import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  SafeAreaView, 
  ActivityIndicator,
  ScrollView,   ImageBackground
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import appFirebase from '../credenciales';

const db = getFirestore(appFirebase);

export default function AdminGestion() {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId } = route.params;
  
  const [userData, setUserData] = useState({
    name: 'Nombre del trabajador',
    email: 'email@ejemplo.com',
    iniciales: 'NN'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'usuarios', userId));
        if (userDoc.exists()) {
          const nombre = userDoc.data().nombre || 'Nombre no proporcionado';
          setUserData({
            name: nombre,
            email: userDoc.data().email || 'Email no proporcionado',
            iniciales: nombre.split(' ').map(n => n[0]).join('').toUpperCase()
          });
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (!route.params?.userName || !route.params?.userEmail) {
      fetchUserData();
    } else {
      const nombre = route.params.userName;
      setUserData({
        name: nombre,
        email: route.params.userEmail,
        iniciales: nombre.split(' ').map(n => n[0]).join('').toUpperCase()
      });
      setLoading(false);
    }
  }, [userId, route.params]);

  const handleGoToLocation = () => {
    navigation.navigate('UserLocation', { userId });
  };

  const handleGoToReport = () => {
    navigation.navigate('ReporteUsuario', { userId });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingText}>Cargando información del usuario...</Text>
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
            <TouchableOpacity 
              onPress={() => navigation.goBack()} 
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Gestión de Trabajador</Text>
            <View style={styles.emptySpace} />
          </View>

          {/* Información del usuario */}
          <View style={styles.userInfoCard}>
            <View style={styles.userAvatar}>
              <Text style={styles.userInitials}>{userData.iniciales}</Text>
            </View>
            
            <Text style={styles.userName}>{userData.name}</Text>
            <Text style={styles.userEmail}>{userData.email}</Text>
            
            <View style={styles.userIdBadge}>
              <Text style={styles.userIdText}>ID: {userId}</Text>
            </View>
          </View>

          {/* Botones de acción */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.locationButton]}
              onPress={handleGoToLocation}
            >
              <MaterialIcons name="location-on" size={24} color="white" />
              <Text style={styles.actionButtonText}>Ubicación del usuario</Text>
              <Ionicons name="chevron-forward" size={20} color="white" style={styles.chevron} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionButton, styles.reportButton]}
              onPress={handleGoToReport}
            >
              <MaterialIcons name="assessment" size={24} color="white" />
              <Text style={styles.actionButtonText}>Reporte del usuario</Text>
              <Ionicons name="chevron-forward" size={20} color="white" style={styles.chevron} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'rgba(18, 18, 18, 0.38)',
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
  },
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    padding: 20,
    borderRadius: 8,
  },
  backButton: {
    padding: 5,
  },
  emptySpace: {
    width: 24,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  userInfoCard: {
    backgroundColor: 'rgba(30, 30, 30, 0.7)',
    borderRadius: 12,
    padding: 25,
    alignItems: 'center',
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#E53935',
  },
  userAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E53935',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  userInitials: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 24,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
    textAlign: 'center',
  },
  userEmail: {
    fontSize: 14,
    color: '#CCCCCC',
    marginBottom: 12,
    textAlign: 'center',
  },
  userIdBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginTop: 10,
  },
  userIdText: {
    fontSize: 12,
    color: '#AAAAAA',
  },
  actionsContainer: {
    width: '100%',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderRadius: 8,
    marginBottom: 16,
    backgroundColor: 'rgba(30, 30, 30, 0.7)',
    borderLeftWidth: 4,
  },
  locationButton: {
    borderLeftColor: '#3498db',
  },
  reportButton: {
    borderLeftColor: '#2ecc71',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 10,
    flex: 1,
  },
  chevron: {
    marginLeft: 10,
  },
});