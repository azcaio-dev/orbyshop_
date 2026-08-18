import cartIcon from '../assets/cart.png'
import menuIcon from '../assets/menu.png'
import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../services/firebase'
import CartDrawer from '../components/CartDrawer'
import { useCart } from '../context/CartContext'
import { createPortal } from 'react-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import lupaIcon from '../assets/lupa.png'
import SearchPanel from '../components/SearchPanel'
import useStore from '../hooks/useStore'
import useStoreTheme from '../hooks/useStoreTheme'

function sortProductsByCategory(products) {
  return [...products].sort((a, b) => {
    const categoryA = a.category || 'Sem categoria'
    const categoryB = b.category || 'Sem categoria'
    if (categoryA !== categoryB) return categoryA.localeCompare(categoryB, 'pt-BR')
    return (a.name || '').localeCompare(b.name || '', 'pt-BR')
  })
}

const sectionLabels = {
  launch: 'Lançamentos',
  bestseller: 'Mais vendidos',
  outlet: 'Outlet',
}

// ✅ No desktop a grade é de 4 colunas, então carrega de 12 em 12
// (múltiplo de 4, sem deixar linha incompleta). No mobile é 2 colunas,
// carrega de 10 em 10.
function getPageSize() {
  if (typeof window === 'undefined') return 10
  return window.innerWidth >= 1024 ? 12 : 10
}

// ✅ Verifica se um produto tem pelo menos um tamanho com estoque > 0
function hasAnyStock(product) {
  if (!product.available) return false
  // Se não usa controle de estoque por tamanho, confia no available
  if (!product.sizeStocks && (!product.variations || product.variations.length === 0)) {
    return product.available
  }
  const mainStock = Object.values(product.sizeStocks || {}).some((v) => Number(v) > 0)
  const variationStock = (product.variations || []).some((variation) =>
    Object.values(variation.sizeStocks || {}).some((v) => Number(v) > 0)
  )
  return mainStock || variationStock
}

// ✅ Retorna os tamanhos com estoque > 0 para um produto (na variação principal)
function getSizesWithStock(product) {
  const sizes = product.sizes || []
  if (!product.sizeStocks) return sizes // sem controle de estoque, mostra todos
  return sizes.filter((size) => Number(product.sizeStocks[size] || 0) > 0)
}

// ✅ Formata a forma de pagamento pra exibição
function formatPaymentMethod(paymentMethod) {
  if (!paymentMethod || paymentMethod === 'vista') return 'À vista'
  return `${paymentMethod} sem juros`
}

function Products() {
  const { cart, addToCart } = useCart()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const section = searchParams.get('section')
  const sizeParam = searchParams.get('size')

  const { store, loading: storeLoading, storeSlug } = useStore()
  const storePrefix = `/${storeSlug}`
  useStoreTheme(store)

  const [scrolled, setScrolled] = useState(false)
  const [products, setProducts] = useState([])
  const [filteredProducts, setFilteredProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [addedId, setAddedId] = useState(null)
  const [openCart, setOpenCart] = useState(false)
  const [openMenu, setOpenMenu] = useState(false)
  const [openBrands, setOpenBrands] = useState(false)
  const [openCategories, setOpenCategories] = useState(false)
  const [activeFilter, setActiveFilter] = useState(null)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [selectedSize, setSelectedSize] = useState('')
  const [filterLabel, setFilterLabel] = useState('')
  const [visibleCount, setVisibleCount] = useState(getPageSize)
  const [openSearch, setOpenSearch] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSizeFilter, setSelectedSizeFilter] = useState(null)
  const [openFilters, setOpenFilters] = useState(false)

  const cartQuantity = cart.reduce((acc, item) => acc + item.quantity, 0)

  useEffect(() => {
    function handleScroll() { setScrolled(window.scrollY > 20) }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (openMenu || openCart) {
      document.body.classList.add('menu-open')
      document.documentElement.classList.add('menu-open')
    } else {
      document.body.classList.remove('menu-open')
      document.documentElement.classList.remove('menu-open')
    }
    return () => {
      document.body.classList.remove('menu-open')
      document.documentElement.classList.remove('menu-open')
    }
  }, [openMenu, openCart])

  useEffect(() => {
    if (sizeParam) setSelectedSizeFilter(sizeParam)
    else setSelectedSizeFilter(null)
  }, [sizeParam])

  useEffect(() => {
    async function loadProducts() {
      try {
        setLoading(true)
        const snapshot = await getDocs(collection(db, 'stores', storeSlug, 'products'))
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        const sortedData = sortProductsByCategory(data)
        setProducts(sortedData)
        if (section && sectionLabels[section]) {
          const filtered = sortProductsByCategory(sortedData.filter((p) => p.productSection === section))
          setFilteredProducts(filtered)
          setActiveFilter(section)
          setFilterLabel(sectionLabels[section])
        } else {
          setFilteredProducts(sortedData)
          setActiveFilter(null)
          setFilterLabel('')
        }
        setVisibleCount(getPageSize())
      } catch (error) {
        console.error('Erro ao carregar produtos:', error)
      } finally {
        setLoading(false)
      }
    }
    loadProducts()
  }, [storeSlug, section])

  const brands = [...new Set(products.map((p) => p.brand).filter(Boolean))]
  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))]

  if (storeLoading || !store) return null

  const allSizes = [...new Set(products.flatMap((p) => p.sizes || []))].sort()

  if (store.active === false) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: '16px', background: store.colors?.background || '#fff',
        color: store.colors?.text || '#111', padding: '24px', textAlign: 'center' }}>
        <img src={store.logo} alt={store.name} style={{ width: '120px', objectFit: 'contain' }} />
        <h1 style={{ fontSize: '28px', margin: 0 }}>Loja temporariamente indisponível</h1>
        <p style={{ maxWidth: '420px', opacity: 0.7, lineHeight: 1.6 }}>
          Esta loja está desativada no momento. Tente novamente mais tarde.
        </p>
      </main>
    )
  }

  return (
    <div>
      <header className={`header ${scrolled ? 'scrolled' : ''}`}>
        <div className="header-left">
          <button className="menu-button" onClick={() => setOpenMenu(true)}>
            <img src={menuIcon} alt="Menu" className="menu-icon" />
          </button>
          <button className="search-button" onClick={() => setOpenSearch(!openSearch)}>
            <img src={lupaIcon} alt="Buscar" className="search-icon" />
          </button>
        </div>
        <div className="header-center">
          <img src={store.logo} alt={store.name} className="logo" onClick={() => navigate(storePrefix)} />
        </div>
        <div className="header-right">
          <button className="cart-button" onClick={() => setOpenCart(true)}>
            <img src={cartIcon} alt="Carrinho" className="cart-icon" />
            {cartQuantity > 0 && <span className="cart-badge">{cartQuantity}</span>}
          </button>
        </div>
      </header>

      <SearchPanel openSearch={openSearch} searchTerm={searchTerm} setSearchTerm={setSearchTerm}
        products={products} setFilteredProducts={setFilteredProducts}
        setActiveFilter={setActiveFilter} setFilterLabel={setFilterLabel} />

      <main className="container products-page fade-in">
        <h2 className="section-title">{activeFilter ? filterLabel : 'Todos os produtos'}</h2>

        <button className="filter-toggle-button" onClick={() => setOpenFilters(!openFilters)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: '#fff',
            border: 'none', borderRadius: '999px', padding: '9px 18px', fontSize: '14px',
            fontWeight: '500', color: '#111', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.10)' }}>
          {openFilters
            ? <><span style={{ fontSize: '15px', lineHeight: 1 }}>✕</span> Fechar filtros</>
            : <><span style={{ fontSize: '16px', lineHeight: 1 }}>⇅</span> Filtrar</>}
        </button>

        {!activeFilter && openFilters && allSizes.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', opacity: 0.6, marginRight: '4px' }}>Tamanho:</span>
            {allSizes.map((size) => (
              <button key={size}
                onClick={() => {
                  const newSize = selectedSizeFilter === size ? null : size
                  setSelectedSizeFilter(newSize)
                  const params = new URLSearchParams(searchParams)
                  if (newSize) params.set('size', newSize)
                  else params.delete('size')
                  setSearchParams(params)
                }}
                style={{ padding: '6px 14px', borderRadius: '20px',
                  border: '1px solid var(--color-primary, #111)',
                  background: selectedSizeFilter === size ? 'var(--color-primary, #111)' : 'transparent',
                  color: selectedSizeFilter === size ? '#fff' : 'var(--color-primary, #111)',
                  fontSize: '13px', cursor: 'pointer',
                  fontWeight: selectedSizeFilter === size ? '600' : '400', transition: 'all 0.2s' }}>
                {size}
              </button>
            ))}
            {selectedSizeFilter && (
              <button onClick={() => {
                  setSelectedSizeFilter(null)
                  const params = new URLSearchParams(searchParams)
                  params.delete('size')
                  setSearchParams(params)
                }}
                style={{ padding: '6px 12px', borderRadius: '20px', border: '1px solid #ccc',
                  background: 'transparent', color: '#888', fontSize: '12px', cursor: 'pointer' }}>
                ✕ Limpar
              </button>
            )}
          </div>
        )}

        <section className="products-grid">
          {loading ? (
            <>{[1,2,3,4,5,6].map((i) => <div key={i} className="skeleton-card" />)}</>
          ) : (
            (() => {
              const displayed = selectedSizeFilter
                ? filteredProducts.filter((p) => {
                    if (!p.sizes?.includes(selectedSizeFilter)) return false
                    // Se não tem controle de estoque por tamanho, confia no available
                    if (!p.sizeStocks || Object.keys(p.sizeStocks).length === 0) return p.available
                    // Verifica se o tamanho específico tem estoque > 0
                    return Number(p.sizeStocks[selectedSizeFilter] || 0) > 0
                  })
                : filteredProducts

              return displayed.length > 0 ? (
                displayed.slice(0, visibleCount).map((product) => {
                  // ✅ Verifica estoque real antes de permitir adicionar
                  const canAdd = hasAnyStock(product)

                  return (
                    <article
                      className={`product-card ${!canAdd ? 'unavailable' : ''}`}
                      key={product.id}
                      onClick={() => navigate(`${storePrefix}/produto/${product.id}`)}
                    >
                      <div className="product-image-wrapper" style={{ position: 'relative' }}>
                        <img src={product.images?.[0] || product.image} alt={product.name} className="product-image" />
                        {!canAdd && <span className="unavailable-badge">Indisponível</span>}
                        {product.productSection === 'outlet' && product.oldPrice && (
                          <span className="discount-badge">
                            {Math.round((1 - product.price / product.oldPrice) * 100)}%
                          </span>
                        )}
                      </div>

                      <div className="product-info">
                        <h3>{product.name}</h3>
                        <div className="price-row">
                          {product.productSection === 'outlet' && product.oldPrice ? (
                            <div className="price-box">
                              <span className="old-price">
                                {Number(product.oldPrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </span>
                              <strong className="current-price">
                                {Number(product.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </strong>
                            </div>
                          ) : (
                            <p>{Number(product.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                          )}
                          <span className="payment-method">{formatPaymentMethod(product.paymentMethod)}</span>
                        </div>
                      </div>

                      {activeFilter !== 'search' && (
                        <button
                          className={`add-cart-button ${addedId === product.id ? 'added' : ''}`}
                          disabled={!canAdd}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (!canAdd) return
                            setSelectedProduct(product)
                            setSelectedSize('')
                          }}
                        >
                          {!canAdd ? 'Indisponível' : addedId === product.id ? '✔ Adicionado' : '+ Carrinho'}
                        </button>
                      )}
                    </article>
                  )
                })
              ) : (
                <div className="empty-products"><p>Nenhum produto encontrado.</p></div>
              )
            })()
          )}

          {/* MODAL DE TAMANHO */}
          {selectedProduct && createPortal(
            <div className="size-modal-overlay" onClick={() => setSelectedProduct(null)}>
              <div className="size-modal" onClick={(e) => e.stopPropagation()}>
                <button className="size-modal-close" onClick={() => setSelectedProduct(null)}>✕</button>
                <h3>Escolha o tamanho</h3>
                <p>{selectedProduct.name}</p>

                <div className="size-modal-options">
                  {/* ✅ Só mostra tamanhos com estoque > 0 */}
                  {getSizesWithStock(selectedProduct).map((size) => (
                    <button key={size}
                      className={selectedSize === size ? 'selected' : ''}
                      onClick={() => setSelectedSize(size)}>
                      {size}
                    </button>
                  ))}
                  {/* ✅ Tamanhos sem estoque aparecem desabilitados */}
                  {(selectedProduct.sizes || [])
                    .filter((size) => !getSizesWithStock(selectedProduct).includes(size))
                    .map((size) => (
                      <button key={size} disabled
                        style={{ opacity: 0.35, cursor: 'not-allowed', textDecoration: 'line-through' }}>
                        {size}
                      </button>
                    ))}
                </div>

                <button
                  className={`size-modal-confirm ${addedId === selectedProduct?.id ? 'added' : ''}`}
                  disabled={!selectedSize}
                  onClick={() => {
                    addToCart({ ...selectedProduct, selectedSize })
                    setAddedId(selectedProduct.id)
                    setTimeout(() => {
                      setAddedId(null)
                      setSelectedProduct(null)
                      setSelectedSize('')
                    }, 800)
                  }}
                >
                  {addedId === selectedProduct?.id ? '✔ Adicionado' : 'Adicionar ao carrinho'}
                </button>
              </div>
            </div>,
            document.body
          )}
        </section>

        {visibleCount < (selectedSizeFilter
          ? filteredProducts.filter((p) => p.sizes?.includes(selectedSizeFilter))
          : filteredProducts).length && (
          <div className="load-more">
            <button onClick={() => {
              setVisibleCount((prev) => prev + getPageSize())
              setTimeout(() => window.scrollBy({ top: 300, behavior: 'smooth' }), 100)
            }}>Ver mais</button>
          </div>
        )}
      </main>

      <CartDrawer open={openCart} onClose={() => setOpenCart(false)} />

      <div className={`side-menu ${openMenu ? 'open' : ''}`}>
        <button className="close-menu" onClick={() => setOpenMenu(false)}>✕</button>
        <nav className="menu-list">
          <button className="menu-link" onClick={() => { navigate(storePrefix); setOpenMenu(false) }}>Home</button>
          <button className="menu-link" onClick={() => { setOpenMenu(false); setTimeout(() => navigate(`${storePrefix}/produtos`), 150) }}>Todos os produtos</button>
          <button className="menu-link" onClick={() => { setVisibleCount(getPageSize()); setFilteredProducts(sortProductsByCategory(products.filter((p) => p.productSection === 'launch'))); setActiveFilter('launch'); setFilterLabel('Lançamentos'); setOpenMenu(false) }}>Lançamentos</button>
          <button className="menu-link" onClick={() => { setVisibleCount(getPageSize()); setFilteredProducts(sortProductsByCategory(products.filter((p) => p.productSection === 'bestseller'))); setActiveFilter('bestseller'); setFilterLabel('Mais vendidos'); setOpenMenu(false) }}>Mais vendidos</button>
          <button className="menu-link" onClick={() => { setVisibleCount(getPageSize()); setFilteredProducts(sortProductsByCategory(products.filter((p) => p.productSection === 'outlet'))); setActiveFilter('outlet'); setFilterLabel('Outlet'); setOpenMenu(false) }}>Outlet</button>

          {store.menu?.showBrands && (
            <>
              <button className="menu-link" onClick={() => setOpenBrands(!openBrands)}>
                <span>{store.menu?.brandsLabel || 'Marcas'}</span><span>›</span>
              </button>
              {openBrands && (
                <div className="submenu">
                  {brands.map((brand) => (
                    <button key={brand} onClick={() => { setVisibleCount(getPageSize()); setFilteredProducts(sortProductsByCategory(products.filter((p) => p.brand === brand))); setActiveFilter('brand'); setFilterLabel(`${store.menu?.brandsLabel || 'Marcas'} > ${brand}`); setOpenMenu(false) }}>{brand}</button>
                  ))}
                </div>
              )}
            </>
          )}

          {store.menu?.showCategories !== false && (
            <>
              <button className="menu-link" onClick={() => setOpenCategories(!openCategories)}>
                <span>{store.menu?.categoriesLabel || 'Peças'}</span><span>›</span>
              </button>
              {openCategories && (
                <div className="submenu">
                  {categories.map((cat) => (
                    <button key={cat} onClick={() => { setVisibleCount(getPageSize()); setFilteredProducts(sortProductsByCategory(products.filter((p) => p.category === cat))); setActiveFilter('category'); setFilterLabel(`${store.menu?.categoriesLabel || 'Peças'} > ${cat}`); setOpenMenu(false) }}>{cat}</button>
                  ))}
                </div>
              )}
            </>
          )}
        </nav>
      </div>

      {openMenu && <div className="menu-overlay" onClick={() => setOpenMenu(false)} />}
    </div>
  )
}

export default Products