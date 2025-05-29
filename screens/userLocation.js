import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { getFirestore, doc, collection, getDocs, orderBy, query } from 'firebase/firestore';

const UserLocationsList = ({ route, navigation }) => {
  const { userId } = route.params;
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastLocation, setLastLocation] = useState(null);

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const db = getFirestore();
        const userRef = doc(db, 'usuarios', userId);
        const locationCollection = collection(userRef, 'locations');

        // Obtenemos todos los documentos sin ordenar primero
        const snapshot = await getDocs(locationCollection);

        const fetchedLocations = snapshot.docs.map(doc => {
          const data = doc.data();
          // Parseamos el timestamp ISO string a Date
          const timestampDate = data.timestamp ? new Date(data.timestamp) : new Date();

          return {
            id: doc.id,
            ...data,
            formattedDate: timestampDate.toLocaleString(),
            timestamp: timestampDate.getTime() // Convertimos a timestamp numérico para ordenar
          };
        });

        // Ordenamos por timestamp (más reciente primero)
        const sortedLocations = fetchedLocations.sort((a, b) => b.timestamp - a.timestamp);

        setLocations(sortedLocations);
        if (sortedLocations.length > 0) {
          setLastLocation(sortedLocations[0]);
        }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching locations: ', error);
        setLoading(false);
      }
    };

    fetchLocations();
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
              <Text style={styles.viewMapButtonText}>Ver en mapa</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Listado de ubicaciones recientes */}
      <View style={styles.recentLocationsSection}>
        <Text style={styles.sectionTitle}>Ubicaciones recientes</Text>
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