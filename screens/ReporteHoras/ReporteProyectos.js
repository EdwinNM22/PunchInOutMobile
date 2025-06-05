import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, ActivityIndicator, ScrollView, TouchableOpacity, Modal, RefreshControl, ImageBackground } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, getDoc, query, where, setDoc, addDoc, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import Icon from 'react-native-vector-icons/MaterialIcons';
import styles from '../../Styles/ReporteUsuarioStyle';

export default function ReporteProyectos() {
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
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);

      const proyectosRef = collection(db, 'proyectos');
      const proyectosSnapshot = await getDocs(proyectosRef);

      const byProjectData = [];
      let allTimeTotal = 0;

      for (const proyectoDoc of proyectosSnapshot.docs) {
        const assignmentRef = doc(db, 'proyectos', proyectoDoc.id, 'assignments', userId);
        const assignmentSnap = await getDoc(assignmentRef);

        if (assignmentSnap.exists()) {
          const proyectoId = proyectoDoc.id;
          const proyectoNombre = proyectoDoc.data().name || `Proyecto ${proyectoId}`;

          const horasRef = collection(db, 'usuarios', userId, 'horas', proyectoId, 'registros');
          const horasSnapshot = await getDocs(horasRef);

          let proyectoTotal = 0;
          let weeklyProyectoTotal = 0;
          let monthlyProyectoTotal = 0;
          const projectRecords = [];

          horasSnapshot.forEach(fechaDoc => {
            const fechaData = fechaDoc.data();
            if (fechaData.totalHours) {
              const horas = typeof fechaData.totalHours === 'number' ?
                fechaData.totalHours :
                parseFloat(fechaData.totalHours);

              const registroFecha = parseSafeDate(fechaData.pushInTime);
              const registroDia = format(registroFecha, 'yyyy-MM-dd');

              proyectoTotal += horas;
              allTimeTotal += horas;

              if (isWithinInterval(registroFecha, { start: weekStart, end: weekEnd })) {
                weeklyProyectoTotal += horas;
              }

              if (isWithinInterval(registroFecha, { start: monthStart, end: monthEnd })) {
                monthlyProyectoTotal += horas;
              }

              projectRecords.push({
                id: fechaDoc.id,
                fecha: registroDia,
                horas: horas,
                pushInTime: fechaData.pushInTime,
                pushOutTime: fechaData.pushOutTime,
                location: fechaData.location
              });
            }
          });

          if (proyectoTotal > 0) {
            byProjectData.push({
              id: proyectoId,
              name: proyectoNombre,
              totalHours: proyectoTotal,
              weeklyHours: weeklyProyectoTotal,
              monthlyHours: monthlyProyectoTotal,
              records: projectRecords
            });
          }
        }
      }

      byProjectData.sort((a, b) => b.totalHours - a.totalHours);

      const fullReportData = {
        byProject: byProjectData,
        summary: {
          allTimeTotal,
          weeklyTotal: byProjectData.reduce((sum, proj) => sum + proj.weeklyHours, 0),
          monthlyTotal: byProjectData.reduce((sum, proj) => sum + proj.monthlyHours, 0)
        },
        generatedAt: now.toISOString(),
        period: {
          weekStart: weekStart.toISOString(),
          weekEnd: weekEnd.toISOString(),
          monthStart: monthStart.toISOString(),
          monthEnd: monthEnd.toISOString()
        },
        type: 'current'
      };

      setReportData(fullReportData);
      await checkAndSaveHistoricalReports(userId, fullReportData, monthStart);

    } catch (error) {
      console.error("Error obteniendo reporte por proyectos:", error);
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

  const checkAndSaveHistoricalReports = async (userId, reportData, monthStart) => {
    try {
      const now = new Date();

      const reportRef = doc(db, 'usuarios', userId, 'reportes', 'current');
      await setDoc(reportRef, reportData);

      if (format(now, 'd') === '1') {
        const monthlyHistoryRef = collection(db, 'usuarios', userId, 'reportes', 'historial', 'mensuales');
        const q = query(monthlyHistoryRef, where('period.monthStart', '==', monthStart.toISOString()));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          await addDoc(monthlyHistoryRef, {
            ...reportData,
            type: 'monthly',
            savedAt: serverTimestamp()
          });
          console.log('Nuevo reporte mensual guardado en historial');
        }
      }
    } catch (error) {
      console.error('Error guardando reportes históricos:', error);
    }
  };

  const loadReportHistory = async () => {
    try {
      setLoadingHistory(true);

      const historyRef = collection(db, 'usuarios', userId, 'reportes', 'historial', 'mensuales');
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
            monthStart: parseSafeDate(data.period?.monthStart),
            monthEnd: parseSafeDate(data.period?.monthEnd)
          }
        });
      });

      setReportHistory(history);
      setHistoryModalVisible(true);
    } catch (error) {
      console.error('Error cargando historial mensual:', error);
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

  const renderMonthlyDetails = () => {
    if (!selectedHistoryReport) return null;

    return (
      <ScrollView style={styles.detailsContainer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={backToHistoryList}
          activeOpacity={0.7}
        >
          <Icon name="arrow-back" size={20} color="#4285F4" />
          <Text style={styles.backButtonText}>Volver al historial</Text>
        </TouchableOpacity>

        <Text style={styles.detailsTitle}>
          Mes de {format(parseSafeDate(selectedHistoryReport.period.monthStart), 'MMMM yyyy', { locale: es })}
        </Text>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Resumen Mensual</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total horas:</Text>
            <Text style={styles.summaryValue}>{selectedHistoryReport.summary?.monthlyTotal?.toFixed(2) || '0.00'} hrs</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total acumulado:</Text>
            <Text style={styles.summaryValue}>{selectedHistoryReport.summary?.allTimeTotal?.toFixed(2) || '0.00'} hrs</Text>
          </View>
          <Text style={styles.periodText}>
            Guardado el {format(parseSafeDate(selectedHistoryReport.savedAt), 'dd/MM/yyyy HH:mm')}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Proyectos</Text>
        {selectedHistoryReport.byProject?.map((project, index) => (
          <View key={index} style={styles.projectCard}>
            <View style={styles.projectHeader}>
              <Text style={styles.projectTitle}>{project.name}</Text>
              <Text style={styles.projectTotal}>{(project.totalHours || 0).toFixed(2)} hrs</Text>
            </View>

            <View style={styles.projectDetails}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Ese mes:</Text>
                <Text style={styles.detailValue}>{(project.monthlyHours || 0).toFixed(2)} hrs</Text>
              </View>
            </View>

            <Text style={styles.recordsTitle}>Registros</Text>
            {project.records?.slice(0, 3).map((record, rIndex) => (
              <View key={rIndex} style={styles.recordItem}>
                <Text style={styles.recordDate}>{record.fecha}</Text>
                <Text style={styles.recordHours}>{(record.horas || 0).toFixed(2)} hrs</Text>
              </View>
            ))}

            {project.records?.length > 3 && (
              <Text style={styles.moreRecords}>+{project.records.length - 3} registros más</Text>
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
      contentContainerStyle={styles.historyListContainer}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.historyItem}
          onPress={() => loadSpecificReport(item)}
          activeOpacity={0.7}
        >
          <Text style={styles.historyItemTitle}>
            {format(item.period.monthStart, 'MMMM yyyy', { locale: es })}
          </Text>
          <View style={styles.historyItemRow}>
            <Text style={styles.historyItemLabel}>Horas totales:</Text>
            <Text style={styles.historyItemValue}>{item.summary?.monthlyTotal?.toFixed(2) || '0.00'} hrs</Text>
          </View>
          <View style={styles.historyItemRow}>
            <Text style={styles.historyItemLabel}>Horas acumuladas:</Text>
            <Text style={[styles.historyItemValue, styles.historyItemTotal]}>{item.summary?.allTimeTotal?.toFixed(2) || '0.00'} hrs</Text>
          </View>
          <Text style={styles.savedAtText}>
            Guardado: {format(parseSafeDate(item.savedAt), 'dd/MM/yyyy HH:mm')}
          </Text>
        </TouchableOpacity>
      )}
      ListEmptyComponent={() => (
        <View style={styles.emptyContainer}>
          <Icon name="history" size={40} color="#AAAAAA" />
          <Text style={styles.emptyText}>No hay reportes históricos para mostrar.</Text>
        </View>
      )}
    />
  );

  return (
    <ImageBackground 
      source={require('../../assets/fondo10.jpg')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Reporte por Proyectos</Text>
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={onRefresh}
            activeOpacity={0.7}
          >
            <Icon name="refresh" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#E53935" />
            <Text style={styles.loadingText}>Generando reporte...</Text>
          </View>
        ) : reportData ? (
          <ScrollView 
            style={styles.reportContainer} 
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Resumen General</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total horas este mes:</Text>
                <Text style={styles.summaryValue}>{(reportData.summary?.monthlyTotal || 0).toFixed(2)} hrs</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total horas acumuladas:</Text>
                <Text style={styles.summaryValue}>{(reportData.summary?.allTimeTotal || 0).toFixed(2)} hrs</Text>
              </View>
              <Text style={styles.periodText}>
                Mes de {format(parseSafeDate(reportData.period?.monthStart), 'MMMM yyyy', { locale: es })}
              </Text>
              <Text style={styles.updateText}>
                Actualizado: {format(parseSafeDate(reportData.generatedAt), 'dd/MM/yyyy HH:mm')}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.historyButton}
              onPress={loadReportHistory}
              activeOpacity={0.7}
            >
              <Icon name="history" size={20} color="#FFFFFF" style={styles.historyIcon} />
              <Text style={styles.historyButtonText}>Ver Historial</Text>
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>Horas por Proyecto</Text>
            {reportData.byProject?.map((project, index) => (
              <View key={index} style={styles.projectCard}>
                <View style={styles.projectHeader}>
                  <Text style={styles.projectTitle}>{project.name}</Text>
                  <Text style={styles.projectTotal}>{(project.totalHours || 0).toFixed(2)} hrs</Text>
                </View>

                <View style={styles.projectDetails}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Esta semana:</Text>
                    <Text style={styles.detailValue}>{(project.weeklyHours || 0).toFixed(2)} hrs</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Este mes:</Text>
                    <Text style={styles.detailValue}>{(project.monthlyHours || 0).toFixed(2)} hrs</Text>
                  </View>
                </View>

                <Text style={styles.recordsTitle}>Últimos registros</Text>
                {project.records?.slice(0, 3).map((record, rIndex) => (
                  <View key={rIndex} style={styles.recordItem}>
                    <Text style={styles.recordDate}>{record.fecha}</Text>
                    <Text style={styles.recordHours}>{(record.horas || 0).toFixed(2)} hrs</Text>
                  </View>
                ))}

                {project.records?.length > 3 && (
                  <Text style={styles.moreRecords}>+{project.records.length - 3} registros más</Text>
                )}
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyContainer}>
            <Icon name="error-outline" size={40} color="#AAAAAA" />
            <Text style={styles.emptyText}>No hay datos para mostrar</Text>
          </View>
        )}

        <Modal 
          visible={historyModalVisible} 
          animationType="slide" 
          onRequestClose={() => {
            setHistoryModalVisible(false);
            backToHistoryList();
          }}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Historial Mensual</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setHistoryModalVisible(false);
                  backToHistoryList();
                }}
                activeOpacity={0.7}
              >
                <Icon name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {viewMode === 'list' ? renderHistoryList() : renderMonthlyDetails()}
          </View>
        </Modal>
      </View>
    </ImageBackground>
  );
}