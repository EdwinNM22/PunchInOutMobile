// ────────────────────────────────────────────────────────────
//   Admin view – all daily reports for a single project
// ────────────────────────────────────────────────────────────
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
  SafeAreaView,
  ImageBackground,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

if (Platform.OS === "android") {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

function ReportCard({ report }) {
  const [open, setOpen] = useState(false);
  const toggle = () => {
    LayoutAnimation.easeInEaseOut();
    setOpen(!open);
  };

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.cardHeader} onPress={toggle}>
        <View style={styles.reportHeader}>
          <MaterialIcons name="report" size={20} color="#2c3e50" />
          <Text style={styles.cardHeaderText}>
            {new Date(report.createdAt).toLocaleDateString()}
          </Text>
        </View>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={20}
          color="#2c3e50"
        />
      </TouchableOpacity>

      {open && (
        <View style={styles.cardBody}>
          <Text style={styles.reportContent}>{report.content}</Text>
        </View>
      )}
    </View>
  );
}

export default function AdminProjectReports({ route }) {
  const { projectId, projectName } = route.params;
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    const db = getFirestore();

    try {
      const q = query(
        collection(db, "reportes"),
        where("projectId", "==", projectId)
      );

      const querySnapshot = await getDocs(q);
      const reportsData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Ordena localmente por fecha
      reportsData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      setReports(reportsData);
    } catch (err) {
      console.error("Error fetching reports:", err);
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const generatePdf = async () => {
    if (!reports || reports.length === 0) return;
    
    try {
      const html = `
        <html>
          <head>
            <style>
              body { font-family: Arial; padding: 20px; }
              .header { text-align: center; margin-bottom: 30px; }
              .title { font-size: 24px; font-weight: bold; color: #2c3e50; }
              .subtitle { font-size: 16px; color: #7f8c8d; margin-bottom: 20px; }
              .report { margin-bottom: 25px; border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
              .report-date { font-weight: bold; color: #2c3e50; margin-bottom: 10px; }
              .report-content { color: #34495e; line-height: 1.5; }
              .page-break { page-break-after: always; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1 class="title">${projectName}</h1>
              <p class="subtitle">Reportes Diarios - ${new Date().toLocaleDateString()}</p>
            </div>
            
            ${reports.map((report, index) => `
              <div class="report" ${index < reports.length - 1 ? '' : ''}>
                <div class="report-date">
                  ${new Date(report.createdAt).toLocaleDateString()}
                </div>
                <div class="report-content">
                  ${report.content.replace(/\n/g, '<br>')}
                </div>
              </div>
              ${index < reports.length - 1 ? '<hr style="margin: 20px 0; border: 0; border-top: 1px dashed #ddd;">' : ''}
            `).join('')}
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      const pdfName = `${FileSystem.documentDirectory}Reportes_${projectName.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`;
      
      await FileSystem.copyAsync({
        from: uri,
        to: pdfName,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(pdfName, {
          mimeType: 'application/pdf',
          dialogTitle: `Reportes de ${projectName}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        alert('El archivo PDF se ha generado pero no se puede compartir en esta plataforma.');
      }
    } catch (error) {
      console.error('Error al generar PDF:', error);
      alert('Error al generar el PDF. Por favor, inténtalo de nuevo.');
    }
  };

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  if (loading || reports === null) {
    return (
      <ImageBackground
        source={require("../assets/fondo8.jpg")}
        style={{ flex: 1 }}
        resizeMode="cover"
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#E53935" />
            <Text style={styles.loadingText}>Cargando reportes...</Text>
          </View>
        </SafeAreaView>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground
      source={require("../assets/fondo8.jpg")}
      style={{ flex: 1 }}
      resizeMode="cover"
    >
      <SafeAreaView style={styles.safeArea}>
        <ScrollView style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>{projectName}</Text>
            <Text style={styles.subtitle}>Reportes diarios</Text>
            
            {reports.length > 0 && (
              <TouchableOpacity 
                style={styles.downloadButton} 
                onPress={generatePdf}
              >
                <Text style={styles.downloadButtonText}>
                  <MaterialIcons name="picture-as-pdf" size={18} color="white" /> Descargar PDF
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {reports.length > 0 ? (
            reports.map((report) => (
              <ReportCard key={report.id} report={report} />
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="report-problem" size={50} color="#E53935" />
              <Text style={styles.emptyText}>
                No hay reportes aún para este proyecto
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

/* ───────── styles ───────── */
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    flex: 1,
    paddingHorizontal: 15,
    paddingTop: 15,
  },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#FFFFFF",
    marginTop: 10,
    fontSize: 16,
  },
  header: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: "rgba(30, 30, 30, 0.7)",
    borderRadius: 10,
    position: 'relative',
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#CCCCCC",
    textAlign: "center",
    marginTop: 5,
    marginBottom: 15,
  },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    marginBottom: 15,
    borderRadius: 10,
    overflow: "hidden",
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
  },
  reportHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardHeaderText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2c3e50",
    marginLeft: 10,
  },
  cardBody: {
    padding: 15,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
  },
  reportContent: {
    fontSize: 14,
    color: "#34495e",
    lineHeight: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
    backgroundColor: "rgba(30, 30, 30, 0.7)",
    borderRadius: 10,
    marginTop: 20,
  },
  emptyText: {
    color: "#FFFFFF",
    fontSize: 16,
    textAlign: "center",
    marginTop: 15,
  },
  downloadButton: {
    backgroundColor: '#E53935',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
    alignSelf: 'center',
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 5,
  },
});