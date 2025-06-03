import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ScrollView, SafeAreaView,
  ImageBackground, ActivityIndicator
} from 'react-native';
import {
  getFirestore, collection, addDoc, doc, setDoc
} from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';

export default function CreateProject() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [locationCoords, setLocationCoords] = useState(null);
  const [workers, setWorkers] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigation = useNavigation();
  const db = getFirestore();

  const openSelectWorkers = () => {
    navigation.navigate('SelectWorker', {
      draftMode: true,
      preselected: workers,
      onWorkersReady: setWorkers
    });
  };

  const openSelectLocation = () => {
    navigation.navigate('SelectLocation', {
      onLocationSelected: setLocationCoords
    });
  };

  const handleSubmit = async () => {
    if (!name || !description || !locationCoords) {
      Alert.alert('Error', 'Por favor complete todos los campos');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const projectData = {
        name,
        description,
        location: locationCoords,
        images: [],
        status: 'activo',
        createdAt: new Date().toISOString()
      };
      
      const projRef = await addDoc(collection(db, 'proyectos'), projectData);

      const batchPromises = workers.map(w =>
        setDoc(
          doc(db, 'proyectos', projRef.id, 'assignments', w.userId),
          { userId: w.userId, role: w.role, assignedAt: new Date().toISOString() }
        )
      );
      
      await Promise.all(batchPromises);

      Alert.alert('Éxito', 'Proyecto creado correctamente');
      navigation.navigate('AdminProjects');
    } catch (error) {
      console.error('Error creating project: ', error);
      Alert.alert('Error', 'Hubo un problema al crear el proyecto');
    } finally {
      setIsSubmitting(false);
    }
  };

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
            {/* Encabezado */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Nuevo Proyecto</Text>
            </View>

            {/* Campos del formulario */}
            <View style={styles.formContainer}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Nombre del proyecto</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ingrese el nombre"
                  placeholderTextColor="#AAAAAA"
                  value={name}
                  onChangeText={setName}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Descripción</Text>
                <TextInput
                  style={[styles.input, styles.multiline]}
                  placeholder="Describa el proyecto"
                  placeholderTextColor="#AAAAAA"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={4}
                />
              </View>

              {/* Selección de ubicación */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Ubicación</Text>
                <TouchableOpacity 
                  style={styles.actionButton} 
                  onPress={openSelectLocation}
                >
                  <MaterialIcons name="location-on" size={20} color="white" />
                  <Text style={styles.actionButtonText}>
                    {locationCoords ? 'Cambiar ubicación' : 'Seleccionar ubicación'}
                  </Text>
                </TouchableOpacity>
                
                {locationCoords && (
                  <View style={styles.locationPreview}>
                    <Feather name="map-pin" size={16} color="#3498db" />
                    <Text style={styles.locationText}>
                      {locationCoords.latitude.toFixed(4)}, {locationCoords.longitude.toFixed(4)}
                    </Text>
                  </View>
                )}
              </View>

              {/* Selección de trabajadores */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Trabajadores asignados</Text>
                <TouchableOpacity 
                  style={[styles.actionButton, { backgroundColor: '#f39c12' }]} 
                  onPress={openSelectWorkers}
                >
                  <Ionicons name="people" size={20} color="white" />
                  <Text style={styles.actionButtonText}>
                    {workers.length > 0 ? 'Modificar selección' : 'Seleccionar trabajadores'}
                  </Text>
                </TouchableOpacity>
                
                {workers.length > 0 && (
                  <View style={styles.selectedWorkersContainer}>
                    {workers.map(w => (
                      <View key={w.userId} style={styles.workerItem}>
                        <Text style={styles.workerName}>• {w.nombre}</Text>
                        <Text style={styles.workerRole}>{w.role}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>

            {/* Botón de envío */}
            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.disabledButton]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialIcons name="add-circle" size={24} color="#FFFFFF" />
                  <Text style={styles.submitButtonText}>CREAR PROYECTO</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  container: {
    flex: 1,
    padding: 15,
  },
  header: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 25,
    padding: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  formContainer: {
    backgroundColor: 'rgba(30, 30, 30, 0.7)',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
  },
  multiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3498db',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  actionButtonText: {
    color: '#FFFFFF',
    marginLeft: 10,
    fontSize: 16,
    fontWeight: '500',
  },
  locationPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 10,
    borderRadius: 8,
  },
  locationText: {
    color: '#3498db',
    marginLeft: 8,
    fontSize: 14,
  },
  selectedWorkersContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 10,
  },
  workerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  workerName: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  workerRole: {
    color: '#CCCCCC',
    fontSize: 14,
    fontStyle: 'italic',
  },
  submitButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2ecc71',
    padding: 15,
    borderRadius: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  disabledButton: {
    backgroundColor: '#7f8c8d',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 10,
  },
});