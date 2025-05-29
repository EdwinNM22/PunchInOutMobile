// ────────────────────────────────────────────────────────────
//   Admin view – all daily reports for a single project
// ────────────────────────────────────────────────────────────
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, ScrollView,
  TouchableOpacity, LayoutAnimation, Platform, UIManager
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  getFirestore, collection, getDocs, doc, getDoc, orderBy, query, FieldPath
} from 'firebase/firestore';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

function DeltaRow({ delta }) {
  const sign = delta.diff > 0 ? '+' : '';
  return (
    <Text style={styles.deltaRow}>
      • {delta.name}: {sign}{delta.diff} {delta.unit ?? ''}
    </Text>
  );
}

/* ----- one collapsible card per date ---------------------- */
function DayCard({ day }) {
  const [open, setOpen] = useState(false);
  const toggle = () => {
    LayoutAnimation.easeInEaseOut();
    setOpen(!open);
  };

  /* helpers */
  const listTitle = (title, list) =>
    list?.length ? <Text style={styles.listTitle}>{title}</Text> : null;

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.cardHeader} onPress={toggle}>
        <Text style={styles.cardHeaderText}>{day.id}</Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={20} color="#2c3e50"
        />
      </TouchableOpacity>

      {open && (
        <View style={styles.cardBody}>
          {/* Checklist (only first day has it) */}
          {listTitle('Checklist inicial', day.checklist)}
          {day.checklist?.map(it => (
            <Text key={it.id} style={styles.itemRow}>
              • {it.name}: {it.qty} {it.unit ?? ''}
            </Text>
          ))}

          {/* Morning delta */}
          {listTitle('Δ Mañana', day.recountMorning)}
          {day.recountMorning?.map(d => (
            <DeltaRow key={d.id} delta={{ ...d, ...day.idMap[d.id] }} />
          ))}

          {/* Evening delta */}
          {listTitle('Δ Tarde', day.recountEvening)}
          {day.recountEvening?.map(d => (
            <DeltaRow key={d.id} delta={{ ...d, ...day.idMap[d.id] }} />
          ))}

          {/* Notes & worker comments grouped */}
          {day.blocks.map(b => (
            <View key={b.id} style={styles.block}>
              <Text style={styles.blockTitle}>
                {b.id} {b.locked ? '' : '(abierto)'}
              </Text>
              <Text style={styles.jefeNote}>{b.jefeNote || '—'}</Text>
              {b.workers.map(w => (
                <Text key={w.id} style={styles.workerRow}>
                  • {w.name}: {w.text}
                </Text>
              ))}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default function AdminProjectReports({ route }) {
  const { projectId, projectName } = route.params;
  const [days, setDays] = useState(null);

  const fetchAll = useCallback(async () => {
    setDays(null);                      // show spinner each refresh
    const db = getFirestore();
  
    try {
      const daySnap = await getDocs(
        query(
          collection(db, 'proyectos', projectId, 'dailyReports'),
          orderBy('__name__', 'desc')
        )
      );
  
      /* map each day-doc to a promise that enriches it */
      const dayPromises = daySnap.docs.map(async d => {
        const data = d.data();
  
        /* helper: id ➞ original checklist item (for name/unit) */
        const idMap = Object.fromEntries(
          (data.checklist?.list ?? []).map(i => [i.id, i])
        );
  
        /* fetch comments blocks */
        const blocksSnap = await getDocs(
          collection(db,'proyectos',projectId,'dailyReports',d.id,'comments')
        );
  
        /* fetch every workers sub-col in parallel */
        const blocks = await Promise.all(
          blocksSnap.docs.map(async b => {
            const wSnap = await getDocs(
              collection(
                db,'proyectos',projectId,'dailyReports',d.id,'comments',b.id,'workers'
              )
            );
            return {
              id: b.id,
              ...b.data(),
              workers: wSnap.docs.map(w=>({ id:w.id, ...w.data() }))
            };
          })
        );
  
        return {
          id: d.id,
          idMap,
          checklist      : data.checklist?.list       ?? null,
          recountMorning : data.recountMorning?.list  ?? null,
          recountEvening : data.recountEvening?.list  ?? null,
          blocks
        };
      });
  
      const allDays = await Promise.all(dayPromises);
      setDays(allDays);
    } catch (err) {
      console.error('AdminProjectReports fetch', err);
      /* send an empty array so UI stops spinning but shows a message */
      setDays([]);
      setError(err);     // optional: add [error,setError] state to show msg
    }
  }, [projectId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (!days) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large"/>
        <Text>Cargando reportes…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{projectName}</Text>
      {days.map(day => <DayCard key={day.id} day={day} />)}
      {!days.length && (
        <Text style={{textAlign:'center',marginTop:50}}>
          No hay reportes aún para este proyecto.
        </Text>
      )}
    </ScrollView>
  );
}

/* ───────── styles ───────── */
const styles = StyleSheet.create({
  container:{flex:1,backgroundColor:'#f8f9fa'},
  loading:{flex:1,justifyContent:'center',alignItems:'center'},
  title:{fontSize:24,fontWeight:'bold',margin:15,color:'#2c3e50'},
  card:{backgroundColor:'#fff',margin:12,borderRadius:8,elevation:2},
  cardHeader:{
    flexDirection:'row',justifyContent:'space-between',alignItems:'center',
    padding:14,borderBottomWidth:1,borderColor:'#ecf0f1'
  },
  cardHeaderText:{fontSize:18,fontWeight:'600',color:'#34495e'},
  cardBody:{padding:14},
  listTitle:{marginTop:6,fontWeight:'bold',color:'#2c3e50'},
  itemRow:{marginLeft:8},
  deltaRow:{marginLeft:8,color:'#e67e22'},
  block:{marginTop:10,paddingTop:6,borderTopWidth:0.5,borderColor:'#ecf0f1'},
  blockTitle:{fontWeight:'600',color:'#16a085'},
  jefeNote:{fontStyle:'italic',marginBottom:4,color:'#2c3e50'},
  workerRow:{marginLeft:12,color:'#34495e'},
});
