// screens/UserOptions.js
import React, { useState, useEffect, useMemo } from "react";
import {View,Text,FlatList,TouchableOpacity,StyleSheet,TextInput,SafeAreaView,ScrollView,Alert,ImageBackground,} from "react-native";
import {getFirestore,collection,getDocs,doc,updateDoc,} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { Ionicons } from "@expo/vector-icons";
import appFirebase from "../credenciales";

const CARD_MARGIN = 10;

export default function UserOptions() {
  const [users, setUsers] = useState([]);
  const [isRefreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const auth = getAuth(appFirebase);
  const db = getFirestore(appFirebase);

  const fetchUsers = async () => {
    setRefreshing(true);
    try {
      const snap = await getDocs(collection(db, "usuarios"));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setUsers(list);
    } catch (e) {
      console.error("Error fetching users:", e);
      Alert.alert("Error", "No se pudo cargar la lista de usuarios");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const toggleUserRole = async (userId, currentRole) => {
    try {
      const newRole = currentRole === "ADMIN" ? "WORKER" : "ADMIN";
      await updateDoc(doc(db, "usuarios", userId), { rol: newRole });
      fetchUsers();
      Alert.alert("Éxito", `Rol cambiado a ${newRole}`);
    } catch (e) {
      console.error("Error updating role:", e);
      Alert.alert("Error", "No se pudo cambiar el rol del usuario");
    }
  };

  const displayedUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users
      .filter(
        (u) =>
          u.nombre?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q)
      )
      .sort((a, b) =>
        (a.nombre || "").localeCompare(b.nombre || "", "es", {
          sensitivity: "base",
        })
      );
  }, [users, searchQuery]);

  const renderUserItem = ({ item }) => (
    <View style={styles.userCard}>
      <View style={styles.userInfo}>
        <View style={styles.userAvatar}>
          <Text style={styles.userInitials}>
            {item.nombre ? item.nombre.charAt(0).toUpperCase() : "U"}
          </Text>
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.userName}>
            {item.nombre || "Usuario sin nombre"}
          </Text>
          <Text style={styles.userEmail}>{item.email}</Text>
          <Text
            style={[
              styles.userRole,
              { color: item.rol === "ADMIN" ? "#E53935" : "#4a76ff" },
            ]}
          >
            {item.rol || "WORKER"}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={[styles.actionButton, styles.roleButton]}
        onPress={() => toggleUserRole(item.id, item.rol)}
      >
        <Ionicons name="swap-horizontal" size={20} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  return (
    <ImageBackground
      source={require("../assets/fondo8.jpg")}
      style={{ flex: 1 }}
      resizeMode="cover"
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Administración de Usuarios</Text>
            <TouchableOpacity onPress={fetchUsers} style={styles.refreshButton}>
              <Ionicons name="refresh" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Barra de búsqueda */}
          <View style={styles.searchContainer}>
            <Ionicons
              name="search"
              size={20}
              color="#CCCCCC"
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar usuario..."
              placeholderTextColor="#AAAAAA"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
          </View>

          {/* Lista */}
          {isRefreshing ? (
            <View style={styles.loadingContainer}>
              <Ionicons name="refresh" size={24} color="#FFFFFF" />
              <Text style={styles.loadingText}>Cargando usuarios...</Text>
            </View>
          ) : (
            <FlatList
              data={displayedUsers}
              renderItem={renderUserItem}
              keyExtractor={(item) => item.id}
              refreshing={isRefreshing}
              onRefresh={fetchUsers}
              contentContainerStyle={styles.gridContainer}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="people-outline" size={50} color="#AAAAAA" />
                  <Text style={styles.noProjectsText}>
                    No hay usuarios registrados
                  </Text>
                </View>
              }
            />
          )}
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(18, 18, 18, 0.8)",
  },
  loadingText: {
    color: "#FFFFFF",
    marginTop: 10,
  },
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 25,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    padding: 20,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  refreshButton: {
    padding: 5,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(30, 30, 30, 0.7)",
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 20,
    height: 45,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: "#FFFFFF",
    height: "100%",
  },
  gridContainer: {
    flex: 1,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderRadius: 10,
  },
  noProjectsText: {
    textAlign: "center",
    marginTop: 15,
    fontSize: 16,
    color: "#AAAAAA",
  },
  userCard: {
    backgroundColor: "rgba(30, 30, 30, 0.7)",
    padding: 15,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: "#E53935",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    marginBottom: CARD_MARGIN,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E53935",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  userInitials: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 16,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  textContainer: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 5,
  },
  userEmail: {
    fontSize: 12,
    color: "#CCCCCC",
    marginBottom: 5,
  },
  userRole: {
    fontSize: 12,
    fontWeight: "bold",
  },
  actionButton: {
    padding: 8,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  roleButton: {
    backgroundColor: "#E53935",
  },
});
