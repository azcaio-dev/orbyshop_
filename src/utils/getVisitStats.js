// utils/getVisitStats.js
//
// Soma os shards de visitas do Firestore para calcular totais por período
// (hoje, últimos 7 dias, últimos 30 dias). Usado no admin panel de cada loja.

import { collection, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';

function getDateKey(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getLastNDateKeys(n) {
  const keys = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    keys.push(getDateKey(d));
  }
  return keys;
}

// Soma todos os shards de um único dia
async function sumDayVisits(storeId, dateKey) {
  const shardsRef = collection(db, 'stores', storeId, 'visits', dateKey, 'shards');
  const snapshot = await getDocs(shardsRef);
  let total = 0;
  snapshot.forEach((docSnap) => {
    total += docSnap.data().count || 0;
  });
  return total;
}

// Retorna { today, last7Days, last30Days, byDay } para montar o card/gráfico no admin
export async function getVisitStats(storeId) {
  const dateKeys30 = getLastNDateKeys(30);

  // Busca os 30 dias em paralelo (30 pequenas leituras de subcoleção, bem barato)
  const results = await Promise.all(
    dateKeys30.map(async (key) => ({ date: key, count: await sumDayVisits(storeId, key) }))
  );

  const today = results[0]?.count || 0;
  const last7Days = results.slice(0, 7).reduce((sum, r) => sum + r.count, 0);
  const last30Days = results.reduce((sum, r) => sum + r.count, 0);

  return {
    today,
    last7Days,
    last30Days,
    byDay: results.reverse(), // ordem cronológica, útil pra gráfico de linha (Chart.js)
  };
}