// screens/CreateProject.js
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ScrollView
} from 'react-native';
import {
  getFirestore, collection, addDoc, doc, setDoc
} from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';

export default function CreateProject() {

  // estado del formulario
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [locationCoords, setLocationCoords] = useState(null);

  // lista de los trabajadores seleccionados
  const [workers, setWorkers] = useState([]); // [{userId, nombre, role}]

  const navigation = useNavigation();
  const db = getFirestore();

  const openSelectWorkers = () => {
    navigation.navigate('SelectWorker', {
      draftMode: true,     // indica que venimos del flujo “nuevo proyecto”
      preselected: workers,  // conserva lo elegido si volvemos
      onWorkersReady: setWorkers
    });
  };

  const openSelectLocation = () => {
    navigation.navigate('SelectLocation', {
      onLocationSelected: setLocationCoords
    });
  };

  /* ───── submit ───── */
  const handleSubmit = async () => {
    if (!name || !description || !locationCoords) {
      Alert.alert('Error', 'Por favor complete todos los campos');
      return;
    }
    try {
      // 1) crea el proyecto
      const projectData = {
        name,
        description,
        location: locationCoords,
        images: [],
        status: 'activo',
        createdAt: new Date().toISOString()
      };
      const projRef = await addDoc(collection(db, 'proyectos'), projectData);

      // 2) crea la sub‑colección assignments con cada trabajador seleccionado
      const batchPromises = workers.map(w =>
        setDoc(
          doc(db, 'proyectos', projRef.id, 'assignments', w.userId),
          { userId: w.userId, role: w.role, assignedAt: new Date().toISOString() }
        )
      );
      await Promise.all(batchPromises);

      Alert.alert('Éxito', 'Proyecto y asignaciones creados');
      navigation.navigate('AdminProjects');
    } catch (error) {
      console.error('Error creating project: ', error);
      Alert.alert('Error', 'Hubo un problema al crear el proyecto');
    }
  };

  /* ───── UI ───── */
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Crear Proyecto</Text>

      <TextInput
        style={styles.input}
        placeholder="Nombre del proyecto"
        value={name}
        onChangeText={setName}
      />
      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder="Descripción"
        value={description}
        onChangeText={setDescription}
        multiline
      />

      {/* ---------- Seleccionar ubicación ---------- */}
      <TouchableOpacity style={styles.button} onPress={openSelectLocation}>
        <Text style={styles.buttonText}>Seleccionar Ubicación</Text>
      </TouchableOpacity>

      {locationCoords && (
        <Text style={styles.locationText}>
          Ubicación: {locationCoords.latitude.toFixed(4)}, {locationCoords.longitude.toFixed(4)}
        </Text>
      )}

      {/* ---------- NUEVO botón Seleccionar trabajadores ---------- */}
      <TouchableOpacity style={[styles.button, { backgroundColor: '#f39c12' }]}
        onPress={openSelectWorkers}>
        <Text style={styles.buttonText}>Seleccionar trabajadores</Text>
      </TouchableOpacity>

      {workers.length > 0 && (
        <View style={styles.selectedBox}>
          {workers.map(w => (
            <Text key={w.userId} style={styles.workerLine}>
              • {w.nombre}  —  {w.role}
            </Text>
          ))}
        </View>
      )}

      <TouchableOpacity style={styles.button} onPress={handleSubmit}>
        <Text style={styles.buttonText}>Crear Proyecto</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

/* ───── estilos ───── */
const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#f5f5f5', flexGrow: 1 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  input: {
    height: 50, borderColor: '#ddd', borderWidth: 1, borderRadius: 10,
    marginBottom: 15, paddingHorizontal: 10, backgroundColor: '#fff'
  },
  multiline: { height: 100, textAlignVertical: 'top' },
  button: {
    backgroundColor: '#4a76ff', padding: 15, borderRadius: 10,
    alignItems: 'center', marginBottom: 15
  },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  locationText: { marginBottom: 15, fontSize: 16, color: '#333' },

  selectedBox: { backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 15 },
  workerLine: { fontSize: 15, marginVertical: 2 }
});
