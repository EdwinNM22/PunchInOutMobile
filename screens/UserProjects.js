import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Linking, SafeAreaView, ScrollView, Image } from 'react-native';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, getDocs, query, where, doc, getDoc, setDoc } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Alert } from 'react-native';
import { ImageBackground } from 'react-native';


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
            trigger: null,
          });
        } catch (e) {
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
        <ActivityIndicator size="large" color="#E53935" />
        <Text style={styles.loadingText}>Cargando proyectos...</Text>
      </View>
    );
  }

  return (
  <ImageBackground
    source={require('../assets/fondo8.jpg')} // Cambia por tu imagen
    style={{ flex: 1 }}
    resizeMode="cover"
  >
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Mis Proyectos</Text>
            <Image 
              source={require('../assets/biovizion.jpg')} 
              style={styles.headerIcon}
            />
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.locationButton]}
              onPress={getUserLocation}
            >
              <Ionicons name="location" size={22} color="#fff" />
              <Text style={styles.actionButtonText}>Compartir ubicación</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.chatButton]}
              onPress={() => navigation.navigate('ChatScreen')}
            >
              <MaterialIcons name="chat" size={22} color="#fff" />
              <Text style={styles.actionButtonText}>Chat</Text>
            </TouchableOpacity>
          </View>

          {/* Projects List */}
          {projects.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="folder-open" size={50} color="#E53935" />
              <Text style={styles.noProjectsText}>No tienes proyectos asignados</Text>
            </View>
          ) : (
            projects.map((proj) => (
              <TouchableOpacity
                key={proj.id}
                style={styles.projectCard}
                onPress={() => handleProjectPress(proj)}
              >
                <View style={styles.projectHeader}>
                  <Ionicons name="document-text" size={24} color="#E53935" />
                  <Text style={styles.projectTitle}>{proj.name}</Text>
                </View>
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
                      <Ionicons name="map" size={16} color="#E53935" /> Ver en mapa
                    </Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  </ImageBackground>
);

}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(18, 18, 18, 0.8)', // Añadida transparencia
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 10,
  },
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Añadida transparencia
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.3)', // Añadida transparencia
    padding: 10,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerIcon: {
    width: 40,
    height: 40,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    width: '48%',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  locationButton: {
    backgroundColor: 'rgba(229, 57, 53, 0.8)', // Añadida transparencia
  },
  chatButton: {
    backgroundColor: 'rgba(30, 136, 229, 0.8)', // Añadida transparencia
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.3)', // Añadida transparencia
    borderRadius: 10,
  },
  noProjectsText: {
    textAlign: 'center',
    marginTop: 15,
    fontSize: 16,
    color: '#AAAAAA',
  },
  projectCard: {
    backgroundColor: 'rgba(30, 30, 30, 0.7)', // Añadida transparencia
    padding: 16,
    marginBottom: 15,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#E53935',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  projectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  projectTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 10,
  },
  projectDescription: {
    fontSize: 14,
    color: '#CCCCCC',
    marginBottom: 10,
    lineHeight: 20,
  },
  locationLink: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  locationLinkText: {
    color: '#E53935',
    fontSize: 14,
    fontWeight: '500',
  },
});