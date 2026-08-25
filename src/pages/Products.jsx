import cartIcon from '../assets/cart.png'
import menuIcon from '../assets/menu.png'
import { useEffect, useState, useCallback } from 'react'
import { collection, getDocs, query, where, orderBy, limit, startAfter } from 'firebase/firestore'
import { db } from '../services/firebase'
import CartDrawer from '../components/CartDrawer'
import { useCart } from '../context/CartContext'
import { createPortal } from 'react-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import lupaIcon from '../assets/lupa.png'
import SearchPanel from '../components/SearchPanel'
import useStore from '../hooks/useStore'
import useStoreTheme from '../hooks/useStoreTheme'
import LoadingScreen from '../components/LoadingScreen'

const sectionLabels = {
  launch: 'Lançamentos',
  bestseller: 'Mais vendidos',
  outlet: 'Outlet',
}

// No desktop a grade é de 4 colunas, então carrega de 12 em 12
// (múltiplo de 4, sem deixar linha incompleta). No mobile é 2 colunas, 10 em 10.
function getPageSize() {
  if (typeof window === 'undefined') return 10
  return window.innerWidth >= 1024 ? 12 : 10
}

// Verifica se um produto tem pelo menos um tamanho com estoque > 0
function hasAnyStock(product) {
  if (!product.available) return false
  if (!product.sizeStocks && (!product.variations || product.variations.length === 0)) {
    return product.available
  }
  const mainStock = Object.values(product.sizeStocks || {}).some((v) => Number(v) > 0)
  const variationStock = (product.variations || []).some((variation) =>
    Object.values(variation.sizeStocks || {}).some((v) => Number(v) > 0)
  )
  return mainStock || variationStock
}

// Retorna os tamanhos com estoque > 0 para um produto (na variação principal)
function getSizesWithStock(product) {
  const sizes = product.sizes || []
  if (!product.sizeStocks) return sizes
  return sizes.filter((size) => Number(product.sizeStocks[size] || 0) > 0)
}

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

  // Produtos paginados (o que realmente aparece na grade)
  const PAGE_SIZE = getPageSize()
  const [filteredProducts, setFilteredProducts] = useState([])
  const [lastDoc, setLastDoc] = useState(null)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const [addedId, setAddedId] = useState(null)
  const [openCart, setOpenCart] = useState(false)
  const [openMenu, setOpenMenu] = useState(false)
  const [openBrands, setOpenBrands] = useState(false)
  const [openCategories, setOpenCategories] = useState(false)

  // activeFilter: null | 'launch' | 'bestseller' | 'outlet' | 'brand' | 'category' | 'search'
  const [activeFilter, setActiveFilter] = useState(section && sectionLabels[section] ? section : null)
  const [filterValue, setFilterValue] = useState(null) // valor da marca/categoria escolhida
  const [filterLabel, setFilterLabel] = useState(section && sectionLabels[section] ? sectionLabels[section] : '')

  const [selectedProduct, setSelectedProduct] = useState(null)
  const [selectedSize, setSelectedSize] = useState('')
  const [openSearch, setOpenSearch] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSizeFilter, setSelectedSizeFilter] = useState(sizeParam || null)
  const [openFilters, setOpenFilters] = useState(false)

  // Facetas (marcas, categorias, tamanhos) — buscadas sob demanda, uma vez só,
  // quando o cliente abre o menu/filtro correspondente. Não bloqueiam o
  // carregamento inicial da página.
  const [brands, setBrands] = useState([])
  const [categories, setCategories] = useState([])
  const [allSizes, setAllSizes] = useState([])
  const [facetsLoaded, setFacetsLoaded] = useState(false)
  const [facetsLoading, setFacetsLoading] = useState(false)

  const cartQuantity = cart.reduce((acc, item) => acc + item.quantity, 0)

  // Salva logo/cores em cache leve pra próxima tela de carregamento
  useEffect(() => {
    if (!store || !storeSlug) return
    try {
      sessionStorage.setItem(
        `orby-store-cache:${storeSlug}`,
        JSON.stringify({ logo: store.logo, name: store.name, colors: store.colors })
      )
    } catch {
      // sessionStorage indisponível — sem problema, só não cacheia
    }
  }, [store, storeSlug])

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
    setSelectedSizeFilter(sizeParam || null)
  }, [sizeParam])

  // ---------------------------------------------------------------------
  // Busca paginada real: monta a query de acordo com o filtro ativo e
  // pede só um lote (PAGE_SIZE) por vez, usando startAfter pra continuar
  // de onde parou. Nunca busca o catálogo inteiro.
  // ---------------------------------------------------------------------
  const buildQuery = useCallback((startAfterDoc) => {
    const baseRef = collection(db, 'stores', storeSlug, 'products')
    const constraints = []

    if (activeFilter === 'brand' && filterValue) {
      constraints.push(where('brand', '==', filterValue))
    } else if (activeFilter === 'category' && filterValue) {
      constraints.push(where('category', '==', filterValue))
    } else if (['launch', 'bestseller', 'outlet'].includes(activeFilter)) {
      constraints.push(where('productSection', '==', activeFilter))
    }

    // Disponíveis primeiro, indisponíveis por último — depois ordena por categoria/nome
    constraints.push(orderBy('available', 'desc'), orderBy('category'), orderBy('name'))
    if (startAfterDoc) constraints.push(startAfter(startAfterDoc))
    constraints.push(limit(PAGE_SIZE))

    return query(baseRef, ...constraints)
  }, [storeSlug, activeFilter, filterValue, PAGE_SIZE])

  const loadPage = useCallback(async (reset = false) => {
    try {
      if (reset) setLoading(true)
      else setLoadingMore(true)

      const q = buildQuery(reset ? null : lastDoc)
      const snapshot = await getDocs(q)
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))

      setFilteredProducts((prev) => (reset ? data : [...prev, ...data]))
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null)
      setHasMore(snapshot.docs.length === PAGE_SIZE)
    } catch (error) {
      console.error('Erro ao carregar produtos:', error)
      // Se a busca com filtro novo falhar, não deixa a lista antiga (de outro
      // filtro) enganando na tela — melhor mostrar "nenhum produto encontrado"
      // e deixar claro no console que algo deu errado (geralmente índice faltando).
      if (reset) {
        setFilteredProducts([])
        setHasMore(false)
      }
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [buildQuery, lastDoc, PAGE_SIZE])

  // Reseta e recarrega sempre que o filtro ativo mudar (seção, marca, categoria, ou nenhum)
  useEffect(() => {
    loadPage(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeSlug, activeFilter, filterValue])

  // ---------------------------------------------------------------------
  // Facetas (marcas / categorias / tamanhos) sob demanda.
  // Só busca o catálogo completo (uma vez, com cache em memória) quando o
  // cliente realmente abre o menu de filtros — não no carregamento inicial.
  // ---------------------------------------------------------------------
  async function loadFacetsIfNeeded() {
    if (facetsLoaded || facetsLoading) return
    try {
      setFacetsLoading(true)
      const snapshot = await getDocs(collection(db, 'stores', storeSlug, 'products'))
      const data = snapshot.docs.map((doc) => doc.data())

      setBrands([...new Set(data.map((p) => p.brand).filter(Boolean))])
      setCategories([...new Set(data.map((p) => p.category).filter(Boolean))])
      setAllSizes([...new Set(data.flatMap((p) => p.sizes || []))].sort())
      setFacetsLoaded(true)
    } catch (error) {
      console.error('Erro ao carregar filtros:', error)
    } finally {
      setFacetsLoading(false)
    }
  }

  function selectSection(sectionKey) {
    setActiveFilter(sectionKey)
    setFilterValue(null)
    setFilterLabel(sectionLabels[sectionKey])
    setOpenMenu(false)
  }

  function selectBrand(brand) {
    setActiveFilter('brand')
    setFilterValue(brand)
    setFilterLabel(`${store.menu?.brandsLabel || 'Marcas'} > ${brand}`)
    setOpenMenu(false)
  }

  function selectCategory(cat) {
    setActiveFilter('category')
    setFilterValue(cat)
    setFilterLabel(`${store.menu?.categoriesLabel || 'Peças'} > ${cat}`)
    setOpenMenu(false)
  }

  function clearFilter() {
    setActiveFilter(null)
    setFilterValue(null)
    setFilterLabel('')
  }

  if (storeLoading || !store) return <LoadingScreen store={store} storeSlug={storeSlug} />

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

  // Filtro de tamanho aplicado só sobre o lote já carregado (não sobre o catálogo inteiro).
  // Se o cliente filtrar por tamanho e a página atual tiver poucos resultados,
  // "Ver mais" ainda busca mais produtos do Firestore normalmente.
  const displayed = selectedSizeFilter
    ? filteredProducts.filter((p) => {
        if (!p.sizes?.includes(selectedSizeFilter)) return false
        if (!p.sizeStocks || Object.keys(p.sizeStocks).length === 0) return p.available
        return Number(p.sizeStocks[selectedSizeFilter] || 0) > 0
      })
    : filteredProducts

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

      {/* Nota: a busca por texto (SearchPanel) ainda depende de uma lista de
          produtos em memória — isso é uma limitação separada, fora do escopo
          da paginação. Ver observação no chat sobre isso. */}
      <SearchPanel openSearch={openSearch} searchTerm={searchTerm} setSearchTerm={setSearchTerm}
        products={filteredProducts} setFilteredProducts={setFilteredProducts}
        setActiveFilter={setActiveFilter} setFilterLabel={setFilterLabel} />

      <main className="container products-page fade-in">
        <h2 className="section-title">{activeFilter ? filterLabel : 'Todos os produtos'}</h2>

        <button
          className="filter-toggle-button"
          onClick={() => { setOpenFilters(!openFilters); loadFacetsIfNeeded() }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: '#fff',
            border: 'none', borderRadius: '999px', padding: '9px 18px', fontSize: '14px',
            fontWeight: '500', color: '#111', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.10)' }}>
          {openFilters
            ? <><span style={{ fontSize: '15px', lineHeight: 1 }}>✕</span> Fechar filtros</>
            : <><span style={{ fontSize: '16px', lineHeight: 1 }}>⇅</span> Filtrar</>}
        </button>

        {!activeFilter && openFilters && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', opacity: 0.6, marginRight: '4px' }}>Tamanho:</span>
            {facetsLoading && <span style={{ fontSize: '13px', opacity: 0.5 }}>Carregando...</span>}
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
          ) : displayed.length > 0 ? (
            displayed.map((product) => {
              const canAdd = hasAnyStock(product)

              return (
                <article
                  className={`product-card ${!canAdd ? 'unavailable' : ''}`}
                  key={product.id}
                  onClick={() => navigate(`${storePrefix}/produto/${product.id}`)}
                >
                  <div className="product-image-wrapper" style={{ position: 'relative' }}>
                    <img src={product.images?.[0] || product.image} alt={product.name} className="product-image" loading="lazy" />
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
          )}

          {selectedProduct && createPortal(
            <div className="size-modal-overlay" onClick={() => setSelectedProduct(null)}>
              <div className="size-modal" onClick={(e) => e.stopPropagation()}>
                <button className="size-modal-close" onClick={() => setSelectedProduct(null)}>✕</button>
                <h3>Escolha o tamanho</h3>
                <p>{selectedProduct.name}</p>

                <div className="size-modal-options">
                  {getSizesWithStock(selectedProduct).map((size) => (
                    <button key={size}
                      className={selectedSize === size ? 'selected' : ''}
                      onClick={() => setSelectedSize(size)}>
                      {size}
                    </button>
                  ))}
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

        {hasMore && !loading && (
          <div className="load-more">
            <button disabled={loadingMore} onClick={() => {
              loadPage(false)
              setTimeout(() => window.scrollBy({ top: 300, behavior: 'smooth' }), 100)
            }}>
              {loadingMore ? 'Carregando...' : 'Ver mais'}
            </button>
          </div>
        )}
      </main>

      <CartDrawer open={openCart} onClose={() => setOpenCart(false)} />

      <div className={`side-menu ${openMenu ? 'open' : ''}`}>
        <button className="close-menu" onClick={() => setOpenMenu(false)}>✕</button>
        <nav className="menu-list">
          <button className="menu-link" onClick={() => { navigate(storePrefix); setOpenMenu(false) }}>Home</button>
          <button className="menu-link" onClick={() => { clearFilter(); setOpenMenu(false) }}>Todos os produtos</button>
          <button className="menu-link" onClick={() => selectSection('launch')}>Lançamentos</button>
          <button className="menu-link" onClick={() => selectSection('bestseller')}>Mais vendidos</button>
          <button className="menu-link" onClick={() => selectSection('outlet')}>Outlet</button>

          {store.menu?.showBrands && (
            <>
              <button className="menu-link" onClick={() => { setOpenBrands(!openBrands); loadFacetsIfNeeded() }}>
                <span>{store.menu?.brandsLabel || 'Marcas'}</span><span>›</span>
              </button>
              {openBrands && (
                <div className="submenu">
                  {facetsLoading && <span style={{ fontSize: '13px', opacity: 0.5, padding: '4px 12px' }}>Carregando...</span>}
                  {brands.map((brand) => (
                    <button key={brand} onClick={() => selectBrand(brand)}>{brand}</button>
                  ))}
                </div>
              )}
            </>
          )}

          {store.menu?.showCategories !== false && (
            <>
              <button className="menu-link" onClick={() => { setOpenCategories(!openCategories); loadFacetsIfNeeded() }}>
                <span>{store.menu?.categoriesLabel || 'Peças'}</span><span>›</span>
              </button>
              {openCategories && (
                <div className="submenu">
                  {facetsLoading && <span style={{ fontSize: '13px', opacity: 0.5, padding: '4px 12px' }}>Carregando...</span>}
                  {categories.map((cat) => (
                    <button key={cat} onClick={() => selectCategory(cat)}>{cat}</button>
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