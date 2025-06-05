import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ImageBackground, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

const AdminDashboard = () => {
  const navigation = useNavigation();

  const actionButtons = [
    {
      title: 'Gestión de Usuarios',
      screen: 'AdminUsers',
      color: 'rgba(76, 175, 80, 0.9)',
      icon: 'people',
    },
    {
      title: 'Gestión de Proyectos',
      screen: 'AdminProjects',
      color: 'rgba(30, 136, 229, 0.9)',
      icon: 'work'
    },
    {
      title: 'Agregar Usuario',
      screen: 'Register',
      color: 'rgba(156, 39, 176, 0.9)',
      icon: 'person-add'
    },
    {
      title: 'Chat',
      screen: 'ChatScreen',
      color: 'rgba(255, 152, 0, 0.9)',
      icon: 'chat'
    },
    {
      title: 'Roles de Usuario',
      screen: 'UserOptions',
      color: 'rgba(244, 67, 54, 0.9)',
      icon: 'security'
    },

  ];

  // Calcular el tamaño de los botones basado en el ancho de la pantalla
  const screenWidth = Dimensions.get('window').width;
  const buttonWidth = (screenWidth - 60) / 2; // 2 columnas con margen
  const buttonHeight = buttonWidth * 0.9; // Proporción 1:0.9

  return (
    <ImageBackground 
      source={require('../assets/fondo10.jpg')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      {/* Capa oscura */}
      <View style={styles.overlay} />

      {/* Contenido */}
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.container}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Panel de Administración</Text>
              <Text style={styles.headerSubtitle}>Seleccione una opción</Text>
            </View>

            <View style={styles.gridContainer}>
              {actionButtons.map((button, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.actionButton, 
                    { 
                      backgroundColor: button.color,
                      width: buttonWidth,
                      height: buttonHeight,
                    }
                  ]}
                  onPress={() => navigation.navigate(button.screen)}
                  activeOpacity={0.7}
                >
                  <View style={styles.buttonContent}>
                    <Icon name={button.icon} size={buttonHeight * 0.3} color="#FFF" style={styles.icon} />
                    <Text style={[styles.actionButtonText, { fontSize: buttonHeight * 0.12 }]}>{button.title}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 0,
  },
  safeArea: {
    flex: 1,
    zIndex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  container: {
    flex: 1,
    padding: 15,
  },
  header: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    padding: 20,
    borderRadius: 15,
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 5,
  },
  actionButton: {
    marginBottom: 20,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    overflow: 'hidden',
  },
  buttonContent: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    width: '100%',
  },
  icon: {
    marginBottom: 12,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 5,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});

export default AdminDashboard;