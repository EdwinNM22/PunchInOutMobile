// screens/UserOptions.js
import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, TextInput
} from 'react-native';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import appFirebase from '../credenciales';

export default function UserOptions() {
  const [users, setUsers] = useState([]);
  const [isRefreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const auth = getAuth(appFirebase);
  const db = getFirestore(appFirebase);

  const fetchUsers = async () => {
    setRefreshing(true);
    try {
      const snap = await getDocs(collection(db, 'usuarios'));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setUsers(list);
    } catch (e) {
      console.error('Error fetching users:', e);
      Alert.alert('Error', 'No se pudo cargar la lista de usuarios');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const toggleUserRole = async (userId, currentRole) => {
    try {
      const newRole = currentRole === 'ADMIN' ? 'USER' : 'ADMIN';
      await updateDoc(doc(db, 'usuarios', userId), { rol: newRole });
      fetchUsers();
      Alert.alert('Éxito', `Rol cambiado a ${newRole}`);
    } catch (e) {
      console.error('Error updating role:', e);
      Alert.alert('Error', 'No se pudo cambiar el rol del usuario');
    }
  };

  // 1) Filtrar por nombre/email, 2) ordenar alfabéticamente por nombre
  const displayedUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users
      .filter(u =>
        u.nombre?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
      )
      .sort((a, b) =>
        (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' })
      );
  }, [users, searchQuery]);

  const renderUserItem = ({ item }) => (
    <View style={styles.itemContainer}>
      <View style={styles.userInfo}>
        <Ionicons
          name={item.rol === 'ADMIN' ? 'shield' : 'person'}
          size={24}
          color={item.rol === 'ADMIN' ? '#ff5722' : '#4a76ff'}
        />
        <View style={styles.textContainer}>
          <Text style={styles.userName}>{item.nombre || 'Usuario sin nombre'}</Text>
          <Text style={styles.userEmail}>{item.email}</Text>
          <Text style={[
            styles.userRole,
            { color: item.rol === 'ADMIN' ? '#ff5722' : '#4a76ff' }
          ]}>
            {item.rol || 'USER'}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={[styles.actionButton, styles.roleButton]}
        onPress={() => toggleUserRole(item.id, item.rol)}
      >
        <Ionicons name="swap-horizontal" size={20} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Administración de Usuarios</Text>
        <TouchableOpacity onPress={fetchUsers} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Barra de búsqueda */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={{ marginHorizontal: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar usuario…"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
      </View>

      {/* Lista */}
      <FlatList
        data={displayedUsers}
        renderItem={renderUserItem}
        keyExtractor={item => item.id}
        refreshing={isRefreshing}
        onRefresh={fetchUsers}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={50} color="#ccc" />
            <Text style={styles.emptyText}>No hay usuarios registrados</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 15 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  refreshButton: { backgroundColor: '#4a76ff', padding: 8, borderRadius: 20 },

  // barra de búsqueda
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eee', borderRadius: 8, height: 40, marginBottom: 12 },
  searchInput: { flex: 1, paddingHorizontal: 8, fontSize: 16 },

  listContent: { paddingBottom: 20 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 },
  emptyText: { marginTop: 10, color: '#888', fontSize: 16 },

  itemContainer: {
    backgroundColor: '#fff', borderRadius: 10, padding: 15, marginBottom: 10,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 2
  },

  userInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  textContainer: { marginLeft: 15, flex: 1 },
  userName: { fontSize: 16, fontWeight: '600', color: '#333' },
  userEmail: { fontSize: 14, color: '#666', marginTop: 2 },
  userRole: { fontSize: 13, marginTop: 3, fontWeight: 'bold' },

  actionButton: { padding: 8, borderRadius: 20, marginLeft: 10, justifyContent: 'center', alignItems: 'center' },
  roleButton: { backgroundColor: '#4a76ff' },
});
