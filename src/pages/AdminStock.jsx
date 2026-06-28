import { useEffect, useState } from 'react'
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore'
import { db } from '../services/firebase'
import AdminLayout from '../layouts/AdminLayout'
import UpgradePlan from '../components/UpgradePlan'
import useStore from '../hooks/useStore'
import { hasFeature } from '../utils/features'

function AdminStock() {
  const { store, loading: storeLoading, storeSlug } = useStore()
  const [products, setProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [search, setSearch] = useState('')
  const isPro = hasFeature(store, 'stock')

  useEffect(() => {
    async function loadProducts() {
      try {
        const snapshot = await getDocs(collection(db, 'stores', storeSlug, 'products'))
        setProducts(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
      } catch (error) { console.error(error) }
      finally { setLoadingProducts(false) }
    }
    if (storeSlug && isPro) loadProducts()
  }, [storeSlug, isPro])

  function calculateTotalStock(product) {
    const mainStock = Object.values(product.sizeStocks || {}).reduce((acc, v) => acc + Number(v || 0), 0)
    const variationsStock = (product.variations || []).reduce((total, variation) =>
      total + Object.values(variation.sizeStocks || {}).reduce((acc, v) => acc + Number(v || 0), 0), 0)
    return mainStock + variationsStock
  }

  async function updateProductStock(productId, updatedData) {
    const totalStock = calculateTotalStock(updatedData)
    await updateDoc(doc(db, 'stores', storeSlug, 'products', productId), {
      ...updatedData, stock: totalStock, available: totalStock > 0,
    })
    setProducts((prev) => prev.map((p) => p.id === productId
      ? { ...updatedData, stock: totalStock, available: totalStock > 0 } : p))
  }

  function updateSizeStock(product, size, value) {
    updateProductStock(product.id, { ...product, sizeStocks: { ...(product.sizeStocks || {}), [size]: Number(value) } })
  }

  function updateVariationStock(product, variationIndex, size, value) {
    const updatedVariations = product.variations.map((variation, index) => {
      if (index !== variationIndex) return variation
      return { ...variation, sizeStocks: { ...(variation.sizeStocks || {}), [size]: Number(value) } }
    })
    updateProductStock(product.id, { ...product, variations: updatedVariations })
  }

  if (storeLoading || !store) return <AdminLayout><div className="dash-loading">Carregando...</div></AdminLayout>
  if (!isPro) return <AdminLayout><UpgradePlan /></AdminLayout>

  const filteredProducts = products.filter((p) =>
    (p.name || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <AdminLayout>
      <div className="dash-content">
        <div className="dash-page-header">
          <h1 className="dash-page-title">Estoque</h1>
          <p className="dash-page-subtitle">Controle os produtos disponíveis da sua loja.</p>
        </div>

        <div className="dash-sales-section">
          <div className="dash-sales-header">
            <p className="dash-section-title" style={{ marginBottom: 0 }}>Produtos em estoque</p>
            <span className="dash-sales-count">{filteredProducts.length} produto(s)</span>
          </div>

          {/* ── Busca ── */}
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <i className="ti ti-search" style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              color: '#9ca3af', fontSize: 16, pointerEvents: 'none'
            }} />
            <input
              type="text"
              placeholder="Buscar produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '9px 12px 9px 36px',
                border: '0.5px solid #e5e7eb', borderRadius: 10,
                fontSize: 13, outline: 'none', fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#9ca3af', fontSize: 14, padding: 0,
              }}>✕</button>
            )}
          </div>

          {loadingProducts ? (
            <p style={{ padding: '16px 0', color: '#6b7280', fontSize: 14 }}>Carregando estoque...</p>
          ) : filteredProducts.length === 0 ? (
            <p style={{ padding: '16px 0', color: '#9ca3af', fontSize: 14 }}>Nenhum produto encontrado.</p>
          ) : (
            filteredProducts.map((product) => {
              const stock = calculateTotalStock(product)
              const hasVariations = product.variations?.length > 0
              return (
                <div key={product.id} className="orby-admin-item" style={{ marginTop: 12 }}>
                  <img src={product.images?.[0] || product.image || '/placeholder.png'} alt={product.name} />
                  <div>
                    <strong>{product.name}</strong>
                    <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0' }}>Estoque total: {stock}</p>
                    <div className={`stock-status ${stock <= 0 ? 'out' : stock <= 3 ? 'low' : 'normal'}`}>
                      {stock <= 0 ? 'Esgotado' : stock <= 3 ? 'Baixo' : 'Normal'}
                    </div>

                    {!hasVariations && product.sizes?.length > 0 && (
                      <div className="size-stock-box">
                        <p>Estoque por tamanho</p>
                        {product.sizes.map((size) => (
                          <div key={size} className="size-stock-row">
                            <label>{size}</label>
                            <input type="number" min="0" value={product.sizeStocks?.[size] ?? 0}
                              onChange={(e) => updateSizeStock(product, size, e.target.value)} />
                          </div>
                        ))}
                      </div>
                    )}

                    {hasVariations && (
                      <div className="size-stock-box">
                        <p>Estoque por variação</p>
                        <div className="variation-stock-group">
                          <strong>{product.mainColor || 'Principal'}</strong>
                          {product.sizes?.map((size) => (
                            <div key={size} className="size-stock-row">
                              <label>{size}</label>
                              <input type="number" min="0" value={product.sizeStocks?.[size] ?? 0}
                                onChange={(e) => updateSizeStock(product, size, e.target.value)} />
                            </div>
                          ))}
                        </div>
                        {product.variations.map((variation, index) => (
                          <div key={`${variation.colorName}-${index}`} className="variation-stock-group">
                            <strong>{variation.colorName}</strong>
                            {variation.sizes?.map((size) => (
                              <div key={size} className="size-stock-row">
                                <label>{size}</label>
                                <input type="number" min="0" value={variation.sizeStocks?.[size] ?? 0}
                                  onChange={(e) => updateVariationStock(product, index, size, e.target.value)} />
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </AdminLayout>
  )
}

export default AdminStock