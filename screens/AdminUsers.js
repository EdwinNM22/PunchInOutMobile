// screens/AdminHome.js
import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, SafeAreaView, ScrollView, ActivityIndicator,   ImageBackground, Dimensions
} from 'react-native';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const CARD_MARGIN = 10;
const CARD_WIDTH = (width - 40 - CARD_MARGIN) / 2; // 20 padding horizontal + 10 margin

export default function AdminHome() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const navigation = useNavigation();

  const fetchUsers = async () => {
    setIsRefreshing(true);
    try {
      const db = getFirestore();
      const snap = await getDocs(collection(db, 'usuarios'));
      const list = snap.docs.map(doc => ({
        id: doc.id,
        nombre: doc.data().nombre || 'Sin nombre',
        email: doc.data().email || '',
        iniciales: (doc.data().nombre || 'NN').split(' ').map(n => n[0]).join('').toUpperCase()
      }));
      setUsers(list);
    } catch (e) {
      console.error('Error fetching users:', e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Orden alfabético de toda la lista
  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) =>
      a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
    );
  }, [users]);

  // Filtrado según la query
  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedUsers;
    return sortedUsers.filter(u =>
      u.nombre.toLowerCase().includes(q) || 
      u.email.toLowerCase().includes(q)
    );
  }, [query, sortedUsers]);

  const handleUserClick = (userId) => {
    navigation.navigate('adminGestion', { userId });
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingText}>Cargando usuarios...</Text>
      </View>
    );
  }

  return (
        <ImageBackground
          source={require('../assets/fondo8.jpg')}
          style={{ flex: 1 }}
          resizeMode="cover"
        >
    <SafeAreaView style={styles.safeArea}>
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Gestión de Usuarios</Text>
            <TouchableOpacity 
              onPress={fetchUsers} 
              style={styles.refreshButton}
            >
              <Ionicons name="refresh" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Barra de búsqueda */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color="#AAAAAA" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar trabajador…"
              placeholderTextColor="#AAAAAA"
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
          </View>

          {/* Grid de usuarios */}
          <View style={styles.gridContainer}>
            {filteredUsers.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={50} color="#AAAAAA" />
                <Text style={styles.noProjectsText}>No hay usuarios registrados</Text>
              </View>
            ) : (
              <FlatList
                data={filteredUsers}
                keyExtractor={item => item.id}
                numColumns={2}
                refreshing={isRefreshing}
                onRefresh={fetchUsers}
                scrollEnabled={false}
                columnWrapperStyle={styles.columnWrapper}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.userCard, { width: CARD_WIDTH }]}
                    onPress={() => handleUserClick(item.id)}
                  >
                    <View style={styles.userAvatar}>
                      <Text style={styles.userInitials}>{item.iniciales}</Text>
                    </View>
                    <Text style={styles.userName} numberOfLines={1}>
                      {item.nombre}
                    </Text>
                    <Text style={styles.userEmail} numberOfLines={1}>
                      {item.email}
                    </Text>
                    <View style={styles.viewDetails}>
                      <Text style={styles.detailsText}>
                        Ver <Ionicons name="chevron-forward" size={14} />
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'rgba(18, 18, 18, 0.54)',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(18, 18, 18, 0.8)',
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 10,
  },
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    padding: 20,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  refreshButton: {
    padding: 5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 30, 30, 0.7)',
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
    color: '#FFFFFF',
    height: '100%',
  },
  gridContainer: {
    flex: 1,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: CARD_MARGIN,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 10,
  },
  noProjectsText: {
    textAlign: 'center',
    marginTop: 15,
    fontSize: 16,
    color: '#AAAAAA',
  },
  userCard: {
    backgroundColor: 'rgba(30, 30, 30, 0.7)',
    padding: 15,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#E53935',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    marginRight: CARD_MARGIN,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E53935',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  userInitials: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 5,
  },
  userEmail: {
    fontSize: 12,
    color: '#CCCCCC',
    marginBottom: 10,
  },
  viewDetails: {
    alignSelf: 'flex-start',
  },
  detailsText: {
    color: '#E53935',
    fontSize: 12,
    fontWeight: '500',
  },
});