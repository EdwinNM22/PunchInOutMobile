import React, { useState } from 'react';
import {
  Text, View, TextInput, TouchableOpacity,
  Alert, StyleSheet, SafeAreaView,
  ImageBackground, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import appFirebase from '../credenciales';

const auth = getAuth(appFirebase);
const db = getFirestore(appFirebase);
const secondaryApp = initializeApp(appFirebase.options, 'Secondary');
const secondaryAuth = getAuth(secondaryApp);

export default function Register({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [showCredentials, setShowCredentials] = useState(false);
  const [credenciales, setCredenciales] = useState({ email: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);

  const registrar = async () => {
    if (!nombre || !email || !password) {
      Alert.alert('Error', 'Por favor complete todos los campos');
      return;
    }

    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const user = userCredential.user;

      await setDoc(doc(db, "usuarios", user.uid), {
        nombre: nombre,
        email: email,
        rol: 'WORKER',
        createdAt: new Date().toISOString()
      });

      setCredenciales({ email, password });
      setShowCredentials(true);
      setNombre('');
      setEmail('');
      setPassword('');
      
      Alert.alert('Éxito', 'Usuario registrado correctamente');
    } catch (error) {
      console.error(error);
      let errorMessage = 'Hubo un problema con el registro';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'El correo electrónico ya está en uso';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'La contraseña debe tener al menos 6 caracteres';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'El correo electrónico no es válido';
      }
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
      await signOut(secondaryAuth);
    }
  };

  const copiarCredenciales = () => {
    const texto = `Email: ${credenciales.email}\nContraseña: ${credenciales.password}`;
    Clipboard.setString(texto);
    Alert.alert('Copiado', 'Las credenciales han sido copiadas al portapapeles');
  };

  return (
    <ImageBackground
      source={require('../assets/fondo8.jpg')}
      style={{ flex: 1 }}
      resizeMode="cover"
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          <View style={styles.formContainer}>
            {/* Encabezado */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Registrar Nuevo Usuario</Text>
            </View>

            {/* Campos del formulario */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Nombre completo</Text>
              <TextInput
                style={styles.input}
                placeholder="Ingrese el nombre completo"
                placeholderTextColor="#AAAAAA"
                value={nombre}
                onChangeText={setNombre}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Correo electrónico</Text>
              <TextInput
                style={styles.input}
                placeholder="Ingrese el correo electrónico"
                placeholderTextColor="#AAAAAA"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Contraseña</Text>
              <TextInput
                style={styles.input}
                placeholder="Ingrese la contraseña"
                placeholderTextColor="#AAAAAA"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            {/* Botón de registro */}
            <TouchableOpacity 
              style={[styles.registerButton, isLoading && styles.disabledButton]}
              onPress={registrar}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialIcons name="person-add" size={20} color="#FFFFFF" />
                  <Text style={styles.registerButtonText}>REGISTRAR USUARIO</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Botón para volver */}
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.navigate('AdminDashboard')}
            >
              <Ionicons name="arrow-back" size={20} color="#3498db" />
              <Text style={styles.backButtonText}>VOLVER AL PANEL</Text>
            </TouchableOpacity>

            {/* Cuadro de credenciales */}
            {showCredentials && (
              <View style={styles.credentialsBox}>
                <Text style={styles.credentialsTitle}>Credenciales creadas</Text>
                <View style={styles.credentialsContent}>
                  <View style={styles.credentialItem}>
                    <MaterialIcons name="email" size={18} color="#3498db" />
                    <Text style={styles.credentialText}>{credenciales.email}</Text>
                  </View>
                  <View style={styles.credentialItem}>
                    <MaterialIcons name="lock" size={18} color="#3498db" />
                    <Text style={styles.credentialText}>{credenciales.password}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.copyButton}
                  onPress={copiarCredenciales}
                >
                  <Ionicons name="copy" size={16} color="#FFFFFF" />
                  <Text style={styles.copyButtonText}>COPIAR CREDENCIALES</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  formContainer: {
    backgroundColor: 'rgba(30, 30, 30, 0.7)',
    borderRadius: 10,
    padding: 20,
    marginHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  inputContainer: {
    marginBottom: 15,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
  },
  registerButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2ecc71',
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  disabledButton: {
    backgroundColor: '#7f8c8d',
  },
  registerButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 10,
  },
  backButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 15,
    marginTop: 10,
  },
  backButtonText: {
    color: '#3498db',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 10,
  },
  credentialsBox: {
    marginTop: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 8,
    padding: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
  },
  credentialsTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  credentialsContent: {
    marginBottom: 15,
  },
  credentialItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  credentialText: {
    color: '#FFFFFF',
    marginLeft: 10,
    fontSize: 14,
  },
  copyButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#3498db',
    padding: 12,
    borderRadius: 8,
  },
  copyButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 10,
  },
});