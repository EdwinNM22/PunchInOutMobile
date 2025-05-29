import { StyleSheet } from 'react-native';

export default StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 40,
      backgroundColor: '#f5f5f5',
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      marginBottom: 30,
      textAlign: 'center',
      color: '#333',
    },
    input: {
      height: 50,
      borderColor: '#ddd',
      borderWidth: 1,
      borderRadius: 25,
      marginBottom: 15,
      paddingLeft: 15,
      fontSize: 16,
      backgroundColor: '#fff',
    },
    button: {
      height: 50,
      borderRadius: 25,
      backgroundColor: '#4CAF50',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
    },
    buttonText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: 'bold',
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    footerText: {
      fontSize: 14,
      color: '#333',
    },
    link: {
      fontSize: 14,
      color: '#4CAF50',
      fontWeight: 'bold',
      marginLeft: 5,
    },
  });
  