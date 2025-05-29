import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, ScrollView, TouchableOpacity, Modal, RefreshControl } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, getDoc, query, where, setDoc, addDoc, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import { TabView, SceneMap, TabBar } from 'react-native-tab-view';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO, isWithinInterval, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import styles from '../Styles/ReporteUsuarioStyle';

export default function ReporteUsuario() {
  const route = useRoute();
  const { userId } = route.params;
  const [index, setIndex] = useState(0);
  const [routes] = useState([
    { key: 'semanal', title: 'Semanal' },
    { key: 'mensual', title: 'Mensual' },
    { key: 'proyectos', title: 'Por Proyecto' },
  ]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [reportHistory, setReportHistory] = useState([]);
  const [historyType, setHistoryType] = useState('weekly');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedHistoryReport, setSelectedHistoryReport] = useState(null);
  const [viewMode, setViewMode] = useState('list');

  const auth = getAuth();
  const db = getFirestore();

  // Función segura para parsear fechas
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

      const proyectosData = [];
      let allTimeTotal = 0;
      const weeklyData = [];
      const monthlyData = [];
      const byProjectData = [];

      const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
      const dailyHours = weekDays.map(day => ({
        date: day,
        dayName: format(day, 'EEEE', { locale: es }),
        hours: 0,
        projects: []
      }));

      for (const proyectoDoc of proyectosSnapshot.docs) {
        const assignmentRef = doc(db, 'proyectos', proyectoDoc.id, 'assignments', userId);
        const assignmentSnap = await getDoc(assignmentRef);

        if (assignmentSnap.exists()) {
          const proyectoId = proyectoDoc.id;
          const proyectoNombre = proyectoDoc.data().name || `Proyecto ${proyectoId}`;

          const horasRef = collection(db, 'usuarios', userId, 'horas', proyectoId, 'fechas');
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

                const dayIndex = weekDays.findIndex(d => isSameDay(d, registroFecha));
                if (dayIndex !== -1) {
                  dailyHours[dayIndex].hours += horas;
                  dailyHours[dayIndex].projects.push({
                    name: proyectoNombre,
                    hours: horas
                  });
                }
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

      weeklyData.push(...dailyHours.map(day => ({
        ...day,
        projects: day.projects.sort((a, b) => b.hours - a.hours)
      })));

      const weeklyTotal = weeklyData.reduce((sum, day) => sum + day.hours, 0);
      const monthlyTotal = byProjectData.reduce((sum, proj) => sum + proj.monthlyHours, 0);

      const fullReportData = {
        weekly: weeklyData,
        monthly: byProjectData,
        byProject: byProjectData,
        summary: {
          weeklyTotal,
          monthlyTotal,
          allTimeTotal
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
      await checkAndSaveHistoricalReports(userId, fullReportData, weekStart, monthStart);

    } catch (error) {
      console.error("Error obteniendo reporte:", error);
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

  const checkAndSaveHistoricalReports = async (userId, reportData, weekStart, monthStart) => {
    try {
      const now = new Date();

      const reportRef = doc(db, 'usuarios', userId, 'reportes', 'current');
      await setDoc(reportRef, reportData);

      if (format(now, 'EEEE', { locale: es }) === 'lunes') {
        const weeklyHistoryRef = collection(db, 'usuarios', userId, 'reportes', 'historial', 'semanales');
        const q = query(weeklyHistoryRef, where('period.weekStart', '==', weekStart.toISOString()));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          await addDoc(weeklyHistoryRef, {
            ...reportData,
            type: 'weekly',
            savedAt: serverTimestamp()
          });
          console.log('Nuevo reporte semanal guardado en historial');
        }
      }

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

  const loadReportHistory = async (type) => {
    try {
      setLoadingHistory(true);
      setHistoryType(type);

      const historyRef = collection(db, 'usuarios', userId, 'reportes', 'historial', type === 'weekly' ? 'semanales' : 'mensuales');
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
            weekEnd: parseSafeDate(data.period?.weekEnd),
            monthStart: parseSafeDate(data.period?.monthStart),
            monthEnd: parseSafeDate(data.period?.monthEnd)
          }
        });
      });

      setReportHistory(history);
      setHistoryModalVisible(true);
    } catch (error) {
      console.error('Error cargando historial:', error);
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

  const renderMonthlyDetails = () => {
    if (!selectedHistoryReport) return null;

    // Calcular semanas del mes
    const monthStart = parseSafeDate(selectedHistoryReport.period.monthStart);
    const monthEnd = parseSafeDate(selectedHistoryReport.period.monthEnd);

    let currentWeekStart = startOfWeek(monthStart, { locale: es });
    const weeks = [];

    while (currentWeekStart <= monthEnd) {
      const weekEnd = endOfWeek(currentWeekStart, { locale: es });

      // Calcular horas por semana
      let weekHours = 0;
      const weekProjects = {};

      selectedHistoryReport.byProject?.forEach(project => {
        project.records?.forEach(record => {
          const recordDate = parseSafeDate(record.pushInTime);
          if (isWithinInterval(recordDate, { start: currentWeekStart, end: weekEnd })) {
            weekHours += record.horas || 0;

            if (!weekProjects[project.name]) {
              weekProjects[project.name] = 0;
            }
            weekProjects[project.name] += record.horas || 0;
          }
        });
      });

      const weekProjectsArray = Object.keys(weekProjects).map(name => ({
        name,
        hours: weekProjects[name]
      })).sort((a, b) => b.hours - a.hours);

      weeks.push({
        start: currentWeekStart,
        end: weekEnd,
        hours: weekHours,
        projects: weekProjectsArray
      });

      currentWeekStart = startOfWeek(addDays(weekEnd, 1), { locale: es });
    }

    return (
      <ScrollView style={styles.detailsContainer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={backToHistoryList}
        >
          <Text style={styles.backButtonText}>← Volver al historial</Text>
        </TouchableOpacity>

        <Text style={styles.detailsTitle}>
          Mes de {format(monthStart, 'MMMM yyyy', { locale: es })}
        </Text>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Resumen Mensual</Text>
          <View style={styles.summaryRow}>
            <Text>Total horas:</Text>
            <Text style={styles.summaryValue}>{selectedHistoryReport.summary?.monthlyTotal?.toFixed(2) || '0.00'} hrs</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Total acumulado:</Text>
            <Text style={styles.summaryValue}>{selectedHistoryReport.summary?.allTimeTotal?.toFixed(2) || '0.00'} hrs</Text>
          </View>
          <Text style={styles.periodText}>
            Guardado el {format(parseSafeDate(selectedHistoryReport.savedAt), 'dd/MM/yyyy HH:mm')}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Semanas del mes</Text>
        {weeks.map((week, index) => (
          <View key={index} style={week.hours > 0 ? styles.dayCardActive : styles.dayCard}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayName}>Semana {index + 1}</Text>
              <Text style={styles.dayDate}>
                {format(week.start, 'dd/MM')} - {format(week.end, 'dd/MM')}
              </Text>
              <Text style={styles.dayHours}>{(week.hours || 0).toFixed(2)} hrs</Text>
            </View>

            {week.hours > 0 && week.projects.length > 0 && (
              <View style={styles.projectsList}>
                {week.projects.map((project, pIndex) => (
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

  const renderModalContent = () => {
    if (viewMode === 'details' && selectedHistoryReport) {
      return historyType === 'weekly' ? renderWeeklyDetails() : renderMonthlyDetails();
    }

    return (
      <>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>
            Historial {historyType === 'weekly' ? 'Semanal' : 'Mensual'}
          </Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setHistoryModalVisible(false)}
          >
            <Text style={styles.closeButtonText}>Cerrar</Text>
          </TouchableOpacity>
        </View>

        {loadingHistory ? (
          <View style={styles.historyLoading}>
            <ActivityIndicator size="large" color="#2c3e50" />
            <Text style={styles.loadingText}>Cargando historial...</Text>
          </View>
        ) : (
          <FlatList
            data={reportHistory}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.historyItem}
                onPress={() => loadSpecificReport(item)}
              >
                <Text style={styles.historyItemTitle}>
                  {historyType === 'weekly' ?
                    `Semana del ${format(parseSafeDate(item.period.weekStart), 'dd/MM/yyyy')} al ${format(parseSafeDate(item.period.weekEnd), 'dd/MM/yyyy')}` :
                    `Mes de ${format(parseSafeDate(item.period.monthStart), 'MMMM yyyy', { locale: es })}`}
                </Text>
                <Text style={styles.historyItemDate}>
                  Guardado el {format(parseSafeDate(item.savedAt), 'dd/MM/yyyy HH:mm')}
                </Text>
                <Text style={styles.historyItemTotal}>
                  Total: {historyType === 'weekly' ?
                    (item.summary?.weeklyTotal || 0).toFixed(2) :
                    (item.summary?.monthlyTotal || 0).toFixed(2)} hrs
                </Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.noHistoryText}>No hay reportes en el historial</Text>
            }
          />
        )}
      </>
    );
  };

  const WeeklyReport = () => {
    if (!reportData) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2c3e50" />
        </View>
      );
    }

    return (
      <ScrollView
        style={styles.tabContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2c3e50']}
            tintColor="#2c3e50"
          />
        }
      >
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Resumen Semanal</Text>
          <View style={styles.summaryRow}>
            <Text>Total horas esta semana:</Text>
            <Text style={styles.summaryValue}>{(reportData.summary?.weeklyTotal || 0).toFixed(2)} hrs</Text>
          </View>
          <Text style={styles.periodText}>
            Semana del {format(parseSafeDate(reportData.period?.weekStart), 'dd/MM/yyyy')} al {format(parseSafeDate(reportData.period?.weekEnd), 'dd/MM/yyyy')}
          </Text>
          <Text style={styles.updateText}>
            Actualizado: {format(parseSafeDate(reportData.generatedAt), 'dd/MM/yyyy HH:mm')}
          </Text>
        </View>

        <View style={styles.historyButtonsContainer}>
          <TouchableOpacity
            style={styles.historyButton}
            onPress={() => loadReportHistory('weekly')}
          >
            <Text style={styles.historyButtonText}>Ver Historial Semanal</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Horas por Día</Text>
        {reportData.weekly?.map((day, index) => (
          <View key={index} style={(day.hours || 0) > 0 ? styles.dayCardActive : styles.dayCard}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayName}>{day.dayName}</Text>
              <Text style={styles.dayDate}>{format(parseSafeDate(day.date), 'dd/MM')}</Text>
              <Text style={styles.dayHours}>{(day.hours || 0).toFixed(2)} hrs</Text>
            </View>

            {(day.hours || 0) > 0 && day.projects && (
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

  const MonthlyReport = () => {
    if (!reportData) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2c3e50" />
        </View>
      );
    }

    // Calcular semanas del mes
    const monthStart = parseSafeDate(reportData.period?.monthStart);
    const monthEnd = parseSafeDate(reportData.period?.monthEnd);

    let currentWeekStart = startOfWeek(monthStart, { locale: es });
    const weeks = [];

    while (currentWeekStart <= monthEnd) {
      const weekEnd = endOfWeek(currentWeekStart, { locale: es });
      const weekDays = eachDayOfInterval({ start: currentWeekStart, end: weekEnd });

      // Calcular horas por semana
      let weekHours = 0;
      const weekProjects = {};

      reportData.byProject?.forEach(project => {
        project.records?.forEach(record => {
          const recordDate = parseSafeDate(record.pushInTime);
          if (isWithinInterval(recordDate, { start: currentWeekStart, end: weekEnd })) {
            weekHours += record.horas || 0;

            if (!weekProjects[project.name]) {
              weekProjects[project.name] = 0;
            }
            weekProjects[project.name] += record.horas || 0;
          }
        });
      });

      const weekProjectsArray = Object.keys(weekProjects).map(name => ({
        name,
        hours: weekProjects[name]
      })).sort((a, b) => b.hours - a.hours);

      weeks.push({
        start: currentWeekStart,
        end: weekEnd,
        hours: weekHours,
        projects: weekProjectsArray
      });

      currentWeekStart = startOfWeek(addDays(weekEnd, 1), { locale: es });
    }

    return (
      <ScrollView
        style={styles.tabContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2c3e50']}
            tintColor="#2c3e50"
          />
        }
      >
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Resumen Mensual</Text>
          <View style={styles.summaryRow}>
            <Text>Total horas este mes:</Text>
            <Text style={styles.summaryValue}>{(reportData.summary?.monthlyTotal || 0).toFixed(2)} hrs</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Total horas acumuladas:</Text>
            <Text style={styles.summaryValue}>{(reportData.summary?.allTimeTotal || 0).toFixed(2)} hrs</Text>
          </View>
          <Text style={styles.periodText}>
            Mes de {format(parseSafeDate(reportData.period?.monthStart), 'MMMM yyyy', { locale: es })}
          </Text>
          <Text style={styles.updateText}>
            Actualizado: {format(parseSafeDate(reportData.generatedAt), 'dd/MM/yyyy HH:mm')}
          </Text>
        </View>

        <View style={styles.historyButtonsContainer}>
          <TouchableOpacity
            style={styles.historyButton}
            onPress={() => loadReportHistory('monthly')}
          >
            <Text style={styles.historyButtonText}>Ver Historial Mensual</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Semanas del mes</Text>
        {weeks.map((week, index) => (
          <View key={index} style={week.hours > 0 ? styles.dayCardActive : styles.dayCard}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayName}>Semana {index + 1}</Text>
              <Text style={styles.dayDate}>
                {format(week.start, 'dd/MM')} - {format(week.end, 'dd/MM')}
              </Text>
              <Text style={styles.dayHours}>{(week.hours || 0).toFixed(2)} hrs</Text>
            </View>

            {week.hours > 0 && week.projects.length > 0 && (
              <View style={styles.projectsList}>
                {week.projects.map((project, pIndex) => (
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

  const ProjectsReport = () => {
    if (!reportData) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2c3e50" />
        </View>
      );
    }

    return (
      <ScrollView
        style={styles.tabContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2c3e50']}
            tintColor="#2c3e50"
          />
        }
      >
        <Text style={styles.sectionTitle}>Horas por Proyecto</Text>
        {reportData.byProject?.map((project, index) => (
          <View key={index} style={styles.projectCard}>
            <View style={styles.projectHeader}>
              <Text style={styles.projectTitle}>{project.name}</Text>
              <Text style={styles.projectTotal}>{(project.totalHours || 0).toFixed(2)} hrs</Text>
            </View>

            <View style={styles.projectDetails}>
              <View style={styles.detailRow}>
                <Text>Esta semana:</Text>
                <Text style={styles.detailValue}>{(project.weeklyHours || 0).toFixed(2)} hrs</Text>
              </View>
              <View style={styles.detailRow}>
                <Text>Este mes:</Text>
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
    );
  };

  const renderScene = SceneMap({
    semanal: WeeklyReport,
    mensual: MonthlyReport,
    proyectos: ProjectsReport,
  });

  const renderTabBar = props => (
    <TabBar
      {...props}
      indicatorStyle={styles.tabIndicator}
      style={styles.tabBar}
      labelStyle={styles.tabLabel}
      activeColor="#2c3e50"
      inactiveColor="#95a5a6"
    />
  );

  if (loading && !reportData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2c3e50" />
        <Text style={styles.loadingText}>Generando reportes...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Reporte de Horas</Text>
      {reportData && (
        <TabView
          navigationState={{ index, routes }}
          renderScene={renderScene}
          onIndexChange={setIndex}
          renderTabBar={renderTabBar}
        />
      )}

      <Modal
        animationType="slide"
        transparent={false}
        visible={historyModalVisible}
        onRequestClose={() => {
          setHistoryModalVisible(false);
          setViewMode('list');
          setSelectedHistoryReport(null);
        }}
      >
        <View style={styles.modalContainer}>
          {renderModalContent()}
        </View>
      </Modal>
    </View>
  );
}