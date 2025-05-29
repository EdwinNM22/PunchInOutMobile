import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

export default function ReporteUsuario() {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId } = route.params;

  const navigateToReport = (screen) => {
    navigation.navigate(screen, { userId });
  };

  const buttonColors = {
    weekly: '#3498db',
    monthly: '#2ecc71',
    projects: '#9b59b6',
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Reporte de Horas</Text>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.reportButton, { backgroundColor: buttonColors.weekly }]}
          onPress={() => navigateToReport('ReporteSemanal')}
        >
          <Text style={styles.reportButtonText}>Reporte Semanal</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.reportButton, { backgroundColor: buttonColors.monthly }]}
          onPress={() => navigateToReport('ReporteMensual')}
        >
          <Text style={styles.reportButtonText}>Reporte Mensual</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.reportButton, { backgroundColor: buttonColors.projects }]}
          onPress={() => navigateToReport('ReporteProyectos')}
        >
          <Text style={styles.reportButtonText}>Reporte por Proyectos</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
    padding: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
    marginVertical: 30,
    marginBottom: 40,
  },
  reportButton: {
    borderRadius: 15,
    paddingVertical: 25,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    maxHeight: 150,
    minHeight: 120,
  },
  reportButtonText: {
    color: 'white',
    fontSize: 22,
    fontWeight: '600',
  },
  buttonContainer: {
    flex: 1,
    justifyContent: 'space-around',
  },
});
