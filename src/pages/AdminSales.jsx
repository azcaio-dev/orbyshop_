import { useEffect, useState } from 'react'
import { collection, getDocs, addDoc, doc, updateDoc, getDoc } from 'firebase/firestore'
import { db } from '../services/firebase'
import AdminLayout from '../layouts/AdminLayout'
import UpgradePlan from '../components/UpgradePlan'
import Toast from '../components/Toast'
import AdminDialog from '../components/AdminDialog'
import useStore from '../hooks/useStore'
import { hasFeature } from '../utils/features'

function AdminSales() {
  const { store, loading: storeLoading, storeSlug } = useStore()
  const [products, setProducts] = useState([])
  const [sales, setSales] = useState([])
  const [salesFilter, setSalesFilter] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [selectedVariationIndex, setSelectedVariationIndex] = useState('')
  const [selectedSize, setSelectedSize] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [unitPrice, setUnitPrice] = useState('')
  const [loadingSale, setLoadingSale] = useState(false)
  const [toast, setToast] = useState({ message: '', type: 'success' })
  const [dialog, setDialog] = useState({ message: '', onConfirm: null })
  const isPro = hasFeature(store, 'sales')

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast({ message: '', type: 'success' }), 2500)
  }
  function showDialog(message, onConfirm) { setDialog({ message, onConfirm }) }
  function closeDialog() { setDialog({ message: '', onConfirm: null }) }

  useEffect(() => { if (storeSlug && isPro) { loadProducts(); loadSales() } }, [storeSlug, isPro])

  async function loadSales() {
    try {
      const snapshot = await getDocs(collection(db, 'stores', storeSlug, 'sales'))
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      setSales(data)
    } catch (error) { console.error(error) }
  }

  async function loadProducts() {
    const snapshot = await getDocs(collection(db, 'stores', storeSlug, 'products'))
    const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    // ✅ Ordenação alfabética
    data.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' }))
    setProducts(data)
  }

  function handleSelectProduct(productId) {
    setSelectedProductId(productId)
    const product = products.find((item) => item.id === productId)
    setSelectedProduct(product)
    setSelectedVariationIndex('')
    setSelectedSize('')
    if (product) setUnitPrice(product.price || '')
  }

  function getAvailableStock() {
    if (!selectedProduct || !selectedSize || selectedVariationIndex === '') return 0
    if (selectedVariationIndex === 'main') return Number(selectedProduct.sizeStocks?.[selectedSize] || 0)
    const variation = selectedProduct.variations?.[Number(selectedVariationIndex)]
    return Number(variation?.sizeStocks?.[selectedSize] || 0)
  }

  function calculateProductTotalStock(product) {
    const mainStock = Object.values(product.sizeStocks || {}).reduce((acc, v) => acc + Number(v || 0), 0)
    const variationsStock = (product.variations || []).reduce((total, variation) =>
      total + Object.values(variation.sizeStocks || {}).reduce((acc, v) => acc + Number(v || 0), 0), 0)
    return mainStock + variationsStock
  }

  async function handleSubmit(e) {
    e.preventDefault()
    console.log('🔥 submit chamado')
  console.log('📦 selectedProduct:', selectedProduct)
  console.log('📦 selectedSize:', selectedSize)
  console.log('📦 selectedVariationIndex:', selectedVariationIndex)
    if (!selectedProduct) return
    if (!selectedSize || selectedVariationIndex === '') {
      showToast('Selecione a cor/variação e o tamanho.', 'warning'); return
    }
    const availableStock = getAvailableStock()
    if (Number(quantity) > availableStock) {
      showToast(`Estoque insuficiente. Disponível: ${availableStock}`, 'warning'); return
    }
    showDialog('Confirmar cadastro desta venda?', async () => {
      closeDialog()
      setLoadingSale(true)
      try {
        const total = Number(unitPrice) * Number(quantity)
        const unitCost = Number(selectedProduct.costPrice || 0)
        const profit = (Number(unitPrice) - unitCost) * Number(quantity)
        await addDoc(collection(db, 'stores', storeSlug, 'sales'), {
          customerName, productId: selectedProduct.id, productName: selectedProduct.name,
          variationIndex: selectedVariationIndex,
          variationName: selectedVariationIndex === 'main'
            ? selectedProduct.mainColor || 'Principal'
            : selectedProduct.variations?.[Number(selectedVariationIndex)]?.colorName,
          size: selectedSize, status: 'active', quantity: Number(quantity),
          unitPrice: Number(unitPrice), unitCost, total, profit, createdAt: new Date(),
        })
        let updatedProduct = { ...selectedProduct }
        if (selectedVariationIndex === 'main') {
          updatedProduct.sizeStocks = { ...(selectedProduct.sizeStocks || {}),
            [selectedSize]: Number(selectedProduct.sizeStocks?.[selectedSize] || 0) - Number(quantity) }
        } else {
          updatedProduct.variations = (selectedProduct.variations || []).map((variation, index) => {
            if (index !== Number(selectedVariationIndex)) return variation
            return { ...variation, sizeStocks: { ...(variation.sizeStocks || {}),
              [selectedSize]: Number(variation.sizeStocks?.[selectedSize] || 0) - Number(quantity) } }
          })
        }
        const totalStock = calculateProductTotalStock(updatedProduct)
        await updateDoc(doc(db, 'stores', storeSlug, 'products', selectedProduct.id),
          { ...updatedProduct, stock: totalStock, available: totalStock > 0 })
        showToast('Venda cadastrada com sucesso!', 'success')
        await loadSales(); await loadProducts()
        handleSelectProduct(selectedProduct.id)
        setCustomerName(''); setQuantity(1); setSelectedProduct(null)
        setSelectedProductId(''); setUnitPrice(''); setSelectedVariationIndex(''); setSelectedSize('')
      } catch (error) { console.error(error); showToast('Erro ao cadastrar venda', 'error') }
      setLoadingSale(false)
    })
  }

  async function handleUndoSale(sale) {
    if (sale.status === 'canceled') return
    showDialog('Deseja desfazer esta venda? O estoque será devolvido.', async () => {
      closeDialog()
      try {
        const productRef = doc(db, 'stores', storeSlug, 'products', sale.productId)
        const productSnap = await getDoc(productRef)
        if (!productSnap.exists()) { showToast('Produto não encontrado.', 'error'); return }
        const product = { id: productSnap.id, ...productSnap.data() }
        let updatedProduct = { ...product }
        if (sale.variationIndex === 'main') {
          updatedProduct.sizeStocks = { ...(product.sizeStocks || {}),
            [sale.size]: Number(product.sizeStocks?.[sale.size] || 0) + Number(sale.quantity || 0) }
        } else {
          updatedProduct.variations = (product.variations || []).map((variation, index) => {
            if (index !== Number(sale.variationIndex)) return variation
            return { ...variation, sizeStocks: { ...(variation.sizeStocks || {}),
              [sale.size]: Number(variation.sizeStocks?.[sale.size] || 0) + Number(sale.quantity || 0) } }
          })
        }
        const totalStock = calculateProductTotalStock(updatedProduct)
        await updateDoc(productRef, { ...updatedProduct, stock: totalStock, available: totalStock > 0 })
        await updateDoc(doc(db, 'stores', storeSlug, 'sales', sale.id), { status: 'canceled', canceledAt: new Date() })
        showToast('Venda desfeita com sucesso!', 'success')
        await loadSales(); await loadProducts()
      } catch (error) { console.error(error); showToast('Erro ao desfazer venda', 'error') }
    })
  }

  function formatDate(createdAt) {
    if (!createdAt?.seconds) return ''
    return new Date(createdAt.seconds * 1000).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  }

  function fmt(v) { return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }

  if (storeLoading || !store) return <AdminLayout><div className="dash-loading">Carregando...</div></AdminLayout>
  if (!isPro) return <AdminLayout><UpgradePlan /></AdminLayout>

  const filteredSales = sales.filter((sale) => {
    if (salesFilter === 'active' && sale.status === 'canceled') return false
    if (salesFilter === 'canceled' && sale.status !== 'canceled') return false
    if (!sale.createdAt?.seconds) return true
    const saleDate = new Date(sale.createdAt.seconds * 1000)
    if (startDate && saleDate < new Date(`${startDate}T00:00:00`)) return false
    if (endDate && saleDate > new Date(`${endDate}T23:59:59`)) return false
    return true
  })

  return (
    <AdminLayout>
      <div className="dash-content">
        <div className="dash-page-header">
          <h1 className="dash-page-title">Vendas</h1>
          <p className="dash-page-subtitle">Cadastre e acompanhe as vendas da sua loja.</p>
        </div>

        <div className="orby-admin-layout">
          <form onSubmit={handleSubmit} className="orby-admin-form">
            <label>Cliente</label>
            <input type="text" placeholder="Nome do cliente" value={customerName}
              onChange={(e) => setCustomerName(e.target.value)} />

            <label>Produto</label>
            <select value={selectedProductId} onChange={(e) => handleSelectProduct(e.target.value)}>
              <option value="">Selecione um produto</option>
              {[...products]
                .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' }))
                .map((product) => (
                  <option key={product.id} value={product.id}>{product.name}</option>
                ))
              }
            </select>

            {selectedProduct && (
              <>
                <label>Cor / Variação</label>
                <select value={selectedVariationIndex}
                  onChange={(e) => { setSelectedVariationIndex(e.target.value); setSelectedSize('') }} >
                  <option value="">Selecione uma opção</option>
                  <option value="main">{selectedProduct.mainColor || 'Principal'}</option>
                  {selectedProduct.variations?.map((variation, index) => (
                    <option key={index} value={index}>{variation.colorName}</option>
                  ))}
                </select>
              </>
            )}

            {selectedProduct && selectedVariationIndex !== '' && (
              <>
                <label>Tamanho</label>
                <select value={selectedSize} onChange={(e) => setSelectedSize(e.target.value)} >
                  <option value="">Selecione um tamanho</option>
                  {(selectedVariationIndex === 'main'
                    ? selectedProduct.sizes
                    : selectedProduct.variations?.[Number(selectedVariationIndex)]?.sizes
                  )?.map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
              </>
            )}

            <label>Quantidade</label>
            <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)}  />

            <label>Preço da venda</label>
            <input type="number" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)}  />

            {selectedProduct && (
              <div className="sale-preview">
                <p>Estoque disponível: {getAvailableStock()}</p>
                <p>Custo unitário: {fmt(selectedProduct.costPrice || 0)}</p>
                <p>Total: {fmt(Number(unitPrice) * Number(quantity))}</p>
                <p>Lucro estimado: {fmt((Number(unitPrice) - Number(selectedProduct.costPrice || 0)) * Number(quantity))}</p>
              </div>
            )}

            <button type="submit" disabled={loadingSale}>
              {loadingSale ? 'Salvando...' : 'Cadastrar venda'}
            </button>
          </form>

          <section className="orby-admin-list">
            <div className="orby-list-header">
              <h2>Últimas vendas</h2>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['all', 'active', 'canceled'].map((f) => (
                  <button key={f} type="button"
                    className={salesFilter === f ? 'section-button active' : 'section-button'}
                    onClick={() => setSalesFilter(f)}>
                    {f === 'all' ? 'Todas' : f === 'active' ? 'Ativas' : 'Canceladas'}
                  </button>
                ))}
              </div>
              <div className="sales-date-filters">
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>

            {filteredSales.map((sale) => (
              <div key={sale.id} className="orby-admin-item">
                <div style={{ gridColumn: '1 / -1' }}>
                  <strong>{sale.customerName}</strong>
                  <p>{sale.productName}</p>
                  <p style={{ fontSize: 12, color: '#6b7280' }}>{formatDate(sale.createdAt)}</p>
                  <p>Qtd: {sale.quantity} — {sale.variationName} / {sale.size}</p>
                  <p>Total: {fmt(sale.total || 0)} · Lucro: {fmt(sale.profit || 0)}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                    <span className={`dash-sale-badge ${sale.status === 'canceled' ? 'dash-sale-badge--canceled' : 'dash-sale-badge--active'}`}>
                      {sale.status === 'canceled' ? 'Cancelada' : 'Concluída'}
                    </span>
                    {sale.status !== 'canceled' && (
                      <button type="button" className="admin-btn admin-btn--danger-outline"
                        onClick={() => handleUndoSale(sale)}>
                        Desfazer
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>

      <Toast message={toast.message} type={toast.type} />
      <AdminDialog message={dialog.message} onConfirm={dialog.onConfirm} onCancel={closeDialog} />
    </AdminLayout>
  )
}

export default AdminSales