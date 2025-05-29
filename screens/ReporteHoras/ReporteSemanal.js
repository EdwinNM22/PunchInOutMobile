import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, ScrollView, TouchableOpacity, Modal, RefreshControl } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, getDoc, query, where, setDoc, addDoc, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, parseISO, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import styles from '../../Styles/ReporteUsuarioStyle';

export default function ReporteSemanal() {
  const route = useRoute();
  const { userId } = route.params;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [reportHistory, setReportHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedHistoryReport, setSelectedHistoryReport] = useState(null);
  const [viewMode, setViewMode] = useState('list');

  const auth = getAuth();
  const db = getFirestore();

  const parseSafeDate = (dateString) => {
    try {
      if (!dateString) return new Date();
      const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
      return isNaN(date.getTime()) ? new Date() : date;
    } catch (e) {
      return new Date();
    }
  };

  const fetchReportData = async () => {
    try {
      setLoading(true);
      setRefreshing(true);

      const now = new Date();
      const weekStart = startOfWeek(now, { locale: es });
      const weekEnd = endOfWeek(now, { locale: es });

      const proyectosRef = collection(db, 'proyectos');
      const proyectosSnapshot = await getDocs(proyectosRef);

      const weeklyData = [];
      const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
      const dailyHours = weekDays.map(day => ({
        date: day,
        dayName: format(day, 'EEEE', { locale: es }),
        hours: 0,
        projects: []
      }));

      let weeklyTotal = 0;

      for (const proyectoDoc of proyectosSnapshot.docs) {
        const assignmentRef = doc(db, 'proyectos', proyectoDoc.id, 'assignments', userId);
        const assignmentSnap = await getDoc(assignmentRef);

        if (assignmentSnap.exists()) {
          const proyectoId = proyectoDoc.id;
          const proyectoNombre = proyectoDoc.data().name || `Proyecto ${proyectoId}`;

          const horasRef = collection(db, 'usuarios', userId, 'horas', proyectoId, 'fechas');
          const horasSnapshot = await getDocs(horasRef);

          horasSnapshot.forEach(fechaDoc => {
            const fechaData = fechaDoc.data();
            if (fechaData.totalHours) {
              const horas = typeof fechaData.totalHours === 'number' ?
                fechaData.totalHours :
                parseFloat(fechaData.totalHours);

              const registroFecha = parseSafeDate(fechaData.pushInTime);

              if (isWithinInterval(registroFecha, { start: weekStart, end: weekEnd })) {
                weeklyTotal += horas;

                const dayIndex = weekDays.findIndex(d => isSameDay(d, registroFecha));
                if (dayIndex !== -1) {
                  dailyHours[dayIndex].hours += horas;
                  dailyHours[dayIndex].projects.push({
                    name: proyectoNombre,
                    hours: horas
                  });
                }
              }
            }
          });
        }
      }

      weeklyData.push(...dailyHours.map(day => ({
        ...day,
        projects: day.projects.sort((a, b) => b.hours - a.hours)
      })));

      const fullReportData = {
        weekly: weeklyData,
        summary: {
          weeklyTotal
        },
        generatedAt: now.toISOString(),
        period: {
          weekStart: weekStart.toISOString(),
          weekEnd: weekEnd.toISOString()
        },
        type: 'current'
      };

      setReportData(fullReportData);
      await checkAndSaveHistoricalReports(userId, fullReportData, weekStart);

    } catch (error) {
      console.error("Error obteniendo reporte semanal:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReportData();
    const interval = setInterval(fetchReportData, 300000);
    return () => clearInterval(interval);
  }, [userId, db]);

  const onRefresh = () => {
    fetchReportData();
  };

  // Modificación: Si ya existe reporte semanal para la semana, lo actualiza en lugar de ignorarlo.
  const checkAndSaveHistoricalReports = async (userId, reportData, weekStart) => {
    try {
      const now = new Date();

      // Guardar reporte actual
      const reportRef = doc(db, 'usuarios', userId, 'reportes', 'current');
      await setDoc(reportRef, reportData);

      // Buscar si ya existe un reporte histórico para esta semana
      const weeklyHistoryRef = collection(db, 'usuarios', userId, 'reportes', 'historial', 'semanales');
      const q = query(weeklyHistoryRef, where('period.weekStart', '==', weekStart.toISOString()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        // No existe reporte para esta semana -> guardar nuevo
        await addDoc(weeklyHistoryRef, {
          ...reportData,
          type: 'weekly',
          savedAt: serverTimestamp()
        });
        console.log('Nuevo reporte semanal guardado en historial');
      } else {
        // Ya existe reporte para esta semana -> actualizar el primer documento encontrado
        const docToUpdate = querySnapshot.docs[0];
        const docRef = doc(db, 'usuarios', userId, 'reportes', 'historial', 'semanales', docToUpdate.id);
        await setDoc(docRef, {
          ...reportData,
          type: 'weekly',
          savedAt: serverTimestamp()
        }, { merge: true });
        console.log('Reporte semanal existente actualizado en historial');
      }

    } catch (error) {
      console.error('Error guardando reportes históricos semanales:', error);
    }
  };

  const loadReportHistory = async () => {
    try {
      setLoadingHistory(true);

      const historyRef = collection(db, 'usuarios', userId, 'reportes', 'historial', 'semanales');
      const q = query(historyRef, orderBy('savedAt', 'desc'), limit(10));
      const querySnapshot = await getDocs(q);

      const history = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        history.push({
          id: doc.id,
          ...data,
          savedAt: data.savedAt?.toDate ? data.savedAt.toDate() : parseSafeDate(data.savedAt),
          period: {
            weekStart: parseSafeDate(data.period?.weekStart),
            weekEnd: parseSafeDate(data.period?.weekEnd)
          }
        });
      });

      setReportHistory(history);
      setHistoryModalVisible(true);
    } catch (error) {
      console.error('Error cargando historial semanal:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadSpecificReport = (report) => {
    setSelectedHistoryReport(report);
    setViewMode('details');
  };

  const backToHistoryList = () => {
    setViewMode('list');
    setSelectedHistoryReport(null);
  };

  const renderWeeklyDetails = () => {
    if (!selectedHistoryReport) return null;

    return (
      <ScrollView style={styles.detailsContainer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={backToHistoryList}
        >
          <Text style={styles.backButtonText}>← Volver al historial</Text>
        </TouchableOpacity>

        <Text style={styles.detailsTitle}>
          Semana del {format(parseSafeDate(selectedHistoryReport.period.weekStart), 'dd/MM/yyyy')} al {format(parseSafeDate(selectedHistoryReport.period.weekEnd), 'dd/MM/yyyy')}
        </Text>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Resumen Semanal</Text>
          <View style={styles.summaryRow}>
            <Text>Total horas:</Text>
            <Text style={styles.summaryValue}>{selectedHistoryReport.summary?.weeklyTotal?.toFixed(2) || '0.00'} hrs</Text>
          </View>
          <Text style={styles.periodText}>
            Guardado el {format(parseSafeDate(selectedHistoryReport.savedAt), 'dd/MM/yyyy HH:mm')}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Horas por Día</Text>
        {selectedHistoryReport.weekly?.map((day, index) => (
          <View key={index} style={day.hours > 0 ? styles.dayCardActive : styles.dayCard}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayName}>{day.dayName}</Text>
              <Text style={styles.dayDate}>{format(parseSafeDate(day.date), 'dd/MM')}</Text>
              <Text style={styles.dayHours}>{(day.hours || 0).toFixed(2)} hrs</Text>
            </View>

            {day.hours > 0 && day.projects && (
              <View style={styles.projectsList}>
                {day.projects.map((project, pIndex) => (
                  <View key={pIndex} style={styles.projectRow}>
                    <Text style={styles.projectName}>{project.name}</Text>
                    <Text style={styles.projectHours}>{(project.hours || 0).toFixed(2)} hrs</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderHistoryList = () => (
    <FlatList
      data={reportHistory}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={loadingHistory} onRefresh={loadReportHistory} />}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.historyItem}
          onPress={() => loadSpecificReport(item)}
        >
          <Text style={styles.historyDate}>
            Semana del {format(parseSafeDate(item.period.weekStart), 'dd/MM/yyyy')} al {format(parseSafeDate(item.period.weekEnd), 'dd/MM/yyyy')}
          </Text>
          <Text>Total horas: {(item.summary?.weeklyTotal || 0).toFixed(2)} hrs</Text>
          <Text style={styles.savedAtText}>Guardado: {format(parseSafeDate(item.savedAt), 'dd/MM/yyyy HH:mm')}</Text>
        </TouchableOpacity>
      )}
      ListEmptyComponent={() => (
        <Text style={styles.emptyText}>No hay reportes históricos para mostrar.</Text>
      )}
    />
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reporte Semanal</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#0000ff" />
      ) : reportData ? (
        <ScrollView style={styles.reportContainer} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Resumen Semanal</Text>
            <View style={styles.summaryRow}>
              <Text>Total horas:</Text>
              <Text style={styles.summaryValue}>{reportData.summary.weeklyTotal.toFixed(2)} hrs</Text>
            </View>
            <Text style={styles.periodText}>
              Semana del {format(parseSafeDate(reportData.period.weekStart), 'dd/MM/yyyy')} al {format(parseSafeDate(reportData.period.weekEnd), 'dd/MM/yyyy')}
            </Text>
          </View>

          {reportData.weekly.map((day, index) => (
            <View key={index} style={day.hours > 0 ? styles.dayCardActive : styles.dayCard}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayName}>{day.dayName}</Text>
                <Text style={styles.dayDate}>{format(parseSafeDate(day.date), 'dd/MM')}</Text>
                <Text style={styles.dayHours}>{day.hours.toFixed(2)} hrs</Text>
              </View>
              {day.hours > 0 && day.projects && (
                <View style={styles.projectsList}>
                  {day.projects.map((project, pIndex) => (
                    <View key={pIndex} style={styles.projectRow}>
                      <Text style={styles.projectName}>{project.name}</Text>
                      <Text style={styles.projectHours}>{project.hours.toFixed(2)} hrs</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      ) : (
        <Text>No hay datos para mostrar.</Text>
      )}

      <TouchableOpacity
        style={styles.historyButton}
        onPress={loadReportHistory}
      >
        <Text style={styles.historyButtonText}>Ver Historial de Reportes</Text>
      </TouchableOpacity>

      <Modal visible={historyModalVisible} animationType="slide" onRequestClose={() => setHistoryModalVisible(false)}>
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.closeModalButton}
            onPress={() => {
              setHistoryModalVisible(false);
              backToHistoryList();
            }}
          >
            <Text style={styles.closeModalText}>Cerrar</Text>
          </TouchableOpacity>

          {viewMode === 'list' ? renderHistoryList() : renderWeeklyDetails()}
        </View>
      </Modal>
    </View>
  );
}
