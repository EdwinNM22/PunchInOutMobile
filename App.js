import React, { useEffect } from 'react';            
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Modal, TextInput } from 'react-native';
import 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';
import Login from './screens/Login';
import Register from './screens/Register';
import UserHome from './screens/UserHome';
// import AdminHome from './screens/AdminHome';
import MapaPage from './screens/MapPage';
import UserLocation from './screens/userLocation';

// user
import UserProjects from './screens/UserProjects';
import UserProjectDetail from './screens/UserProjectDetail';

//Pantallas de administrador
import AdminDashboard from './screens/AdminDashboard';
import AdminUsers from './screens/AdminUsers';
import AdminProjects from './screens/AdminProjects';
import CreateProject from './screens/CreateProject';
import SelectLocation from './screens/SelectLocation';
import AssignProject from './screens/AssignProject';
import SelectWorker from './screens/SelectWorker';
import adminGestion from './screens/adminGestion';

import AdminProjectReports from './screens/AdminProjectReports';
import UserOptions from './screens/UserOptions';
import UserLocationMap from './screens/UserLocationMap';
import ReporteUsuario from './screens/ReporteHoras/ReporteUsuario';
import ReporteSemanal from './screens/ReporteHoras/ReporteSemanal';
import ReporteMensual from './screens/ReporteHoras/ReporteMensual';
import ReporteProyectos from './screens/ReporteHoras/ReporteProyectos';

import ProfilePictureUploader from './screens/ProfilePictureUploader';
import ChatScreen from './screens/UserChat/ChatScreen';
import MessageScreen from './screens/UserChat/MessageScreen';






export default function App() {
  useEffect(() => {
    (async () => {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        const { status: newStatus } = await Notifications.requestPermissionsAsync();
        if (newStatus !== 'granted') {
          console.log('🔕  User denied push‑notification permission');
        }
      }
    })();
  }, []);

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });

  const Stack = createStackNavigator();

  function MyStack() {
    return (
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#121212' },
          headerTintColor: '#E53935',
          headerTitleStyle: { fontWeight: 'bold' },
          contentStyle: { backgroundColor: '#121212' },
        }}
      >
        {/* Pantallas generales */}
        <Stack.Screen name="Login" component={Login} />
        <Stack.Screen name="Register" component={Register} />
        <Stack.Screen name="ChatScreen" component={ChatScreen} />
        <Stack.Screen name="MessageScreen" component={MessageScreen} />

        {/* Pantallas de usuario */}
        <Stack.Screen name="UserHome" component={UserHome} />
        <Stack.Screen name="UserLocation" component={UserLocation} />
        <Stack.Screen name="MapPage" component={MapaPage} />
        <Stack.Screen name="UserProjects" component={UserProjects} />
        <Stack.Screen name="UserProjectDetail" component={UserProjectDetail} />
                <Stack.Screen name="ProfilePictureUploader" component={ProfilePictureUploader} />

        {/* Pantallas de administrador */}
        <Stack.Screen name="AdminDashboard" component={AdminDashboard} />
        <Stack.Screen name="AdminUsers" component={AdminUsers} />
        <Stack.Screen name="AdminProjects" component={AdminProjects} />
        <Stack.Screen name="CreateProject" component={CreateProject} options={{ unmountOnBlur: false }} />
        <Stack.Screen name="SelectLocation" component={SelectLocation} />
        <Stack.Screen name="AssignProject" component={AssignProject} />
        <Stack.Screen name="SelectWorker" component={SelectWorker} />
        <Stack.Screen name="adminGestion" component={adminGestion} />

        {/* Reporte de horas */}
        <Stack.Screen name="ReporteUsuario" component={ReporteUsuario} />
        <Stack.Screen name="ReporteSemanal" component={ReporteSemanal} />
        <Stack.Screen name="ReporteMensual" component={ReporteMensual} />
        <Stack.Screen name="ReporteProyectos" component={ReporteProyectos} />

        <Stack.Screen name="AdminProjectReports" component={AdminProjectReports} options={{ title: 'Reportes del proyecto' }} />
        <Stack.Screen name="UserOptions" component={UserOptions} />
        <Stack.Screen name="UserLocationMap" component={UserLocationMap} />
      </Stack.Navigator>
    );
  }

  return (
  <SafeAreaProvider>
    <NavigationContainer>
      <MyStack />
    </NavigationContainer>
    <StatusBar style="light" />
  </SafeAreaProvider>
);
}
