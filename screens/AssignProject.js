import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, Alert, SafeAreaView,
  ImageBackground, ActivityIndicator
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import {
  getFirestore, collection, getDocs, doc,
  setDoc, deleteDoc, getDoc
} from 'firebase/firestore';
import { useNavigation, useRoute } from '@react-navigation/native';
import { sendPush } from '../utils/sendPush.js';

const AssignProject = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { projectId, projectName } = route.params;
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchAssignments = async () => {
    setLoading(true);
    const db = getFirestore();
    const assignmentsRef = collection(db, 'proyectos', projectId, 'assignments');
    try {
      const snapshot = await getDocs(assignmentsRef);
      const assignmentsList = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();
          const userDocRef = doc(db, 'usuarios', data.userId);
          const userSnap = await getDoc(userDocRef);
          const userData = userSnap.exists() ? userSnap.data() : {};
          return { 
            id: docSnap.id, 
            ...data, 
            userName: userData.nombre || 'Usuario sin nombre',
            userEmail: userData.email || ''
          };
        })
      );
      setAssignments(assignmentsList);
    } catch (error) {
      console.error("Error fetching assignments: ", error);
      Alert.alert('Error', 'No se pudieron cargar las asignaciones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  const editAssignment = (userId, currentRole) => {
    Alert.alert(
      'Cambiar rol',
      `Seleccione el nuevo rol para este trabajador en el proyecto "${projectName}"`,
      [
        { 
          text: 'Supervisor', 
          onPress: () => updateAssignmentRole(userId, 'supervisor') 
        },
        { 
          text: 'Trabajador', 
          onPress: () => updateAssignmentRole(userId, 'trabajador') 
        },
        { 
          text: 'Cancelar', 
          style: 'cancel' 
        },
      ]
    );
  };

  const updateAssignmentRole = async (userId, newRole) => {
    setIsProcessing(true);
    const db = getFirestore();
    try {
      const assignmentDocRef = doc(db, 'proyectos', projectId, 'assignments', userId);
      await setDoc(
        assignmentDocRef, 
        { 
          role: newRole, 
          assignedAt: new Date().toISOString(), 
          userId 
        }, 
        { merge: true }
      );
      
      // Enviar notificación
      const userSnap = await getDoc(doc(db, 'usuarios', userId));
      const token = userSnap.exists() ? userSnap.data().expoToken : null;
      if (token) {
        await sendPush(
          token,
          'Cambio de rol en proyecto',
          `Tu rol en el proyecto "${projectName}" ha cambiado a ${newRole}`,
          { projectId }
        );
      }
      
      fetchAssignments();
      Alert.alert("Éxito", `Rol actualizado a ${newRole}`);
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "No se pudo actualizar el rol");
    } finally {
      setIsProcessing(false);
    }
  };

  const deleteAssignment = (userId, userName) => {
    Alert.alert(
      'Eliminar asignación',
      `¿Está seguro que desea eliminar a ${userName} del proyecto "${projectName}"?`,
      [
        { 
          text: 'Cancelar', 
          style: 'cancel' 
        },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setIsProcessing(true);
            try {
              const db = getFirestore();
              const assignmentDocRef = doc(db, 'proyectos', projectId, 'assignments', userId);
              await deleteDoc(assignmentDocRef);
              
              // Enviar notificación
              const userSnap = await getDoc(doc(db, 'usuarios', userId));
              const token = userSnap.exists() ? userSnap.data().expoToken : null;
              if (token) {
                await sendPush(
                  token,
                  'Eliminado de proyecto',
                  `Has sido removido del proyecto "${projectName}"`,
                  { projectId }
                );
              }
              
              fetchAssignments();
              Alert.alert("Éxito", "Asignación eliminada");
            } catch (error) {
              console.error(error);
              Alert.alert("Error", "No se pudo eliminar la asignación");
            } finally {
              setIsProcessing(false);
            }
          }
        },
      ]
    );
  };

  const addOrUpdateAssignment = async (userId, role) => {
    setIsProcessing(true);
    try {
      const db = getFirestore();
      await setDoc(
        doc(db, 'proyectos', projectId, 'assignments', userId),
        { role, assignedAt: new Date().toISOString(), userId },
        { merge: true }
      );
      
      // Enviar notificación
      const userSnap = await getDoc(doc(db, 'usuarios', userId));
      const token = userSnap.exists() ? userSnap.data().expoToken : null;
      if (token) {
        await sendPush(
          token,
          'Nuevo proyecto asignado',
          `Te asignaron al proyecto "${projectName}" como ${role}`,
          { projectId }
        );
      }
      
      return true;
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "No se pudo completar la asignación");
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  const renderAssignment = ({ item }) => (
    <View style={styles.assignmentCard}>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.userName}</Text>
        <Text style={styles.userEmail}>{item.userEmail}</Text>
      </View>
      
      <View style={styles.roleContainer}>
        <TouchableOpacity 
          style={[
            styles.roleBadge,
            item.role === 'supervisor' && styles.supervisorBadge
          ]}
          onPress={() => editAssignment(item.userId, item.role)}
        >
          <MaterialIcons 
            name={item.role === 'supervisor' ? 'supervisor-account' : 'engineering'} 
            size={16} 
            color="#FFFFFF" 
          />
          <Text style={styles.roleText}>
            {item.role === 'supervisor' ? 'Supervisor' : 'Trabajador'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.deleteButton}
          onPress={() => deleteAssignment(item.userId, item.userName)}
        >
          <Ionicons name="trash-outline" size={20} color="#e74c3c" />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingText}>Cargando asignaciones...</Text>
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
            <Text style={styles.headerTitle}>Asignaciones</Text>
            <Text style={styles.projectName}>{projectName}</Text>
          </View>

          {/* Contador de asignaciones */}
          <View style={styles.counterBox}>
            <Text style={styles.counterText}>
              {assignments.length} {assignments.length === 1 ? 'trabajador asignado' : 'trabajadores asignados'}
            </Text>
          </View>

          {/* Lista de asignaciones */}
          {assignments.length > 0 ? (
            <FlatList
              data={assignments}
              keyExtractor={(item) => item.id}
              renderItem={renderAssignment}
              contentContainerStyle={styles.listContent}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={50} color="#CCCCCC" />
              <Text style={styles.emptyText}>No hay trabajadores asignados</Text>
              <Text style={styles.emptyHint}>Presione el botón inferior para agregar trabajadores</Text>
            </View>
          )}

          {/* Botón para agregar trabajadores */}
          <TouchableOpacity
            style={[styles.addButton, isProcessing && styles.disabledButton]}
            onPress={() =>
              navigation.navigate('SelectWorker', {
                projectId,
                  draftMode: true, // Añade esta línea
                onWorkersReady: async (pickedWorkers) => {
                  setIsProcessing(true);
                  const results = await Promise.all(
                    pickedWorkers.map(worker => 
                      addOrUpdateAssignment(worker.userId, worker.role)
                    )
                  );
                  if (results.every(Boolean)) {
                    fetchAssignments();
                  }
                  setIsProcessing(false);
                },
                preselected: assignments
              })
            }
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="people" size={20} color="#FFFFFF" />
                <Text style={styles.addButtonText}>
                  {assignments.length > 0 ? 'AGREGAR MÁS TRABAJADORES' : 'ASIGNAR TRABAJADORES'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
};

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
    marginBottom: 15,
    padding: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  projectName: {
    fontSize: 16,
    color: '#CCCCCC',
    textAlign: 'center',
    marginTop: 5,
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
  assignmentCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 3,
  },
  userEmail: {
    color: '#CCCCCC',
    fontSize: 13,
  },
  roleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2ecc71',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  supervisorBadge: {
    backgroundColor: '#e74c3c',
  },
  roleText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 5,
    textTransform: 'uppercase',
  },
  deleteButton: {
    marginLeft: 15,
    padding: 5,
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
  addButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f39c12',
    padding: 15,
    borderRadius: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  disabledButton: {
    backgroundColor: '#7f8c8d',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 10,
  },
});

export default AssignProject;