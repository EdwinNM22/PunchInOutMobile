import React, { useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform, RefreshControl, SafeAreaView, ImageBackground } from 'react-native';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, doc, addDoc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where, getDocs } from 'firebase/firestore';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import appFirebase from '../../credenciales';

const auth = getAuth(appFirebase);
const db = getFirestore(appFirebase);

const getChatId = (uid1, uid2) => [uid1, uid2].sort().join('_');

export default function MessageScreen({ route, navigation }) {
  const { user } = route.params;
  const [mensajes, setMensajes] = useState([]);
  const [mensaje, setMensaje] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const flatListRef = useRef(null);

  const currentUser = auth.currentUser;

  const markMessagesAsRead = async () => {
    if (!currentUser || !user?.id) return;
    
    try {
      const chatId = getChatId(currentUser.uid, user.id);
      const unreadQuery = query(
        collection(db, 'chats', chatId, 'mensajes'),
        where('senderId', '==', user.id),
        where('leido', '==', false)
      );
      
      const unreadSnapshot = await getDocs(unreadQuery);
      const batchUpdates = unreadSnapshot.docs.map(docSnap => 
        updateDoc(doc(db, 'chats', chatId, 'mensajes', docSnap.id), {
          leido: true
        })
      );
      
      await Promise.all(batchUpdates);
    } catch (err) {
      console.error("Error al marcar mensajes como leídos:", err);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    const chatId = getChatId(currentUser.uid, user.id);
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
  };

  useEffect(() => {
    if (!user || !currentUser) return;
    
    setLoading(true);
    const chatId = getChatId(currentUser.uid, user.id);
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
        
        markMessagesAsRead();
      },
      (err) => {
        console.error("Error en la suscripción a mensajes:", err);
        setError("Error al cargar mensajes. Intenta nuevamente.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, currentUser]);

  const enviarMensaje = async () => {
    if (!mensaje.trim() || !user || !currentUser) return;
    
    try {
      const chatId = getChatId(currentUser.uid, user.id);
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

  useEffect(() => {
    navigation.setOptions({
      title: user.nombre || 'Chat',
      headerLeft: () => (
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={{ marginLeft: 15 }}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      ),
      headerTitleStyle: {
        color: '#FFFFFF',
      },
    });
  }, [navigation, user]);

  if (loading) {
    return (
      <ImageBackground
        source={require("../../assets/fondo8.jpg")}
        style={{ flex: 1 }}
        resizeMode="cover"
      >
        <SafeAreaView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#5E35B1" />
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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.flexContainer}
          keyboardVerticalOffset={90}
        >
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
                <Ionicons name="chatbubbles-outline" size={60} color="#AAAAAA" />
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
                colors={['#FFFFFF']}
                tintColor="#FFFFFF"
              />
            }
          />

          <View style={styles.inputContainer}>
            <TextInput
              placeholder="Escribe un mensaje..."
              placeholderTextColor="#AAAAAA"
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
                color={mensaje.trim() ? "#FFFFFF" : "#AAAAAA"} 
              />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  flexContainer: {
    flex: 1,
  },
  loadingContainer: {
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
  messagesContainer: {
    padding: 20,
    paddingBottom: 10
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 15
  },
  myMessageContainer: {
    justifyContent: 'flex-end'
  },
  theirMessageContainer: {
    justifyContent: 'flex-start'
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 15,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2
  },
  myMessage: {
    backgroundColor: 'rgba(223, 20, 20, 0.73)',
    borderBottomRightRadius: 3
  },
  theirMessage: {
    backgroundColor: 'rgba(255, 255, 255, 0.73)',
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
    color: 'rgba(0, 0, 0, 0.5)'
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
    padding: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 10,
    margin: 20
  },
  emptyMessagesText: {
    fontSize: 18,
    color: '#FFFFFF',
    marginTop: 15,
    fontWeight: '500'
  },
  emptyMessagesSubText: {
    fontSize: 14,
    color: '#AAAAAA',
    marginTop: 5,
    textAlign: 'center'
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: 'rgba(30, 30, 30, 0.7)',
    margin: 15,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)'
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    maxHeight: 100,
    fontSize: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: '#FFFFFF'
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)'
  }
});