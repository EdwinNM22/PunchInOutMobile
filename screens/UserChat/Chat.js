import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Image,
  SafeAreaView
} from 'react-native';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, doc, getDocs, onSnapshot, addDoc, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import appFirebase from '../../credenciales';

const auth = getAuth(appFirebase);
const db = getFirestore(appFirebase);

const getChatId = (uid1, uid2) => [uid1, uid2].sort().join('_');

export default function ChatScreen() {
  const [usuarios, setUsuarios] = useState([]);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [mensaje, setMensaje] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({});
  const flatListRef = useRef(null);

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
    if (usuarioSeleccionado) {
      const chatId = getChatId(currentUser.uid, usuarioSeleccionado.id);
      const mensajesRef = collection(db, 'chats', chatId, 'mensajes');
      const q = query(mensajesRef, orderBy('createdAt', 'asc'));
      
      getDocs(q).then(snapshot => {
        const msgs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
        }));
        setMensajes(msgs);
        setRefreshing(false);
      }).catch(err => {
        console.error("Error al refrescar mensajes:", err);
        setRefreshing(false);
      });
    } else {
      traerUsuarios();
    }
  };

  useEffect(() => {
    if (currentUser) {
      traerUsuarios();
    }
  }, [currentUser]);

  useEffect(() => {
    if (!usuarioSeleccionado || !currentUser) return;
    
    setLoading(true);
    const chatId = getChatId(currentUser.uid, usuarioSeleccionado.id);
    const mensajesRef = collection(db, 'chats', chatId, 'mensajes');
    const q = query(mensajesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(
      q, 
      (snapshot) => {
        const msgs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
        }));
        setMensajes(msgs);
        setError(null);
        setLoading(false);
        
        if (flatListRef.current && msgs.length > 0) {
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
        
        markMessagesAsRead(usuarioSeleccionado.id);
      },
      (err) => {
        console.error("Error en la suscripción a mensajes:", err);
        setError("Error al cargar mensajes. Intenta nuevamente.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [usuarioSeleccionado, currentUser]);

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
        if (!usuarioSeleccionado || usuarioSeleccionado.id !== user.id) {
          setUnreadCounts(prev => ({
            ...prev,
            [user.id]: snapshot.size
          }));
        }
      });
    });
    
    return () => unsubscribes.forEach(unsub => unsub());
  }, [usuarios, usuarioSeleccionado, currentUser]);

  const enviarMensaje = async () => {
    if (!mensaje.trim() || !usuarioSeleccionado || !currentUser) return;
    
    try {
      const chatId = getChatId(currentUser.uid, usuarioSeleccionado.id);
      await addDoc(collection(db, 'chats', chatId, 'mensajes'), {
        texto: mensaje,
        senderId: currentUser.uid,
        createdAt: serverTimestamp(),
        leido: false
      });
      setMensaje('');
    } catch (err) {
      console.error("Error al enviar mensaje:", err);
      setError("Error al enviar mensaje. Intenta nuevamente.");
    }
  };

  if (!currentUser) {
    return (
      <SafeAreaView style={styles.authContainer}>
        <MaterialIcons name="error-outline" size={50} color="#FF3B30" />
        <Text style={styles.authText}>Debes iniciar sesión para usar el chat</Text>
      </SafeAreaView>
    );
  }

  if (loading && !usuarioSeleccionado) {
    return (
      <SafeAreaView style={styles.loadingFullContainer}>
        <ActivityIndicator size="large" color="#5E35B1" />
        <Text style={styles.loadingText}>Cargando contactos...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
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
    );
  }

  if (!usuarioSeleccionado) {
    return (
      <SafeAreaView style={styles.usersContainer}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mensajes</Text>
        </View>
        
        <FlatList
          data={usuarios}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => {
                setUsuarioSeleccionado(item);
                markMessagesAsRead(item.id);
              }}
              style={styles.userItem}
            >
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {item.nombre?.charAt(0).toUpperCase() || 'U'}
                </Text>
              </View>
              
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{item.nombre}</Text>
                <Text style={styles.userEmail}>{item.email}</Text>
              </View>
              
              {unreadCounts[item.id] > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>{unreadCounts[item.id]}</Text>
                </View>
              )}
              
              <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={60} color="#C7C7CC" />
              <Text style={styles.emptyText}>No hay otros usuarios disponibles</Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#5E35B1']}
              tintColor="#5E35B1"
            />
          }
          contentContainerStyle={styles.listContent}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.flexContainer}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flexContainer}
        keyboardVerticalOffset={90}
      >
        <View style={styles.chatHeader}>
          <TouchableOpacity 
            onPress={() => setUsuarioSeleccionado(null)}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#5E35B1" />
          </TouchableOpacity>
          
          <View style={styles.chatUserInfo}>
            <View style={styles.chatAvatar}>
              <Text style={styles.chatAvatarText}>
                {usuarioSeleccionado.nombre?.charAt(0).toUpperCase() || 'U'}
              </Text>
            </View>
            <Text style={styles.chatTitle}>{usuarioSeleccionado.nombre}</Text>
          </View>
          
          <View style={styles.headerRightPlaceholder} />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#5E35B1" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={mensajes}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <View
                style={[
                  styles.messageContainer,
                  item.senderId === currentUser.uid 
                    ? styles.myMessageContainer 
                    : styles.theirMessageContainer
                ]}
              >
                <View
                  style={[
                    styles.messageBubble,
                    item.senderId === currentUser.uid 
                      ? styles.myMessage 
                      : styles.theirMessage
                  ]}
                >
                  <Text style={[
                    styles.messageText,
                    item.senderId === currentUser.uid && styles.myMessageText
                  ]}>
                    {item.texto}
                  </Text>
                  <View style={styles.messageTimeContainer}>
                    <Text style={[
                      styles.messageTime,
                      item.senderId === currentUser.uid && styles.myMessageTime
                    ]}>
                      {item.createdAt?.toLocaleTimeString?.([], { hour: '2-digit', minute: '2-digit' }) || ''}
                    </Text>
                    {!item.leido && item.senderId === currentUser.uid && (
                      <Ionicons 
                        name="checkmark-done" 
                        size={14} 
                        color={item.leido ? '#5E35B1' : '#C7C7CC'} 
                        style={styles.readIcon}
                      />
                    )}
                  </View>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyMessages}>
                <Ionicons name="chatbubbles-outline" size={60} color="#E5E5EA" />
                <Text style={styles.emptyMessagesText}>No hay mensajes todavía</Text>
                <Text style={styles.emptyMessagesSubText}>Envía el primer mensaje para iniciar la conversación</Text>
              </View>
            }
            contentContainerStyle={styles.messagesContainer}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={['#5E35B1']}
                tintColor="#5E35B1"
              />
            }
          />
        )}

        <View style={styles.inputContainer}>
          <TextInput
            placeholder="Escribe un mensaje..."
            placeholderTextColor="#8E8E93"
            value={mensaje}
            onChangeText={setMensaje}
            style={styles.input}
            multiline
            onSubmitEditing={enviarMensaje}
          />
          <TouchableOpacity 
            onPress={enviarMensaje} 
            style={[
              styles.sendButton,
              !mensaje.trim() && styles.sendButtonDisabled
            ]}
            disabled={!mensaje.trim()}
          >
            <Ionicons 
              name="send" 
              size={24} 
              color={mensaje.trim() ? "#FFFFFF" : "#C7C7CC"} 
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flexContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF'
  },
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20
  },
  authText: {
    fontSize: 18,
    color: '#1C1C1E',
    marginTop: 20,
    textAlign: 'center'
  },
  loadingFullContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF'
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#8E8E93'
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20
  },
  errorText: {
    fontSize: 16,
    color: '#1C1C1E',
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
  usersContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF'
  },
  header: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E'
  },
  listContent: {
    paddingBottom: 15
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA'
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#5E35B1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600'
  },
  userInfo: {
    flex: 1
  },
  userName: {
    fontSize: 17,
    fontWeight: '500',
    color: '#1C1C1E',
    marginBottom: 3
  },
  userEmail: {
    fontSize: 14,
    color: '#8E8E93'
  },
  unreadBadge: {
    backgroundColor: '#FF3B30',
    borderRadius: 50,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10
  },
  unreadText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 5
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 15,
    textAlign: 'center'
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA'
  },
  backButton: {
    marginRight: 15
  },
  chatUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  chatAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#5E35B1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10
  },
  chatAvatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600'
  },
  chatTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E'
  },
  headerRightPlaceholder: {
    width: 24
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  messagesContainer: {
    padding: 15,
    paddingBottom: 5
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 10
  },
  myMessageContainer: {
    justifyContent: 'flex-end'
  },
  theirMessageContainer: {
    justifyContent: 'flex-start'
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 18
  },
  myMessage: {
    backgroundColor: '#5E35B1',
    borderBottomRightRadius: 3
  },
  theirMessage: {
    backgroundColor: '#E5E5EA',
    borderBottomLeftRadius: 3
  },
  messageText: {
    fontSize: 16,
    color: '#1C1C1E',
    lineHeight: 22
  },
  myMessageText: {
    color: '#FFFFFF'
  },
  messageTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 5
  },
  messageTime: {
    fontSize: 12,
    color: '#8E8E93'
  },
  myMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)'
  },
  readIcon: {
    marginLeft: 5
  },
  emptyMessages: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40
  },
  emptyMessagesText: {
    fontSize: 18,
    color: '#1C1C1E',
    marginTop: 15,
    fontWeight: '500'
  },
  emptyMessagesSubText: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 5,
    textAlign: 'center'
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    backgroundColor: '#FFFFFF'
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    maxHeight: 100,
    fontSize: 16,
    backgroundColor: '#F2F2F7'
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#5E35B1',
    justifyContent: 'center',
    alignItems: 'center'
  },
  sendButtonDisabled: {
    backgroundColor: '#E5E5EA'
  }
});