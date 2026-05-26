import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../services/firebase'
import AdminLayout from '../layouts/AdminLayout'
import UpgradePlan from '../components/UpgradePlan'
import useStore from '../hooks/useStore'
import { hasFeature } from '../utils/features'

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
  if (loadingSales) return null

  const now = new Date()
  const currentMonthSales = sales.filter((sale) => {
    if (!sale.createdAt?.seconds) return false
    const d = new Date(sale.createdAt.seconds * 1000)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  const sum = (arr, key) => arr.reduce((acc, s) => acc + Number(s[key] || 0), 0)
  const fmt = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const metrics = [
    { label: 'Faturamento total', value: fmt(sum(sales, 'total')), accent: true },
    { label: 'Lucro total', value: fmt(sum(sales, 'profit')), accent: true },
    { label: 'Faturamento do mês', value: fmt(sum(currentMonthSales, 'total')) },
    { label: 'Lucro do mês', value: fmt(sum(currentMonthSales, 'profit')) },
    { label: 'Total de vendas', value: sales.length },
  ]

  return (
    <AdminLayout>
      <div className="dash-content">
        <div className="dash-page-header">
          <h1 className="dash-page-title">Financeiro</h1>
          <p className="dash-page-subtitle">Acompanhe faturamento, lucro e vendas da loja.</p>
        </div>

        <div className="sales-date-filters" style={{ marginBottom: 20 }}>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>

        <div className="dash-metric-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
          {metrics.map((m) => (
            <div key={m.label} className={`dash-metric-card${m.accent ? ' dash-metric-accent' : ''}`}>
              <div className="dash-metric-label">{m.label}</div>
              <div className="dash-metric-value">{m.value}</div>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  )
}

export default AdminFinancial