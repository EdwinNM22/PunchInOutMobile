// screens/UserProjectDetail.js
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  SafeAreaView,
  Linking,
  ActivityIndicator,
  ScrollView,
  Image,
  ImageBackground,
  TextInput,
  Modal,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
} from "firebase/firestore";

/* ────────────────────────────────────────────────────────────── */
/* helper: muestra link a la ubicación del proyecto              */
const ProjectLocation = React.memo(({ location }) => (
  <TouchableOpacity
    style={styles.locationLink}
    onPress={() =>
      Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`
      )
    }
  >
    <Text style={styles.locationLinkText}>
      <Ionicons name="map" size={16} color="#E53935" /> Ver en mapa:{" "}
      {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
    </Text>
  </TouchableOpacity>
));
/* ────────────────────────────────────────────────────────────── */

export default function UserProjectDetail({ route, navigation }) {
  const { project } = route.params;
  const auth = getAuth();
  const db = getFirestore();

  /* estado general */
  const [currentRecordId, setCurrentRecordId] = useState(null);
  const [pushInTime, setPushInTime] = useState(null);
  const [totalHours, setTotalHours] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processingAction, setProcessingAction] = useState(false);
  const [todayRecords, setTodayRecords] = useState([]);
  const [userRole, setUserRole] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportContent, setReportContent] = useState("");
  const [savingReport, setSavingReport] = useState(false);
  const [existingReport, setExistingReport] = useState(null);
  const [reportId, setReportId] = useState(null);

  /* geofence */
  const locationSub = useRef(null);
  const threshold = 200;

  /* ─── helpers fecha ───────────────────────────────────────── */
  const todayString = useCallback(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const getCurrentTimestampId = useCallback(() => {
    const now = new Date();
    return `${todayString()}_${now.getHours()}${now.getMinutes()}${now.getSeconds()}${now.getMilliseconds()}`;
  }, [todayString]);

  const distMeters = useCallback((lat1, lon1, lat2, lon2) => {
    const toRad = (v) => (v * Math.PI) / 180,
      R = 6371e3;
    const dLat = toRad(lat2 - lat1),
      dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, []);

  /* ─── geofence watch — se activa sólo con Push-In ─────────── */
  const watchDistance = useCallback(async () => {
    locationSub.current?.remove();
    locationSub.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Highest, distanceInterval: 10 },
      async (loc) => {
        const d = distMeters(
          loc.coords.latitude,
          loc.coords.longitude,
          project.location.latitude,
          project.location.longitude
        );
        if (d > threshold) {
          Alert.alert(
            "Te alejaste del proyecto",
            "Superaste el radio permitido; se cerró tu turno automáticamente."
          );
          await doPushOut(true);
        }
      }
    );
  }, [distMeters, project.location]);

  /* ─── Obtener registros del día actual ───────────────────── */
  const fetchTodayRecords = useCallback(async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const recordsRef = collection(
        db,
        "usuarios",
        user.uid,
        "horas",
        project.id,
        "registros"
      );
      const q = query(recordsRef, where("fecha", "==", todayString()));
      const querySnapshot = await getDocs(q);

      const records = [];
      let total = 0;
      let activeRecord = null;

      querySnapshot.forEach((doc) => {
        const record = { id: doc.id, ...doc.data() };
        records.push(record);

        if (record.totalHours) {
          total += record.totalHours;
        }

        if (!record.pushOutTime) {
          activeRecord = record;
        }
      });

      setTodayRecords(records);
      setTotalHours(total);

      if (activeRecord) {
        setCurrentRecordId(activeRecord.id);
        setPushInTime(activeRecord.pushInTime);
        watchDistance();
      }
    } catch (e) {
      console.error("Error fetching today records:", e);
    }
  }, [auth.currentUser, db, project.id, todayString, watchDistance]);

  /* ─── Obtener rol del usuario en el proyecto ─────────────── */
  const fetchUserRole = useCallback(async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const assignmentRef = doc(db, "proyectos", project.id, "assignments", user.uid);
      const assignmentSnap = await getDoc(assignmentRef);

      if (assignmentSnap.exists()) {
        setUserRole(assignmentSnap.data().role);
      }
    } catch (e) {
      console.error("Error fetching user role:", e);
    }
  }, [auth.currentUser, db, project.id]);

  /* ─── Buscar reporte existente ───────────────────────────── */
  const fetchExistingReport = useCallback(async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const reportsRef = collection(db, "reportes");
      const q = query(
        reportsRef,
        where("projectId", "==", project.id),
        where("createdBy", "==", user.uid),
        where("fecha", "==", todayString())
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const reportDoc = querySnapshot.docs[0];
        setExistingReport(reportDoc.data());
        setReportId(reportDoc.id);
        setReportContent(reportDoc.data().content || "");
      }
    } catch (e) {
      console.error("Error fetching existing report:", e);
    }
  }, [auth.currentUser, db, project.id, todayString]);

  /* ─── Crear o actualizar reporte ─────────────────────────── */
  const handleSaveReport = async () => {
    if (!reportContent.trim()) {
      Alert.alert("Error", "Por favor ingresa el contenido del reporte");
      return;
    }

    setSavingReport(true);
    try {
      const user = auth.currentUser;
      if (!user) return;

      const reportData = {
        content: reportContent,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: user.uid,
        projectId: project.id,
        projectName: project.name,
        fecha: todayString(),
      };

      if (reportId) {
        // Actualizar reporte existente
        await updateDoc(doc(db, "reportes", reportId), reportData);
        Alert.alert("Éxito", "Reporte actualizado correctamente");
      } else {
        // Crear nuevo reporte
        const docRef = await addDoc(collection(db, "reportes"), reportData);
        setReportId(docRef.id);
        Alert.alert("Éxito", "Reporte creado correctamente");
      }

      setExistingReport(reportData);
      setShowReportModal(false);
    } catch (e) {
      console.error("Error saving report:", e);
      Alert.alert("Error", "No se pudo guardar el reporte");
    } finally {
      setSavingReport(false);
    }
  };

  /* ─── PUSH-IN ─────────────────────────────────────────────── */
  const doPushIn = useCallback(async () => {
    if (processingAction) return;
    setProcessingAction(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permiso denegado");
        setProcessingAction(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      const d = distMeters(
        loc.coords.latitude,
        loc.coords.longitude,
        project.location.latitude,
        project.location.longitude
      );
      if (d > threshold) {
        Alert.alert("Muy lejos del proyecto");
        setProcessingAction(false);
        return;
      }

      const nowISO = new Date().toISOString();
      const recordId = getCurrentTimestampId();
      const user = auth.currentUser;
      const recordRef = doc(
        db,
        "usuarios",
        user.uid,
        "horas",
        project.id,
        "registros",
        recordId
      );

      await setDoc(recordRef, {
        pushInTime: nowISO,
        pushOutTime: null,
        totalHours: 0,
        fecha: todayString(),
        location: {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        },
      });

      setCurrentRecordId(recordId);
      setPushInTime(nowISO);
      watchDistance();
      fetchTodayRecords();
      Alert.alert("Push In exitoso");
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "No se pudo hacer Push In");
    } finally {
      setProcessingAction(false);
    }
  }, [
    auth.currentUser,
    db,
    distMeters,
    project.id,
    project.location,
    todayString,
    watchDistance,
    processingAction,
    fetchTodayRecords,
    getCurrentTimestampId,
  ]);

  /* ─── PUSH-OUT ────────────────────────────────────────────── */
  const doPushOut = useCallback(
    async (silent = false) => {
      if (processingAction || !currentRecordId) return;
      setProcessingAction(true);

      try {
        const user = auth.currentUser;
        if (!user || !pushInTime) return;

        const nowISO = new Date().toISOString();
        const diffHrs = (
          (new Date(nowISO) - new Date(pushInTime)) /
          3.6e6
        ).toFixed(2);
        const recordRef = doc(
          db,
          "usuarios",
          user.uid,
          "horas",
          project.id,
          "registros",
          currentRecordId
        );

        await updateDoc(recordRef, {
          pushOutTime: nowISO,
          totalHours: Number(diffHrs),
        });

        setTotalHours((prev) => prev + Number(diffHrs));
        setPushInTime(null);
        setCurrentRecordId(null);
        locationSub.current?.remove();
        locationSub.current = null;
        fetchTodayRecords();

        if (!silent)
          Alert.alert("Push Out exitoso", `Horas trabajadas: ${diffHrs} h`);
      } catch (e) {
        console.error(e);
        if (!silent) Alert.alert("Error", "No se pudo hacer Push Out");
      } finally {
        setProcessingAction(false);
      }
    },
    [
      auth.currentUser,
      db,
      pushInTime,
      project.id,
      currentRecordId,
      fetchTodayRecords,
      processingAction,
    ]
  );

  /* ─── primer montaje: ver si ya hay Push-In activo ────────── */
  useEffect(() => {
    const init = async () => {
      try {
        await fetchTodayRecords();
        await fetchUserRole();
        await fetchExistingReport();
      } catch (e) {
        console.error("init UserProjectDetail", e);
      } finally {
        setLoading(false);
      }
    };

    init();
    return () => locationSub.current?.remove();
  }, [auth.currentUser, db, project.id, fetchTodayRecords, fetchUserRole, fetchExistingReport]);

  /* ─── quick UI shortcuts ─────────────────────────────────── */
  const { optionStyle, buttonLabel, buttonAction } = {
    optionStyle: pushInTime ? styles.option2 : styles.option1,
    buttonLabel: pushInTime ? "Push Out" : "Push In",
    buttonAction: pushInTime ? doPushOut : doPushIn,
  };

  /* ─── LOADING first paint ────────────────────────────────── */
  if (loading)
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E53935" />
        <Text style={styles.loadingText}>Cargando proyecto...</Text>
      </View>
    );

  /* ─────────────────────────────────────────────────────────── */
  return (
    <ImageBackground
      source={require("../assets/fondo8.jpg")}
      style={{ flex: 1 }}
      resizeMode="cover"
    >
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          {/* ——— Encabezado ——— */}
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <Text style={styles.headerTitle}>{project.name}</Text>
              <Image
                source={require("../assets/biovizion.jpg")}
                style={styles.headerIcon}
              />
            </View>
            <Text style={styles.projectDescription}>{project.description}</Text>
            {project.location && (
              <ProjectLocation location={project.location} />
            )}
          </View>

          {/* ——— Push-In / Out ——— */}
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={[styles.actionButton, optionStyle]}
              onPress={buttonAction}
              disabled={processingAction}
            >
              {processingAction ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons
                    name={pushInTime ? "log-out" : "log-in"}
                    size={22}
                    color="#fff"
                  />
                  <Text style={styles.actionButtonText}>{buttonLabel}</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Botón de reporte solo para supervisores */}
            {userRole === 'supervisor' && (
              <TouchableOpacity
                style={[styles.actionButton, existingReport ? styles.continueReportButton : styles.newReportButton]}
                onPress={() => setShowReportModal(true)}
                disabled={processingAction}
              >
                <MaterialIcons 
                  name={existingReport ? "edit" : "report"} 
                  size={22} 
                  color="#fff" 
                />
                <Text style={styles.actionButtonText}>
                  {existingReport ? 'Continuar Reporte' : 'Crear Reporte'}
                </Text>
              </TouchableOpacity>
            )}

            <View style={styles.hoursContainer}>
              <Text style={styles.hoursText}>Horas trabajadas hoy:</Text>
              <Text style={styles.hoursValue}>{totalHours.toFixed(2)} h</Text>
            </View>

            {/* Lista de registros del día */}
            {todayRecords.length > 0 && (
              <View style={styles.recordsContainer}>
                <Text style={styles.recordsTitle}>Registros de hoy:</Text>
                {todayRecords.map((record, index) => (
                  <View key={record.id} style={styles.recordItem}>
                    <Text style={styles.recordText}>
                      {new Date(record.pushInTime).toLocaleTimeString()} -
                      {record.pushOutTime
                        ? ` ${new Date(
                            record.pushOutTime
                          ).toLocaleTimeString()}`
                        : " En progreso"}
                    </Text>
                    <Text style={styles.recordHours}>
                      {record.pushOutTime
                        ? `${record.totalHours.toFixed(2)} h`
                        : ""}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>

        {/* Modal para crear/editar reporte */}
        <Modal
          visible={showReportModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowReportModal(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {existingReport ? 'Editar Reporte' : 'Nuevo Reporte'}
              </Text>
              
              <TextInput
                style={styles.reportInput}
                placeholder="Describe el reporte..."
                placeholderTextColor="#888"
                multiline
                numberOfLines={6}
                value={reportContent}
                onChangeText={setReportContent}
              />
              
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setShowReportModal(false)}
                  disabled={savingReport}
                >
                  <Text style={styles.modalButtonText}>Cancelar</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.modalButton, styles.submitButton]}
                  onPress={handleSaveReport}
                  disabled={savingReport}
                >
                  {savingReport ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalButtonText}>
                      {existingReport ? 'Actualizar' : 'Guardar'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </ImageBackground>
  );
}

/* ───────────────────────── estilos ─────────────────────────── */
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'rgba(18, 18, 18, 0.53)',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#121212",
  },
  loadingText: {
    color: "#FFFFFF",
    marginTop: 10,
  },
  header: {
    padding: 20,
    paddingTop: 10,
    marginBottom: 15,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
    flex: 1,
  },
  headerIcon: {
    width: 40,
    height: 40,
    marginLeft: 15,
  },
  projectDescription: {
    fontSize: 16,
    color: "#CCCCCC",
    marginBottom: 15,
    lineHeight: 22,
  },
  locationLink: {
    marginTop: 5,
    alignSelf: "flex-start",
  },
  locationLinkText: {
    color: "#E53935",
    fontSize: 14,
    fontWeight: "500",
  },
  actionButtonsContainer: {
    marginHorizontal: 20,
    marginBottom: 15,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    borderRadius: 10,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    marginBottom: 10,
  },
  option1: {
    backgroundColor: "#E53935",
  },
  option2: {
    backgroundColor: "#1E88E5",
  },
  newReportButton: {
    backgroundColor: "#FFA000",
  },
  continueReportButton: {
    backgroundColor: "#388E3C",
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
    marginLeft: 10,
  },
  hoursContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    padding: 12,
    backgroundColor: "#1E1E1E",
    borderRadius: 8,
  },
  hoursText: {
    color: "#CCCCCC",
    fontSize: 16,
  },
  hoursValue: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  recordsContainer: {
    marginTop: 20,
    backgroundColor: "#1E1E1E",
    borderRadius: 8,
    padding: 12,
  },
  recordsTitle: {
    color: "#CCCCCC",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
  },
  recordItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#333333",
  },
  recordText: {
    color: "#FFFFFF",
    fontSize: 14,
  },
  recordHours: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  modalContent: {
    width: "90%",
    backgroundColor: "#1E1E1E",
    borderRadius: 10,
    padding: 20,
  },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  reportInput: {
    backgroundColor: '#333',
    color: '#FFF',
    borderRadius: 12,
    padding: 20,
    minHeight: 500, // Altura mínima aumentada
    maxHeight: 500, // Altura máxima para que no crezca indefinidamente
    textAlignVertical: 'top',
    marginBottom: 25,
    fontSize: 16, // Tamaño de fuente más grande
    lineHeight: 24, // Espaciado entre líneas mejorado
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: "#757575",
  },
  submitButton: {
    backgroundColor: "#388E3C",
  },
  modalButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 16,
  },
});