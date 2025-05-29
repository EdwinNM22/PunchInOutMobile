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
import ReporteUsuario from './screens/ReporteUsuario';
import AdminProjectReports from './screens/AdminProjectReports';
import UserOptions from './screens/UserOptions';
import UserLocationMap from './screens/UserLocationMap';

export default function App() {
  useEffect(() => {
    (async () => {
      // En iOS primero revisa si el usuario ya le dio permiso a la app para recibir notificaciones y si no se lo pide
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        const { status: newStatus } = await Notifications.requestPermissionsAsync();
        if (newStatus !== 'granted') {
          console.log('🔕  User denied push‑notification permission');
        }
      }
    })();
  }, []);

  /* Le dice a expo qué hacer cuando la app está corriendo al fondo */
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,   // show banner
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });

  //Navegación
  const Stack = createStackNavigator();

  function MyStack() {
    return (
      <Stack.Navigator>
        {/* Pantallas generales */}
        <Stack.Screen name="Login" component={Login} />
        <Stack.Screen name="Register" component={Register} />

        {/* Pantallas de usuario */}
        <Stack.Screen name="UserHome" component={UserHome} />
        {/* <Stack.Screen name="AdminHome" component={AdminHome} /> */}
        <Stack.Screen name="UserLocation" component={UserLocation} />
        <Stack.Screen name="MapPage" component={MapaPage} />
      
        <Stack.Screen name="UserProjects" component={UserProjects} />
        <Stack.Screen name="UserProjectDetail" component={UserProjectDetail} />

        {/* Pantallas de administrador */} 
        <Stack.Screen name="AdminDashboard" component={AdminDashboard} />
        <Stack.Screen name="AdminUsers" component={AdminUsers} />
        <Stack.Screen name="AdminProjects" component={AdminProjects} />
        <Stack.Screen name="CreateProject" component={CreateProject} options={{ unmountOnBlur: false }}/>
        <Stack.Screen name="SelectLocation" component={SelectLocation} />
        <Stack.Screen name="AssignProject" component={AssignProject} />
        <Stack.Screen name="SelectWorker" component={SelectWorker} />
        <Stack.Screen name="adminGestion" component={adminGestion} />
        <Stack.Screen name="ReporteUsuario" component={ReporteUsuario} />
        <Stack.Screen name="AdminProjectReports" component={AdminProjectReports} options={{ title: 'Reportes del proyecto' }} />
        <Stack.Screen name="UserOptions" component={UserOptions} />
        <Stack.Screen name="UserLocationMap" component={UserLocationMap} />
        {/* Pantallas de carga */}
      </Stack.Navigator>
    );
  }

  return (
    <SafeAreaProvider>
    <NavigationContainer>
      <MyStack/>
    </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
