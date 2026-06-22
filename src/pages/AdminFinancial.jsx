import { useEffect, useState, useRef } from 'react'
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
  const chartRef = useRef(null)
  const chartInstance = useRef(null)

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

  // ── Gráfico de evolução diária ───────────────────────────────
  useEffect(() => {
    if (!chartRef.current) return

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const dayMap = {}
    sales.forEach((sale) => {
      if (!sale.createdAt?.seconds) return
      const d = new Date(sale.createdAt.seconds * 1000)
      if (d < thirtyDaysAgo) return
      const key = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      dayMap[key] = (dayMap[key] || 0) + Number(sale.total || 0)
    })

    // Gera os 30 dias fixos do mais antigo ao mais recente
    const allDays = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      allDays.push(d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }))
    }

    const labels = allDays
    const data = allDays.map(key => Math.round((dayMap[key] || 0) * 100) / 100)
    const maxVal = Math.max(...data)
    const avg = Math.round(data.reduce((a, b) => a + b, 0) / data.length)

    if (chartInstance.current) {
      chartInstance.current.destroy()
      chartInstance.current = null
    }

    const initChart = () => {
      if (!window.Chart || !chartRef.current) return
      chartInstance.current = new window.Chart(chartRef.current, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Faturamento',
              data,
              backgroundColor: data.map(v => v > 0 && v === maxVal ? '#534AB7' : '#AFA9EC'),
              borderRadius: 6,
              borderSkipped: false,
              barThickness: 18,
              maxBarThickness: 18,
            },
            {
              label: 'Média',
              data: data.map(() => avg),
              type: 'line',
              borderColor: '#7F77DD',
              borderDash: [4, 4],
              borderWidth: 1.5,
              pointRadius: 0,
              fill: false,
              tension: 0,
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => ctx.datasetIndex === 0
                  ? 'R$ ' + ctx.parsed.y.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                  : 'Média: R$ ' + ctx.parsed.y.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
              }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { font: { size: 11 }, maxRotation: 45, autoSkip: true, maxTicksLimit: 15 }
            },
            y: {
              grid: { color: 'rgba(0,0,0,0.05)' },
              beginAtZero: true,
              ticks: {
                font: { size: 11 },
                callback: (v) => 'R$ ' + Number(v).toLocaleString('pt-BR')
              }
            }
          }
        }
      })
    }

    const existingScript = document.getElementById('chartjs-cdn')
    if (window.Chart) {
      initChart()
    } else if (!existingScript) {
      const s = document.createElement('script')
      s.id = 'chartjs-cdn'
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js'
      s.onload = initChart
      document.head.appendChild(s)
    } else {
      existingScript.addEventListener('load', initChart)
    }

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy()
        chartInstance.current = null
      }
    }
  }, [sales])

  if (storeLoading || !store) return <AdminLayout><div className="dash-loading">Carregando...</div></AdminLayout>
  if (!isPro) return <AdminLayout><UpgradePlan /></AdminLayout>
  if (loadingSales) return <AdminLayout><div className="dash-loading">Carregando financeiro...</div></AdminLayout>

  const now = new Date()
  const fmt = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const sum = (arr, key) => arr.reduce((acc, s) => acc + Number(s[key] || 0), 0)

  const currentMonthSales = sales.filter((sale) => {
    if (!sale.createdAt?.seconds) return false
    const d = new Date(sale.createdAt.seconds * 1000)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })

  const totalRevenue = sum(sales, 'total')
  const totalProfit = sum(sales, 'profit')
  const monthRevenue = sum(currentMonthSales, 'total')
  const monthProfit = sum(currentMonthSales, 'profit')
  const totalSalesCount = sales.length
  const avgTicket = totalSalesCount > 0 ? totalRevenue / totalSalesCount : 0
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

  const salesByDay = Array(7).fill(0)
  sales.forEach((sale) => {
    if (!sale.createdAt?.seconds) return
    const d = new Date(sale.createdAt.seconds * 1000)
    salesByDay[d.getDay()] += Number(sale.total || 0)
  })
  const bestDayIndex = salesByDay.indexOf(Math.max(...salesByDay))
  const bestDay = Math.max(...salesByDay) > 0 ? DAYS[bestDayIndex] : '—'

  const productMap = {}
  currentMonthSales.forEach((sale) => {
    if (!sale.productName) return
    if (!productMap[sale.productName]) productMap[sale.productName] = { qty: 0, total: 0 }
    productMap[sale.productName].qty += Number(sale.quantity || 1)
    productMap[sale.productName].total += Number(sale.total || 0)
  })
  const bestProduct = Object.entries(productMap).sort((a, b) => b[1].qty - a[1].qty)[0]

  // Dados resumo do gráfico (últimos 30 dias)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const dayMap = {}
  sales.forEach((sale) => {
    if (!sale.createdAt?.seconds) return
    const d = new Date(sale.createdAt.seconds * 1000)
    if (d < thirtyDaysAgo) return
    const key = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    dayMap[key] = (dayMap[key] || 0) + Number(sale.total || 0)
  })
  const dayValues = Object.values(dayMap)
  const chartAvg = dayValues.length > 0 ? dayValues.reduce((a, b) => a + b, 0) / dayValues.length : 0
  const bestDayEntry = Object.entries(dayMap).sort((a, b) => b[1] - a[1])[0]

  const mainMetrics = [
    { label: 'Faturamento total', value: fmt(totalRevenue), accent: true },
    { label: 'Lucro total', value: fmt(totalProfit), accent: true },
    { label: 'Faturamento do mês', value: fmt(monthRevenue) },
    { label: 'Lucro do mês', value: fmt(monthProfit) },
    { label: 'Total de vendas', value: totalSalesCount },
    { label: 'Vendas no mês', value: currentMonthSales.length },
  ]

  const extraMetrics = [
    { label: 'Ticket médio', value: fmt(avgTicket), icon: 'ti-receipt', hint: 'Valor médio por venda no período' },
    { label: 'Margem de lucro', value: `${profitMargin.toFixed(1)}%`, icon: 'ti-chart-pie', hint: 'Lucro em relação ao faturamento total' },
    { label: 'Melhor dia da semana', value: bestDay, icon: 'ti-calendar-stats', hint: 'Dia com maior faturamento no período' },
    {
      label: 'Campeão do mês', value: bestProduct ? bestProduct[0] : '—', icon: 'ti-trophy',
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

        <p className="dash-section-title">Visão geral</p>
        <div className="dash-metric-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))', marginBottom: 28 }}>
          {mainMetrics.map((m) => (
            <div key={m.label} className={`dash-metric-card${m.accent ? ' dash-metric-accent' : ''}`}>
              <div className="dash-metric-label">{m.label}</div>
              <div className="dash-metric-value">{m.value}</div>
            </div>
          ))}
        </div>

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

        {/* ── Gráfico de evolução diária ── */}
        <div className="dash-sales-section" style={{ marginTop: 24 }}>
          <div className="dash-sales-header">
            <p className="dash-section-title" style={{ marginBottom: 0 }}>Evolução por dia</p>
            <span className="dash-sales-count">últimos 30 dias</span>
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ background: '#f6f7fb', borderRadius: 10, padding: '10px 14px', flex: 1 }}>
              <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 2px' }}>Faturamento no período</p>
              <p style={{ fontSize: 16, fontWeight: 600, color: '#111827', margin: 0 }}>{fmt(sum(sales.filter(s => {
                if (!s.createdAt?.seconds) return false
                return new Date(s.createdAt.seconds * 1000) >= thirtyDaysAgo
              }), 'total'))}</p>
            </div>
            <div style={{ background: '#f6f7fb', borderRadius: 10, padding: '10px 14px', flex: 1 }}>
              <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 2px' }}>Melhor dia</p>
              <p style={{ fontSize: 16, fontWeight: 600, color: '#111827', margin: 0 }}>
                {bestDayEntry ? bestDayEntry[0] : '—'}
              </p>
            </div>
            <div style={{ background: '#f6f7fb', borderRadius: 10, padding: '10px 14px', flex: 1 }}>
              <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 2px' }}>Média diária</p>
              <p style={{ fontSize: 16, fontWeight: 600, color: '#111827', margin: 0 }}>{fmt(chartAvg)}</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 12, color: '#6b7280' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: '#AFA9EC', display: 'inline-block' }} />
              Faturamento diário
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: '#534AB7', display: 'inline-block' }} />
              Melhor dia
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 16, height: 2, background: '#7F77DD', display: 'inline-block', borderRadius: 2 }} />
              Média
            </span>
          </div>

          <div style={{ position: 'relative', width: '100%', height: 260 }}>
            <canvas
              ref={chartRef}
              role="img"
              aria-label="Gráfico de barras mostrando evolução do faturamento nos últimos 30 dias"
            />
          </div>
        </div>

      </div>
    </AdminLayout>
  )
}

export default AdminFinancial