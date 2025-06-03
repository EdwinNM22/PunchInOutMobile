import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getAuth } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import appFirebase from '../credenciales';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

const auth = getAuth(appFirebase);
const storage = getStorage(appFirebase);
const db = getFirestore(appFirebase);

export default function UploadProfilePhoto() {
  const [image, setImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const requestPermissions = async () => {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (cameraStatus !== 'granted' || libraryStatus !== 'granted') {
      Alert.alert(
        'Permisos requeridos',
        'Necesitamos permisos para acceder a la cámara y la galería para subir fotos.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  const selectImage = async (source) => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      let result;
      if (source === 'camera') {
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.7,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.7,
        });
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const manipulatedImage = await manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 800 } }],
          { compress: 0.7, format: SaveFormat.JPEG }
        );
        setImage(manipulatedImage.uri);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo seleccionar la imagen: ' + error.message);
    }
  };

  const uploadImage = async () => {
    if (!image) {
      Alert.alert('Error', 'Por favor selecciona una imagen primero');
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Usuario no autenticado');

      // Obtener blob desde URI con fetch
      const response = await fetch(image);
      const originalBlob = await response.blob();

      // Crear un nuevo blob con tipo MIME explícito para evitar errores
      const blob = new Blob([originalBlob], { type: 'image/jpeg' });

      const storageRef = ref(storage, `profilePhotos/${user.uid}_${Date.now()}.jpg`);

      // Subir el blob
      await uploadBytes(storageRef, blob);

      const downloadURL = await getDownloadURL(storageRef);

      const userDocRef = doc(db, 'usuarios', user.uid);
      await updateDoc(userDocRef, {
        photoURL: downloadURL,
        lastPhotoUpdate: new Date().toISOString(),
      });

      Alert.alert('Éxito', 'Foto de perfil actualizada correctamente');
      setImage(null);
    } catch (error) {
      console.error('Error al subir:', error);
      Alert.alert(
        'Error',
        error.message || 'Ocurrió un error al subir la foto. Por favor inténtalo de nuevo.'
      );
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Actualizar Foto de Perfil</Text>

      {image ? (
        <Image source={{ uri: image }} style={styles.imagePreview} />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>No hay imagen seleccionada</Text>
        </View>
      )}

      <View style={styles.buttonGroup}>
        <TouchableOpacity
          onPress={() => selectImage('camera')}
          style={[styles.button, styles.cameraButton]}
          disabled={uploading}
        >
          <Text style={styles.buttonText}>Tomar Foto</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => selectImage('library')}
          style={[styles.button, styles.galleryButton]}
          disabled={uploading}
        >
          <Text style={styles.buttonText}>Elegir de Galería</Text>
        </TouchableOpacity>
      </View>

      {uploading && (
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            Subiendo... {Math.round(progress * 100)}%
          </Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
        </View>
      )}

      <TouchableOpacity
        onPress={uploadImage}
        style={[styles.button, styles.uploadButton]}
        disabled={uploading || !image}
      >
        {uploading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Subir Foto</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  imagePreview: {
    width: 200,
    height: 200,
    borderRadius: 100,
    alignSelf: 'center',
    marginBottom: 20,
  },
  placeholder: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  placeholderText: {
    color: '#888',
    fontSize: 16,
  },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  cameraButton: {
    backgroundColor: '#007bff',
  },
  galleryButton: {
    backgroundColor: '#28a745',
  },
  uploadButton: {
    backgroundColor: '#6f42c1',
    alignSelf: 'center',
    width: 200,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
  progressContainer: {
    marginBottom: 10,
  },
  progressText: {
    textAlign: 'center',
    marginBottom: 5,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#eee',
    borderRadius: 4,
    overflow: 'hidden',
    marginHorizontal: 40,
  },
  progressFill: {
    height: 8,
    backgroundColor: '#6f42c1',
  },
});
