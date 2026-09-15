// components/admin/VisitsCard.jsx
//
// Card de visitas para o dashboard admin, usando as mesmas classes CSS
// dos outros metric cards (dash-metric-card, dash-metric-label, etc.)
// pra ficar visualmente identico aos cards de Faturamento/Lucro/Vendas.

import { useEffect, useState } from 'react';
import { getVisitStats } from '../../utils/getVisitStats';

export default function VisitsCard({ storeId }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    getVisitStats(storeId)
      .then(setStats)
      .catch((err) => console.error('Erro ao carregar estatisticas de visitas:', err))
      .finally(() => setLoading(false));
  }, [storeId]);

  return (
    <div className="dash-metric-card">
      <div className="dash-metric-label">
        <i className="ti ti-eye" aria-hidden="true" />
        Visitas hoje
      </div>
      <div className="dash-metric-value">{loading ? '\u2014' : stats?.today ?? 0}</div>
      <div className="dash-metric-sub">
        {loading
          ? 'Carregando...'
          : `7 dias: ${stats?.last7Days ?? 0} \u00b7 30 dias: ${stats?.last30Days ?? 0}`}
      </div>
    </div>
  );
}