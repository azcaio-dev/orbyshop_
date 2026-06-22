import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../services/firebase'
import AdminLayout from '../layouts/AdminLayout'
import UpgradePlan from '../components/UpgradePlan'
import useStore from '../hooks/useStore'
import { hasFeature } from '../utils/features'

const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

function AdminFinancial() {
  const { store, loading: storeLoading, storeSlug } = useStore()
  const [sales, setSales] = useState([])
  const [loadingSales, setLoadingSales] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const isPro = hasFeature(store, 'financial')

  useEffect(() => {
    async function loadSales() {
      try {
        const snapshot = await getDocs(collection(db, 'stores', storeSlug, 'sales'))
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        const activeSales = data.filter((sale) => sale.status !== 'canceled')
        const filteredSales = activeSales.filter((sale) => {
          if (!sale.createdAt?.seconds) return true
          const saleDate = new Date(sale.createdAt.seconds * 1000)
          if (startDate && saleDate < new Date(`${startDate}T00:00:00`)) return false
          if (endDate && saleDate > new Date(`${endDate}T23:59:59`)) return false
          return true
        })
        setSales(filteredSales)
      } catch (error) { console.error(error) }
      finally { setLoadingSales(false) }
    }
    if (storeSlug && isPro) loadSales()
  }, [storeSlug, isPro, startDate, endDate])

  if (storeLoading || !store) return <AdminLayout><div className="dash-loading">Carregando...</div></AdminLayout>
  if (!isPro) return <AdminLayout><UpgradePlan /></AdminLayout>
  if (loadingSales) return (
    <AdminLayout>
      <div className="dash-loading">Carregando...</div>
    </AdminLayout>
  )

  const now = new Date()
  const fmt = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const sum = (arr, key) => arr.reduce((acc, s) => acc + Number(s[key] || 0), 0)

  const currentMonthSales = sales.filter((sale) => {
    if (!sale.createdAt?.seconds) return false
    const d = new Date(sale.createdAt.seconds * 1000)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })

  // ── Métricas principais ──────────────────────────────────────
  const totalRevenue = sum(sales, 'total')
  const totalProfit = sum(sales, 'profit')
  const monthRevenue = sum(currentMonthSales, 'total')
  const monthProfit = sum(currentMonthSales, 'profit')
  const totalSalesCount = sales.length

  // ── Métricas adicionais ──────────────────────────────────────

  // Ticket médio
  const avgTicket = totalSalesCount > 0 ? totalRevenue / totalSalesCount : 0

  // Margem de lucro %
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

  // Melhor dia da semana
  const salesByDay = Array(7).fill(0)
  sales.forEach((sale) => {
    if (!sale.createdAt?.seconds) return
    const d = new Date(sale.createdAt.seconds * 1000)
    salesByDay[d.getDay()] += Number(sale.total || 0)
  })
  const bestDayIndex = salesByDay.indexOf(Math.max(...salesByDay))
  const bestDay = Math.max(...salesByDay) > 0 ? DAYS[bestDayIndex] : '—'

  // Melhor produto do mês
  const productMap = {}
  currentMonthSales.forEach((sale) => {
    if (!sale.productName) return
    if (!productMap[sale.productName]) productMap[sale.productName] = { qty: 0, total: 0 }
    productMap[sale.productName].qty += Number(sale.quantity || 1)
    productMap[sale.productName].total += Number(sale.total || 0)
  })
  const bestProduct = Object.entries(productMap)
    .sort((a, b) => b[1].qty - a[1].qty)[0]

  // ── Cards de métricas ────────────────────────────────────────
  const mainMetrics = [
    { label: 'Faturamento total', value: fmt(totalRevenue), accent: true },
    { label: 'Lucro total', value: fmt(totalProfit), accent: true },
    { label: 'Faturamento do mês', value: fmt(monthRevenue) },
    { label: 'Lucro do mês', value: fmt(monthProfit) },
    { label: 'Total de vendas', value: totalSalesCount },
    { label: 'Vendas no mês', value: currentMonthSales.length },
  ]

  const extraMetrics = [
    {
      label: 'Ticket médio',
      value: fmt(avgTicket),
      icon: 'ti-receipt',
      hint: 'Valor médio por venda no período',
    },
    {
      label: 'Margem de lucro',
      value: `${profitMargin.toFixed(1)}%`,
      icon: 'ti-chart-pie',
      hint: 'Lucro em relação ao faturamento total',
    },
    {
      label: 'Melhor dia da semana',
      value: bestDay,
      icon: 'ti-calendar-stats',
      hint: 'Dia com maior faturamento no período',
    },
    {
      label: 'Campeão do mês',
      value: bestProduct ? bestProduct[0] : '—',
      icon: 'ti-trophy',
      hint: bestProduct ? `${bestProduct[1].qty} unidades vendidas` : 'Sem vendas no mês',
      small: bestProduct ? `${bestProduct[1].qty} un. · ${fmt(bestProduct[1].total)}` : null,
    },
  ]

  return (
    <AdminLayout>
      <div className="dash-content">
        <div className="dash-page-header">
          <h1 className="dash-page-title">Financeiro</h1>
          <p className="dash-page-subtitle">Acompanhe faturamento, lucro e vendas da loja.</p>
        </div>

        {/* Filtro de datas */}
        <div className="sales-date-filters" style={{ marginBottom: 24 }}>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          {(startDate || endDate) && (
            <button onClick={() => { setStartDate(''); setEndDate('') }}
              style={{ fontSize: 12, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}>
              ✕ Limpar filtro
            </button>
          )}
        </div>

        {/* Métricas principais */}
        <p className="dash-section-title">Visão geral</p>
        <div className="dash-metric-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))', marginBottom: 28 }}>
          {mainMetrics.map((m) => (
            <div key={m.label} className={`dash-metric-card${m.accent ? ' dash-metric-accent' : ''}`}>
              <div className="dash-metric-label">{m.label}</div>
              <div className="dash-metric-value">{m.value}</div>
            </div>
          ))}
        </div>

        {/* Métricas adicionais */}
        <p className="dash-section-title">Indicadores</p>
        <div className="fin-extra-grid">
          {extraMetrics.map((m) => (
            <div key={m.label} className="fin-extra-card">
              <div className="fin-extra-icon">
                <i className={`ti ${m.icon}`} aria-hidden="true" />
              </div>
              <div className="fin-extra-body">
                <span className="fin-extra-label">{m.label}</span>
                <strong className="fin-extra-value">{m.value}</strong>
                {m.small && <span className="fin-extra-small">{m.small}</span>}
                <span className="fin-extra-hint">{m.hint}</span>
              </div>
            </div>
          ))}
        </div>

      </div>
    </AdminLayout>
  )
}

export default AdminFinancial