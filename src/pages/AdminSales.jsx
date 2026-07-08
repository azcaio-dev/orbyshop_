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
  const [loadingSale, setLoadingSale] = useState(false)
  const [toast, setToast] = useState({ message: '', type: 'success' })
  const [dialog, setDialog] = useState({ message: '', onConfirm: null })
  const isPro = hasFeature(store, 'sales')

  // ── Formulário de item ──────────────────────────────────────
  const [customerName, setCustomerName] = useState('')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [selectedVariationIndex, setSelectedVariationIndex] = useState('')
  const [selectedSize, setSelectedSize] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [unitPrice, setUnitPrice] = useState('')

  // ── Carrinho de venda (múltiplos itens) ─────────────────────
  const [saleItems, setSaleItems] = useState([])

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
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
      data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      setSales(data)
    } catch (error) { console.error(error) }
  }

  async function loadProducts() {
    const snapshot = await getDocs(collection(db, 'stores', storeSlug, 'products'))
    const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
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

  // ── Adiciona item ao carrinho de venda ──────────────────────
  function handleAddItem() {
    if (!selectedProduct) { showToast('Selecione um produto.', 'warning'); return }
    if (selectedVariationIndex === '') { showToast('Selecione a cor/variação.', 'warning'); return }
    if (!selectedSize) { showToast('Selecione o tamanho.', 'warning'); return }
    if (!unitPrice) { showToast('Informe o preço da venda.', 'warning'); return }

    const availableStock = getAvailableStock()
    if (Number(quantity) > availableStock) {
      showToast(`Estoque insuficiente. Disponível: ${availableStock}`, 'warning'); return
    }

    const variationName = selectedVariationIndex === 'main'
      ? selectedProduct.mainColor || 'Principal'
      : selectedProduct.variations?.[Number(selectedVariationIndex)]?.colorName

    const newItem = {
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      product: selectedProduct,
      variationIndex: selectedVariationIndex,
      variationName,
      size: selectedSize,
      quantity: Number(quantity),
      unitPrice: Number(unitPrice),
      unitCost: Number(selectedProduct.costPrice || 0),
      total: Number(unitPrice) * Number(quantity),
      profit: (Number(unitPrice) - Number(selectedProduct.costPrice || 0)) * Number(quantity),
    }

    setSaleItems((prev) => [...prev, newItem])

    // Limpa o formulário de item
    setSelectedProductId('')
    setSelectedProduct(null)
    setSelectedVariationIndex('')
    setSelectedSize('')
    setQuantity(1)
    setUnitPrice('')

    showToast('Item adicionado!', 'success')
  }

  function removeItem(index) {
    setSaleItems((prev) => prev.filter((_, i) => i !== index))
  }

  // ── Confirma a venda com todos os itens ─────────────────────
  async function handleSubmit(e) {
    e.preventDefault()
    if (saleItems.length === 0) { showToast('Adicione pelo menos um produto.', 'warning'); return }

    showDialog(`Confirmar venda com ${saleItems.length} item(s)?`, async () => {
      closeDialog()
      setLoadingSale(true)
      try {
        await addDoc(collection(db, 'stores', storeSlug, 'sales'), {
          customerName,
          status: 'active',
          total: saleTotal,
          profit: saleProfit,
          createdAt: new Date(),
          items: saleItems.map(item => ({
            productId: item.productId,
            productName: item.productName,
            variationIndex: item.variationIndex,
            variationName: item.variationName,
            size: item.size,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            unitCost: item.unitCost,
            total: item.total,
            profit: item.profit,
          })),
        })

        // Atualiza estoque normalmente
        for (const item of saleItems) {

          // Atualiza estoque de cada produto
          let updatedProduct = { ...item.product }
          if (item.variationIndex === 'main') {
            updatedProduct.sizeStocks = {
              ...(item.product.sizeStocks || {}),
              [item.size]: Number(item.product.sizeStocks?.[item.size] || 0) - item.quantity,
            }
          } else {
            updatedProduct.variations = (item.product.variations || []).map((variation, index) => {
              if (index !== Number(item.variationIndex)) return variation
              return {
                ...variation,
                sizeStocks: {
                  ...(variation.sizeStocks || {}),
                  [item.size]: Number(variation.sizeStocks?.[item.size] || 0) - item.quantity,
                },
              }
            })
          }
          const totalStock = calculateProductTotalStock(updatedProduct)
          await updateDoc(doc(db, 'stores', storeSlug, 'products', item.productId), {
            ...updatedProduct, stock: totalStock, available: totalStock > 0,
          })
        }

        showToast('Venda cadastrada com sucesso!', 'success')
        setSaleItems([])
        setCustomerName('')
        await loadSales()
        await loadProducts()
      } catch (error) { console.error(error); showToast('Erro ao cadastrar venda', 'error') }
      setLoadingSale(false)
    })
  }

  async function handleUndoSale(sale) {
    if (sale.status === 'canceled') return

    showDialog('Deseja desfazer esta venda? O estoque será devolvido.', async () => {
      closeDialog()

      try {
        // Compatibilidade:
        // venda antiga => [sale]
        // venda nova => sale.items
        const items = sale.items || [sale]

        for (const item of items) {
          const productRef = doc(db, 'stores', storeSlug, 'products', item.productId)
          const productSnap = await getDoc(productRef)

          if (!productSnap.exists()) continue

          const product = {
            id: productSnap.id,
            ...productSnap.data()
          }

          let updatedProduct = { ...product }

          if (item.variationIndex === 'main') {
            updatedProduct.sizeStocks = {
              ...(product.sizeStocks || {}),
              [item.size]:
                Number(product.sizeStocks?.[item.size] || 0) +
                Number(item.quantity || 0),
            }
          } else {
            updatedProduct.variations = (product.variations || []).map(
              (variation, index) => {
                if (index !== Number(item.variationIndex)) return variation

                return {
                  ...variation,
                  sizeStocks: {
                    ...(variation.sizeStocks || {}),
                    [item.size]:
                      Number(variation.sizeStocks?.[item.size] || 0) +
                      Number(item.quantity || 0),
                  },
                }
              }
            )
          }

          const totalStock = calculateProductTotalStock(updatedProduct)

          await updateDoc(productRef, {
            ...updatedProduct,
            stock: totalStock,
            available: totalStock > 0,
          })
        }

        await updateDoc(
          doc(db, 'stores', storeSlug, 'sales', sale.id),
          {
            status: 'canceled',
            canceledAt: new Date(),
          }
        )

        showToast('Venda desfeita com sucesso!', 'success')

        await loadSales()
        await loadProducts()
      } catch (error) {
        console.error(error)
        showToast('Erro ao desfazer venda', 'error')
      }
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

  const saleTotal = saleItems.reduce((acc, item) => acc + item.total, 0)
  const saleProfit = saleItems.reduce((acc, item) => acc + item.profit, 0)

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

            {/* ── Seleção de item ── */}
            <div style={{ borderTop: '0.5px solid #e5e7eb', paddingTop: 12, marginTop: 4 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#534ab7', margin: '0 0 10px' }}>
                Adicionar produto
              </p>

              <label>Produto</label>
              <select value={selectedProductId} onChange={(e) => handleSelectProduct(e.target.value)}>
                <option value="">Selecione um produto</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>{product.name}</option>
                ))}
              </select>

              {selectedProduct && (
                <>
                  <label style={{ marginTop: 10 }}>Cor / Variação</label>
                  <select value={selectedVariationIndex}
                    onChange={(e) => { setSelectedVariationIndex(e.target.value); setSelectedSize('') }}>
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
                  <label style={{ marginTop: 10 }}>Tamanho</label>
                  <select value={selectedSize} onChange={(e) => setSelectedSize(e.target.value)}>
                    <option value="">Selecione um tamanho</option>
                    {(selectedVariationIndex === 'main'
                      ? selectedProduct.sizes
                      : selectedProduct.variations?.[Number(selectedVariationIndex)]?.sizes
                    )?.map((size) => <option key={size} value={size}>{size}</option>)}
                  </select>
                </>
              )}

              <label style={{ marginTop: 10 }}>Quantidade</label>
              <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />

              <label style={{ marginTop: 10 }}>Preço da venda</label>
              <input type="number" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />

              {selectedProduct && selectedSize && (
                <p style={{ fontSize: 12, color: '#6b7280', margin: '6px 0 0' }}>
                  Estoque disponível: {getAvailableStock()}
                </p>
              )}

              <button type="button" onClick={handleAddItem}
                style={{ marginTop: 12, background: '#eeedfe', color: '#534ab7',
                  border: '0.5px solid #afa9ec', borderRadius: 10, padding: '10px 14px',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%' }}>
                + Adicionar item
              </button>
            </div>

            {/* ── Carrinho de itens ── */}
            {saleItems.length > 0 && (
              <div style={{ borderTop: '0.5px solid #e5e7eb', paddingTop: 12, marginTop: 4 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: '0 0 10px' }}>
                  Itens da venda
                </p>

                {saleItems.map((item, index) => (
                  <div key={index} style={{ display: 'flex', justifyContent: 'space-between',
                    alignItems: 'flex-start', padding: '8px 0',
                    borderBottom: '0.5px solid #f3f4f6', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#111827' }}>{item.productName}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>
                        {item.variationName} / {item.size} · Qtd: {item.quantity} · {fmt(item.unitPrice)}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 12, fontWeight: 600, color: '#534ab7' }}>
                        {fmt(item.total)}
                      </p>
                    </div>
                    <button type="button" onClick={() => removeItem(index)}
                      style={{ background: '#fee2e2', border: 'none', borderRadius: 6,
                        color: '#b91c1c', fontSize: 11, padding: '4px 8px', cursor: 'pointer', flexShrink: 0 }}>
                      Remover
                    </button>
                  </div>
                ))}

                <div style={{ marginTop: 12, padding: '10px 12px', background: '#f6f7fb',
                  borderRadius: 10, display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>Total da venda</p>
                    <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>{fmt(saleTotal)}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>Lucro estimado</p>
                    <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f6e56' }}>{fmt(saleProfit)}</p>
                  </div>
                </div>
              </div>
            )}

            <button type="submit" disabled={loadingSale || saleItems.length === 0}>
              {loadingSale ? 'Salvando...' : `Confirmar venda${saleItems.length > 1 ? ` (${saleItems.length} itens)` : ''}`}
            </button>
          </form>

          {/* ── Lista de vendas ── */}
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

            {filteredSales.map((sale) => {
              const items = sale.items || [sale]

              return (
                <div key={sale.id} className="orby-admin-item">
                  <div style={{ gridColumn: '1 / -1' }}>
                    <strong>{sale.customerName || 'Cliente não informado'}</strong>

                    <p style={{ fontSize: 12, color: '#6b7280' }}>
                      {formatDate(sale.createdAt)}
                    </p>

                    {items.map((item, index) => (
                      <div
                        key={index}
                        style={{
                          marginTop: 8,
                          paddingBottom: 8,
                          borderBottom:
                            index < items.length - 1 ? '1px solid #f3f4f6' : 'none',
                        }}
                      >
                        <p style={{ margin: 0, fontWeight: 600 }}>
                          {item.productName}
                        </p>

                        <p style={{ margin: '2px 0', fontSize: 13 }}>
                          Qtd: {item.quantity} — {item.variationName} / {item.size}
                        </p>

                        <p style={{ margin: '2px 0', fontSize: 13 }}>
                          {fmt(item.total)} · Lucro: {fmt(item.profit)}
                        </p>
                      </div>
                    ))}

                    <div
                      style={{
                        marginTop: 10,
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontWeight: 700,
                      }}
                    >
                      <span>Total da venda</span>
                      <span>{fmt(sale.total || 0)}</span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        marginTop: 10,
                      }}
                    >
                      <span
                        className={`dash-sale-badge ${
                          sale.status === 'canceled'
                            ? 'dash-sale-badge--canceled'
                            : 'dash-sale-badge--active'
                        }`}
                      >
                        {sale.status === 'canceled' ? 'Cancelada' : 'Concluída'}
                      </span>

                      {sale.status !== 'canceled' && (
                        <button
                          type="button"
                          className="admin-btn admin-btn--danger-outline"
                          onClick={() => handleUndoSale(sale)}
                        >
                          Desfazer
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </section>
        </div>
      </div>

      <Toast message={toast.message} type={toast.type} />
      <AdminDialog message={dialog.message} onConfirm={dialog.onConfirm} onCancel={closeDialog} />
    </AdminLayout>
  )
}

export default AdminSales