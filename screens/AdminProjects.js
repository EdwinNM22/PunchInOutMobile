// screens/AdminProjects.js
import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Linking, TextInput, Alert, SafeAreaView,
  ScrollView, ImageBackground
} from 'react-native';
import { getFirestore, collection, query, where, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

export default function AdminProjects() {
  const [projects, setProjects] = useState([]);
  const [viewType, setViewType] = useState('active');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const navigation = useNavigation();

  const fetchProjects = async () => {
    setIsRefreshing(true);
    try {
      const db = getFirestore();
      const proyectosRef = collection(db, 'proyectos');
      const q = viewType === 'completed'
        ? query(proyectosRef, where('status', '==', 'completado'))
        : query(proyectosRef, where('status', '==', 'activo'));

      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProjects(list);
    } catch (e) {
      console.error('Error fetching projects:', e);
      Alert.alert('Error', 'No se pudieron cargar los proyectos');
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [viewType]);

  const displayedProjects = useMemo(() => {
    const filtered = projects.filter(p =>
      p.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
    );
    return filtered.sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt) : 0;
      const db = b.createdAt ? new Date(b.createdAt) : 0;
      return db - da;
    });
  }, [projects, searchQuery]);

  const handleReportPress = proj => {
    navigation.navigate('AdminProjectReports', {
      projectId: proj.id,
      projectName: proj.name
    });
  };

  const toggleProjectStatus = async (proj) => {
    const newStatus = proj.status === 'activo' ? 'completado' : 'activo';
    
    Alert.alert(
      'Cambiar estado',
      `¿Deseas marcar este proyecto como ${newStatus === 'activo' ? 'ACTIVO' : 'COMPLETADO'}?`,
      [
        {
          text: 'Cancelar',
          style: 'cancel'
        },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const db = getFirestore();
              await updateDoc(doc(db, 'proyectos', proj.id), {
                status: newStatus,
                updatedAt: new Date().toISOString()
              });
              fetchProjects();
              Alert.alert('Éxito', `Estado cambiado a ${newStatus.toUpperCase()}`);
            } catch (e) {
              console.error(e);
              Alert.alert('Error', 'No se pudo actualizar el estado del proyecto');
            }
          }
        }
      ]
    );
  };

  const deleteProject = async (proj) => {
    Alert.alert(
      'Eliminar proyecto',
      '¿Está seguro? Todos los datos asociados se perderán permanentemente.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive',
          onPress: async () => {
            try {
              const db = getFirestore();
              await deleteDoc(doc(db, 'proyectos', proj.id));
              fetchProjects();
              Alert.alert('Éxito', 'Proyecto eliminado correctamente');
            } catch (e) {
              console.error(e);
              Alert.alert('Error', 'No se pudo eliminar el proyecto');
            }
          }
        }
      ]
    );
  };

  const renderProject = ({ item }) => (
    <View style={styles.projectCard}>
      <View style={styles.projectHeader}>
        <Text style={styles.projectTitle}>{item.name}</Text>
        <TouchableOpacity
          style={[
            styles.statusBadge,
            item.status === 'completado' ? styles.completedBadge : styles.activeBadge
          ]}
          onPress={() => toggleProjectStatus(item)}
        >
          <Text style={styles.statusText}>
            {item.status === 'completado' ? 'COMPLETADO' : 'ACTIVO'}
          </Text>
          <Feather 
            name={item.status === 'completado' ? 'check-circle' : 'refresh-cw'} 
            size={16} 
            color="#FFFFFF" 
            style={styles.statusIcon}
          />
        </TouchableOpacity>
      </View>
      
      {item.description && (
        <Text style={styles.projectDescription}>{item.description}</Text>
      )}

      {item.location?.latitude != null && item.location?.longitude != null && (
        <TouchableOpacity 
          style={styles.locationButton}
          onPress={() => {
            const url = `https://www.google.com/maps/search/?api=1&query=${item.location.latitude},${item.location.longitude}`;
            Linking.openURL(url);
          }}
        >
          <MaterialIcons name="location-on" size={18} color="#3498db" />
          <Text style={styles.locationText}>
            {item.location.latitude.toFixed(4)}, {item.location.longitude.toFixed(4)}
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.reportButton]}
          onPress={() => handleReportPress(item)}
        >
          <MaterialIcons name="assessment" size={18} color="white" />
          <Text style={styles.actionButtonText}>Reportes</Text>
        </TouchableOpacity>

        {item.status === 'activo' ? (
          <TouchableOpacity
            style={[styles.actionButton, styles.assignButton]}
            onPress={() => navigation.navigate('AssignProject', { 
              projectId: item.id, 
              projectName: item.name 
            })}
          >
            <Ionicons name="people" size={18} color="white" />
            <Text style={styles.actionButtonText}>Asignar</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => deleteProject(item)}
          >
            <MaterialIcons name="delete" size={18} color="white" />
            <Text style={styles.actionButtonText}>Eliminar</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingText}>Cargando proyectos...</Text>
      </View>
    );
  }

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
              <Text style={styles.headerTitle}>Gestión de Proyectos</Text>
            </View>

            {/* Botón destacado para nuevo proyecto */}
            <TouchableOpacity
              style={styles.createProjectButton}
              onPress={() => navigation.navigate('CreateProject')}
            >
              <MaterialIcons name="add-circle" size={24} color="#FFFFFF" />
              <Text style={styles.createProjectButtonText}>NUEVO PROYECTO</Text>
            </TouchableOpacity>

            {/* Filtros y búsqueda */}
            <View style={styles.filterContainer}>
              <View style={styles.toggleContainer}>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    viewType === 'active' && styles.activeToggleButton
                  ]}
                  onPress={() => setViewType('active')}
                >
                  <Text style={styles.toggleButtonText}>Proyectos Activos</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    viewType === 'completed' && styles.activeToggleButton
                  ]}
                  onPress={() => setViewType('completed')}
                >
                  <Text style={styles.toggleButtonText}>Proyectos Completados</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="#FFFFFF" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar proyectos..."
                  placeholderTextColor="#AAAAAA"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  returnKeyType="search"
                />
              </View>
            </View>

            {/* Lista de proyectos */}
            {displayedProjects.length > 0 ? (
              <FlatList
                data={displayedProjects}
                keyExtractor={item => item.id}
                refreshing={isRefreshing}
                onRefresh={fetchProjects}
                renderItem={renderProject}
                scrollEnabled={false}
                contentContainerStyle={styles.projectsList}
              />
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="folder-open" size={50} color="#CCCCCC" />
                <Text style={styles.emptyText}>No hay proyectos {viewType === 'active' ? 'activos' : 'completados'}</Text>
                {searchQuery.trim() !== '' && (
                  <Text style={styles.emptyHint}>Intenta con otro término de búsqueda</Text>
                )}
              </View>
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(18, 18, 18, 0.8)',
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 10,
    fontSize: 16,
  },
  container: {
    flex: 1,
    padding: 15,
  },
  header: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    padding: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  createProjectButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E53935',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  createProjectButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 10,
  },
  filterContainer: {
    marginBottom: 20,
    backgroundColor: 'rgba(30, 30, 30, 0.7)',
    borderRadius: 10,
    padding: 15,
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  toggleButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 5,
    alignItems: 'center',
  },
  activeToggleButton: {
    backgroundColor: '#E53935',
  },
  toggleButtonText: {
    color: '#FFFFFF',
    fontWeight: '500',
    fontSize: 14,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    height: 40,
    fontSize: 16,
  },
  projectsList: {
    paddingBottom: 20,
  },
  projectCard: {
    backgroundColor: 'rgba(30, 30, 30, 0.7)',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
  },
  projectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  projectTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginLeft: 10,
  },
  activeBadge: {
    backgroundColor: '#2ecc71',
  },
  completedBadge: {
    backgroundColor: '#e74c3c',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statusIcon: {
    marginLeft: 5,
  },
  projectDescription: {
    color: '#CCCCCC',
    marginBottom: 10,
    fontSize: 14,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  locationText: {
    color: '#3498db',
    marginLeft: 5,
    fontSize: 14,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 5,
    flex: 1,
    marginHorizontal: 5,
    justifyContent: 'center',
  },
  reportButton: {
    backgroundColor: '#3498db',
  },
  assignButton: {
    backgroundColor: '#f39c12',
  },
  deleteButton: {
    backgroundColor: '#e74c3c',
  },
  actionButtonText: {
    color: '#FFFFFF',
    marginLeft: 5,
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: 'rgba(30, 30, 30, 0.7)',
    borderRadius: 10,
  },
  emptyText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 15,
    textAlign: 'center',
  },
  emptyHint: {
    color: '#AAAAAA',
    fontSize: 14,
    marginTop: 5,
    textAlign: 'center',
  },
});