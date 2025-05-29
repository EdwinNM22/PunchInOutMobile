// screens/AdminHome.js
import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, Platform
} from 'react-native';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

export default function AdminHome() {
  const [users, setUsers] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const navigation = useNavigation();

  const fetchUsers = async () => {
    setIsRefreshing(true);
    try {
      const db = getFirestore();
      const snap = await getDocs(collection(db, 'usuarios'));
      const list = snap.docs.map(doc => ({
        id: doc.id,
        nombre: doc.data().nombre || 'Sin nombre',
        email: doc.data().email || ''
      }));
      setUsers(list);
    } catch (e) {
      console.error('Error fetching users:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // 1️⃣ Orden alfabético de toda la lista
  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) =>
      a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
    );
  }, [users]);

  // 2️⃣ Filtrado según la query
  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedUsers;
    return sortedUsers.filter(u =>
      u.nombre.toLowerCase().includes(q)
    );
  }, [query, sortedUsers]);

  const handleUserClick = (userId) => {
    navigation.navigate('adminGestion', { userId });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Gestión de Usuarios</Text>
        <TouchableOpacity onPress={fetchUsers} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Barra de búsqueda */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color="#666" />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar trabajador…"
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
      </View>

      {/* Lista filtrada */}
      <FlatList
        data={filteredUsers}
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
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.item}
            onPress={() => handleUserClick(item.id)}
          >
            <View style={styles.userInfo}>
              <Ionicons name="person-circle-outline" size={30} color="#4a76ff" />
              <View style={styles.textContainer}>
                <Text style={styles.userName}>{item.nombre}</Text>
                <Text style={styles.userEmail}>{item.email}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 20, backgroundColor: '#4a76ff',
    borderBottomLeftRadius: 20, borderBottomRightRadius: 20,
    elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4,
  },
  title: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  refreshButton: { padding: 5 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f0f0f0', margin: 16, borderRadius: 8,
    paddingHorizontal: 10, height: 40
  },
  searchInput: {
    flex: 1, paddingHorizontal: 8,
    ...Platform.select({ ios: { paddingVertical: 6 } })
  },
  listContent: { padding: 15 },
  item: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', backgroundColor: '#fff', padding: 15,
    borderRadius: 10, marginBottom: 10, elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 2,
  },
  userInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  textContainer: { marginLeft: 15 },
  userName: { fontSize: 16, fontWeight: '600', color: '#333' },
  userEmail: { fontSize: 14, color: '#666', marginTop: 2 },
  emptyContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', padding: 50
  },
  emptyText: { marginTop: 15, fontSize: 16, color: '#999', textAlign: 'center' },
});
