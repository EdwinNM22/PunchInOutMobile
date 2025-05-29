// src/hooks/useDailyReport.js
// ────────────────────────────────────────────────────────────
// A tiny state-wrapper around reportFirestore helpers.
// Lets any component:
//
//   const {
//     checklist, recount, comments,
//     saveChecklist, saveRecount, addComment,
//     loading, refresh,
//   } = useDailyReport(projectId, jefeId);
//
// The hook keeps everything in memory and auto-refreshes
// when you store something new, so UIs stay in sync.

import { useState, useCallback, useEffect } from 'react';
import {
  saveChecklist as _saveChecklist,
  saveRecountWithPhase,
  upsertComment as _upsertComment,   // 👈  nuevo nombre
  getTodayReport,
  todayId,
  getLiveStock, setLiveStock, applyRecountToStock,
  upsertJefeNote as _upsertJefeNote,
  addWorkerComment as _addWorkerComment,
  currentBlock,
} from '../utils/reportFirestore';

export default function useDailyReport(projectId, jefeId) {
  const [data, setData] = useState({
    checklist: null,
    recountMorning: null,
    recountEvening: null,
    comments: null,
  });
  const [loading, setLoading] = useState(true);

  /* ---------- loader ---------- */
  const refresh = useCallback(async () => {
    setLoading(true);
    const r = await getTodayReport(projectId);
  
    /* If first visit today → seed checklist with live stock */
    if (!r.checklist) {
      const live = await getLiveStock(projectId);
      if (live) r.checklist = { list: live, jefeId, createdAt: null };
    }
    setData({
      checklist      : r.checklist      ?? null,
      recountMorning : r.recountMorning ?? null,
      recountEvening : r.recountEvening ?? null,
      comments       : r.comments       ?? null,
    });
    setLoading(false);
  }, [projectId]);

  /* initial fetch */
  useEffect(() => {
    refresh();
  }, [refresh]);

  /* ---------- wrapped writers ---------- */
  const saveChecklist = async list => {
    await _saveChecklist(projectId, jefeId, list);   // keep history
    await setLiveStock(projectId, list);             // <-- NEW
    await refresh();
  };

  const saveRecount = async (diffArr, phase) => {
    await saveRecountWithPhase(projectId, jefeId, diffArr, phase);
    await applyRecountToStock(projectId, diffArr);   // <-- NEW
    await refresh();
  };

  const upsertComment = async (text) => {   // 👈
    await _upsertComment(projectId, jefeId, text);
    await refresh();
  };

  const saveJefeNote = async (pushInISO, text, lockNow=false) => {
    const blk = currentBlock(pushInISO);
    await _upsertJefeNote(projectId, blk, jefeId, text, lockNow);
    await refresh();
  };
  
  const postWorkerComment = async (blockId, userObj, text) => {
    await _addWorkerComment(projectId, blockId, {
      uid : userObj.uid,
      displayName: userObj.displayName ?? '—',
      text,
    });
    await refresh();
  };  

  return {
    ...data,
    loading,
    refresh,
    saveChecklist,
    saveRecount,
    upsertComment,     // 👈 nuevo nombre que usaremos fuera
    loadChecklist: refresh,   // 👈 alias para que el componente lo “encuentre”
    todayId: todayId(),
    recountMorning: data.recountMorning,
    recountEvening: data.recountEvening,
    saveJefeNote,
    postWorkerComment,
  };
}
