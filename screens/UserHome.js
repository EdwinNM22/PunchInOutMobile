import { Text, StyleSheet, View, TouchableOpacity, SafeAreaView } from 'react-native';
import React, { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import * as Location from 'expo-location';
import appFirebase from '../credenciales';

const auth = getAuth(appFirebase);
const db = getFirestore(appFirebase);

export default function UserHome({ navigation }) {
  const [userName, setUserName] = useState('');
  const [pushInTime, setPushInTime] = useState(null);
  const [pushOutTime, setPushOutTime] = useState(null);
  const [totalHours, setTotalHours] = useState(null);
  const [day, setDay] = useState(new Date().getDay());
  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    const fetchUserData = async () => {
      const user = auth.currentUser;
      if (user) {
        const docRef = doc(db, 'usuarios', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUserName(docSnap.data().nombre);
        }
      }
    };

    fetchUserData();
  }, []);

  const handlePushIn = async () => {
    const user = auth.currentUser;
    if (user) {
      const currentTime = new Date().toISOString();
      setPushInTime(currentTime);

      const dayString = getDayString(day);

      const docRef = doc(db, 'usuarios', user.uid, 'horas', dayString);
      await setDoc(docRef, {
        pushInTime: currentTime,
        pushOutTime: null,
        totalHours: 0,
      });
    }
  };

  const handlePushOut = async () => {
    const user = auth.currentUser;
    if (user && pushInTime) {
      const currentTime = new Date().toISOString();
      setPushOutTime(currentTime);

      const startTime = new Date(pushInTime);
      const endTime = new Date(currentTime);
      const timeDiff = (endTime - startTime) / 1000 / 60 / 60;
      const roundedTime = timeDiff.toFixed(2);
      setTotalHours(roundedTime);

      const dayString = getDayString(day);

      const docRef = doc(db, 'usuarios', user.uid, 'horas', dayString);
      await updateDoc(docRef, {
        pushOutTime: currentTime,
        totalHours: timeDiff,
      });
    }
  };

  const getDayString = (dayIndex) => {
    switch (dayIndex) {
      case 0: return 'domingo';
      case 1: return 'lunes';
      case 2: return 'martes';
      case 3: return 'miércoles';
      case 4: return 'jueves';
      case 5: return 'viernes';
      case 6: return 'sábado';
      default: return '';
    }
  };

  const getUserLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      const location = await Location.getCurrentPositionAsync({});
      setUserLocation(location);

      const user = auth.currentUser;
      if (user && location) {
        const docRef = doc(db, 'usuarios', user.uid, 'location', new Date().toISOString());
        await setDoc(docRef, {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          timestamp: new Date().toISOString(),
        });
        navigation.navigate('MapPage', { location: location.coords });
      }
    } else {
      alert('Se necesitan permisos para acceder a la ubicación');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Bienvenido, {userName || 'Usuario'}</Text>
        <Text style={styles.subtitle}>Gestiona tus proyectos fácilmente</Text>
      </View>

      <View style={styles.optionsContainer}>
        <TouchableOpacity
          style={[styles.optionCard, styles.option1]}
          onPress={handlePushIn}
        >
          <Ionicons name="folder-open" size={32} color="#fff" />
          <Text style={styles.optionText}>Push In</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.optionCard, styles.option2]}
          onPress={handlePushOut}
        >
          <Ionicons name="add-circle" size={32} color="#fff" />
          <Text style={styles.optionText}>Push Out</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.optionCard, styles.option1]}
          onPress={getUserLocation}
        >
          <Ionicons name="location" size={32} color="#fff" />
          <Text style={styles.optionText}>Ver Ubicación</Text>
        </TouchableOpacity>

        {totalHours && (
          <Text style={styles.totalHours}>Horas trabajadas: {totalHours} horas</Text>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Gestor de Proyectos v1.0</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    padding: 20,
    paddingTop: 40,
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    marginTop: 5,
  },
  optionsContainer: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  optionCard: {
    height: 100,
    borderRadius: 15,
    marginVertical: 10,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  option1: {
    backgroundColor: '#3498db',
  },
  option2: {
    backgroundColor: '#2ecc71',
  },
  option3: {
    backgroundColor: '#f39c12',
  },
  optionText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginLeft: 15,
  },
  totalHours: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    textAlign: 'center',
  },
  footer: {
    padding: 15,
    alignItems: 'center',
  },
  footerText: {
    color: '#95a5a6',
    fontSize: 12,
  },
});
