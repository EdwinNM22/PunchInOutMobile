// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getStorage } from "firebase/storage";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC9ZlxtdOTUGWTDgrKTRi0MTcZBcMAmL-Q",
  authDomain: "constructionprovisional.firebaseapp.com",
  projectId: "constructionprovisional",
  storageBucket: "constructionprovisional.firebasestorage.app",
  messagingSenderId: "304936862930",
  appId: "1:304936862930:web:f09280851fd2d04024990b",
  measurementId: "G-ZFFR81HQ1F"
};

// Initialize Firebase
const appFirebase = initializeApp(firebaseConfig);

// Inicializar Storage
getStorage(appFirebase);

export default appFirebase