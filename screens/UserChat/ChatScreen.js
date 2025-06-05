import React, { useEffect, useState, useRef,useMemo  } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet, SafeAreaView, RefreshControl,TextInput , ImageBackground } from 'react-native';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, getDocs, query, where, updateDoc, onSnapshot, doc } from 'firebase/firestore';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import appFirebase from '../../credenciales';

const auth = getAuth(appFirebase);
const db = getFirestore(appFirebase);

const CARD_MARGIN = 10;

const getChatId = (uid1, uid2) => [uid1, uid2].sort().join('_');

export default function ChatScreen({ navigation }) {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [searchQuery, setSearchQuery] = useState("");

  const currentUser = auth.currentUser;

  const traerUsuarios = async () => {
    try {
      setLoading(true);
      const querySnapshot = await getDocs(collection(db, "usuarios"));
      const lista = [];
      const counts = {};
      
      querySnapshot.forEach(doc => {
        if (doc.id !== currentUser?.uid) {
          lista.push({ id: doc.id, ...doc.data() });
          counts[doc.id] = 0;
        }
      });
      
      await Promise.all(lista.map(async (user) => {
        const chatId = getChatId(currentUser.uid, user.id);
        const unreadQuery = query(
          collection(db, 'chats', chatId, 'mensajes'),
          where('senderId', '==', user.id),
          where('leido', '==', false)
        );
        
        const unreadSnapshot = await getDocs(unreadQuery);
        counts[user.id] = unreadSnapshot.size;
      }));
      
      setUsuarios(lista);
      setUnreadCounts(counts);
      setError(null);
    } catch (err) {
      console.error("Error al cargar usuarios:", err);
      setError("Error al cargar usuarios. Intenta nuevamente.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const markMessagesAsRead = async (userId) => {
    if (!currentUser || !userId) return;
    
    try {
      const chatId = getChatId(currentUser.uid, userId);
      const unreadQuery = query(
        collection(db, 'chats', chatId, 'mensajes'),
        where('senderId', '==', userId),
        where('leido', '==', false)
      );
      
      const unreadSnapshot = await getDocs(unreadQuery);
      const batchUpdates = unreadSnapshot.docs.map(docSnap => 
        updateDoc(doc(db, 'chats', chatId, 'mensajes', docSnap.id), {
          leido: true
        })
      );
      
      await Promise.all(batchUpdates);
      
      setUnreadCounts(prev => ({
        ...prev,
        [userId]: 0
      }));
    } catch (err) {
      console.error("Error al marcar mensajes como leídos:", err);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    traerUsuarios();
  };

  useEffect(() => {
    if (currentUser) {
      traerUsuarios();
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    
    const unsubscribes = usuarios.map(user => {
      const chatId = getChatId(currentUser.uid, user.id);
      const mensajesRef = collection(db, 'chats', chatId, 'mensajes');
      const q = query(
        mensajesRef,
        where('senderId', '==', user.id),
        where('leido', '==', false)
      );
      
      return onSnapshot(q, (snapshot) => {
        setUnreadCounts(prev => ({
          ...prev,
          [user.id]: snapshot.size
        }));
      });
    });
    
    return () => unsubscribes.forEach(unsub => unsub());
  }, [usuarios, currentUser]);

  const displayedUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return usuarios
      .filter(
        (u) =>
          u.nombre?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q)
      )
      .sort((a, b) =>
        (a.nombre || "").localeCompare(b.nombre || "", "es", {
          sensitivity: "base",
        })
      );
  }, [usuarios, searchQuery]);

  if (!currentUser) {
    return (
      <ImageBackground
        source={require("../../assets/fondo8.jpg")}
        style={{ flex: 1 }}
        resizeMode="cover"
      >
        <SafeAreaView style={styles.authContainer}>
          <MaterialIcons name="error-outline" size={50} color="#FF3B30" />
          <Text style={styles.authText}>Debes iniciar sesión para usar el chat</Text>
        </SafeAreaView>
      </ImageBackground>
    );
  }

  if (loading && !refreshing) {
    return (
      <ImageBackground
        source={require("../../assets/fondo8.jpg")}
        style={{ flex: 1 }}
        resizeMode="cover"
      >
        <SafeAreaView style={styles.loadingFullContainer}>
          <ActivityIndicator size="large" color="#5E35B1" />
          <Text style={styles.loadingText}>Cargando contactos...</Text>
        </SafeAreaView>
      </ImageBackground>
    );
  }

  if (error) {
    return (
      <ImageBackground
        source={require("../../assets/fondo8.jpg")}
        style={{ flex: 1 }}
        resizeMode="cover"
      >
        <SafeAreaView style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={50} color="#FF3B30" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => setError(null)}
          >
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground
      source={require("../../assets/fondo8.jpg")}
      style={{ flex: 1 }}
      resizeMode="cover"
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Mensajes</Text>
            <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
              <Ionicons name="refresh" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Barra de búsqueda */}
          <View style={styles.searchContainer}>
            <Ionicons
              name="search"
              size={20}
              color="#CCCCCC"
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar contacto..."
              placeholderTextColor="#AAAAAA"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
          </View>

          {/* Lista de chats */}
          {refreshing ? (
            <View style={styles.loadingContainer}>
              <Ionicons name="refresh" size={24} color="#FFFFFF" />
              <Text style={styles.loadingText}>Actualizando chats...</Text>
            </View>
          ) : (
            <FlatList
              data={displayedUsers}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    markMessagesAsRead(item.id);
                    navigation.navigate('MessageScreen', { user: item });
                  }}
                  style={styles.userCard}
                >
                  <View style={styles.userInfo}>
                    <View style={styles.userAvatar}>
                      <Text style={styles.userInitials}>
                        {item.nombre?.charAt(0).toUpperCase() || 'U'}
                      </Text>
                    </View>
                    <View style={styles.textContainer}>
                      <Text style={styles.userName}>{item.nombre || "Usuario sin nombre"}</Text>
                      <Text style={styles.userEmail}>{item.email}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.rightContainer}>
                    {unreadCounts[item.id] > 0 && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadText}>{unreadCounts[item.id]}</Text>
                      </View>
                    )}
                    <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="people-outline" size={50} color="#AAAAAA" />
                  <Text style={styles.noProjectsText}>
                    No hay contactos disponibles
                  </Text>
                </View>
              }
              contentContainerStyle={styles.gridContainer}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  colors={['#FFFFFF']}
                  tintColor="#FFFFFF"
                />
              }
            />
          )}
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 25,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    padding: 20,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  refreshButton: {
    padding: 5,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(30, 30, 30, 0.7)",
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 20,
    height: 45,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: "#FFFFFF",
    height: "100%",
  },
  gridContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(18, 18, 18, 0.8)",
  },
  loadingText: {
    color: "#FFFFFF",
    marginTop: 10,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderRadius: 10,
  },
  noProjectsText: {
    textAlign: "center",
    marginTop: 15,
    fontSize: 16,
    color: "#AAAAAA",
  },
  userCard: {
    backgroundColor: "rgba(30, 30, 30, 0.7)",
    padding: 15,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: "rgba(255, 0, 0, 0.7)",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    marginBottom: CARD_MARGIN,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  userInitials: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 16,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  textContainer: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 5,
  },
  userEmail: {
    fontSize: 12,
    color: "#CCCCCC",
    marginBottom: 5,
  },
  rightContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  unreadBadge: {
    backgroundColor: "#E53935",
    borderRadius: 50,
    minWidth: 22,
    height: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  unreadText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 5,
  },
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 20
  },
  authText: {
    fontSize: 18,
    color: '#FFFFFF',
    marginTop: 20,
    textAlign: 'center'
  },
  loadingFullContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)'
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 20
  },
  errorText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginVertical: 20,
    textAlign: 'center'
  },
  retryButton: {
    backgroundColor: '#5E35B1',
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 25
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500'
  },
});