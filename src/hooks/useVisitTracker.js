// hooks/useVisitTracker.js
//
// Registra uma visita ao storefront usando um contador "sharded" no Firestore,
// evitando o limite de ~1 escrita/segundo por documento e ficando 100% dentro
// da cota gratuita (sem custo, sem limite de contagem real pro seu caso de uso).
//
// Estrutura no Firestore:
//   stores/{storeId}/visits/{YYYY-MM-DD}/shards/{shardId}  -> { count: number }
//
// Uso: chamar useVisitTracker(storeId) uma vez no componente raiz do storefront
// (ex: dentro do StoreLayout ou App.jsx da loja), depois que o storeId já é conhecido.

import { useEffect } from 'react';
import { doc, increment, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

const NUM_SHARDS = 10; // 10 shards suporta picos de até ~10 escritas/s por loja

function getTodayKey() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function useVisitTracker(storeId) {
  useEffect(() => {
    if (!storeId) return;

    const todayKey = getTodayKey();
    const sessionFlag = `orby_visit_${storeId}_${todayKey}`;

    // Evita contar múltiplas páginas/refreshes da mesma sessão como visitas novas.
    // Se quiser contar por pageview em vez de por sessão/dia, é só remover esse guard.
    if (sessionStorage.getItem(sessionFlag)) return;

    const shardId = Math.floor(Math.random() * NUM_SHARDS);
    const shardRef = doc(db, 'stores', storeId, 'visits', todayKey, 'shards', String(shardId));

    setDoc(shardRef, { count: increment(1) }, { merge: true })
      .then(() => {
        sessionStorage.setItem(sessionFlag, '1');
      })
      .catch((err) => {
        // Falha silenciosa: nunca deve quebrar a experiência do cliente na loja
        console.error('Erro ao registrar visita:', err);
      });
  }, [storeId]);
}