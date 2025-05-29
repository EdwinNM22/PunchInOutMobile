// src/utils/reportFirestore.js
// ────────────────────────────────────────────────────────────
import {
  getFirestore,
  doc, setDoc, getDoc, addDoc, getDocs, collection,
  serverTimestamp
} from 'firebase/firestore';

const db = getFirestore();

/* util común ------------------------------------------------ */
export const todayId = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;              // yyyy-MM-dd
};

/* paths comodín -------------------------------------------- */
const basePath = (projectId) => ['proyectos', projectId, 'dailyReports', todayId()];

/* ---------- CHECKLIST inicial ----------------------------- */
export async function saveChecklist(projectId, jefeId, list) {
  await setDoc(
    doc(db, ...basePath(projectId)), 
    { checklist:{ jefeId, createdAt: serverTimestamp(), list } },
        { merge:true }
      );
}

/* ---------- RECOUNT fin de día ---------------------------- */
export async function saveRecount(projectId, jefeId, list) {
  await setDoc(
    doc(db, ...basePath(projectId)),
      { recount:{ jefeId, createdAt: serverTimestamp(), list } },
      { merge:true }
    );
}

/* ---------- save Δ with phase ----------------------------- */
export async function saveRecountWithPhase(
  projectId, jefeId, diffArr, phase /* 'morning' | 'evening' */
) {
  const field = phase === 'morning' ? 'recountMorning' : 'recountEvening';
  await setDoc(
    doc(db, ...basePath(projectId)),
    { [field]: { jefeId, createdAt: serverTimestamp(), list: diffArr } },
    { merge: true }
  );
}

/* ---------- Comentarios libre cada 2 h -------------------- */
export async function upsertComment(projectId, jefeId, text) {
  const now     = new Date();
  const blockId = String(now.getHours()).padStart(2, '0') + ':00';
  await setDoc(
    doc(db, ...basePath(projectId), 'comments', blockId),
    { blockId, jefeId, text, createdAt: serverTimestamp() },
    { merge: true } 
  );
}

/* ---------- Traer TODO el dailyReport --------------------- */
export async function getTodayReport(projectId) {
   const dayDoc = await getDoc(doc(db, ...basePath(projectId)));
  const data   = dayDoc.exists() ? dayDoc.data() : {};

  /* 2️⃣ sub-colección de comentarios */
  const commSnap = await getDocs(collection(db, ...basePath(projectId), 'comments'));

  return {
    checklist : data.checklist ?? null,
    recountMorning  : data.recountMorning  ?? null,
    recountEvening  : data.recountEvening  ?? null,
    comments  : commSnap.empty ? null
                               : commSnap.docs.map(d => ({ id: d.id, ...d.data() })),
  };
}

/* ---------- LIVE STOCK ------------------------------------ */
const stockPath = pid => ['proyectos', pid, 'inventory', 'stock'];

export async function getLiveStock(projectId) {
  const snap = await getDoc(doc(db, ...stockPath(projectId)));
  return snap.exists() ? snap.data().list : null;           // array or null
}

export async function setLiveStock(projectId, list) {
  await setDoc(
    doc(db, ...stockPath(projectId)),
    { list, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

/* ---------- Apply recount diff to stock ------------------- */
export async function applyRecountToStock(projectId, diffArr) {
  if (!diffArr.length) return;

  // 1. get current live stock
  const current = (await getLiveStock(projectId)) ?? [];

  // 2. build a map {id -> item}
  const map = Object.fromEntries(current.map(i => [i.id, { ...i }]));

  // 3. apply each Δ
  diffArr.forEach(({ id, diff }) => {
    if (!map[id]) return;                 // safety
    map[id].qty += diff;
  });

  // 4. write back
  await setLiveStock(projectId, Object.values(map));
}

// Comentarios
/* ---------- compute 2-hour block id ---------------------- */
export function currentBlock(pushInISO) {
  const start = new Date(pushInISO);
  const idx = Math.floor( (Date.now() - start) / (2*60*60*1000) );
  const blockStart = new Date(start.getTime() + idx * 2*60*60*1000);
  const hh = String(blockStart.getHours()).padStart(2,'0');
  const mm = String(blockStart.getMinutes()).padStart(2,'0');
  return { id: `${hh}:${mm}`, startAt: blockStart };
}
/* ---------- upsert jefe note ----------------------------- */
export async function upsertJefeNote(
  pid, block, jefeId, text, lockNow = false
){
  await setDoc(
    doc(db, ...basePath(pid), 'comments', block.id),
    {
      jefeId,
      jefeNote: text,
      startAt : block.startAt,
      locked  : lockNow,
      updatedAt: serverTimestamp()
    },
    { merge:true }
  );
}

/* ---------- add worker comment --------------------------- */
export async function addWorkerComment(
  pid, blockId, user
){
  await addDoc(
    collection(db, ...basePath(pid), 'comments', blockId, 'workers'),
    {
      userId:   user.uid,
      name:     user.displayName ?? '—',
      text:     user.text,
      createdAt: serverTimestamp(),
    }
  );
}