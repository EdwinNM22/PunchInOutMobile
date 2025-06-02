import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, ScrollView, TouchableOpacity, Modal, RefreshControl, TextInput, Alert, ImageBackground } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, getDoc, query, where, setDoc, addDoc, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, parseISO, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import styles from '../../Styles/ReporteUsuarioStyle';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Componente para generar el PDF
const PDFGenerator = ({ reportData }) => {
  const generateHTML = () => {
    if (!reportData) return '';

    const weekStart = format(parseSafeDate(reportData.period.weekStart), 'dd/MM/yyyy');
    const weekEnd = format(parseSafeDate(reportData.period.weekEnd), 'dd/MM/yyyy');
    const generatedAt = format(new Date(), 'dd/MM/yyyy HH:mm');

    let projectsHTML = '';
    let dailyHTML = '';

    // Generar HTML para los proyectos
    reportData.weekly.forEach(day => {
      const dayTotal = (day.hours || 0) + (day.extraHours || 0);
      if (dayTotal > 0 && day.projects && day.projects.length > 0) {
        dailyHTML += `
          <div style="margin-bottom: 15px; border: 1px solid #ddd; padding: 10px; border-radius: 5px;">
            <h3 style="margin: 0 0 10px 0; color: #333; display: flex; justify-content: space-between;">
              <span>${day.dayName} - ${format(parseSafeDate(day.date), 'dd/MM')}</span>
              <span>${dayTotal.toFixed(2)} hrs (${day.hours.toFixed(2)} + ${day.extraHours.toFixed(2)} extras)</span>
            </h3>
            <table style="width: 100%; border-collapse: collapse;">
              ${day.projects.map(project => `
                <tr>
                  <td style="padding: 5px; border-bottom: 1px solid #eee;">${project.name}</td>
                  <td style="padding: 5px; border-bottom: 1px solid #eee; text-align: right;">${project.hours.toFixed(2)} hrs</td>
                </tr>
              `).join('')}
              ${day.extraHours > 0 ? `
                <tr>
                  <td style="padding: 5px; border-bottom: 1px solid #eee; font-weight: bold;">Horas extras</td>
                  <td style="padding: 5px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">${day.extraHours.toFixed(2)} hrs</td>
                </tr>
                <tr>
                  <td style="padding: 5px; font-weight: bold;">Total del día</td>
                  <td style="padding: 5px; text-align: right; font-weight: bold;">${dayTotal.toFixed(2)} hrs</td>
                </tr>
              ` : ''}
            </table>
          </div>
        `;
      }
    });

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Reporte Semanal</title>
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
            <div class="title">Reporte Semanal</div>
            <div class="subtitle">${weekStart} - ${weekEnd}</div>
          </div>
          
          <div class="summary">
            <div class="section-title">Resumen Semanal</div>
            <div class="summary-row">
              <span>Total horas proyectos:</span>
              <span class="summary-value">${reportData.summary.weeklyTotal.toFixed(2)} hrs</span>
            </div>
            <div class="summary-row">
              <span>Horas extras:</span>
              <span class="summary-value">${reportData.summary.extraHoursTotal.toFixed(2)} hrs</span>
            </div>
            <div class="summary-row">
              <span>Total general:</span>
              <span class="summary-value">${reportData.summary.generalTotal.toFixed(2)} hrs</span>
            </div>
          </div>
          
          <div class="section-title">Detalle por Día</div>
          ${dailyHTML}
          
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
          dialogTitle: 'Compartir Reporte Semanal',
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
  const [extraHoursModalVisible, setExtraHoursModalVisible] = useState(false);
  const [currentDayIndex, setCurrentDayIndex] = useState(-1);
  const [extraHoursInput, setExtraHoursInput] = useState('');

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
        extraHours: 0,
        total: 0,
        projects: []
      }));

      let weeklyTotal = 0;
      let extraHoursTotal = 0;

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

      // Obtener horas extras guardadas
      const extraHoursRef = doc(db, 'usuarios', userId, 'horas_extras', 'current_week');
      const extraHoursSnap = await getDoc(extraHoursRef);
      
      if (extraHoursSnap.exists()) {
        const extraHoursData = extraHoursSnap.data();
        if (extraHoursData.days) {
          extraHoursData.days.forEach((dayExtra, index) => {
            if (index < dailyHours.length) {
              dailyHours[index].extraHours = dayExtra.extraHours || 0;
              extraHoursTotal += dailyHours[index].extraHours;
            }
          });
        }
      }

      // Calcular total por día
      dailyHours.forEach(day => {
        day.total = day.hours + day.extraHours;
      });

      weeklyData.push(...dailyHours.map(day => ({
        ...day,
        projects: day.projects.sort((a, b) => b.hours - a.hours)
      })));

      const fullReportData = {
        weekly: weeklyData,
        summary: {
          weeklyTotal,
          extraHoursTotal,
          generalTotal: weeklyTotal + extraHoursTotal
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

  const checkAndSaveHistoricalReports = async (userId, reportData, weekStart) => {
    try {
      const now = new Date();

      const reportRef = doc(db, 'usuarios', userId, 'reportes', 'current');
      await setDoc(reportRef, reportData);

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
      } else {
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

  const openExtraHoursModal = (dayIndex) => {
    setCurrentDayIndex(dayIndex);
    setExtraHoursInput(reportData.weekly[dayIndex].extraHours.toString() || '0');
    setExtraHoursModalVisible(true);
  };

  const saveExtraHours = async () => {
    try {
      if (currentDayIndex === -1 || !reportData) return;

      const extraHoursValue = parseFloat(extraHoursInput) || 0;
      if (extraHoursValue < 0) {
        Alert.alert('Error', 'Las horas extras no pueden ser negativas');
        return;
      }

      // Actualizar el estado local
      const updatedWeekly = [...reportData.weekly];
      updatedWeekly[currentDayIndex].extraHours = extraHoursValue;
      updatedWeekly[currentDayIndex].total = updatedWeekly[currentDayIndex].hours + extraHoursValue;

      // Calcular el total de horas extras
      const extraHoursTotal = updatedWeekly.reduce((sum, day) => sum + day.extraHours, 0);

      const updatedReportData = {
        ...reportData,
        weekly: updatedWeekly,
        summary: {
          ...reportData.summary,
          extraHoursTotal,
          generalTotal: reportData.summary.weeklyTotal + extraHoursTotal
        }
      };

      setReportData(updatedReportData);

      // Guardar en Firebase
      const extraHoursRef = doc(db, 'usuarios', userId, 'horas_extras', 'current_week');
      await setDoc(extraHoursRef, {
        days: updatedWeekly.map(day => ({
          date: day.date,
          extraHours: day.extraHours
        })),
        updatedAt: serverTimestamp()
      });

      setExtraHoursModalVisible(false);
      Alert.alert('Éxito', 'Horas extras guardadas correctamente');
    } catch (error) {
      console.error('Error guardando horas extras:', error);
      Alert.alert('Error', 'No se pudieron guardar las horas extras');
    }
  };

  const renderWeeklyDetails = () => {
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
          Semana del {format(parseSafeDate(selectedHistoryReport.period.weekStart), 'dd/MM/yyyy')} al {format(parseSafeDate(selectedHistoryReport.period.weekEnd), 'dd/MM/yyyy')}
        </Text>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Resumen Semanal</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total horas proyectos:</Text>
            <Text style={styles.summaryValue}>{selectedHistoryReport.summary?.weeklyTotal?.toFixed(2) || '0.00'} hrs</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Horas extras:</Text>
            <Text style={styles.summaryValue}>{selectedHistoryReport.summary?.extraHoursTotal?.toFixed(2) || '0.00'} hrs</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total general:</Text>
            <Text style={styles.summaryValue}>{selectedHistoryReport.summary?.generalTotal?.toFixed(2) || '0.00'} hrs</Text>
          </View>
          <Text style={styles.periodText}>
            Guardado el {format(parseSafeDate(selectedHistoryReport.savedAt), 'dd/MM/yyyy HH:mm')}
          </Text>
        </View>

        <PDFGenerator reportData={selectedHistoryReport} />

        <Text style={styles.sectionTitle}>Horas por Día</Text>
        {selectedHistoryReport.weekly?.map((day, index) => (
          <View key={index} style={(day.hours > 0 || day.extraHours > 0) ? styles.dayCardActive : styles.dayCard}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayName}>{day.dayName}</Text>
              <Text style={styles.dayDate}>{format(parseSafeDate(day.date), 'dd/MM')}</Text>
              <View style={styles.dayHoursContainer}>
                <Text style={styles.dayHours}>{day.total.toFixed(2)} hrs ({day.hours.toFixed(2)} + {day.extraHours.toFixed(2)} extras)</Text>
              </View>
            </View>

            {(day.hours > 0 || day.extraHours > 0) && day.projects && (
              <View style={styles.projectsList}>
                {day.projects.map((project, pIndex) => (
                  <View key={pIndex} style={styles.projectRow}>
                    <Text style={styles.projectName}>{project.name}</Text>
                    <Text style={styles.projectHours}>{(project.hours || 0).toFixed(2)} hrs</Text>
                  </View>
                ))}
                {day.extraHours > 0 && (
                  <View style={styles.projectRow}>
                    <Text style={[styles.projectName, styles.boldText]}>Horas extras</Text>
                    <Text style={[styles.projectHours, styles.boldText]}>{day.extraHours.toFixed(2)} hrs</Text>
                  </View>
                )}
                <View style={styles.projectRow}>
                  <Text style={[styles.projectName, styles.boldText]}>Total del día</Text>
                  <Text style={[styles.projectHours, styles.boldText]}>{day.total.toFixed(2)} hrs</Text>
                </View>
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
      contentContainerStyle={styles.historyListContainer}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.historyItem}
          onPress={() => loadSpecificReport(item)}
          activeOpacity={0.7}
        >
          <Text style={styles.historyItemTitle}>
            Semana del {format(parseSafeDate(item.period.weekStart), 'dd/MM/yyyy')} al {format(parseSafeDate(item.period.weekEnd), 'dd/MM/yyyy')}
          </Text>
          <View style={styles.historyItemRow}>
            <Text style={styles.historyItemLabel}>Horas proyectos:</Text>
            <Text style={styles.historyItemValue}>{(item.summary?.weeklyTotal || 0).toFixed(2)} hrs</Text>
          </View>
          <View style={styles.historyItemRow}>
            <Text style={styles.historyItemLabel}>Horas extras:</Text>
            <Text style={styles.historyItemValue}>{(item.summary?.extraHoursTotal || 0).toFixed(2)} hrs</Text>
          </View>
          <View style={styles.historyItemRow}>
            <Text style={styles.historyItemLabel}>Total general:</Text>
            <Text style={[styles.historyItemValue, styles.historyItemTotal]}>{(item.summary?.generalTotal || 0).toFixed(2)} hrs</Text>
          </View>
          <Text style={styles.savedAtText}>Guardado: {format(parseSafeDate(item.savedAt), 'dd/MM/yyyy HH:mm')}</Text>
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
          <Text style={styles.headerTitle}>Reporte Semanal</Text>
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
            <Text style={styles.loadingText}>Cargando reporte...</Text>
          </View>
        ) : reportData ? (
          <ScrollView 
            style={styles.reportContainer} 
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            <View style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <Text style={styles.summaryTitle}>Resumen Semanal</Text>
                <PDFGenerator reportData={reportData} />
              </View>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total horas proyectos:</Text>
                <Text style={styles.summaryValue}>{reportData.summary.weeklyTotal.toFixed(2)} hrs</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Horas extras:</Text>
                <Text style={styles.summaryValue}>{reportData.summary.extraHoursTotal.toFixed(2)} hrs</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total general:</Text>
                <Text style={styles.summaryValue}>{reportData.summary.generalTotal.toFixed(2)} hrs</Text>
              </View>
              <Text style={styles.periodText}>
                Semana del {format(parseSafeDate(reportData.period.weekStart), 'dd/MM/yyyy')} al {format(parseSafeDate(reportData.period.weekEnd), 'dd/MM/yyyy')}
              </Text>
            </View>

            <Text style={styles.sectionTitle}>Detalle por Día</Text>
            
            {reportData.weekly.map((day, index) => (
              <View key={index} style={(day.hours > 0 || day.extraHours > 0) ? styles.dayCardActive : styles.dayCard}>
                <View style={styles.dayHeader}>
                  <Text style={styles.dayName}>{day.dayName}</Text>
                  <Text style={styles.dayDate}>{format(parseSafeDate(day.date), 'dd/MM')}</Text>
                  <View style={styles.dayHoursContainer}>
                    <Text style={styles.dayHours}>({day.extraHours.toFixed(2)} hrs extra)</Text>
                    <TouchableOpacity 
                      style={styles.addButton} 
                      onPress={() => openExtraHoursModal(index)}
                      activeOpacity={0.7}
                    >
                      <Icon name="add" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>
                
                {(day.hours > 0 || day.extraHours > 0) && day.projects && (
                  <View style={styles.projectsList}>
                    {day.projects.map((project, pIndex) => (
                      <View key={pIndex} style={styles.projectRow}>
                        <Text style={styles.projectName}>{project.name}</Text>
                        <Text style={styles.projectHours}>{project.hours.toFixed(2)} hrs</Text>
                      </View>
                    ))}
                    {day.extraHours > 0 && (
                      <View style={styles.projectRow}>
                        <Text style={[styles.projectName, styles.boldText]}>Horas extras</Text>
                        <Text style={[styles.projectHours, styles.boldText]}>{day.extraHours.toFixed(2)} hrs</Text>
                      </View>
                    )}
                    <View style={styles.projectRow}>
                      <Text style={[styles.projectName, styles.boldText]}>Total del día</Text>
                      <Text style={[styles.projectHours, styles.boldText]}>{day.total.toFixed(2)} hrs</Text>
                    </View>
                  </View>
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
          onRequestClose={() => setHistoryModalVisible(false)}
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

            {viewMode === 'list' ? renderHistoryList() : renderWeeklyDetails()}
          </View>
        </Modal>

        {/* Modal para agregar horas extras */}
        <Modal visible={extraHoursModalVisible} transparent={true} animationType="fade">
          <View style={styles.centeredModal}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Agregar Horas Extras</Text>
              <Text style={styles.modalSubtitle}>
                {reportData && currentDayIndex >= 0 && 
                  `${reportData.weekly[currentDayIndex].dayName} - ${format(parseSafeDate(reportData.weekly[currentDayIndex].date), 'dd/MM')}`}
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