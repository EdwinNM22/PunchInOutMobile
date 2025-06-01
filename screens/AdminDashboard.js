// Vista principal del admin
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const AdminDashboard = () => {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dashboard Admin</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('AdminUsers')}
      >
        <Text style={styles.buttonText}>Gestión de Usuarios</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('AdminProjects')}
      >
        <Text style={styles.buttonText}>Gestión de Proyectos</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('Register')}
      >
        <Text style={styles.buttonText}>Agregar Nuevo Usuario</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('ChatScreen')}
      >
        <Text style={styles.buttonText}>chat entre personas</Text>
      </TouchableOpacity>



      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('UserOptions')}
      >
        <Text style={styles.buttonText}>Roles de Usuario</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5'
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20
  },
  button: {
    backgroundColor: '#4a76ff',
    padding: 15,
    borderRadius: 10,
    marginVertical: 10,
    width: '80%',
    alignItems: 'center'
  },
  buttonText: {
    color: '#fff',
    fontSize: 18
  }
});

export default AdminDashboard;
