// > Click a "Asignar proyecto a trabajadores" permite cambiar los trabajadores asignados a cada proyecto.
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { getFirestore, collection, query, getDocs, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { sendPush } from '../utils/sendPush.js';

const AssignProject = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { projectId, projectName } = route.params; // the project ID is passed via params
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch assignments from the subcollection
  const fetchAssignments = async () => {
    const db = getFirestore();
    const assignmentsRef = collection(db, 'proyectos', projectId, 'assignments');
    try {
      const snapshot = await getDocs(assignmentsRef);
      // For each assignment, fetch user info from the 'usuarios' collection
      const assignmentsList = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();
          // Fetch the user's details
          const userDocRef = doc(db, 'usuarios', data.userId);
          const userSnap = await getDoc(userDocRef);
          const userName = userSnap.exists() ? userSnap.data().nombre : 'Usuario sin nombre';
          return { id: docSnap.id, ...data, userName };
        })
      );
      setAssignments(assignmentsList);
    } catch (error) {
      console.error("Error fetching assignments: ", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  // Handle editing an assignment (change role)
  const editAssignment = (userId, currentRole) => {
    Alert.alert(
      'Asignar como:',
      'Seleccione el nuevo rol para la asignación',
      [
        { text: 'Jefe', onPress: () => updateAssignmentRole(userId, 'jefe') },
        { text: 'Trabajador', onPress: () => updateAssignmentRole(userId, 'trabajador') },
        { text: 'Cancelar', style: 'cancel' },
      ]
    );
  };

  const updateAssignmentRole = async (userId, newRole) => {
    const db = getFirestore();
    try {
      const assignmentDocRef = doc(db, 'proyectos', projectId, 'assignments', userId);
      await setDoc(assignmentDocRef, { role: newRole, assignedAt: new Date().toISOString(), userId }, { merge: true });
      Alert.alert("Éxito", "Rol actualizado");
      fetchAssignments();
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "No se pudo actualizar el rol");
    }
  };

  // Handle deletion
  const deleteAssignment = (userId) => {
    Alert.alert(
      'Eliminar asignación',
      '¿Está seguro de que desea eliminar la asignación para este usuario?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          onPress: async () => {
            try {
              const db = getFirestore();
              const assignmentDocRef = doc(db, 'proyectos', projectId, 'assignments', userId);
              await deleteDoc(assignmentDocRef);
              Alert.alert("Éxito", "Asignación eliminada");
              fetchAssignments();
            } catch (error) {
              console.error(error);
              Alert.alert("Error", "No se pudo eliminar la asignación");
            }
          }
        },
      ]
    );
  };

  const addOrUpdateAssignment = async (userId, role) => {
    const db = getFirestore();
    // 1. guardar / actualizar asignación
    await setDoc(
      doc(db,'proyectos', projectId, 'assignments', userId),
      { role, assignedAt: new Date().toISOString(), userId },
      { merge:true }
    );
  
    // 2. recuperar token
    const userSnap = await getDoc(doc(db,'usuarios',userId));
    const token    = userSnap.exists() ? userSnap.data().expoToken : null;
  
    // 3. enviar push si hay token
    if (token)
      await sendPush(
        token,
        'Nuevo proyecto asignado',
        `Te asignaron al proyecto “${projectName}”`,
        { projectId }
      );
  };

  const renderAssignment = ({ item }) => (
    <View style={styles.assignmentCard}>
      <View style={styles.assignmentInfo}>
        <Text style={styles.userName}>{item.userName}</Text>
        <Text style={styles.userRole}>{item.role}</Text>
      </View>
      <View style={styles.assignmentActions}>
        <TouchableOpacity onPress={() => editAssignment(item.userId, item.role)}>
          <Ionicons name="create-outline" size={24} color="#4a76ff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => deleteAssignment(item.userId)}>
          <Ionicons name="trash-outline" size={24} color="#f44336" style={{ marginLeft: 10 }} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Asignaciones del proyecto</Text>
      {loading ? (
        <Text>Cargando asignaciones...</Text>
      ) : assignments.length > 0 ? (
        <FlatList
          data={assignments}
          keyExtractor={(item) => item.id}
          renderItem={renderAssignment}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      ) : (
        <Text style={styles.emptyText}>No se ha asignado ningún trabajador a este proyecto aún</Text>
      )}

      {/* Button to add new assignments */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() =>
          navigation.navigate('SelectWorker', {
            projectId,
            onWorkersReady: async (pickedWorkers) => {
              for (const worker of pickedWorkers) {
                await addOrUpdateAssignment(worker.userId, worker.role);
              }
              fetchAssignments(); // actualiza la vista después
            },
            preselected: assignments
          })
        }
      >
        <Text style={styles.addButtonText}>Añadir trabajadores al proyecto</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
  emptyText: { fontSize: 16, color: '#777', textAlign: 'center', marginVertical: 20 },
  assignmentCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc'
  },
  assignmentInfo: { flexDirection: 'column' },
  userName: { fontSize: 18 },
  userRole: { fontSize: 14, color: '#555' },
  assignmentActions: { flexDirection: 'row', alignItems: 'center' },
  addButton: {
    backgroundColor: '#4a76ff',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20
  },
  addButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18
  },
});

export default AssignProject;
