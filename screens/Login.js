import React, { useState, useEffect } from 'react';  
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ImageBackground,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import appFirebase from '../credenciales';
import { registerForPushToken } from '../utils/pushRegistrations';

const auth = getAuth(appFirebase);
const db = getFirestore(appFirebase);

const Login = (props) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [isFirstTime, setIsFirstTime] = useState(true);

  useEffect(() => {
    checkBiometricAvailability();
    checkSavedCredentials();
  }, []);

  const checkBiometricAvailability = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    setIsBiometricAvailable(compatible && enrolled);
  };

  const checkSavedCredentials = async () => {
    try {
      const savedEmail = await SecureStore.getItemAsync('userEmail');
      const savedPassword = await SecureStore.getItemAsync('userPassword');
      
      if (savedEmail && savedPassword) {
        setEmail(savedEmail);
        setIsFirstTime(false);
        
        if (isBiometricAvailable) {
          handleBiometricAuth();
        }
      }
    } catch (error) {
      console.error('Error al recuperar credenciales:', error);
    }
  };

  const handleBiometricAuth = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Autentícate con tu huella',
        cancelLabel: 'Cancelar',
        disableDeviceFallback: true,
      });

      if (result.success) {
        const savedPassword = await SecureStore.getItemAsync('userPassword');
        if (email && savedPassword) {
          await loginUser(email, savedPassword);
        } else {
          Alert.alert('Error', 'No se encontraron credenciales guardadas');
        }
      } else {
        Alert.alert('Autenticación fallida', 'No se pudo verificar tu identidad');
      }
    } catch (error) {
      console.error('Error en autenticación biométrica:', error);
      Alert.alert('Error', 'Ocurrió un error durante la autenticación');
    }
  };

  const loginUser = async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (isFirstTime) {
        await SecureStore.setItemAsync('userEmail', email);
        await SecureStore.setItemAsync('userPassword', password);
        setIsFirstTime(false);
      }

      const docRef = doc(db, "usuarios", user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const rol = docSnap.data().rol;
        navigateByRole(rol);
        await registerForPushToken(user.uid);
      } else {
        Alert.alert('Error', 'No se encontró el perfil del usuario');
      }
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      Alert.alert('Error', 'Credenciales incorrectas o problema de conexión');
    }
  };

  const navigateByRole = (rol) => {
    if (rol === 'ADMIN') {
      props.navigation.navigate('AdminDashboard');
    } else {
      props.navigation.navigate('UserProjects');
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Por favor ingresa email y contraseña');
      return;
    }
    await loginUser(email, password);
  };

  const handleUseAnotherAccount = () => {
    SecureStore.deleteItemAsync('userEmail');
    SecureStore.deleteItemAsync('userPassword');
    setEmail('');
    setPassword('');
    setIsFirstTime(true);
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={{ flex: 1 }}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ImageBackground 
          source={require('../assets/login.jpg')} 
          style={{ flex: 1 }}
          resizeMode="cover"
        >
          <View style={styles.overlay}>
            <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
              <View style={styles.innerContainer}>
                <Image 
                  source={require('../assets/biovizion.jpg')}
                  style={styles.logo}
                  resizeMode="contain"
                />
                
                <Text style={styles.title}>Iniciar Sesión</Text>

                {isFirstTime && (
                  <>
                    <TextInput
                      style={styles.input}
                      placeholder="Correo electrónico"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      placeholderTextColor="#aaa"
                    />

                    <TextInput
                      style={styles.input}
                      placeholder="Contraseña"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      placeholderTextColor="#aaa"
                    />

                    <TouchableOpacity style={styles.button} onPress={handleLogin}>
                      <Text style={styles.buttonText}>Iniciar sesión</Text>
                    </TouchableOpacity>
                  </>
                )}

                {!isFirstTime && isBiometricAvailable && (
                  <>
                    <TouchableOpacity 
                      style={styles.biometricButton} 
                      onPress={handleBiometricAuth}
                    >
                      <Text style={styles.biometricButtonText}>Iniciar Sesión</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.secondaryButton} 
                      onPress={handleUseAnotherAccount}
                    >
                      <Text style={styles.secondaryButtonText}>Iniciar con otra cuenta</Text>
                    </TouchableOpacity>
                  </>
                )}

                {!isFirstTime && !isBiometricAvailable && (
                  <TouchableOpacity 
                    style={styles.button} 
                    onPress={() => setIsFirstTime(true)}
                  >
                    <Text style={styles.buttonText}>Ingresar con email y contraseña</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </View>
        </ImageBackground>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = {
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  innerContainer: {
    justifyContent: 'center',
  },
  logo: {
    width: 900,
    height: 150,
    alignSelf: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#E53935',
    marginBottom: 30,
    textAlign: 'center',
    textShadowColor: 'rgba(229, 57, 53, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  input: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    color: '#FFFFFF',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E53935',
  },
  button: {
    backgroundColor: 'rgba(255, 0, 0, 0.77)',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    elevation: 3,
    shadowColor: '#E53935',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  biometricButton: {
    backgroundColor: '#1E1E1E',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E53935',
  },
  biometricButtonText: {
    color: '#E53935',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryButtonText: {
    color: '#E53935',
    fontSize: 16,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
};

export default Login;
