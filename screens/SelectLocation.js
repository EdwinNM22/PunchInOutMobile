// Para que el admin selecciones la ubicación del proyecto
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';

const SelectLocation = ({ navigation, route }) => {
  const [markerCoords, setMarkerCoords] = useState(null);
  const mapRef = useRef(null);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setMarkerCoords({ latitude: 37.78825, longitude: -122.4324 }); // por si no se puede acceder a la ubicación
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setMarkerCoords({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    })();
  }, []);

  const handleMapLongPress = (event) => {
    const coords = event.nativeEvent.coordinate;
    setMarkerCoords(coords);
  };

  const handleConfirm = () => {
    if (route.params?.onLocationSelected) {
      route.params.onLocationSelected(markerCoords);
    }
    navigation.goBack();
  };

  if (!markerCoords) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text>Cargando mapa...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        ref={mapRef}
        initialRegion={{
          ...markerCoords,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        onLongPress={handleMapLongPress}
        showsUserLocation
        showsMyLocationButton
      >
        <Marker
          coordinate={markerCoords}
          draggable
          onDragEnd={(e) => setMarkerCoords(e.nativeEvent.coordinate)}
        />
      </MapView>

      <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
        <Text style={styles.buttonText}>Confirmar Ubicación</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  confirmButton: {
    position: 'absolute',
    bottom: 20,
    left: '20%',
    right: '20%',
    backgroundColor: '#4a76ff',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    zIndex: 1,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default SelectLocation;
