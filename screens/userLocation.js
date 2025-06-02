import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { getFirestore, doc, collection, onSnapshot, orderBy, query, getDocs } from 'firebase/firestore';

import MapView, { Marker } from 'react-native-maps';

const UserLocationsList = ({ route, navigation }) => {
  const { userId } = route.params;
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastLocation, setLastLocation] = useState(null);
  const [realTimeTracking, setRealTimeTracking] = useState(false);
  const [subscription, setSubscription] = useState(null);

  // Función para iniciar el seguimiento en tiempo real
  const startRealTimeTracking = () => {
    const db = getFirestore();
    const userRef = doc(db, 'usuarios', userId);
    const locationCollection = collection(userRef, 'locations');
    
    // Crear consulta ordenada por timestamp descendente
    const q = query(locationCollection, orderBy('timestamp', 'desc'));
    
    // Suscribirse a cambios en tiempo real
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const updatedLocations = snapshot.docs.map(doc => {
        const data = doc.data();
        const timestampDate = data.timestamp ? new Date(data.timestamp) : new Date();
        
        return {
          id: doc.id,
          ...data,
          formattedDate: timestampDate.toLocaleString(),
          timestamp: timestampDate.getTime()
        };
      });
      
      setLocations(updatedLocations);
      if (updatedLocations.length > 0) {
        setLastLocation(updatedLocations[0]);
      }
    });
    
    setSubscription(unsubscribe);
    setRealTimeTracking(true);
  };

  // Función para detener el seguimiento en tiempo real
  const stopRealTimeTracking = () => {
    if (subscription) {
      subscription(); // Llama a la función de unsubscribe
      setSubscription(null);
    }
    setRealTimeTracking(false);
  };

  // Cargar datos iniciales
  useEffect(() => {
    const fetchInitialLocations = async () => {
      try {
        const db = getFirestore();
        const userRef = doc(db, 'usuarios', userId);
        const locationCollection = collection(userRef, 'locations');
        const q = query(locationCollection, orderBy('timestamp', 'desc'));
        
        const snapshot = await getDocs(q);
        const fetchedLocations = snapshot.docs.map(doc => {
          const data = doc.data();
          const timestampDate = data.timestamp ? new Date(data.timestamp) : new Date();
          
          return {
            id: doc.id,
            ...data,
            formattedDate: timestampDate.toLocaleString(),
            timestamp: timestampDate.getTime()
          };
        });
        
        setLocations(fetchedLocations);
        if (fetchedLocations.length > 0) {
          setLastLocation(fetchedLocations[0]);
        }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching locations: ', error);
        setLoading(false);
      }
    };
    
    fetchInitialLocations();
    
    // Limpiar la suscripción al desmontar el componente
    return () => {
      if (subscription) {
        subscription();
      }
    };
  }, [userId]);

  const renderLocationItem = ({ item }) => (
    <TouchableOpacity
      style={styles.locationItem}
      onPress={() => navigation.navigate('UserLocationMap', { location: item })}
    >
      <Text style={styles.coordinates}>{item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}</Text>
      <Text style={styles.date}>{item.formattedDate}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return <ActivityIndicator size="large" style={styles.loader} />;
  }

  if (locations.length === 0) {
    return <Text style={styles.noData}>No hay ubicaciones disponibles para este usuario.</Text>;
  }

  return (
    <View style={styles.container}>
      {/* Controles de seguimiento en tiempo real */}
      <View style={styles.realTimeControls}>
        {!realTimeTracking ? (
          <TouchableOpacity 
            style={[styles.trackingButton, styles.startTrackingButton]}
            onPress={startRealTimeTracking}
          >
            <Text style={styles.trackingButtonText}>Iniciar Seguimiento en Tiempo Real</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={[styles.trackingButton, styles.stopTrackingButton]}
            onPress={stopRealTimeTracking}
          >
            <Text style={styles.trackingButtonText}>Detener Seguimiento</Text>
          </TouchableOpacity>
        )}
        
        {realTimeTracking && (
          <View style={styles.trackingStatus}>
            <View style={styles.trackingIndicator} />
            <Text style={styles.trackingStatusText}>Seguimiento activo</Text>
          </View>
        )}
      </View>

      {/* Mapa en tiempo real */}
      {lastLocation && (
        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: lastLocation.latitude,
              longitude: lastLocation.longitude,
              latitudeDelta: 0.0922,
              longitudeDelta: 0.0421,
            }}
            region={realTimeTracking ? {
              latitude: lastLocation.latitude,
              longitude: lastLocation.longitude,
              latitudeDelta: 0.0922,
              longitudeDelta: 0.0421,
            } : null}
          >
            <Marker
              coordinate={{
                latitude: lastLocation.latitude,
                longitude: lastLocation.longitude,
              }}
              title="Ubicación actual"
              description={`Actualizado: ${lastLocation.formattedDate}`}
              pinColor="#3498db"
            />
          </MapView>
        </View>
      )}

      {/* Sección de última ubicación */}
      <View style={styles.lastLocationSection}>
        <Text style={styles.sectionTitle}>Última ubicación registrada</Text>
        {lastLocation && (
          <View style={styles.lastLocationCard}>
            <Text style={styles.lastLocationCoords}>
              {lastLocation.latitude.toFixed(4)}, {lastLocation.longitude.toFixed(4)}
            </Text>
            <Text style={styles.lastLocationDate}>Actualizado: {lastLocation.formattedDate}</Text>
            <TouchableOpacity
              style={styles.viewMapButton}
              onPress={() => navigation.navigate('UserLocationMap', { location: lastLocation })}
            >
              <Text style={styles.viewMapButtonText}>Ver en mapa completo</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Listado de ubicaciones recientes */}
      <View style={styles.recentLocationsSection}>
        <Text style={styles.sectionTitle}>Historial de ubicaciones</Text>
        <FlatList
          data={locations.slice(1)} // Excluimos la última que ya mostramos arriba
          renderItem={renderLocationItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noData: {
    flex: 1,
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
    color: '#666',
  },
  realTimeControls: {
    marginBottom: 20,
    alignItems: 'center',
  },
  trackingButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
    width: '100%',
  },
  startTrackingButton: {
    backgroundColor: '#27ae60',
  },
  stopTrackingButton: {
    backgroundColor: '#e74c3c',
  },
  trackingButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  trackingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trackingIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#e74c3c',
    marginRight: 8,
  },
  trackingStatusText: {
    color: '#e74c3c',
    fontWeight: 'bold',
  },
  mapContainer: {
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 20,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  lastLocationSection: {
    marginBottom: 20,
  },
  recentLocationsSection: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  lastLocationCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  lastLocationCoords: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#2c3e50',
  },
  lastLocationDate: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 10,
  },
  viewMapButton: {
    backgroundColor: '#3498db',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  viewMapButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  locationItem: {
    backgroundColor: 'white',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 1,
  },
  coordinates: {
    fontSize: 15,
    color: '#2c3e50',
    marginBottom: 5,
  },
  date: {
    fontSize: 13,
    color: '#7f8c8d',
  },
  listContent: {
    paddingBottom: 20,
  },
});

export default UserLocationsList;