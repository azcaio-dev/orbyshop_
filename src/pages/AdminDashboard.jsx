import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { signOut, onAuthStateChanged } from 'firebase/auth'
import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import { auth, db } from '../services/firebase'
import AdminLayout from '../layouts/AdminLayout'

function AdminDashboard() {
  const navigate = useNavigate()
  const { storeSlug } = useParams()

  const [store, setStore] = useState(null)
  const [storeLoading, setStoreLoading] = useState(true)
  const [checkingAuth, setCheckingAuth] = useState(true)

  const [stats, setStats] = useState({
    products: 0,
    availableProducts: 0,
    dailyRevenue: 0,
    dailyProfit: 0,
    dailySales: 0,
    monthlyRevenue: 0,
    monthlyProfit: 0,
    outOfStock: 0,
    recentSales: [],
  })

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate('/admin/login')
        return
      }

      const userRef = doc(db, 'users', user.uid)
      const userSnap = await getDoc(userRef)

      if (!userSnap.exists()) {
        await signOut(auth)
        navigate('/admin/login')
        return
      }

      const userData = userSnap.data()

      if (userData.role === 'orbyOwner') {
        setCheckingAuth(false)
        return
      }

      if (userData.storeSlug !== storeSlug) {
        navigate(`/admin/${userData.storeSlug}/dashboard`)
        return
      }

      setCheckingAuth(false)
    })

    return () => unsubscribe()
  }, [navigate, storeSlug])

  useEffect(() => {
    async function loadStore() {
      try {
        const storeRef = doc(db, 'stores', storeSlug)
        const storeSnap = await getDoc(storeRef)
        if (storeSnap.exists()) setStore(storeSnap.data())
      } catch (error) {
        console.error('Erro ao carregar loja:', error)
      } finally {
        setStoreLoading(false)
      }
    }
    loadStore()
  }, [storeSlug])

  useEffect(() => {
    if (checkingAuth) return

    async function loadStats() {
      try {
        const productsSnapshot = await getDocs(
          collection(db, 'stores', storeSlug, 'products')
        )
        const salesSnapshot = await getDocs(
          collection(db, 'stores', storeSlug, 'sales')
        )

        const products = productsSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
        const sales = salesSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
        const activeSales = sales.filter((s) => s.status !== 'canceled')

        const now = new Date()

        const todaySales = activeSales.filter((sale) => {
          if (!sale.createdAt?.seconds) return false
          const d = new Date(sale.createdAt.seconds * 1000)
          return (
            d.getDate() === now.getDate() &&
            d.getMonth() === now.getMonth() &&
            d.getFullYear() === now.getFullYear()
          )
        })

        const monthSales = activeSales.filter((sale) => {
          if (!sale.createdAt?.seconds) return false
          const d = new Date(sale.createdAt.seconds * 1000)
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
        })

        const sum = (arr, key) => arr.reduce((acc, s) => acc + Number(s[key] || 0), 0)

        const sortedSales = [...activeSales].sort(
          (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
        )

        setStats({
          products: products.length,
          availableProducts: products.filter((p) => p.available).length,
          dailyRevenue: sum(todaySales, 'total'),
          dailyProfit: sum(todaySales, 'profit'),
          dailySales: todaySales.length,
          monthlyRevenue: sum(monthSales, 'total'),
          monthlyProfit: sum(monthSales, 'profit'),
          outOfStock: products.filter((p) => (p.stock ?? 0) <= 0).length,
          recentSales: sortedSales.slice(0, 10),
        })
      } catch (error) {
        console.error(error)
      }
    }

    loadStats()
  }, [storeSlug, checkingAuth])

  useEffect(() => {
    document.title = `Dashboard - ${store?.name || 'ORBY'}`
  }, [store])

  function formatBRL(value) {
    return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  function formatDate(createdAt) {
    if (!createdAt?.seconds) return ''
    return new Date(createdAt.seconds * 1000).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (checkingAuth || storeLoading) {
    return (
      <AdminLayout>
        <div className="dash-loading">Verificando acesso...</div>
      </AdminLayout>
    )
  }

  const quickActions = [
    {
      label: 'Nova venda',
      desc: 'Cadastrar manualmente',
      icon: 'ti-plus',
      onClick: () => navigate(`/admin/${storeSlug}/vendas`),
    },
    {
      label: 'Produtos',
      desc: 'Adicionar, editar e remover',
      icon: 'ti-package',
      onClick: () => navigate(`/admin/${storeSlug}/produtos`),
    },
    {
      label: 'Estoque',
      desc: 'Controlar quantidades',
      icon: 'ti-box',
      onClick: () => navigate(`/admin/${storeSlug}/estoque`),
    },
    {
      label: 'Ver loja',
      desc: 'Abrir como cliente',
      icon: 'ti-external-link',
      onClick: () => navigate(`/${storeSlug}`),
    },
  ]

  return (
    <AdminLayout>
      <div className="dash-content">

        {/* Cabeçalho da página */}
        <div className="dash-page-header">
          <div>
            <h1 className="dash-page-title">Dashboard</h1>
            <p className="dash-page-subtitle">Visão geral da sua loja</p>
          </div>
        </div>

        {/* Métricas */}
        <div className="dash-metric-grid">
          <div className="dash-metric-card dash-metric-accent">
            <div className="dash-metric-label">
              <i className="ti ti-trending-up" aria-hidden="true" />
              Faturamento hoje
            </div>
            <div className="dash-metric-value">{formatBRL(stats.dailyRevenue)}</div>
            <div className="dash-metric-sub">Mês: {formatBRL(stats.monthlyRevenue)}</div>
          </div>

          <div className="dash-metric-card dash-metric-accent">
            <div className="dash-metric-label">
              <i className="ti ti-coin" aria-hidden="true" />
              Lucro hoje
            </div>
            <div className="dash-metric-value">{formatBRL(stats.dailyProfit)}</div>
            <div className="dash-metric-sub">Mês: {formatBRL(stats.monthlyProfit)}</div>
          </div>

          <div className="dash-metric-card">
            <div className="dash-metric-label">
              <i className="ti ti-shopping-bag" aria-hidden="true" />
              Vendas hoje
            </div>
            <div className="dash-metric-value">{stats.dailySales}</div>
            {stats.outOfStock > 0 && (
              <div className="dash-metric-warn">
                <i className="ti ti-alert-triangle" aria-hidden="true" />
                {stats.outOfStock} sem estoque
              </div>
            )}
          </div>
        </div>

        {/* Ações rápidas */}
        <p className="dash-section-title">Ações rápidas</p>
        <div className="dash-quick-grid">
          {quickActions.map((action) => (
            <button
              key={action.label}
              className="dash-quick-card"
              onClick={action.onClick}
            >
              <div className="dash-quick-icon">
                <i className={`ti ${action.icon}`} aria-hidden="true" />
              </div>
              <span className="dash-quick-label">{action.label}</span>
              <span className="dash-quick-desc">{action.desc}</span>
            </button>
          ))}
        </div>

        {/* Últimas vendas */}
        <div className="dash-sales-section">
          <div className="dash-sales-header">
            <p className="dash-section-title" style={{ marginBottom: 0 }}>Últimas vendas</p>
            <span className="dash-sales-count">{stats.recentSales.length} venda(s)</span>
          </div>

          {stats.recentSales.length === 0 ? (
            <div className="dash-empty">
              <i className="ti ti-shopping-cart-off" aria-hidden="true" />
              <p>Nenhuma venda cadastrada ainda.</p>
            </div>
          ) : (
            <table className="dash-sales-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Produto</th>
                  <th>Data</th>
                  <th>Qtd</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentSales.map((sale) => (
                  <tr key={sale.id}>
                    <td>{sale.customerName || '—'}</td>
                    <td>{sale.productName || '—'}</td>
                    <td>{formatDate(sale.createdAt)}</td>
                    <td>{sale.quantity ?? '—'}</td>
                    <td>{formatBRL(sale.total || 0)}</td>
                    <td>
                      <span className={`dash-sale-badge ${sale.status === 'canceled' ? 'dash-sale-badge--canceled' : 'dash-sale-badge--active'}`}>
                        {sale.status === 'canceled' ? 'Cancelada' : 'Pago'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </AdminLayout>
  )
}

export default AdminDashboard