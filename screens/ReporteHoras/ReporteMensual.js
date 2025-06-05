import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, ActivityIndicator, ScrollView, TouchableOpacity, Modal, RefreshControl, ImageBackground, TextInput, Alert } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, getDoc, query, where, setDoc, addDoc, serverTimestamp, orderBy, limit, updateDoc } from 'firebase/firestore';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, parseISO, addDays, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import Icon from 'react-native-vector-icons/MaterialIcons';
import styles from '../../Styles/ReporteUsuarioStyle';

// Componente para generar el PDF
const PDFGenerator = ({ reportData }) => {
  const generateHTML = () => {
    if (!reportData) return '';

    const monthStart = format(parseSafeDate(reportData.period.monthStart), 'MMMM yyyy', { locale: es });
    const generatedAt = format(new Date(), 'dd/MM/yyyy HH:mm');

    // Generar HTML para las semanas
    let weeksHTML = '';
    const weeks = getWeeksData(reportData);
    
    weeks.forEach((week, index) => {
      weeksHTML += `
        <div style="margin-bottom: 15px; border: 1px solid #ddd; padding: 10px; border-radius: 5px;">
          <h3 style="margin: 0 0 10px 0; color: #333; display: flex; justify-content: space-between;">
            <span>Semana ${index + 1} (${format(week.start, 'dd/MM')} - ${format(week.end, 'dd/MM')})</span>
            <span>${week.totalHours.toFixed(2)} hrs (${week.hours.toFixed(2)} + ${week.extraHours.toFixed(2)} extras)</span>
          </h3>
          ${week.hours > 0 ? `
            <table style="width: 100%; border-collapse: collapse;">
              ${week.projects.map(project => `
                <tr>
                  <td style="padding: 5px; border-bottom: 1px solid #eee;">${project.name}</td>
                  <td style="padding: 5px; border-bottom: 1px solid #eee; text-align: right;">${project.hours.toFixed(2)} hrs</td>
                </tr>
              `).join('')}
              ${week.extraHours > 0 ? `
                <tr>
                  <td style="padding: 5px; border-bottom: 1px solid #eee; font-weight: bold;">Horas extras</td>
                  <td style="padding: 5px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">${week.extraHours.toFixed(2)} hrs</td>
                </tr>
              ` : ''}
            </table>
          ` : '<p style="color: #999; text-align: center;">Sin horas registradas</p>'}
        </div>
      `;
    });

    // Generar HTML para los proyectos
    let projectsHTML = '';
    if (reportData.byProject && reportData.byProject.length > 0) {
      projectsHTML = `
        <div style="margin-top: 20px;">
          <h3 style="margin: 15px 0 10px 0; color: #444;">Resumen por Proyecto</h3>
          <table style="width: 100%; border-collapse: collapse;">
            ${reportData.byProject.map(project => `
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">${project.name}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${project.monthlyHours.toFixed(2)} hrs</td>
              </tr>
            `).join('')}
          </table>
        </div>
      `;
    }

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Reporte Mensual</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
            .header { text-align: center; margin-bottom: 20px; }
            .title { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
            .subtitle { font-size: 16px; color: #666; margin-bottom: 20px; }
            .summary { background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
            .summary-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
            .summary-value { font-weight: bold; }
            .section-title { font-size: 18px; font-weight: bold; margin: 20px 0 10px 0; color: #444; }
            .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #999; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">Reporte Mensual</div>
            <div class="subtitle">${monthStart}</div>
          </div>
          
          <div class="summary">
            <div class="summary-row">
              <span>Total horas proyectos:</span>
              <span class="summary-value">${reportData.summary.monthlyTotal.toFixed(2)} hrs</span>
            </div>
            <div class="summary-row">
              <span>Horas extras:</span>
              <span class="summary-value">${reportData.summary.extraHoursTotal.toFixed(2)} hrs</span>
            </div>
            <div class="summary-row">
              <span>Total general:</span>
              <span class="summary-value">${reportData.summary.generalTotal.toFixed(2)} hrs</span>
            </div>
            <div class="summary-row">
              <span>Horas totales acumuladas:</span>
              <span class="summary-value">${reportData.summary.allTimeTotal.toFixed(2)} hrs</span>
            </div>
          </div>
          
          <div class="section-title">Horas por Semana</div>
          ${weeksHTML}
          
          ${projectsHTML}
          
          <div class="footer">
            Generado el ${generatedAt}
          </div>
        </body>
      </html>
    `;
  };

  const parseSafeDate = (dateString) => {
    try {
      if (!dateString) return new Date();
      const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
      return isNaN(date.getTime()) ? new Date() : date;
    } catch (e) {
      return new Date();
    }
  };

  const getWeeksData = (report) => {
    if (!report) return [];
    
    const monthStart = parseSafeDate(report.period.monthStart);
    const monthEnd = parseSafeDate(report.period.monthEnd);
    let currentWeekStart = startOfWeek(monthStart, { locale: es });
    const weeks = [];

    while (currentWeekStart <= monthEnd) {
      const weekEnd = endOfWeek(currentWeekStart, { locale: es });
      let weekHours = 0;
      let weekExtraHours = 0;
      const weekProjects = {};

      // Procesar horas de proyectos
      report.byProject?.forEach(project => {
        project.records?.forEach(record => {
          const recordDate = parseSafeDate(record.pushInTime);
          if (isWithinInterval(recordDate, { start: currentWeekStart, end: weekEnd })) {
            weekHours += record.horas || 0;
            weekProjects[project.name] = (weekProjects[project.name] || 0) + (record.horas || 0);
          }
        });
      });

      // Procesar horas extras
      if (report.extraHours && report.extraHours.days) {
        report.extraHours.days.forEach(day => {
          const dayDate = parseSafeDate(day.date);
          if (isWithinInterval(dayDate, { start: currentWeekStart, end: weekEnd })) {
            weekExtraHours += day.extraHours || 0;
          }
        });
      }

      const projectsSorted = Object.entries(weekProjects)
        .map(([name, hours]) => ({ name, hours }))
        .sort((a, b) => b.hours - a.hours);

      weeks.push({
        start: currentWeekStart,
        end: weekEnd,
        hours: weekHours,
        extraHours: weekExtraHours,
        totalHours: weekHours + weekExtraHours,
        projects: projectsSorted
      });

      currentWeekStart = startOfWeek(addDays(weekEnd, 1), { locale: es });
    }

    return weeks;
  };

  const generatePDF = async () => {
    try {
      const html = generateHTML();
      
      const { uri } = await Print.printToFileAsync({
        html: html,
        width: 612,
        height: 792,
        base64: false
      });
      
      console.log('PDF generado en:', uri);
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Compartir Reporte Mensual',
          UTI: 'com.adobe.pdf'
        });
      } else {
        alert(`PDF generado correctamente en: ${uri}`);
      }
      
    } catch (error) {
      console.error('Error al generar PDF:', error);
      alert('Error al generar el PDF. Por favor intenta nuevamente.');
    }
  };

  return (
    <TouchableOpacity 
      onPress={generatePDF} 
      style={styles.pdfButton}
      activeOpacity={0.7}
    >
      <Icon name="picture-as-pdf" size={20} color="#FFFFFF" style={styles.pdfIcon} />
      <Text style={styles.pdfButtonText}>Generar PDF</Text>
    </TouchableOpacity>
  );
};

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
  const [extraHoursModalVisible, setExtraHoursModalVisible] = useState(false);
  const [currentWeekIndex, setCurrentWeekIndex] = useState(-1);
  const [extraHoursInput, setExtraHoursInput] = useState('');

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
      let monthlyTotal = 0;

      // Obtener horas de proyectos
      for (const proyectoDoc of proyectosSnapshot.docs) {
        const assignmentSnap = await getDoc(doc(db, 'proyectos', proyectoDoc.id, 'assignments', userId));
        if (!assignmentSnap.exists()) continue;

        const proyectoId = proyectoDoc.id;
        const proyectoNombre = proyectoDoc.data().name || `Proyecto ${proyectoId}`;
        
        const registrosRef = collection(db, 'usuarios', userId, 'horas', proyectoId, 'registros');
        const registrosQuery = query(
          registrosRef,
          where('pushInTime', '>=', monthStart.toISOString()),
          where('pushInTime', '<=', monthEnd.toISOString())
        );
        
        const registrosSnapshot = await getDocs(registrosQuery);

        let proyectoTotal = 0;
        let monthlyProyectoTotal = 0;
        const records = [];

        registrosSnapshot.forEach(registroDoc => {
          const data = registroDoc.data();
          const horas = Number(data.totalHours) || 0;
          const fecha = parseSafeDate(data.pushInTime);

          proyectoTotal += horas;
          allTimeTotal += horas;

          if (isWithinInterval(fecha, { start: monthStart, end: monthEnd })) {
            monthlyProyectoTotal += horas;
            monthlyTotal += horas;
          }

          records.push({
            id: registroDoc.id,
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

      // Obtener horas extras
      const extraHoursRef = doc(db, 'usuarios', userId, 'horas_extras', 'current_month');
      const extraHoursSnap = await getDoc(extraHoursRef);
      let extraHoursTotal = 0;
      let extraHoursData = { days: [] };

      if (extraHoursSnap.exists()) {
        extraHoursData = extraHoursSnap.data();
        if (extraHoursData.days) {
          extraHoursTotal = extraHoursData.days.reduce((sum, day) => sum + (day.extraHours || 0), 0);
        }
      }

      byProjectData.sort((a, b) => b.totalHours - a.totalHours);

      // Calcular totales por semana
      const weeks = calculateWeeklyTotals(monthStart, monthEnd, byProjectData, extraHoursData.days || []);

      const fullReportData = {
        monthly: byProjectData,
        byProject: byProjectData,
        extraHours: extraHoursData,
        weeks, // Agregamos los datos semanales calculados
        summary: { 
          monthlyTotal,
          extraHoursTotal,
          generalTotal: monthlyTotal + extraHoursTotal,
          allTimeTotal 
        },
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

  // Función para calcular totales semanales
  const calculateWeeklyTotals = (monthStart, monthEnd, projects, extraHoursDays) => {
    let currentWeekStart = startOfWeek(monthStart, { locale: es });
    const weeks = [];

    while (currentWeekStart <= monthEnd) {
      const weekEnd = endOfWeek(currentWeekStart, { locale: es });
      let weekHours = 0;
      let weekExtraHours = 0;
      const weekProjects = {};

      // Procesar horas de proyectos
      projects.forEach(project => {
        project.records.forEach(record => {
          const recordDate = parseSafeDate(record.pushInTime);
          if (isWithinInterval(recordDate, { start: currentWeekStart, end: weekEnd })) {
            weekHours += record.horas || 0;
            weekProjects[project.name] = (weekProjects[project.name] || 0) + (record.horas || 0);
          }
        });
      });

      // Procesar horas extras
      extraHoursDays.forEach(day => {
        const dayDate = parseSafeDate(day.date);
        if (isWithinInterval(dayDate, { start: currentWeekStart, end: weekEnd })) {
          weekExtraHours += day.extraHours || 0;
        }
      });

      const projectsSorted = Object.entries(weekProjects)
        .map(([name, hours]) => ({ name, hours }))
        .sort((a, b) => b.hours - a.hours);

      weeks.push({
        start: currentWeekStart,
        end: weekEnd,
        hours: weekHours,
        extraHours: weekExtraHours,
        totalHours: weekHours + weekExtraHours,
        projects: projectsSorted
      });

      currentWeekStart = startOfWeek(addDays(weekEnd, 1), { locale: es });
    }

    return weeks;
  };

  async function saveOrUpdateHistoricalReport(userId, reportData, monthStart) {
    try {
      const now = new Date();

      // Guardar siempre el reporte "current"
      await setDoc(doc(db, 'usuarios', userId, 'reportes', 'current'), reportData);

      // Referencia a la colección de reportes mensuales históricos
      const monthlyHistoryRef = collection(db, 'usuarios', userId, 'reportes', 'historial', 'mensuales');

      // Buscar si ya existe reporte para este mes
      const q = query(monthlyHistoryRef, where('period.monthStart', '==', monthStart.toISOString()));
      const existingSnapshot = await getDocs(q);

      if (existingSnapshot.empty) {
        // No existe: crear uno nuevo
        await addDoc(monthlyHistoryRef, { ...reportData, type: 'monthly', savedAt: serverTimestamp() });
        console.log('Nuevo reporte mensual guardado en historial');
      } else {
        // Existe: actualizar el primero encontrado
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

    // Usamos las semanas ya calculadas en el reporte
    const weeks = report.weeks || [];

    return weeks.map((week, i) => (
      <View key={i} style={week.totalHours > 0 ? styles.dayCardActive : styles.dayCard}>
        <View style={styles.dayHeader}>
          <Text style={styles.dayName}>Semana {i + 1}</Text>
          <Text style={styles.dayDate}>{format(week.start, 'dd/MM')} - {format(week.end, 'dd/MM')}</Text>
          <View style={styles.dayHoursContainer}>
            <Text style={styles.dayHours}>{week.totalHours.toFixed(2)} hrs</Text>
            <TouchableOpacity 
              style={styles.addButton} 
              onPress={() => {
                setCurrentWeekIndex(i);
                setExtraHoursInput(week.extraHours.toString());
                setExtraHoursModalVisible(true);
              }}
              activeOpacity={0.7}
            >
              <Icon name="add" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
        {week.totalHours > 0 && (
          <View style={styles.projectsList}>
            {week.projects.map((p, idx) => (
              <View key={idx} style={styles.projectRow}>
                <Text style={styles.projectName}>{p.name}</Text>
                <Text style={styles.projectHours}>{p.hours.toFixed(2)} hrs</Text>
              </View>
            ))}
            {week.extraHours > 0 && (
              <View style={styles.projectRow}>
                <Text style={[styles.projectName, styles.boldText]}>Horas extras</Text>
                <Text style={[styles.projectHours, styles.boldText]}>{week.extraHours.toFixed(2)} hrs</Text>
              </View>
            )}
            <View style={styles.projectRow}>
              <Text style={[styles.projectName, styles.boldText]}>Total semana</Text>
              <Text style={[styles.projectHours, styles.boldText]}>{week.totalHours.toFixed(2)} hrs</Text>
            </View>
          </View>
        )}
      </View>
    ));
  }

  const saveExtraHours = async () => {
    try {
      if (currentWeekIndex === -1 || !reportData) return;

      const extraHoursValue = parseFloat(extraHoursInput) || 0;
      if (extraHoursValue < 0) {
        Alert.alert('Error', 'Las horas extras no pueden ser negativas');
        return;
      }

      // Obtener las semanas actuales
      const monthStart = parseSafeDate(reportData.period.monthStart);
      const monthEnd = parseSafeDate(reportData.period.monthEnd);
      const weeks = reportData.weeks || [];

      if (currentWeekIndex >= weeks.length) {
        Alert.alert('Error', 'Semana no válida');
        return;
      }

      const selectedWeek = weeks[currentWeekIndex];
      let extraHoursDays = [...(reportData.extraHours?.days || [])];

      // Eliminar días existentes en esta semana
      extraHoursDays = extraHoursDays.filter(day => {
        const dayDate = parseSafeDate(day.date);
        return !isWithinInterval(dayDate, { 
          start: selectedWeek.start, 
          end: selectedWeek.end 
        });
      });

      // Agregar el nuevo registro si hay horas extras
      if (extraHoursValue > 0) {
        extraHoursDays.push({
          date: selectedWeek.start.toISOString(),
          extraHours: extraHoursValue
        });
      }

      // Calcular total de horas extras
      const extraHoursTotal = extraHoursDays.reduce((sum, day) => sum + (day.extraHours || 0), 0);

      // Recalcular las semanas con las nuevas horas extras
      const updatedWeeks = calculateWeeklyTotals(
        monthStart, 
        monthEnd, 
        reportData.byProject, 
        extraHoursDays
      );

      // Actualizar el estado local
      const updatedReportData = {
        ...reportData,
        weeks: updatedWeeks,
        extraHours: { days: extraHoursDays },
        summary: {
          ...reportData.summary,
          extraHoursTotal,
          generalTotal: reportData.summary.monthlyTotal + extraHoursTotal
        }
      };

      setReportData(updatedReportData);

      // Guardar en Firebase
      const extraHoursRef = doc(db, 'usuarios', userId, 'horas_extras', 'current_month');
      await setDoc(extraHoursRef, {
        days: extraHoursDays,
        updatedAt: serverTimestamp()
      });

      // Actualizar también el reporte histórico
      await saveOrUpdateHistoricalReport(userId, updatedReportData, monthStart);

      setExtraHoursModalVisible(false);
      Alert.alert('Éxito', 'Horas extras guardadas correctamente');
    } catch (error) {
      console.error('Error guardando horas extras:', error);
      Alert.alert('Error', 'No se pudieron guardar las horas extras');
    }
  };

  function renderMonthlyDetails() {
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
          {format(parseSafeDate(selectedHistoryReport.period.monthStart), 'MMMM yyyy', { locale: es })}
        </Text>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Resumen Mensual</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total horas proyectos:</Text>
            <Text style={styles.summaryValue}>{selectedHistoryReport.summary.monthlyTotal.toFixed(2)} hrs</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Horas extras:</Text>
            <Text style={styles.summaryValue}>{selectedHistoryReport.summary.extraHoursTotal.toFixed(2)} hrs</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total general:</Text>
            <Text style={styles.summaryValue}>{selectedHistoryReport.summary.generalTotal.toFixed(2)} hrs</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Horas acumuladas:</Text>
            <Text style={styles.summaryValue}>{selectedHistoryReport.summary.allTimeTotal.toFixed(2)} hrs</Text>
          </View>
          <Text style={styles.periodText}>
            Guardado el {format(parseSafeDate(selectedHistoryReport.savedAt), 'dd/MM/yyyy HH:mm')}
          </Text>
        </View>

        <PDFGenerator reportData={selectedHistoryReport} />

        <Text style={styles.sectionTitle}>Horas por Semana</Text>
        {renderWeeks(selectedHistoryReport)}

        <Text style={styles.sectionTitle}>Resumen por Proyecto</Text>
        <View style={styles.projectsSummary}>
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
    return (
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
              <Text style={styles.historyItemLabel}>Horas proyectos:</Text>
              <Text style={styles.historyItemValue}>{item.summary.monthlyTotal.toFixed(2)} hrs</Text>
            </View>
            <View style={styles.historyItemRow}>
              <Text style={styles.historyItemLabel}>Horas extras:</Text>
              <Text style={styles.historyItemValue}>{item.summary.extraHoursTotal.toFixed(2)} hrs</Text>
            </View>
            <View style={styles.historyItemRow}>
              <Text style={styles.historyItemLabel}>Total general:</Text>
              <Text style={[styles.historyItemValue, styles.historyItemTotal]}>{item.summary.generalTotal.toFixed(2)} hrs</Text>
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
  }

  useEffect(() => {
    fetchReportData();
  }, []);

  return (
    <ImageBackground 
      source={require('../../assets/fondo10.jpg')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Reporte Mensual</Text>
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={fetchReportData}
            activeOpacity={0.7}
          >
            <Icon name="refresh" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#E53935" />
            <Text style={styles.loadingText}>Cargando reporte...</Text>
          </View>
        ) : reportData ? (
          <ScrollView 
            style={styles.reportContainer} 
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchReportData} />}
          >
            <View style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <Text style={styles.summaryTitle}>Resumen Mensual</Text>
                <PDFGenerator reportData={reportData} />
              </View>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Horas proyectos:</Text>
                <Text style={styles.summaryValue}>{reportData.summary.monthlyTotal.toFixed(2)} hrs</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Horas extras:</Text>
                <Text style={styles.summaryValue}>{reportData.summary.extraHoursTotal.toFixed(2)} hrs</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total general:</Text>
                <Text style={styles.summaryValue}>{reportData.summary.generalTotal.toFixed(2)} hrs</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Horas acumuladas:</Text>
                <Text style={styles.summaryValue}>{reportData.summary.allTimeTotal.toFixed(2)} hrs</Text>
              </View>
              <Text style={styles.periodText}>
                {format(parseSafeDate(reportData.period.monthStart), 'MMMM yyyy', { locale: es })}
              </Text>
            </View>

            <Text style={styles.sectionTitle}>Horas por Semana</Text>
            {renderWeeks(reportData)}

            <Text style={styles.sectionTitle}>Resumen por Proyecto</Text>
            <View style={styles.projectsSummary}>
              {reportData.byProject?.map(p => (
                <View key={p.id} style={styles.projectRow}>
                  <Text style={styles.projectName}>{p.name}</Text>
                  <Text style={styles.projectHours}>{p.monthlyHours.toFixed(2)} hrs</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        ) : (
          <View style={styles.emptyContainer}>
            <Icon name="error-outline" size={40} color="#AAAAAA" />
            <Text style={styles.emptyText}>No hay datos para mostrar</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.historyButton}
          onPress={loadReportHistory}
          activeOpacity={0.7}
        >
          <Icon name="history" size={20} color="#FFFFFF" style={styles.historyIcon} />
          <Text style={styles.historyButtonText}>Ver Historial</Text>
        </TouchableOpacity>

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
              <Text style={styles.modalTitle}>Historial de Reportes</Text>
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

        {/* Modal para agregar horas extras */}
        <Modal visible={extraHoursModalVisible} transparent={true} animationType="fade">
          <View style={styles.centeredModal}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Agregar Horas Extras</Text>
              <Text style={styles.modalSubtitle}>
                {reportData && currentWeekIndex >= 0 && 
                  `Semana ${currentWeekIndex + 1} - ${format(parseSafeDate(reportData.period.monthStart), 'MMMM yyyy', { locale: es })}`}
              </Text>
              
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="Horas extras"
                placeholderTextColor="#AAAAAA"
                value={extraHoursInput}
                onChangeText={setExtraHoursInput}
              />
              
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setExtraHoursModalVisible(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalButtonText}>Cancelar</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={saveExtraHours}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalButtonText}>Guardar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </ImageBackground>
  );
}