// utils/pushRegistration.js
import * as Notifications from 'expo-notifications';
import * as Device         from 'expo-device';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { Alert, Platform } from 'react-native';
import appFirebase from '../credenciales';

export async function registerForPushToken(uid) {
  try {
    if (!Device.isDevice) return;                       // simuladores iOS no sirven

    const { status } = await Notifications.getPermissionsAsync();
    let finalStatus = status;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      finalStatus = req.status;
    }
    if (finalStatus !== 'granted')
      return Alert.alert('Aviso','Sin permisos de notificación');

    const token = (await Notifications.getExpoPushTokenAsync()).data;

    const db = getFirestore(appFirebase);
    await setDoc(
      doc(db,'usuarios',uid),
      { expoToken: token }, { merge:true }
    );
  } catch(e){ console.error('Push-token',e); }
}
