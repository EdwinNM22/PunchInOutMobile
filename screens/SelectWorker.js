import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, TextInput, SafeAreaView,
  ImageBackground, ActivityIndicator
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import {
  getFirestore, collection, getDocs
} from 'firebase/firestore';
import { useNavigation, useRoute } from '@react-navigation/native';

export default function SelectWorker() {
  const navigation = useNavigation();
  const route = useRoute();

  /* ───── props ───── */
  const draftMode = !!route.params?.draftMode;
  const preselected = route.params?.preselected ?? [];
  const onWorkersReady = route.params?.onWorkersReady;
  const projectId = route.params?.projectId;

  /* ───── estado ───── */
  const [users, setUsers] = useState([]);
  const [picked, setPicked] = useState([...preselected]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  /* ───── carga de usuarios ───── */
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const db = getFirestore();
        const snap = await getDocs(collection(db, 'usuarios'));
        const list = snap.docs.map(d => ({
          userId: d.id,
          nombre: d.data().nombre || 'Sin nombre',
          email: d.data().email || '',
          role: d.data().role || 'trabajador'
        }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));

        setUsers(list);
      } catch (e) {
        console.error(e);
        Alert.alert('Error', 'No se pudieron cargar los usuarios');
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, []);

  /* ───── helpers ───── */
  const isPicked = (id) => picked.some(u => u.userId === id);

  const togglePick = (userObj) => {
    setPicked(prev => {
      const idx = prev.findIndex(u => u.userId === userObj.userId);
      if (idx !== -1) {
        return prev.filter((_, i) => i !== idx);
      }
      return [...prev, { 
        ...userObj, 
        role: userObj.role || 'trabajador' 
      }];
    });
  };

  const changeRole = (userId) => {
    setPicked(prev => prev.map(u =>
      u.userId === userId
        ? { ...u, role: u.role === 'supervisor' ? 'trabajador' : 'supervisor' }
        : u
    ));
  };

  const saveAndGoBack = () => {
    onWorkersReady?.(picked);
    navigation.goBack();
  };

  /* ───── filtrado memoizado ───── */
  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u => 
      u.nombre.toLowerCase().includes(q) || 
      (u.email && u.email.toLowerCase().includes(q))
    );
  }, [query, users]);

  /* ───── render fila ───── */
  const renderItem = ({ item }) => {
    const selected = isPicked(item.userId);
    const pickObj = picked.find(u => u.userId === item.userId);
    const role = pickObj?.role || item.role;

    return (
      <TouchableOpacity
        style={[styles.row, selected && styles.rowSelected]}
        onPress={() => togglePick(item)}
        onLongPress={() => selected && changeRole(item.userId)}
      >
        <View style={styles.userInfo}>
          <Text style={styles.name}>{item.nombre}</Text>
          <Text style={styles.email}>{item.email}</Text>
        </View>

        {selected && (
          <View style={[
            styles.roleBox,
            role === 'supervisor' && styles.supervisorRole
          ]}>
            <MaterialIcons 
              name={role === 'supervisor' ? 'supervisor-account' : 'engineering'} 
              size={18} 
              color="#fff" 
            />
            <Text style={styles.roleText}>
              {role === 'supervisor' ? 'Supervisor' : 'Trabajador'}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  /* ───── UI ───── */
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingText}>Cargando trabajadores...</Text>
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
        <View style={styles.container}>
          {/* Encabezado */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {draftMode ? 'Seleccionar Trabajadores' : 'Asignar al Proyecto'}
            </Text>
          </View>

          {/* Barra de búsqueda */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#FFFFFF" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar trabajadores..."
              placeholderTextColor="#AAAAAA"
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
          </View>

          {/* Instrucciones */}
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              <Ionicons name="information-circle" size={16} color="#3498db" /> 
              {' '}Toque para seleccionar. Mantenga presionado para cambiar rol.
            </Text>
          </View>

          {/* Contador de seleccionados */}
          {picked.length > 0 && (
            <View style={styles.counterBox}>
              <Text style={styles.counterText}>
                {picked.length} {picked.length === 1 ? 'trabajador seleccionado' : 'trabajadores seleccionados'}
              </Text>
            </View>
          )}

          {/* Lista de trabajadores */}
          <FlatList
            data={filteredUsers}
            keyExtractor={u => u.userId}
            renderItem={renderItem}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={50} color="#CCCCCC" />
                <Text style={styles.emptyText}>
                  {query ? 'No hay coincidencias' : 'No hay trabajadores disponibles'}
                </Text>
              </View>
            }
          />

          {/* Botón de guardar */}
          {draftMode && (
            <TouchableOpacity 
              style={[
                styles.saveButton,
                picked.length === 0 && styles.disabledButton
              ]} 
              onPress={saveAndGoBack}
              disabled={picked.length === 0}
            >
              <Text style={styles.saveButtonText}>
                {picked.length > 0 
                  ? `GUARDAR (${picked.length})` 
                  : 'SELECCIONE TRABAJADORES'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.33)',
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 15,
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
  infoBox: {
    backgroundColor: 'rgba(30, 30, 30, 0.7)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
  },
  infoText: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
  },
  counterBox: {
    backgroundColor: 'rgba(52, 152, 219, 0.2)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
  },
  counterText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.48)',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
  },
  rowSelected: {
    backgroundColor: 'rgba(219, 52, 52, 0.3)',
    borderLeftWidth: 4,
    borderLeftColor: 'rgba(250, 0, 0, 0.3)',
  },
  userInfo: {
    flex: 1,
  },
  name: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 3,
  },
  email: {
    color: '#CCCCCC',
    fontSize: 13,
  },
  roleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2ecc71',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginLeft: 10,
  },
  supervisorRole: {
    backgroundColor: '#e74c3c',
  },
  roleText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 5,
    textTransform: 'uppercase',
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
  saveButton: {
    backgroundColor: '#2ecc71',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  disabledButton: {
    backgroundColor: '#7f8c8d',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});