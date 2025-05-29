// screens/SelectWorker.js
import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, TextInput, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  const projectId = route.params?.projectId;      // (no lo usamos aquí)

  /* ───── estado ───── */
  const [users, setUsers] = useState([]);
  const [picked, setPicked] = useState([...preselected]);
  const [query, setQuery] = useState('');          // texto de búsqueda

  /* ───── carga de usuarios ───── */
  useEffect(() => {
    (async () => {
      try {
        const db = getFirestore();
        const snap = await getDocs(collection(db, 'usuarios'));
        const list = snap.docs.map(d => ({
          userId: d.id,
          nombre: d.data().nombre || 'Sin nombre'
        }))
          // orden alfabético (ES → incluye tildes/ñ)
          .sort((a, b) =>
            a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));

        setUsers(list);
      } catch (e) { console.error(e); }
    })();
  }, []);

  /* ───── helpers ───── */
  const isPicked = (id) => picked.some(u => u.userId === id);

  const togglePick = (userObj) => {
    setPicked(prev => {
      const idx = prev.findIndex(u => u.userId === userObj.userId);
      if (idx !== -1) {
        // quitar
        return prev.filter((_, i) => i !== idx);
      }
      // añadir
      return [...prev, { ...userObj, role: 'trabajador' }];
    });
  };

  const changeRole = (userId) => {
    setPicked(prev => prev.map(u =>
      u.userId === userId
        ? { ...u, role: u.role === 'jefe' ? 'trabajador' : 'jefe' }
        : u
    ));
  };

  const saveAndGoBack = () => {
    onWorkersReady?.(picked);
    navigation.setParams({ onWorkersReady: undefined });
    navigation.goBack();
  };

  /* ───── filtrado memoizado ───── */
  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u => u.nombre.toLowerCase().includes(q));
  }, [query, users]);

  /* ───── render fila ───── */
  const renderItem = ({ item }) => {
    const selected = isPicked(item.userId);
    const pickObj = picked.find(u => u.userId === item.userId);

    return (
      <TouchableOpacity
        style={[styles.row, selected && styles.rowSelected]}
        onPress={() => togglePick(item)}
        onLongPress={() => selected && changeRole(item.userId)}
      >
        <Text style={styles.name}>{item.nombre}</Text>

        {selected && (
          <View style={styles.roleBox}>
            <Ionicons name="checkmark" size={18} color="#fff" />
            <Text style={styles.roleText}>{pickObj.role}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  /* ───── UI ───── */
  return (
    <View style={styles.container}>
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

      <Text style={styles.info}>
        Toca para seleccionar/deseleccionar.
        Mantén presionado para cambiar “jefe” ↔ “trabajador”.
      </Text>

      <FlatList
        data={filteredUsers}
        keyExtractor={u => u.userId}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 20 }}
      />

      {draftMode && (
        <TouchableOpacity style={styles.saveBtn} onPress={saveAndGoBack}>
          <Text style={styles.saveTxt}>Guardar selección</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/* ───── estilos ───── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  info: { paddingHorizontal: 16, paddingTop: 10, textAlign: 'center', color: '#666' },

  /* búsqueda */
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f0f0f0', margin: 16,
    borderRadius: 8, paddingHorizontal: 10,
    height: 40
  },
  searchInput: {
    flex: 1, paddingHorizontal: 8, color: '#333',
    ...Platform.select({ ios: { paddingVertical: 6 } })
  },

  /* filas */
  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderColor: '#eee'
  },
  rowSelected: { backgroundColor: '#e8f0ff' },

  name: { fontSize: 16 },

  roleBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#4a76ff', paddingHorizontal: 10,
    borderRadius: 12, height: 26
  },
  roleText: { color: '#fff', marginLeft: 4, textTransform: 'capitalize' },

  saveBtn: {
    backgroundColor: '#4a76ff', margin: 20, padding: 14,
    borderRadius: 10, alignItems: 'center'
  },
  saveTxt: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
