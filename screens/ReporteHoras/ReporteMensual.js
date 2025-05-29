import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, ScrollView, TouchableOpacity, Modal, RefreshControl } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, getDoc, query, where, setDoc, addDoc, serverTimestamp, orderBy, limit, updateDoc } from 'firebase/firestore';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, parseISO, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import styles from '../../Styles/ReporteUsuarioStyle';

export default function ReporteMensual() {
  const { userId } = useRoute().params;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [reportHistory, setReportHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedHistoryReport, setSelectedHistoryReport] = useState(null);
  const [viewMode, setViewMode] = useState('list');

  const db = getFirestore();

  const parseSafeDate = (dateString) => {
    const date = dateString ? new Date(dateString) : new Date();
    return isNaN(date.getTime()) ? new Date() : date;
  };

  async function fetchReportData() {
    setLoading(true);
    setRefreshing(true);
    try {
      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);

      const proyectosSnapshot = await getDocs(collection(db, 'proyectos'));
      const byProjectData = [];
      let allTimeTotal = 0;

      for (const proyectoDoc of proyectosSnapshot.docs) {
        const assignmentSnap = await getDoc(doc(db, 'proyectos', proyectoDoc.id, 'assignments', userId));
        if (!assignmentSnap.exists()) continue;

        const proyectoId = proyectoDoc.id;
        const proyectoNombre = proyectoDoc.data().name || `Proyecto ${proyectoId}`;
        const horasSnapshot = await getDocs(collection(db, 'usuarios', userId, 'horas', proyectoId, 'fechas'));

        let proyectoTotal = 0;
        let monthlyProyectoTotal = 0;
        const records = [];

        horasSnapshot.forEach(fechaDoc => {
          const data = fechaDoc.data();
          const horas = Number(data.totalHours) || 0;
          const fecha = parseSafeDate(data.pushInTime);

          proyectoTotal += horas;
          allTimeTotal += horas;

          if (isWithinInterval(fecha, { start: monthStart, end: monthEnd })) {
            monthlyProyectoTotal += horas;
          }

          records.push({
            id: fechaDoc.id,
            fecha: format(fecha, 'yyyy-MM-dd'),
            horas,
            pushInTime: data.pushInTime,
            pushOutTime: data.pushOutTime,
            location: data.location
          });
        });

        if (proyectoTotal > 0) {
          byProjectData.push({
            id: proyectoId,
            name: proyectoNombre,
            totalHours: proyectoTotal,
            monthlyHours: monthlyProyectoTotal,
            records
          });
        }
      }

      byProjectData.sort((a, b) => b.totalHours - a.totalHours);
      const monthlyTotal = byProjectData.reduce((acc, p) => acc + p.monthlyHours, 0);

      const fullReportData = {
        monthly: byProjectData,
        byProject: byProjectData,
        summary: { monthlyTotal, allTimeTotal },
        generatedAt: now.toISOString(),
        period: { monthStart: monthStart.toISOString(), monthEnd: monthEnd.toISOString() },
        type: 'current'
      };

      setReportData(fullReportData);
      await saveOrUpdateHistoricalReport(userId, fullReportData, monthStart);
    } catch (error) {
      console.error("Error obteniendo reporte mensual:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // Nueva función: guarda o actualiza el reporte mensual histórico solo una vez por mes
  // También actualiza siempre el reporte "current"
  async function saveOrUpdateHistoricalReport(userId, reportData, monthStart) {
    try {
      const now = new Date();

      // Guardar siempre el reporte "current"
      await setDoc(doc(db, 'usuarios', userId, 'reportes', 'current'), reportData);

      // Referencia a la colección de reportes mensuales históricos
      const monthlyHistoryRef = collection(db, 'usuarios', userId, 'reportes', 'historial', 'mensuales');

      // Buscar si ya existe reporte para este mes (por monthStart exacto)
      const q = query(monthlyHistoryRef, where('period.monthStart', '==', monthStart.toISOString()));
      const existingSnapshot = await getDocs(q);

      if (existingSnapshot.empty) {
        // No existe: crear uno nuevo
        await addDoc(monthlyHistoryRef, { ...reportData, type: 'monthly', savedAt: serverTimestamp() });
        console.log('Nuevo reporte mensual guardado en historial');
      } else {
        // Existe: actualizar el primero encontrado (solo uno debería existir)
        const docToUpdate = existingSnapshot.docs[0];
        await updateDoc(docToUpdate.ref, {
          ...reportData,
          savedAt: serverTimestamp()
        });
        console.log('Reporte mensual existente actualizado en historial');
      }
    } catch (error) {
      console.error('Error guardando o actualizando reportes históricos mensuales:', error);
    }
  }

  async function loadReportHistory() {
    setLoadingHistory(true);
    try {
      const historyRef = collection(db, 'usuarios', userId, 'reportes', 'historial', 'mensuales');
      const q = query(historyRef, orderBy('savedAt', 'desc'), limit(10));
      const snapshot = await getDocs(q);

      const history = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          savedAt: data.savedAt?.toDate ? data.savedAt.toDate() : parseSafeDate(data.savedAt),
          period: {
            monthStart: parseSafeDate(data.period?.monthStart),
            monthEnd: parseSafeDate(data.period?.monthEnd)
          }
        };
      });

      setReportHistory(history);
      setHistoryModalVisible(true);
    } catch (error) {
      console.error('Error cargando historial mensual:', error);
    } finally {
      setLoadingHistory(false);
    }
  }

  function loadSpecificReport(report) {
    setSelectedHistoryReport(report);
    setViewMode('details');
  }

  function backToHistoryList() {
    setSelectedHistoryReport(null);
    setViewMode('list');
  }

  function renderWeeks(report) {
    if (!report) return null;

    const monthStart = parseSafeDate(report.period.monthStart);
    const monthEnd = parseSafeDate(report.period.monthEnd);

    let currentWeekStart = startOfWeek(monthStart, { locale: es });
    const weeks = [];

    while (currentWeekStart <= monthEnd) {
      const weekEnd = endOfWeek(currentWeekStart, { locale: es });
      let weekHours = 0;
      const weekProjects = {};

      report.byProject?.forEach(project => {
        project.records?.forEach(record => {
          const recordDate = parseSafeDate(record.pushInTime);
          if (isWithinInterval(recordDate, { start: currentWeekStart, end: weekEnd })) {
            weekHours += record.horas || 0;
            weekProjects[project.name] = (weekProjects[project.name] || 0) + (record.horas || 0);
          }
        });
      });

      const projectsSorted = Object.entries(weekProjects)
        .map(([name, hours]) => ({ name, hours }))
        .sort((a, b) => b.hours - a.hours);

      weeks.push({
        start: currentWeekStart,
        end: weekEnd,
        hours: weekHours,
        projects: projectsSorted
      });

      currentWeekStart = startOfWeek(addDays(weekEnd, 1), { locale: es });
    }

    return weeks.map((week, i) => (
      <View key={i} style={week.hours > 0 ? styles.dayCardActive : styles.dayCard}>
        <View style={styles.dayHeader}>
          <Text style={styles.dayName}>Semana {i + 1}</Text>
          <Text style={styles.dayDate}>{format(week.start, 'dd/MM')} - {format(week.end, 'dd/MM')}</Text>
          <Text style={styles.dayHours}>{week.hours.toFixed(2)} hrs</Text>
        </View>
        {week.hours > 0 && week.projects.length > 0 && (
          <View style={styles.projectsList}>
            {week.projects.map((p, idx) => (
              <View key={idx} style={styles.projectRow}>
                <Text style={styles.projectName}>{p.name}</Text>
                <Text style={styles.projectHours}>{p.hours.toFixed(2)} hrs</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    ));
  }

  function renderMonthlyDetails() {
    if (!selectedHistoryReport) return null;

    return (
      <ScrollView style={styles.detailsContainer}>
        <TouchableOpacity style={styles.backButton} onPress={backToHistoryList}>
          <Text style={styles.backButtonText}>← Volver al historial</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Detalles del reporte mensual</Text>
        <Text style={styles.subtitle}>
          Mes: {format(parseSafeDate(selectedHistoryReport.period.monthStart), 'MMMM yyyy', { locale: es })}
        </Text>
        <Text style={styles.totalHours}>Total horas: {selectedHistoryReport.summary.monthlyTotal.toFixed(2)} hrs</Text>

        {renderWeeks(selectedHistoryReport)}

        <View style={styles.projectsSummary}>
          <Text style={styles.subtitle}>Resumen por proyecto:</Text>
          {selectedHistoryReport.byProject?.map(p => (
            <View key={p.id} style={styles.projectRow}>
              <Text style={styles.projectName}>{p.name}</Text>
              <Text style={styles.projectHours}>{p.monthlyHours.toFixed(2)} hrs</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    );
  }

  function renderHistoryList() {
    if (loadingHistory) return <ActivityIndicator size="large" color="#000" />;

    if (reportHistory.length === 0) return <Text style={styles.noData}>No hay reportes históricos.</Text>;

    return (
      <FlatList
        data={reportHistory}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.historyItem} onPress={() => loadSpecificReport(item)}>
            <Text style={styles.historyDate}>
              {format(item.period.monthStart, 'MMMM yyyy', { locale: es })}
            </Text>
            <Text style={styles.historyHours}>Horas: {item.summary.monthlyTotal.toFixed(2)}</Text>
          </TouchableOpacity>
        )}
      />
    );
  }

  useEffect(() => {
    fetchReportData();
  }, []);

  return (
    <View style={styles.container}>
      {loading && <ActivityIndicator size="large" color="#000" />}

      {!loading && reportData && (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchReportData} />}
        >
          <Text style={styles.title}>Reporte Mensual Actual</Text>
          <Text style={styles.summary}>
            Total horas este mes: {reportData.summary.monthlyTotal.toFixed(2)} hrs
          </Text>

          {renderWeeks(reportData)}

          <TouchableOpacity style={styles.historyButton} onPress={loadReportHistory}>
            <Text style={styles.historyButtonText}>Ver historial de reportes mensuales</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      <Modal
        visible={historyModalVisible}
        animationType="slide"
        onRequestClose={() => {
          setHistoryModalVisible(false);
          setSelectedHistoryReport(null);
          setViewMode('list');
        }}
      >
        <View style={styles.modalContainer}>
          {viewMode === 'list' ? renderHistoryList() : renderMonthlyDetails()}
          <TouchableOpacity
            style={styles.closeModalButton}
            onPress={() => {
              setHistoryModalVisible(false);
              setSelectedHistoryReport(null);
              setViewMode('list');
            }}
          >
            <Text style={styles.closeModalButtonText}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}
