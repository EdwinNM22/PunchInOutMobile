import React from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  SafeAreaView,
  ScrollView,
  ImageBackground,
  Dimensions
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

const { height } = Dimensions.get('window');

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
    <ImageBackground
      source={require('../../assets/fondo8.jpg')}
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
              <Text style={styles.headerTitle}>Reportes de Horas</Text>
              <View style={styles.emptySpace} />
            </View>

            {/* Botones de reporte - ahora más grandes */}
            <View style={styles.buttonsMainContainer}>
              <TouchableOpacity
                style={[styles.largeActionButton, { borderLeftColor: buttonColors.weekly }]}
                onPress={() => navigateToReport('ReporteSemanal')}
              >
                <Text style={styles.largeActionButtonText}>Reporte Semanal</Text>
                <Ionicons name="chevron-forward" size={24} color="white" style={styles.chevron} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.largeActionButton, { borderLeftColor: buttonColors.monthly }]}
                onPress={() => navigateToReport('ReporteMensual')}
              >
                <Text style={styles.largeActionButtonText}>Reporte Mensual</Text>
                <Ionicons name="chevron-forward" size={24} color="white" style={styles.chevron} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.largeActionButton, { borderLeftColor: buttonColors.projects }]}
                onPress={() => navigateToReport('ReporteProyectos')}
              >
                <Text style={styles.largeActionButtonText}>Reporte por Proyectos</Text>
                <Ionicons name="chevron-forward" size={24} color="white" style={styles.chevron} />
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 20,
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
  buttonsMainContainer: {
    flex: 1,
    justifyContent: 'space-around',
    marginTop: 20,
  },
  largeActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 25,
    borderRadius: 8,
    marginBottom: 25,
    backgroundColor: 'rgba(30, 30, 30, 0.7)',
    borderLeftWidth: 6,
    minHeight: height * 0.18, // 18% de la altura de pantalla
  },
  largeActionButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: '600',
    marginLeft: 15,
    flex: 1,
  },
  chevron: {
    marginLeft: 10,
  },
});