// screens/UserProjectDetail.js
// --------------------------------------------------------------
//   Push-In / Push-Out + Checklist inicial + Recuento final
//   + Comentarios libres cada 2 h
// --------------------------------------------------------------
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Alert, StyleSheet, SafeAreaView,
  Linking, Modal, TextInput, KeyboardAvoidingView, Platform,
  ActivityIndicator, FlatList, SectionList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
const ProjectLocation = ({ location }) => (
  <TouchableOpacity
    onPress={() =>
      Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`
      )}
  >
    <Text style={styles.locationText}>
      Ver Ubicación: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
    </Text>
  </TouchableOpacity>
);
/* ────────────────────────────────────────────────────────────── */

export default function UserProjectDetail({ route, navigation }) {
  const { project } = route.params;              // viene de UserProjects
  const auth = getAuth();
  const db = getFirestore();
  const insets = useSafeAreaInsets();
  const [recountPhase, setRecountPhase] = useState('evening');

  /* ………………………………………………………………… estado general ……………………………………………………… */
  const [pushInTime, setPushInTime] = useState(null);
  const [totalHours, setTotalHours] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isJefe, setIsJefe] = useState(false);

  /* checklist / recount UI */
  const [showChecklist, setShowChecklist] = useState(false);
  const [showRecount, setShowRecount] = useState(false);
  const [materialsList, setMaterialsList] = useState([]);   // inicial (mat)
  const [toolsList, setToolsList] = useState([]);   // inicial (tool)
  const [editItem, setEditItem] = useState(null); // {type,id}
  const [tmpName, setTmpName] = useState('');
  const [tmpQty, setTmpQty] = useState('');
  const [itemUnit, setItemUnit] = useState('');
  const [recount, setRecount] = useState({});   // id -> ±diff
  const [commentModal, setCommentModal] = useState(false);
  const [commentTxt, setCommentTxt] = useState('');

  /* geofence */
  const locationSub = useRef(null);
  const threshold = 200;   // m

  /* hook: toda la lógica Firestore de los reportes (chunk 2) */
  const {
    checklist,
    loadChecklist,       // alias de refresh
    recountMorning,
    recountEvening,
    comments,
    saveChecklist,
    saveRecount,
    saveJefeNote,
    postWorkerComment,
  } = useDailyReport(project.id, auth.currentUser?.uid);

  useEffect(() => {
    if (!checklist || !checklist.list) return;

    setMaterialsList(checklist.list.filter(i => i.type === 'mat'));
    setToolsList(checklist.list.filter(i => i.type === 'tool'));
  }, [checklist]);

  /* ─── helpers fecha ───────────────────────────────────────── */
  const todayString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const distMeters = (lat1, lon1, lat2, lon2) => {
    const toRad = v => v * Math.PI / 180, R = 6371e3;
    const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };
  /* ─────────────────────────────────────────────────────────── */

  /* ─── primer montaje: ver si ya hay Push-In activo ────────── */
  useEffect(() => {
    (async () => {
      try {
        const user = auth.currentUser;
        if (!user) { setLoading(false); return; }

        /* rol */
        const aSnap = await getDoc(doc(db, 'proyectos', project.id, 'assignments', user.uid));
        if (aSnap.exists() && aSnap.data().role === 'jefe') setIsJefe(true);

        /* push-in previo? */
        const hsnap = await getDoc(doc(db, 'usuarios', user.uid, 'horas', project.id, 'fechas', todayString()));
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
    })();
    return () => locationSub.current?.remove();
  }, []);

  /* ─── geofence watch — se activa sólo con Push-In ─────────── */
  const watchDistance = async () => {
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
  };

  /* ─── PUSH-IN ─────────────────────────────────────────────── */
  const doPushIn = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permiso denegado'); return; }
      const loc = await Location.getCurrentPositionAsync({});
      const d = distMeters(loc.coords.latitude, loc.coords.longitude,
        project.location.latitude, project.location.longitude);
      if (d > threshold) { Alert.alert('Muy lejos del proyecto'); return; }

      const nowISO = new Date().toISOString();
      const user = auth.currentUser;
      await setDoc(
        doc(db, 'usuarios', user.uid, 'horas', project.id, 'fechas', todayString()),
        {
          pushInTime: nowISO, pushOutTime: null, totalHours: 0,
          location: { latitude: loc.coords.latitude, longitude: loc.coords.longitude }
        }
      );
      setPushInTime(nowISO);
      watchDistance();
      Alert.alert('Push In exitoso');

      if (isJefe) {
        /* ----------------------------------------------------------------
         * Decide what to show right after a successful Push-In
         * ---------------------------------------------------------------- */
        const checklistExists = Boolean(checklist);
        const morningRecountExists = Boolean(recountMorning);

        if (!checklistExists) {
          /* First time we ever work on this date → show checklist */
          setShowChecklist(true);

        } else if (!morningRecountExists) {
          /* Checklist already exists but no morning recount yet
             → we are in the MORNING phase */
          setRecountPhase('morning');
          setShowRecount(true);

        } else {
          /* Morning recount already done → any later recount is EVENING */
          setRecountPhase('evening');
          setShowRecount(true);
        }
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'No se pudo hacer Push In');
    }
  };

  /* ─── PUSH-OUT ────────────────────────────────────────────── */
  const doPushOut = async (silent = false) => {
    try {
      const user = auth.currentUser;
      if (!user || !pushInTime) return;

      const nowISO = new Date().toISOString();
      const diffHrs = ((new Date(nowISO) - new Date(pushInTime)) / 3.6e6).toFixed(2);
      await updateDoc(
        doc(db, 'usuarios', user.uid, 'horas', project.id, 'fechas', todayString()),
        { pushOutTime: nowISO, totalHours: Number(diffHrs) }
      );
      setTotalHours(diffHrs); setPushInTime(null);
      locationSub.current?.remove(); locationSub.current = null;
      if (!silent) Alert.alert('Push Out exitoso', `Total: ${diffHrs} h`);
    } catch (e) { console.error(e); if (!silent) Alert.alert('Error', 'No se pudo hacer Push Out'); }
    await Notifications.cancelAllScheduledNotificationsAsync();
  };

  /* ─── comentarios cada 2 h ───────────────────────────────── */
  const sendComment = async () => {
    if (!commentTxt.trim()) return;
    await upsertComment(commentTxt.trim());
    setCommentTxt(''); setCommentModal(false);
  };

  const handleReportBtn = () => {
    if (!pushInTime) return;

    const { id } = currentBlock(pushInTime);
    const blk = comments?.find(c => c.id === id) ?? {};

    setCommentTxt(blk.jefeNote ?? '');   // ← preload previous text
    setCommentModal(true);
  };

  /* ─── Checklist helpers (añadir / editar) ────────────────── */
  const addOrUpdateItem = type => {
    if (!tmpName || !tmpQty) {
      Alert.alert('Completa nombre y cantidad');
      return;
    }

    const list = type === 'mat' ? materialsList : toolsList;
    const setter = type === 'mat' ? setMaterialsList : setToolsList;

    const isEditing = Boolean(editItem?.id);

    if (isEditing) {
      // --- update ---
      setter(list.map(it =>
        it.id === editItem.id
          ? { ...it, name: tmpName, qty: Number(tmpQty), unit: itemUnit }
          : it
      ));
    } else {
      // --- add new ---
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

    // clear form
    setEditItem(null);
    setTmpName('');
    setTmpQty('');
    setItemUnit('');
  };

  const deleteItem = (id, type) => {
    const setter = type === 'mat' ? setMaterialsList : setToolsList;
    const list = type === 'mat' ? materialsList : toolsList;
    setter(list.filter(it => it.id !== id));
  };

  /* ─── SAVE checklist to Firestore ────────────────────────── */
  const saveChecklistAndStartTimer = async (items) => {
    await saveChecklist(items);
    const now = new Date();
  };

  /* ─── quick UI shortcuts ─────────────────────────────────── */
  const optionStyle = pushInTime ? styles.option2 : styles.option1;
  const buttonLabel = pushInTime ? 'Push Out' : 'Push In';
  const buttonAction = pushInTime ? doPushOut : doPushIn;

  /* ─── LOADING first paint ────────────────────────────────── */
  if (loading) return (
    <View style={styles.loading}><ActivityIndicator size="large" /><Text>Cargando…</Text></View>
  );

  /* ─────────────────────────────────────────────────────────── */
  return (
    <>
      <SafeAreaView style={styles.container}>
        {/* ——— Encabezado ——— */}
        <View style={styles.header}>
          <Text style={styles.title}>{project.name}</Text>
          <Text style={styles.subtitle}>{project.description}</Text>
          {project.location && <ProjectLocation location={project.location} />}

          {!isJefe && pushInTime && (
            <TouchableOpacity
              style={styles.commentBtn}
              onPress={() => {
                setCommentTxt('');          // start blank
                setCommentModal(true);      // open modal (worker sees quick box only)
              }}
            >
              <Text style={styles.btnLabel}>Añadir comentario</Text>
            </TouchableOpacity>
          )}

          {isJefe && pushInTime && (
            <>
              <TouchableOpacity
                style={styles.reportBtn}
                onPress={handleReportBtn}
              >
                <Text style={styles.btnLabel}>Reportes del proyecto</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.commentBtn}
                onPress={() => {
                  setRecountPhase('evening');
                  setShowRecount(true);
                }}
              >
                <Text style={styles.btnLabel}>Recuento de materiales</Text>
              </TouchableOpacity>
            </>

          )}
        </View>

        {/* ——— Push-In / Out ——— */}
        <View style={styles.optionsContainer}>
          <TouchableOpacity
            style={[styles.optionCard, optionStyle]}
            onPress={buttonAction}
          >
            <Ionicons name={pushInTime ? 'log-out' : 'log-in'} size={32} color="#fff" />
            <Text style={styles.optionText}>{buttonLabel}</Text>
          </TouchableOpacity>
          {totalHours && <Text style={styles.totalHours}>Horas trabajadas: {totalHours} h</Text>}
        </View>
      </SafeAreaView>

      {/* ——— Checklist inicial ——— */}
      <Modal
        visible={showChecklist}
        animationType="slide"
        onRequestClose={() => { setShowChecklist(false); setEditItem(null); }}
      >

        <View style={[styles.modalWrap, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.modalTitle}>Lista inicial de materiales / herramientas</Text>

          <FlatList
            data={[...materialsList, ...toolsList]}
            keyExtractor={it => it.id}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <Text>{item.name} – {item.qty} {item.unit || ''}</Text>
                <View style={styles.rowActions}>
                  <TouchableOpacity onPress={() => { setEditItem(item); setTmpName(item.name); setTmpQty(String(item.qty)); setItemUnit(item.unit || ''); }}>
                    <Ionicons name="create-outline" size={20} color="#4a76ff" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteItem(item.id, item.type)}>
                    <Ionicons name="trash-outline" size={20} color="#e74c3c" style={{ marginLeft: 10 }} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#666' }}>Sin ítems…</Text>}
          />


          <TouchableOpacity onPress={() => setEditItem({ type: 'mat' })}>
            <Text style={styles.addBtn}>＋ Añadir material</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setEditItem({ type: 'tool' })}>
            <Text style={styles.addBtn}>＋ Añadir herramienta</Text>
          </TouchableOpacity>


          {editItem && (
            <View style={styles.editBox}>
              <TextInput
                placeholder="Nombre"
                style={styles.input}
                value={tmpName}
                onChangeText={setTmpName}
              />
              <View style={{ flexDirection: 'row' }}>
                <TextInput
                  placeholder="Cantidad"
                  style={[styles.input, { flex: 1, marginRight: 6 }]}
                  keyboardType="numeric"
                  value={tmpQty}
                  onChangeText={setTmpQty}
                />
                <TextInput
                  placeholder="Unidad (opcional)"
                  style={[styles.input, { flex: 1 }]}
                  value={itemUnit}
                  onChangeText={setItemUnit}
                />
              </View>
              <TouchableOpacity
                style={[styles.saveBtn, { marginTop: 5 }]}
                onPress={() => addOrUpdateItem(editItem.type)}
              >
                <Text style={styles.saveLabel}>{editItem.id ? 'Actualizar' : 'Añadir'}</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={[styles.saveBtn, { marginTop: 20 }]}
            onPress={async () => {
              await saveChecklistAndStartTimer([...materialsList, ...toolsList]);
              setShowChecklist(false);
            }}
          >
            <Text style={styles.saveLabel}>Guardar lista</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ——— Comentarios ——— */}
      <Modal
        visible={commentModal}
        animationType="slide"
        onRequestClose={() => setCommentModal(false)}
      >
        <KeyboardAvoidingView
          style={[styles.modalWrap, { paddingTop: insets.top + 12 }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
            <TouchableOpacity onPress={() => setCommentModal(false)}>
              <Ionicons name="close" size={28} color="#2c3e50" />
            </TouchableOpacity>
          </View>
          {isJefe && (
            <>
              <Text style={styles.modalTitle}>Bitácora en curso</Text>

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
                      style={[
                        styles.input,
                        { height: 140, textAlignVertical: 'top' },
                      ]}
                      multiline
                      editable={!locked}
                      placeholder="Describe las actividades…"
                      value={commentTxt !== '' ? commentTxt : blk.jefeNote ?? ''}
                      onChangeText={setCommentTxt}
                    />

                    <TouchableOpacity
                      style={styles.saveBtn}
                      disabled={locked}
                      onPress={async () => {
                        await saveJefeNote(pushInTime, commentTxt, locked);
                        if (locked)
                          Alert.alert('Bloque cerrado', 'Se inició uno nuevo.');
                        /* keep text so jefe can continue editing */
                      }}
                    >
                      <Text style={styles.saveLabel}>
                        {locked ? 'Bloque cerrado' : 'Guardar / Actualizar'}
                      </Text>
                    </TouchableOpacity>
                  </>
                );
              })()}
            </>
          )}

          {/* 2. Worker quick comment */}
          {!isJefe && (
            <>
              <Text style={[styles.modalTitle, { marginTop: 20 }]}>Tu comentario</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TextInput
                  style={[styles.input, { flex: 1, marginRight: 10, height: 100, textAlignVertical:'top', marginRight:10}]}
                  placeholder="Escribe algo…"
                  value={commentTxt}
                  onChangeText={setCommentTxt}
                />
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={async () => {
                    const { id } = currentBlock(pushInTime);
                    await postWorkerComment(id, auth.currentUser, commentTxt);
                    setCommentTxt('');
                  }}
                >
                  <Ionicons name="send" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* 3. Timeline of previous blocks */}
          {isJefe && (<SectionList
            style={{ marginTop: 30 }}
            sections={comments?.map(c => ({
              title: c.id + (c.locked ? '' : ' (abierto)'),
              data: c.workers ?? [],
              jefe: c.jefeNote ?? '—',
            })) ?? []}
            keyExtractor={(_, i) => String(i)}
            renderSectionHeader={({ section }) => (
              <>
                <Text style={styles.sectionHeader}>{section.title}</Text>
                <Text style={{ fontStyle: 'italic', marginBottom: 4 }}>
                  {section.jefe}
                </Text>
              </>
            )}
            renderItem={({ item }) => (
              <Text style={{ marginLeft: 12 }}>• {item.name}: {item.text}</Text>
            )}
          />
          )}
        </KeyboardAvoidingView>
      </Modal>

      {/* ——— Recuento fin de día ——— */}
      <Modal
        visible={showRecount}
        animationType="slide"
        onRequestClose={() => setShowRecount(false)}
      >
        <View style={styles.modalWrap}>
          <Text style={styles.modalTitle}>Recuento de materiales</Text>

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
              // current delta for this item (0 = OK)
              const diff = recount[item.id] ?? 0;

              /* toggle ✅ / ⬜  ---------------------------------------------------- */
              const toggleChecked = () => {
                setRecount(p => ({
                  ...p,
                  [item.id]: diff === 0 ? -item.qty : 0,   // 0 ↔︎ -fullQty (missing all)
                }));
              };

              return (
                <View style={styles.row}>
                  {/* --- check-box --- */}
                  <TouchableOpacity style={styles.chk} onPress={toggleChecked}>
                    <Ionicons
                      name={diff === 0 ? 'checkbox-outline' : 'square-outline'}
                      size={22}
                      color={diff === 0 ? '#2ecc71' : '#95a5a6'}
                    />
                  </TouchableOpacity>

                  {/* --- label --- */}
                  <Text style={styles.rowLabel}>
                    {item.name} – {item.qty} {item.unit || ''}
                  </Text>

                  {/* --- – / Δ / +  --- */}
                  <View style={styles.deltaBox}>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() =>
                        setRecount(p => ({ ...p, [item.id]: diff - 1 }))
                      }
                    >
                      <Ionicons name="remove" size={18} color="#fff" />
                    </TouchableOpacity>

                    <Text style={styles.deltaText}>{diff}</Text>

                    <TouchableOpacity
                      style={styles.qtyBtn}
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
              <Text style={styles.emptyText}>Sin ítems…</Text>
            }
          />

          <TouchableOpacity
            style={[styles.saveBtn, { marginTop: 20 }]}
            onPress={async () => {
              const diffArr = Object.entries(recount)
                .filter(([, v]) => v !== 0)
                .map(([id, diff]) => ({ id, diff }));
              await saveRecount(diffArr, recountPhase);
              setRecount({});
              setShowRecount(false);
            }}
          >
            <Text style={styles.saveLabel}>Guardar recuento</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

/* ───────────────────────── estilos ─────────────────────────── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { padding: 20, paddingTop: 40, backgroundColor: '#fff', borderBottomLeftRadius: 20, borderBottomRightRadius: 20, marginBottom: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#2c3e50' },
  subtitle: { fontSize: 16, color: '#7f8c8d', marginTop: 5 },
  locationText: { fontSize: 16, color: '#4a76ff', textDecorationLine: 'underline', marginTop: 10 },

  optionsContainer: { flex: 1, paddingHorizontal: 20, justifyContent: 'center' },
  optionCard: { height: 100, borderRadius: 15, marginVertical: 10, padding: 20, flexDirection: 'row', alignItems: 'center', elevation: 5 },
  option1: { backgroundColor: '#3498db' }, option2: { backgroundColor: '#2ecc71' },
  optionText: { color: '#fff', fontSize: 20, fontWeight: '600', marginLeft: 15 },
  totalHours: { fontSize: 18, fontWeight: '600', marginTop: 20, textAlign: 'center' },

  /* botones header */
  reportBtn: {
    marginTop: 15,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#3498db',   // blue matches your palette
  },
  commentBtn: { marginTop: 10, backgroundColor: '#3498db', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  btnLabel: { color: '#fff', fontSize: 16, fontWeight: '600' },

  /* modal genérico */
  modalWrap: { flex: 1, padding: 20, backgroundColor: '#fff' },
  rowActions: { flexDirection: 'row', alignItems: 'center' },
  addBtn: { color: '#4a76ff', marginVertical: 6 },
  editBox: { marginTop: 10, padding: 10, backgroundColor: '#f0f4ff', borderRadius: 8 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 15, backgroundColor: '#fafafa', fontSize: 16 },
  saveBtn: { backgroundColor: '#2ecc71', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  saveLabel: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

  qtyBtn: { backgroundColor: '#4a76ff', borderRadius: 20, padding: 6 },
  editBox: {             // en tu objeto styles
    marginTop: 10, padding: 10,
    backgroundColor: '#f0f4ff',
    borderLeftWidth: 4, borderLeftColor: '#4a76ff',
    borderRadius: 8
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#34495e',
    marginTop: 10,
    marginBottom: 4,
  },
  rowLabel: { flex: 1, fontSize: 16, color: '#2c3e50' },

  iconBtn: {
    padding: 6,          // ▶︎ bigger touch-area
    borderRadius: 6,
  },

  emptyText: {
    textAlign: 'center',
    color: '#95a5a6',
    marginTop: 20,
  },

  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#2c3e50',
    marginTop: 10,        // ▼ pushes it down from the status bar
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderColor: '#e0e0e0',
  },

  chk: { paddingRight: 8 },

  rowLabel: { flex: 1, fontSize: 15, color: '#2c3e50' },

  deltaBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  qtyBtn: {
    backgroundColor: '#4a76ff',
    borderRadius: 18,
    padding: 6,
    marginHorizontal: 2,
  },

  deltaText: {
    width: 34,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#34495e',
  },
});
