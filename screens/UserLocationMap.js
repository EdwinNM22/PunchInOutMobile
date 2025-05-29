import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

const UserLocationMap = ({ route }) => {
  const { location } = route.params;

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
      >
        <Marker coordinate={{ latitude: location.latitude, longitude: location.longitude }} />
      </MapView>
      <View style={styles.infoContainer}>
        <Text style={styles.coordinates}>
          {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
        </Text>
        <Text style={styles.date}>Actualizado: {location.formattedDate || 'Fecha no disponible'}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  infoContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  coordinates: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#2c3e50',
  },
  date: {
    fontSize: 14,
    color: '#7f8c8d',
  },
});

export default UserLocationMap;