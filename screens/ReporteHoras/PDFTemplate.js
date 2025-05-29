import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

Font.register({
  family: 'Open Sans',
  fonts: [{ src: 'https://fonts.gstatic.com/s/opensans/v18/mem8YaGs126MiZpBA-UFVZ0b.woff2' }]
});

const styles = StyleSheet.create({
  page: { padding: 20, fontFamily: 'Open Sans', fontSize: 12 },
  section: { marginBottom: 10 },
  title: { fontSize: 16, marginBottom: 8, fontWeight: 'bold' },
  dayRow: { marginBottom: 5 },
  projectRow: { marginLeft: 10, flexDirection: 'row', justifyContent: 'space-between' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
});

export function PDFTemplate({ report }) {
  if (!report) return null;

  const weekStart = format(new Date(report.period.weekStart), 'dd/MM/yyyy', { locale: es });
  const weekEnd = format(new Date(report.period.weekEnd), 'dd/MM/yyyy', { locale: es });

  return (
    <Document>
      <Page style={styles.page}>
        <Text style={styles.title}>Reporte Semanal</Text>
        <Text>Semana: {weekStart} - {weekEnd}</Text>

        <View style={styles.section}>
          <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>Resumen</Text>
          <View style={styles.summaryRow}>
            <Text>Total horas:</Text>
            <Text>{report.summary?.weeklyTotal?.toFixed(2) || '0.00'} hrs</Text>
          </View>
          <Text>Generado: {format(new Date(report.generatedAt), 'dd/MM/yyyy HH:mm', { locale: es })}</Text>
        </View>

        <View style={styles.section}>
          <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>Horas por Día</Text>
          {report.weekly.map((day, idx) => (
            <View key={idx} style={styles.dayRow}>
              <Text>{day.dayName} ({format(new Date(day.date), 'dd/MM')}): {day.hours.toFixed(2)} hrs</Text>
              {day.projects?.map((project, i) => (
                <View key={i} style={styles.projectRow}>
                  <Text>- {project.name}</Text>
                  <Text>{project.hours.toFixed(2)} hrs</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
