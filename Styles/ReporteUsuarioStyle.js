import { StyleSheet } from 'react-native';

export default StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#f5f5f5',
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      textAlign: 'center',
      marginVertical: 15,
      color: '#2c3e50',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 10,
      color: '#2c3e50',
    },
    tabContent: {
      flex: 1,
      padding: 15,
    },
    tabBar: {
      backgroundColor: '#fff',
    },
    tabIndicator: {
      backgroundColor: '#2c3e50',
    },
    tabLabel: {
      fontWeight: 'bold',
    },
    summaryCard: {
      backgroundColor: '#fff',
      borderRadius: 10,
      padding: 15,
      marginBottom: 15,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    summaryTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 10,
      color: '#2c3e50',
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 5,
    },
    summaryValue: {
      fontWeight: 'bold',
    },
    periodText: {
      fontSize: 12,
      color: '#7f8c8d',
      marginTop: 5,
    },
    updateText: {
      fontSize: 12,
      color: '#7f8c8d',
      fontStyle: 'italic',
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      marginBottom: 10,
      color: '#2c3e50',
    },
    dayCard: {
      backgroundColor: '#fff',
      borderRadius: 10,
      padding: 15,
      marginBottom: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 1,
      opacity: 0.7,
    },
    dayCardActive: {
      backgroundColor: '#fff',
      borderRadius: 10,
      padding: 15,
      marginBottom: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 1,
    },
    dayHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 5,
    },
    dayName: {
      fontWeight: 'bold',
      flex: 2,
    },
    dayDate: {
      flex: 1,
      textAlign: 'center',
    },
    dayHours: {
      flex: 1,
      textAlign: 'right',
      fontWeight: 'bold',
    },
    projectsList: {
      marginTop: 10,
      borderTopWidth: 1,
      borderTopColor: '#ecf0f1',
      paddingTop: 10,
    },
    projectRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 5,
    },
    projectName: {
      flex: 3,
    },
    projectHours: {
      flex: 1,
      textAlign: 'right',
    },
    projectCard: {
      backgroundColor: '#fff',
      borderRadius: 10,
      padding: 15,
      marginBottom: 15,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    projectHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 5,
    },
    projectTitle: {
      fontWeight: 'bold',
      fontSize: 16,
      flex: 3,
    },
    projectTotal: {
      fontWeight: 'bold',
      fontSize: 16,
      flex: 1,
      textAlign: 'right',
    },
    projectSubtitle: {
      fontSize: 12,
      color: '#7f8c8d',
      marginBottom: 10,
    },
    projectDetails: {
      marginVertical: 10,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 5,
    },
    detailValue: {
      fontWeight: 'bold',
    },
    recordsTitle: {
      fontWeight: 'bold',
      marginTop: 10,
      marginBottom: 5,
      fontSize: 14,
    },
    recordItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 3,
      paddingLeft: 10,
    },
    recordDate: {
      color: '#7f8c8d',
    },
    recordHours: {
      fontWeight: 'bold',
    },
    moreRecords: {
      fontSize: 12,
      color: '#7f8c8d',
      textAlign: 'right',
      marginTop: 5,
    },
    historyButtonsContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginBottom: 15,
    },
    historyButton: {
      backgroundColor: '#2c3e50',
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 20,
    },
    historyButtonText: {
      color: '#fff',
      fontWeight: 'bold',
    },
    modalContainer: {
      flex: 1,
      backgroundColor: '#f5f5f5',
      padding: 15,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 15,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#2c3e50',
    },
    closeButton: {
      backgroundColor: '#e74c3c',
      padding: 8,
      borderRadius: 5,
    },
    closeButtonText: {
      color: '#fff',
      fontWeight: 'bold',
    },
    historyItem: {
      backgroundColor: '#fff',
      padding: 15,
      borderRadius: 10,
      marginBottom: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 1,
    },
    historyItemTitle: {
      fontWeight: 'bold',
      marginBottom: 5,
    },
    historyItemDate: {
      fontSize: 12,
      color: '#7f8c8d',
      marginBottom: 5,
    },
    historyItemTotal: {
      fontWeight: 'bold',
      color: '#2c3e50',
    },
    noHistoryText: {
      textAlign: 'center',
      marginTop: 20,
      color: '#7f8c8d',
    },
    historyLoading: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    detailsContainer: {
      flex: 1,
      padding: 15,
    },
    detailsTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 15,
      textAlign: 'center',
      color: '#2c3e50',
    },
    backButton: {
      alignSelf: 'flex-start',
      marginBottom: 15,
    },
    backButtonText: {
      color: '#3498db',
      fontWeight: 'bold',
    },
  });