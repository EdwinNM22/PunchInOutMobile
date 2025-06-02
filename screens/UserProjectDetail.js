// screens/UserProjectDetail.js
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Alert, StyleSheet, SafeAreaView,
  Linking, Modal, TextInput, KeyboardAvoidingView, Platform,
  ActivityIndicator, FlatList, SectionList, ScrollView, Image
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { getAuth } from 'firebase/auth';
import {
  getFirestore, doc, setDoc, updateDoc, collection,
  getDoc, serverTimestamp
} from 'firebase/firestore';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { currentBlock } from '../utils/reportFirestore';
import useDailyReport from '../hooks/useDailyReport';
import { useSafeAreaInsets, SafeAreaProvider } from 'react-native-safe-area-context';

/* ────────────────────────────────────────────────────────────── */
/* helper: muestra link a la ubicación del proyecto              */
const ProjectLocation = React.memo(({ location }) => (
  <TouchableOpacity
    style={styles.locationLink}
    onPress={() =>
      Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`
      )}
  >
    <Text style={styles.locationLinkText}>
      <Ionicons name="map" size={16} color="#E53935" /> Ver en mapa: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
    </Text>
  </TouchableOpacity>
));
/* ────────────────────────────────────────────────────────────── */

export default function UserProjectDetail({ route, navigation }) {
  const { project } = route.params;
  const auth = getAuth();
  const db = getFirestore();
  const insets = useSafeAreaInsets();
  const [recountPhase, setRecountPhase] = useState('evening');

  /* ………………………………………………………………… estado general ……………………………………………………… */
  const [pushInTime, setPushInTime] = useState(null);
  const [totalHours, setTotalHours] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isJefe, setIsJefe] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);

  /* checklist / recount UI */
  const [showChecklist, setShowChecklist] = useState(false);
  const [showRecount, setShowRecount] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [tmpName, setTmpName] = useState('');
  const [tmpQty, setTmpQty] = useState('');
  const [itemUnit, setItemUnit] = useState('');
  const [recount, setRecount] = useState({});
  const [commentModal, setCommentModal] = useState(false);
  const [commentTxt, setCommentTxt] = useState('');

  /* geofence */
  const locationSub = useRef(null);
  const threshold = 200;

  /* hook: toda la lógica Firestore de los reportes */
  const {
    checklist,
    loadChecklist,
    recountMorning,
    recountEvening,
    comments,
    saveChecklist,
    saveRecount,
    saveJefeNote,
    postWorkerComment,
  } = useDailyReport(project.id, auth.currentUser?.uid);

  // Memoized filtered lists
  const { materialsList, toolsList } = useMemo(() => {
    if (!checklist || !checklist.list) return { materialsList: [], toolsList: [] };
    return {
      materialsList: checklist.list.filter(i => i.type === 'mat'),
      toolsList: checklist.list.filter(i => i.type === 'tool'),
    };
  }, [checklist]);

  /* ─── helpers fecha ───────────────────────────────────────── */
  const todayString = useCallback(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const distMeters = useCallback((lat1, lon1, lat2, lon2) => {
    const toRad = v => v * Math.PI / 180, R = 6371e3;
    const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, []);

  /* ─── geofence watch — se activa sólo con Push-In ─────────── */
  const watchDistance = useCallback(async () => {
    locationSub.current?.remove();
    locationSub.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Highest, distanceInterval: 10 },
      async loc => {
        const d = distMeters(
          loc.coords.latitude, loc.coords.longitude,
          project.location.latitude, project.location.longitude
        );
        if (d > threshold) {
          Alert.alert('Te alejaste del proyecto',
            'Superaste el radio permitido; se cerró tu turno automáticamente.');
          await doPushOut(true);
        }
      });
  }, [distMeters, project.location]);

  /* ─── PUSH-IN ─────────────────────────────────────────────── */
  const doPushIn = useCallback(async () => {
    if (processingAction) return;
    setProcessingAction(true);
    
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { 
        Alert.alert('Permiso denegado'); 
        setProcessingAction(false);
        return; 
      }
      
      const loc = await Location.getCurrentPositionAsync({});
      const d = distMeters(loc.coords.latitude, loc.coords.longitude,
        project.location.latitude, project.location.longitude);
      if (d > threshold) { 
        Alert.alert('Muy lejos del proyecto'); 
        setProcessingAction(false);
        return; 
      }

      const nowISO = new Date().toISOString();
      const user = auth.currentUser;
      const userDocRef = doc(db, 'usuarios', user.uid, 'horas', project.id, 'fechas', todayString());
      
      await setDoc(userDocRef, {
        pushInTime: nowISO, 
        pushOutTime: null, 
        totalHours: 0,
        location: { latitude: loc.coords.latitude, longitude: loc.coords.longitude }
      });
      
      setPushInTime(nowISO);
      watchDistance();
      Alert.alert('Push In exitoso');

      if (isJefe) {
        const checklistExists = Boolean(checklist);
        const morningRecountExists = Boolean(recountMorning);

        if (!checklistExists) {
          setShowChecklist(true);
        } else if (!morningRecountExists) {
          setRecountPhase('morning');
          setShowRecount(true);
        } else {
          setRecountPhase('evening');
          setShowRecount(true);
        }
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'No se pudo hacer Push In');
    } finally {
      setProcessingAction(false);
    }
  }, [auth.currentUser, db, distMeters, isJefe, project.id, project.location, todayString, watchDistance, checklist, recountMorning, processingAction]);

  /* ─── PUSH-OUT ────────────────────────────────────────────── */
  const doPushOut = useCallback(async (silent = false) => {
    if (processingAction) return;
    setProcessingAction(true);
    
    try {
      const user = auth.currentUser;
      if (!user || !pushInTime) return;

      const nowISO = new Date().toISOString();
      const diffHrs = ((new Date(nowISO) - new Date(pushInTime)) / 3.6e6).toFixed(2);
      const userDocRef = doc(db, 'usuarios', user.uid, 'horas', project.id, 'fechas', todayString());
      
      await updateDoc(userDocRef, {
        pushOutTime: nowISO, 
        totalHours: Number(diffHrs)
      });
      
      setTotalHours(diffHrs); 
      setPushInTime(null);
      locationSub.current?.remove(); 
      locationSub.current = null;
      if (!silent) Alert.alert('Push Out exitoso', `Total: ${diffHrs} h`);
    } catch (e) { 
      console.error(e); 
      if (!silent) Alert.alert('Error', 'No se pudo hacer Push Out'); 
    } finally {
      setProcessingAction(false);
    }
    await Notifications.cancelAllScheduledNotificationsAsync();
  }, [auth.currentUser, db, pushInTime, project.id, todayString, processingAction]);

  /* ─── comentarios cada 2 h ───────────────────────────────── */
  const sendComment = useCallback(async () => {
    if (!commentTxt.trim()) return;
    try {
      await postWorkerComment(currentBlock(pushInTime).id, auth.currentUser, commentTxt.trim());
      setCommentTxt(''); 
      setCommentModal(false);
    } catch (error) {
      Alert.alert('Error', 'No se pudo enviar el comentario');
    }
  }, [commentTxt, pushInTime, auth.currentUser, postWorkerComment]);

  const handleReportBtn = useCallback(() => {
    if (!pushInTime) return;

    const { id } = currentBlock(pushInTime);
    const blk = comments?.find(c => c.id === id) ?? {};

    setCommentTxt(blk.jefeNote ?? '');
    setCommentModal(true);
  }, [pushInTime, comments]);

  /* ─── Checklist helpers (añadir / editar) ────────────────── */
  const addOrUpdateItem = useCallback((type) => {
    if (!tmpName || !tmpQty) {
      Alert.alert('Completa nombre y cantidad');
      return;
    }

    const list = type === 'mat' ? materialsList : toolsList;
    const setter = type === 'mat' ? setMaterialsList : setToolsList;

    const isEditing = Boolean(editItem?.id);

    if (isEditing) {
      setter(list.map(it =>
        it.id === editItem.id
          ? { ...it, name: tmpName, qty: Number(tmpQty), unit: itemUnit }
          : it
      ));
    } else {
      setter([
        ...list,
        {
          id: Date.now().toString(),
          name: tmpName,
          qty: Number(tmpQty),
          unit: itemUnit,
          type
        }
      ]);
    }

    setEditItem(null);
    setTmpName('');
    setTmpQty('');
    setItemUnit('');
  }, [editItem, materialsList, toolsList, tmpName, tmpQty, itemUnit]);

  const deleteItem = useCallback((id, type) => {
    const setter = type === 'mat' ? setMaterialsList : setToolsList;
    const list = type === 'mat' ? materialsList : toolsList;
    setter(list.filter(it => it.id !== id));
  }, [materialsList, toolsList]);

  /* ─── SAVE checklist to Firestore ────────────────────────── */
  const saveChecklistAndStartTimer = useCallback(async (items) => {
    try {
      await saveChecklist(items);
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar la lista');
    }
  }, [saveChecklist]);

  /* ─── primer montaje: ver si ya hay Push-In activo ────────── */
  useEffect(() => {
    const init = async () => {
      try {
        const user = auth.currentUser;
        if (!user) { setLoading(false); return; }

        // Optimización: Cargar rol y push-in en paralelo
        const [aSnap, hsnap] = await Promise.all([
          getDoc(doc(db, 'proyectos', project.id, 'assignments', user.uid)),
          getDoc(doc(db, 'usuarios', user.uid, 'horas', project.id, 'fechas', todayString()))
        ]);

        if (aSnap.exists() && aSnap.data().role === 'jefe') setIsJefe(true);

        if (hsnap.exists() && !hsnap.data().pushOutTime) {
          setPushInTime(hsnap.data().pushInTime);
          watchDistance();
        }
        
        await loadChecklist();
      } catch (e) {
        console.error('init UserProjectDetail', e);
      } finally {
        setLoading(false);
      }
    };

    init();
    return () => locationSub.current?.remove();
  }, [auth.currentUser, db, project.id, todayString, watchDistance, loadChecklist]);

  /* ─── quick UI shortcuts ─────────────────────────────────── */
  const { optionStyle, buttonLabel, buttonAction } = useMemo(() => ({
    optionStyle: pushInTime ? styles.option2 : styles.option1,
    buttonLabel: pushInTime ? 'Push Out' : 'Push In',
    buttonAction: pushInTime ? doPushOut : doPushIn,
  }), [pushInTime, doPushIn, doPushOut]);

  /* ─── LOADING first paint ────────────────────────────────── */
  if (loading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#E53935" />
      <Text style={styles.loadingText}>Cargando proyecto...</Text>
    </View>
  );

  /* ─────────────────────────────────────────────────────────── */
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* ——— Encabezado ——— */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>{project.name}</Text>
            <Image 
              source={require('../assets/biovizion.jpg')}
              style={styles.headerIcon}
            />
          </View>
          <Text style={styles.projectDescription}>{project.description}</Text>
          {project.location && <ProjectLocation location={project.location} />}
        </View>

        {/* ——— Push-In / Out ——— */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, optionStyle]}
            onPress={buttonAction}
            disabled={processingAction}
          >
            {processingAction ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name={pushInTime ? 'log-out' : 'log-in'} size={22} color="#fff" />
                <Text style={styles.actionButtonText}>{buttonLabel}</Text>
              </>
            )}
          </TouchableOpacity>
          
          {totalHours && (
            <View style={styles.hoursContainer}>
              <Text style={styles.hoursText}>Horas trabajadas:</Text>
              <Text style={styles.hoursValue}>{totalHours} h</Text>
            </View>
          )}
        </View>

        {/* ——— Botones adicionales ——— */}
        <View style={styles.secondaryButtonsContainer}>
          {!isJefe && pushInTime && (
            <TouchableOpacity
              style={[styles.secondaryButton, styles.commentButton]}
              onPress={() => {
                setCommentTxt('');
                setCommentModal(true);
              }}
            >
              <MaterialIcons name="comment" size={20} color="#fff" />
              <Text style={styles.secondaryButtonText}>Comentario</Text>
            </TouchableOpacity>
          )}

          {isJefe && pushInTime && (
            <>
              <TouchableOpacity
                style={[styles.secondaryButton, styles.reportButton]}
                onPress={handleReportBtn}
              >
                <MaterialIcons name="assignment" size={20} color="#fff" />
                <Text style={styles.secondaryButtonText}>Reportes</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryButton, styles.recountButton]}
                onPress={() => {
                  setRecountPhase('evening');
                  setShowRecount(true);
                }}
              >
                <MaterialIcons name="inventory" size={20} color="#fff" />
                <Text style={styles.secondaryButtonText}>Recuento</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Información adicional del proyecto */}
        {project.additionalInfo && (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Información del Proyecto</Text>
            <Text style={styles.infoText}>{project.additionalInfo}</Text>
          </View>
        )}
      </ScrollView>

      {/* ——— Modales ——— */}
      {/* Checklist inicial */}
      <Modal
        visible={showChecklist}
        animationType="slide"
        onRequestClose={() => { setShowChecklist(false); setEditItem(null); }}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <ScrollView contentContainerStyle={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Lista de materiales/herramientas</Text>
              <TouchableOpacity onPress={() => setShowChecklist(false)}>
                <Ionicons name="close" size={28} color="#E53935" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={[...materialsList, ...toolsList]}
              keyExtractor={it => it.id}
              renderItem={({ item }) => (
                <View style={styles.listItem}>
                  <Text style={styles.listItemText}>{item.name} – {item.qty} {item.unit || ''}</Text>
                  <View style={styles.listItemActions}>
                    <TouchableOpacity 
                      style={styles.iconButton}
                      onPress={() => { 
                        setEditItem(item); 
                        setTmpName(item.name); 
                        setTmpQty(String(item.qty)); 
                        setItemUnit(item.unit || ''); 
                      }}
                    >
                      <Ionicons name="create-outline" size={20} color="#4a76ff" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.iconButton}
                      onPress={() => deleteItem(item.id, item.type)}
                    >
                      <Ionicons name="trash-outline" size={20} color="#e74c3c" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyListText}>No hay ítems en la lista</Text>
              }
            />

            <View style={styles.addButtonsContainer}>
              <TouchableOpacity 
                style={styles.addButton}
                onPress={() => setEditItem({ type: 'mat' })}
              >
                <Text style={styles.addButtonText}>＋ Material</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.addButton}
                onPress={() => setEditItem({ type: 'tool' })}
              >
                <Text style={styles.addButtonText}>＋ Herramienta</Text>
              </TouchableOpacity>
            </View>

            {editItem && (
              <View style={styles.editForm}>
                <TextInput
                  placeholder="Nombre"
                  style={styles.editInput}
                  value={tmpName}
                  onChangeText={setTmpName}
                />
                <View style={styles.quantityRow}>
                  <TextInput
                    placeholder="Cantidad"
                    style={[styles.editInput, styles.quantityInput]}
                    keyboardType="numeric"
                    value={tmpQty}
                    onChangeText={setTmpQty}
                  />
                  <TextInput
                    placeholder="Unidad (opcional)"
                    style={[styles.editInput, styles.unitInput]}
                    value={itemUnit}
                    onChangeText={setItemUnit}
                  />
                </View>
                <TouchableOpacity
                  style={styles.saveEditButton}
                  onPress={() => addOrUpdateItem(editItem.type)}
                >
                  <Text style={styles.saveEditButtonText}>
                    {editItem.id ? 'Actualizar' : 'Añadir'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={styles.saveButton}
              onPress={async () => {
                await saveChecklistAndStartTimer([...materialsList, ...toolsList]);
                setShowChecklist(false);
              }}
            >
              <Text style={styles.saveButtonText}>Guardar lista</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Comentarios */}
      <Modal
        visible={commentModal}
        animationType="slide"
        onRequestClose={() => setCommentModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalSafeArea}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isJefe ? 'Bitácora del proyecto' : 'Añadir comentario'}
              </Text>
              <TouchableOpacity onPress={() => setCommentModal(false)}>
                <Ionicons name="close" size={28} color="#E53935" />
              </TouchableOpacity>
            </View>

            {isJefe ? (
              <>
                {(() => {
                  if (!pushInTime) return null;
                  const { id: startId, startAt } = currentBlock(pushInTime);
                  const blk = comments?.find(c => c.id === startId) ?? {};
                  const locked =
                    blk.locked ||
                    Date.now() - startAt.getTime() > 2 * 60 * 60 * 1000;

                  return (
                    <>
                      <TextInput
                        style={styles.commentInput}
                        multiline
                        editable={!locked}
                        placeholder="Describe las actividades..."
                        value={commentTxt !== '' ? commentTxt : blk.jefeNote ?? ''}
                        onChangeText={setCommentTxt}
                      />

                      <TouchableOpacity
                        style={[styles.saveButton, locked && styles.disabledButton]}
                        disabled={locked}
                        onPress={async () => {
                          await saveJefeNote(pushInTime, commentTxt, locked);
                          if (locked)
                            Alert.alert('Bloque cerrado', 'Se inició uno nuevo.');
                        }}
                      >
                        <Text style={styles.saveButtonText}>
                          {locked ? 'Bloque cerrado' : 'Guardar'}
                        </Text>
                      </TouchableOpacity>
                    </>
                  );
                })()}

                <SectionList
                  style={styles.commentList}
                  sections={comments?.map(c => ({
                    title: c.id + (c.locked ? '' : ' (abierto)'),
                    data: c.workers ?? [],
                    jefe: c.jefeNote ?? '—',
                  })) ?? []}
                  keyExtractor={(_, i) => String(i)}
                  renderSectionHeader={({ section }) => (
                    <>
                      <Text style={styles.sectionHeader}>{section.title}</Text>
                      <Text style={styles.sectionSubheader}>
                        {section.jefe}
                      </Text>
                    </>
                  )}
                  renderItem={({ item }) => (
                    <View style={styles.workerComment}>
                      <Text style={styles.workerName}>{item.name}:</Text>
                      <Text style={styles.workerText}>{item.text}</Text>
                    </View>
                  )}
                />
              </>
            ) : (
              <>
                <TextInput
                  style={styles.commentInput}
                  placeholder="Escribe tu comentario..."
                  value={commentTxt}
                  onChangeText={setCommentTxt}
                  multiline
                />
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={sendComment}
                >
                  <Text style={styles.saveButtonText}>Enviar</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Recuento fin de día */}
      <Modal
        visible={showRecount}
        animationType="slide"
        onRequestClose={() => setShowRecount(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <ScrollView contentContainerStyle={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Recuento {recountPhase === 'morning' ? 'matutino' : 'vespertino'}
              </Text>
              <TouchableOpacity onPress={() => setShowRecount(false)}>
                <Ionicons name="close" size={28} color="#E53935" />
              </TouchableOpacity>
            </View>

            <SectionList
              sections={[
                { title: 'Materiales', data: materialsList },
                { title: 'Herramientas', data: toolsList },
              ]}
              keyExtractor={it => it.id}
              renderSectionHeader={({ section: { title } }) => (
                <Text style={styles.sectionHeader}>{title}</Text>
              )}
              renderItem={({ item }) => {
                const diff = recount[item.id] ?? 0;

                return (
                  <View style={styles.recountItem}>
                    <TouchableOpacity 
                      style={styles.checkbox}
                      onPress={() => {
                        setRecount(p => ({
                          ...p,
                          [item.id]: diff === 0 ? -item.qty : 0,
                        }));
                      }}
                    >
                      <Ionicons
                        name={diff === 0 ? 'checkbox-outline' : 'square-outline'}
                        size={22}
                        color={diff === 0 ? '#2ecc71' : '#95a5a6'}
                      />
                    </TouchableOpacity>

                    <Text style={styles.recountItemText}>
                      {item.name} – {item.qty} {item.unit || ''}
                    </Text>

                    <View style={styles.quantityControls}>
                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() =>
                          setRecount(p => ({ ...p, [item.id]: diff - 1 }))
                        }
                      >
                        <Ionicons name="remove" size={18} color="#fff" />
                      </TouchableOpacity>

                      <Text style={styles.quantityValue}>{diff}</Text>

                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() =>
                          setRecount(p => ({ ...p, [item.id]: diff + 1 }))
                        }
                      >
                        <Ionicons name="add" size={18} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.emptyListText}>No hay ítems para recuento</Text>
              }
            />

            <TouchableOpacity
              style={styles.saveButton}
              onPress={async () => {
                const diffArr = Object.entries(recount)
                  .filter(([, v]) => v !== 0)
                  .map(([id, diff]) => ({ id, diff }));
                await saveRecount(diffArr, recountPhase);
                setRecount({});
                setShowRecount(false);
              }}
            >
              <Text style={styles.saveButtonText}>Guardar recuento</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

/* ───────────────────────── estilos ─────────────────────────── */
const styles = StyleSheet.create({
  // Estilos base del contenedor
  safeArea: {
    flex: 1,
    backgroundColor: '#121212',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 10,
  },

  // Encabezado
  header: {
    padding: 20,
    paddingTop: 10,
    marginBottom: 15,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
  },
  headerIcon: {
    width: 40,
    height: 40,
    marginLeft: 15,
  },
  projectDescription: {
    fontSize: 16,
    color: '#CCCCCC',
    marginBottom: 15,
    lineHeight: 22,
  },
  locationLink: {
    marginTop: 5,
    alignSelf: 'flex-start',
  },
  locationLinkText: {
    color: '#E53935',
    fontSize: 14,
    fontWeight: '500',
  },

  // Botones principales
  actionButtonsContainer: {
    marginHorizontal: 20,
    marginBottom: 15,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  option1: {
    backgroundColor: '#E53935', // Rojo para Push In
  },
  option2: {
    backgroundColor: '#1E88E5', // Azul para Push Out
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 10,
  },
  hoursContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    padding: 12,
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
  },
  hoursText: {
    color: '#CCCCCC',
    fontSize: 16,
  },
  hoursValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },

  // Botones secundarios
  secondaryButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginBottom: 20,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    width: '30%',
    elevation: 2,
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 5,
  },
  commentButton: {
    backgroundColor: '#43A047',
  },
  reportButton: {
    backgroundColor: '#5C6BC0',
  },
  recountButton: {
    backgroundColor: '#FFA000',
  },

  // Tarjeta de información
  infoCard: {
    backgroundColor: '#1E1E1E',
    marginHorizontal: 20,
    padding: 15,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#E53935',
  },
  infoTitle: {
    color: '#E53935',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  infoText: {
    color: '#CCCCCC',
    fontSize: 14,
    lineHeight: 20,
  },

  // Estilos de modales
  modalSafeArea: {
    flex: 1,
    backgroundColor: '#121212',
  },
  modalContainer: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
  },

  // Listas
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    marginBottom: 10,
  },
  listItemText: {
    color: '#FFFFFF',
    fontSize: 16,
    flex: 1,
  },
  listItemActions: {
    flexDirection: 'row',
    marginLeft: 10,
  },
  iconButton: {
    padding: 6,
    marginLeft: 10,
  },
  emptyListText: {
    textAlign: 'center',
    color: '#AAAAAA',
    marginVertical: 20,
    fontSize: 16,
  },

  // Formularios de edición
  editForm: {
    backgroundColor: '#1E1E1E',
    padding: 15,
    borderRadius: 10,
    marginTop: 15,
  },
  editInput: {
    backgroundColor: '#121212',
    color: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    fontSize: 16,
  },
  quantityRow: {
    flexDirection: 'row',
  },
  quantityInput: {
    flex: 1,
    marginRight: 10,
  },
  unitInput: {
    flex: 1,
  },
  saveEditButton: {
    backgroundColor: '#E53935',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveEditButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Botones de añadir
  addButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  addButton: {
    backgroundColor: '#1E1E1E',
    padding: 10,
    borderRadius: 8,
    width: '48%',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#E53935',
    fontSize: 16,
    fontWeight: '500',
  },

  // Comentarios
  commentInput: {
    backgroundColor: '#1E1E1E',
    color: '#FFFFFF',
    padding: 15,
    borderRadius: 10,
    minHeight: 120,
    textAlignVertical: 'top',
    fontSize: 16,
    marginBottom: 15,
  },
  commentList: {
    marginTop: 20,
  },
  sectionHeader: {
    color: '#E53935',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 5,
  },
  sectionSubheader: {
    color: '#CCCCCC',
    fontStyle: 'italic',
    marginBottom: 10,
  },
  workerComment: {
    backgroundColor: '#1E1E1E',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  workerName: {
    color: '#E53935',
    fontWeight: 'bold',
    marginBottom: 3,
  },
  workerText: {
    color: '#FFFFFF',
  },

  // Recuento
  recountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    marginBottom: 10,
  },
  checkbox: {
    marginRight: 10,
  },
  recountItemText: {
    color: '#FFFFFF',
    fontSize: 16,
    flex: 1,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
  },
  quantityButton: {
    backgroundColor: '#E53935',
    borderRadius: 20,
    padding: 6,
  },
  quantityValue: {
    color: '#FFFFFF',
    width: 30,
    textAlign: 'center',
    fontSize: 16,
  },

  // Botones de guardar
  saveButton: {
    backgroundColor: '#E53935',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#666666',
  },
});