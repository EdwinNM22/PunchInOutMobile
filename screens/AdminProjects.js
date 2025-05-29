// screens/AdminProjects.js
import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Linking, TextInput, Alert
} from 'react-native';
import { getFirestore, collection, query, where, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
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
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [viewType]);

  // 1) Filtrar por nombre según searchQuery
  // 2) Ordenar por createdAt descendente
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

  /* ---------- marcar finalizado ---------- */
  const toggleCompleted = async (proj) => {
    try {
      const db = getFirestore();
      await updateDoc(doc(db, 'proyectos', proj.id), {
        status: proj.status === 'activo' ? 'completado' : 'activo'
      });
      fetchProjects();
    } catch (e) { console.error(e); }
  };

  /* ---------- borrar definitivo ---------- */
  const deleteProject = async (proj) => {
    Alert.alert(
      'Eliminar proyecto',
      '¿Está seguro? Los reportes dejarán de estar disponibles.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive',
          onPress: async () => {
            try {
              const db = getFirestore();
              await deleteDoc(doc(db, 'proyectos', proj.id));
              fetchProjects();
            } catch (e) { console.error(e); }
          }
        }
      ]
    );
  };
  const renderProject = ({ item }) => (
    <View style={styles.projectCard}>
      <Text style={styles.projectTitle}>{item.name}</Text>
      <Text>{item.description}</Text>

      {item.location?.latitude != null && item.location?.longitude != null && (
        <TouchableOpacity onPress={() => {
          const url = `https://www.google.com/maps/search/?api=1&query=${item.location.latitude},${item.location.longitude}`;
          Linking.openURL(url);
        }}>
          <Text style={styles.projectLocation}>
            Ver Ubicación: {item.location.latitude.toFixed(4)}, {item.location.longitude.toFixed(4)}
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={styles.reportButton}
        onPress={() => handleReportPress(item)}
      >
        <Text style={styles.reportButtonText}>Ver reportes del proyecto</Text>
      </TouchableOpacity>

      {/* ---- acción variable según estado ---- */}
      {item.status === 'activo' ? (
        <TouchableOpacity
          style={styles.assignButton}
          onPress={() =>
            navigation.navigate('AssignProject', { projectId: item.id, projectName: item.name })}
        >
          <Text style={styles.assignButtonText}>Asignar proyecto a trabajadores</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => deleteProject(item)}
        >
          <Text style={styles.deleteButtonText}>Eliminar registro del proyecto</Text>
        </TouchableOpacity>
      )}

      {/* ---- checkbox “finalizado” ---- */}
      <TouchableOpacity
        style={styles.checkbox}
        onPress={() => toggleCompleted(item)}
      >
        {item.status === 'completado' && (
          <Ionicons name="checkmark" size={18} color="#fff" />
        )}
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return <ActivityIndicator size="large" style={styles.loading} />;
  }

  return (
    <View style={styles.container}>

      {/* Filtros de estado */}
      <View style={styles.topButtonsContainer}>
        <TouchableOpacity
          style={[
            styles.topButton,
            viewType === 'completed' && styles.activeTopButton
          ]}
          onPress={() => setViewType(viewType === 'completed' ? 'active' : 'completed')}
        >
          <Text style={styles.topButtonText}>Proyectos antiguos</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.topButton}
          onPress={() => navigation.navigate('CreateProject')}
        >
          <Text style={styles.topButtonText}>Proyecto nuevo</Text>
        </TouchableOpacity>
      </View>

      {/* Barra de búsqueda */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={{ marginHorizontal: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar proyecto…"
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
      </View>

      <FlatList
        data={displayedProjects}
        keyExtractor={item => item.id}
        refreshing={isRefreshing}
        onRefresh={fetchProjects}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="folder-open" size={50} color="#ccc" />
            <Text style={styles.emptyText}>No hay proyectos que coincidan</Text>
          </View>
        }
        renderItem={renderProject}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  topButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 10,
    backgroundColor: '#fff'
  },
  topButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    backgroundColor: '#ddd'
  },
  activeTopButton: {
    backgroundColor: '#4a76ff'
  },
  topButtonText: {
    color: '#fff',
    fontWeight: 'bold'
  },
  // Nueva barra de búsqueda
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eee',
    margin: 12,
    borderRadius: 8,
    height: 40
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 8,
    fontSize: 16
  },
  listContent: {
    padding: 15
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 50
  },
  emptyText: {
    marginTop: 15,
    fontSize: 16,
    color: '#999',
    textAlign: 'center'
  },
  projectCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    elevation: 2
  },
  projectTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5
  },
  projectLocation: {
    color: '#4a76ff',
    textDecorationLine: 'underline',
    marginTop: 5
  },
  reportButton: {
    marginTop: 10,
    backgroundColor: '#4a76ff',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center'
  },
  reportButtonText: {
    color: '#fff'
  },
  assignButton: {
    marginTop: 10,
    backgroundColor: '#f39c12',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center'
  },
  assignButtonText: {
    color: '#fff'
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  checkbox: {
    position: 'absolute', top: 10, right: 10,
    width: 24, height: 24, borderRadius: 4,
    borderWidth: 1, borderColor: '#777',
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#4CAF50'
  },
  deleteButton: {
    marginTop: 10, backgroundColor: '#e74c3c',
    padding: 10, borderRadius: 5, alignItems: 'center'
  },
  deleteButtonText: { color: '#fff' },
});
