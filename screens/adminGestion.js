import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

export default function AdminGestion() {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId } = route.params;

  const handleGoToLocation = () => {
    navigation.navigate('UserLocation', { userId });
  };

  const handleGoToReport = () => {
    navigation.navigate('ReporteUsuario', { userId });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gestión del Usuario</Text>
      <Text style={styles.subText}>ID del usuario: {userId}</Text>
      <View style={styles.buttonContainer}>
        <Button
          title="Ver ubicación del usuario"
          onPress={handleGoToLocation}
        />
      </View>
      <View style={styles.buttonContainer}>
        <Button
          title="Ver reporte del usuario"
          onPress={handleGoToReport}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    marginBottom: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  subText: {
    marginBottom: 20,
    fontSize: 16,
    textAlign: 'center',
  },
  buttonContainer: {
    marginVertical: 10,
  },
});