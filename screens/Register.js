import { Text, View, TextInput, TouchableOpacity, Alert, Pressable, Clipboard } from 'react-native';
import React, { useState } from 'react';
import appFirebase from '../credenciales';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';

const auth = getAuth(appFirebase);
const db = getFirestore(appFirebase);

// Crear una segunda app de Firebase solo para registrar usuarios sin cerrar la sesión actual
const secondaryApp = initializeApp(appFirebase.options, 'Secondary');
const secondaryAuth = getAuth(secondaryApp);

export default function Register(props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [showCredentials, setShowCredentials] = useState(false);
  const [credenciales, setCredenciales] = useState({ email: '', password: '' });

  const registrar = async () => {
    try {
      // Crear el usuario con la segunda instancia de auth
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const user = userCredential.user;

      // Guardar en Firestore con la instancia principal
      await setDoc(doc(db, "usuarios", user.uid), {
        nombre: nombre,
        email: email,
        rol: 'USER',
      });

      console.log("Usuario guardado con rol USER");

      // Cerrar sesión en la segunda instancia para evitar conflictos
      await signOut(secondaryAuth);

      // Guardar credenciales para mostrarlas
      setCredenciales({
        email: email,
        password: password
      });

      // Mostrar el cuadro de credenciales
      setShowCredentials(true);

      // Limpiar campos
      setNombre('');
      setEmail('');
      setPassword('');

    } catch (error) {
      console.log(error);
      Alert.alert('Error', 'Hubo un problema con el registro');
    }
  };

  const copiarCredenciales = () => {
    const texto = `Email: ${credenciales.email}\nContraseña: ${credenciales.password}`;
    Clipboard.setString(texto);
    Alert.alert('Copiado', 'Las credenciales han sido copiadas al portapapeles');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Regístrate</Text>

      <TextInput
        style={styles.input}
        placeholder="Nombre de usuario"
        value={nombre}
        onChangeText={(text) => setNombre(text)}
        placeholderTextColor="#aaa"
      />

      <TextInput
        style={styles.input}
        placeholder="Correo electrónico"
        value={email}
        onChangeText={(text) => setEmail(text)}
        keyboardType="email-address"
        placeholderTextColor="#aaa"
      />

      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        value={password}
        onChangeText={(text) => setPassword(text)}
        secureTextEntry
        placeholderTextColor="#aaa"
      />

      <TouchableOpacity style={styles.button} onPress={registrar}>
        <Text style={styles.buttonText}>Registrar</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={() => props.navigation.navigate('AdminDashboard')}>
        <Text style={styles.buttonText}>Volver al Dashboard</Text>
      </TouchableOpacity>

      {/* Cuadro de credenciales que aparece después del registro */}
      {showCredentials && (
        <View style={styles.credentialsBox}>
          <Text style={styles.credentialsTitle}>Credenciales creadas:</Text>

          <View style={styles.credentialsInfo}>
            <Text style={styles.credentialsText}>
              <Text style={styles.credentialsLabel}>Email: </Text>
              {credenciales.email}
            </Text>
            <Text style={styles.credentialsText}>
              <Text style={styles.credentialsLabel}>Contraseña: </Text>
              {credenciales.password}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.copyButton}
            onPress={copiarCredenciales}
          >
            <Text style={styles.copyButtonText}>Copiar Credenciales</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = {
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  input: {
    height: 50,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 15,
    marginBottom: 15,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  button: {
    backgroundColor: '#3498db',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginBottom: 15,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  credentialsBox: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  credentialsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
    textAlign: 'center',
  },
  credentialsInfo: {
    marginBottom: 15,
  },
  credentialsText: {
    fontSize: 14,
    marginBottom: 5,
    color: '#495057',
  },
  credentialsLabel: {
    fontWeight: 'bold',
    color: '#212529',
  },
  copyButton: {
    backgroundColor: '#2196F3',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  copyButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
};
