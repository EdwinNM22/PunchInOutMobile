import React, { useState, useEffect } from 'react';  
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import appFirebase from '../credenciales';
import styles from '../Styles/LoginStyle';
import { registerForPushToken } from '../utils/pushRegistrations';

const auth = getAuth(appFirebase);
const db = getFirestore(appFirebase);

export default function Login(props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [isFirstTime, setIsFirstTime] = useState(true);

  // Verificar si la autenticación biométrica está disponible
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
        
        // Intentar autenticación biométrica automáticamente
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
        // Obtener credenciales guardadas
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

      // Guardar credenciales solo si es el primer inicio de sesión
      if (isFirstTime) {
        await SecureStore.setItemAsync('userEmail', email);
        await SecureStore.setItemAsync('userPassword', password);
        setIsFirstTime(false);
      }

      // Obtener el rol del usuario
      const docRef = doc(db, "usuarios", user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const rol = docSnap.data().rol;
        navigateByRole(rol);
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
    await registerForPushToken(user.uid);
  };

  const handleUseAnotherAccount = () => {
    // Limpiar credenciales almacenadas y mostrar formulario
    SecureStore.deleteItemAsync('userEmail');
    SecureStore.deleteItemAsync('userPassword');
    setEmail('');
    setPassword('');
    setIsFirstTime(true);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Iniciar sesión</Text>

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
          <TouchableOpacity style={styles.biometricButton} onPress={handleBiometricAuth}>
            <Text style={styles.buttonText}>Iniciar con huella</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, { marginTop: 15, backgroundColor: '#f1f1f1' }]} 
            onPress={handleUseAnotherAccount}
          >
            <Text style={[styles.buttonText, { color: '#4285F4' }]}>Iniciar con otra cuenta</Text>
          </TouchableOpacity>
        </>
      )}

      {!isFirstTime && !isBiometricAvailable && (
        <TouchableOpacity style={styles.button} onPress={() => setIsFirstTime(true)}>
          <Text style={styles.buttonText}>Ingresar con email y contraseña</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}