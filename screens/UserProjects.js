// screens/UserProjects.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Linking, SafeAreaView, ScrollView } from 'react-native';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, getDocs, query, where, doc, getDoc, setDoc } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Alert } from 'react-native';  // fallback

export default function UserProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const auth = getAuth();
  const db = getFirestore();
  const navigation = useNavigation();

  useEffect(() => {
    fetchAssignedProjects();
  }, []);

  const fetchAssignedProjects = async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        setProjects([]);
        setLoading(false);
        return;
      }

      const proyectosRef = collection(db, 'proyectos');
      const q = query(proyectosRef, where('status', '==', 'activo'));
      const projectsSnap = await getDocs(q);

      const assigned = [];

      for (const projectDoc of projectsSnap.docs) {
        const assignmentRef = doc(db, 'proyectos', projectDoc.id, 'assignments', user.uid);
        const assignmentSnap = await getDoc(assignmentRef);

        if (assignmentSnap.exists()) {
          assigned.push({ id: projectDoc.id, ...projectDoc.data() });
        }
      }

      setProjects(assigned);
    } catch (error) {
      console.error('Error fetching assigned projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProjectPress = (project) => {
    navigation.navigate('UserProjectDetail', { project });
  };

  const getUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert('Se necesitan permisos para acceder a la ubicación');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setUserLocation(location);

      const user = auth.currentUser;
      if (user) {
        const docRef = doc(db, 'usuarios', user.uid, 'locations', new Date().toISOString());
        await setDoc(docRef, {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          timestamp: new Date().toISOString(),
        });
        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Ubicación enviada',
              body: 'Su ubicación ha sido enviada al administrador.',
            },
            trigger: null, // se manda la notificación inmediatamente
          });
        } catch (e) {
          // si no hay notificaciones, se muestra una alerta
          Alert.alert(
            'Ubicación enviada',
            'Su ubicación ha sido enviada al administrador.'
          );
        }
      }
    } catch (error) {
      console.error('Error getting location:', error);
      alert('Error al obtener la ubicación');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text>Cargando proyectos...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.container}>
          <TouchableOpacity
            style={styles.locationButton}
            onPress={getUserLocation}
          >
            <Ionicons name="location" size={20} color="#fff" />
            <Text style={styles.locationButtonText}>Compartir mi ubicación</Text>
          </TouchableOpacity>

          {projects.length === 0 ? (
            <Text style={styles.noProjectsText}>No tienes proyectos asignados</Text>
          ) : (
            projects.map((proj) => (
              <TouchableOpacity
                key={proj.id}
                style={styles.projectCard}
                onPress={() => handleProjectPress(proj)}
              >
                <Text style={styles.projectTitle}>{proj.name}</Text>
                <Text style={styles.projectDescription}>{proj.description}</Text>
                {proj.location && (
                  <TouchableOpacity
                    style={styles.locationLink}
                    onPress={() => {
                      const url = `https://www.google.com/maps/search/?api=1&query=${proj.location.latitude},${proj.location.longitude}`;
                      Linking.openURL(url);
                    }}
                  >
                    <Text style={styles.locationLinkText}>
                      <Ionicons name="map" size={16} color="#3498db" /> Ver en mapa
                    </Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    padding: 20,
  },
  locationButton: {
    backgroundColor: '#3498db',
    padding: 15,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    elevation: 2,
  },
  locationButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  noProjectsText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
    color: '#666',
  },
  projectCard: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 15,
    borderRadius: 8,
    elevation: 2,
  },
  projectTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  projectDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  locationLink: {
    marginTop: 8,
  },
  locationLinkText: {
    color: '#3498db',
    fontSize: 14,
  },
});