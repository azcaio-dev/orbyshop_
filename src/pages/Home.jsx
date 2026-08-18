import { useCart } from '../context/CartContext'
import { useEffect, useState } from 'react'
import CartDrawer from '../components/CartDrawer'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../services/firebase'
import cartIcon from '../assets/cart.png'
import menuIcon from '../assets/menu.png'
import lupaIcon from '../assets/lupa.png'
import SearchPanel from '../components/SearchPanel'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import useStore from '../hooks/useStore'
import useStoreTheme from '../hooks/useStoreTheme'
import SobreNos from '../components/SobreNos'
import ReviewsCarousel from '../components/ReviewsCarousel'

// ✅ Formata a forma de pagamento pra exibição
function formatPaymentMethod(paymentMethod) {
  if (!paymentMethod || paymentMethod === 'vista') return 'À vista'
  return `${paymentMethod} sem juros`
}

function Home() {
  const { cart, addToCart } = useCart()
  const navigate = useNavigate()
 const { store, loading: storeLoading, storeSlug } = useStore()

const storePrefix = `/${storeSlug}`
  useStoreTheme(store)

  const [openCart, setOpenCart] = useState(false)
  const [openMenu, setOpenMenu] = useState(false)
  const [products, setProducts] = useState([])
  const [filteredProducts, setFilteredProducts] = useState([])
  const [addedId, setAddedId] = useState(null)
  const [banners, setBanners] = useState([])
  const [currentBanner, setCurrentBanner] = useState(0)
  const [openBrands, setOpenBrands] = useState(false)
  const [openCategories, setOpenCategories] = useState(false)
  const [activeFilter, setActiveFilter] = useState(null)
  const [scrolled, setScrolled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [filterLabel, setFilterLabel] = useState('')
  const [openSearch, setOpenSearch] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [selectedSize, setSelectedSize] = useState('')

  const cartQuantity = cart.reduce((acc, item) => acc + item.quantity, 0)

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 20)
    }

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
    async function loadProducts() {
      try {
        setLoading(true)

        const snapshot = await getDocs(
          collection(db, 'stores', storeSlug, 'products')
        )

        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))

        setProducts(data)
        setFilteredProducts(data)
      } catch (error) {
        console.error('Erro ao carregar produtos:', error)
      } finally {
        setLoading(false)
      }
    }

    loadProducts()
  }, [storeSlug])

  useEffect(() => {
    async function loadBanners() {
      try {
        const snapshot = await getDocs(
          collection(db, 'stores', storeSlug, 'banners')
        )

        const data = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .filter((banner) => banner.active)

        setBanners(data)
        setCurrentBanner(0)
      } catch (error) {
        console.error('Erro ao carregar banners:', error)
      }
    }

    loadBanners()
  }, [storeSlug])

    useEffect(() => {
      if (banners.length <= 1) return

      const interval = setInterval(() => {
        setCurrentBanner((prev) =>
          prev === banners.length - 1 ? 0 : prev + 1
        )
      }, 4000)

      return () => clearInterval(interval)
    }, [banners])

  const brands = [...new Set(products.map((p) => p.brand).filter(Boolean))]
  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))]

  const launchProducts = products.filter(
    (product) => product.productSection === 'launch' && product.available
  )

  const bestsellers = products.filter(
    (product) => product.productSection === 'bestseller' && product.available
  )

  const outlet = products.filter(
    (product) => product.productSection === 'outlet' && product.available
  )

  function goToProduct(productId) {
    navigate(`${storePrefix}/produto/${productId}`)
  }

  function resetHome() {
    setFilteredProducts(products)
    setActiveFilter(null)
    setFilterLabel('')
    setSearchTerm('')
    setOpenSearch(false)
    setOpenMenu(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    navigate(storePrefix)
  }

  if (storeLoading || !store) {
    return null
  }

  if (store.active === false) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '16px',
          background: store.colors?.background || '#fff',
          color: store.colors?.text || '#111',
          padding: '24px',
          textAlign: 'center',
        }}
      >
        <img
          src={store.logo}
          alt={store.name}
          style={{
            width: '120px',
            objectFit: 'contain',
          }}
        />

        <h1
          style={{
            fontSize: '28px',
            margin: 0,
          }}
        >
          Loja temporariamente indisponível
        </h1>

        <p
          style={{
            maxWidth: '420px',
            opacity: 0.7,
            lineHeight: 1.6,
          }}
        >
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

          <button
            className="search-button"
            onClick={() => setOpenSearch(!openSearch)}
          >
            <img src={lupaIcon} alt="Buscar" className="search-icon" />
          </button>
        </div>

        <div className="header-center">
          <img
            src={store.logo}
            alt={store.name}
            className="logo"
            onClick={resetHome}
          />
        </div>

        <div className="header-right">
          <button className="cart-button" onClick={() => setOpenCart(true)}>
            <img src={cartIcon} alt="Carrinho" className="cart-icon" />

            {cartQuantity > 0 && (
              <span className="cart-badge">{cartQuantity}</span>
            )}
          </button>
        </div>
      </header>

      <SearchPanel
        openSearch={openSearch}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        products={products}
        setFilteredProducts={setFilteredProducts}
        setActiveFilter={setActiveFilter}
        setFilterLabel={setFilterLabel}
      />
      <div className="page-content">
      {!activeFilter && banners.length > 0 && (
          <section className="banner-carousel fade-in">
            <div className="banner-track">
              {banners.map((banner, index) => (
                <div
                  className={`banner-slide ${index === currentBanner ? 'active' : ''}`}
                  key={banner.id}
                  onClick={() => {
                    if (!banner.redirectValue) return

                    if (banner.redirectValue === 'all') {
                      navigate(`${storePrefix}/produtos`)
                      return
                    }

                    navigate(
                      `${storePrefix}/produtos?section=${banner.redirectValue}`
                    )
                  }}
                  style={{
                    cursor: banner.redirectValue ? 'pointer' : 'default',
                  }}
                >
                  <picture>
                    {banner.imageDesktop && (
                      <source
                        media="(min-width: 1024px)"
                        srcSet={banner.imageDesktop}
                      />
                    )}
                    <img
                      src={banner.image}
                      alt={`Banner ${store.name}`}
                      className="banner-image"
                    />
                  </picture>
                </div>
              ))}
            </div>

            {banners.length > 1 && (
              <div className="banner-dots">
                {banners.map((banner, index) => (
                  <button
                    key={banner.id}
                    className={index === currentBanner ? 'active' : ''}
                    onClick={() => setCurrentBanner(index)}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
      
      <main className="container">
        <div className={openSearch ? 'search-open' : ''}></div>

        {loading && (
          <section className="launch-section">
            <h2>Carregando produtos...</h2>

            <div className="launch-list">
              {[1, 2, 3].map((i) => (
                <div key={i} className="launch-card skeleton-card"></div>
              ))}
            </div>
          </section>
        )}

        {!loading && !activeFilter && bestsellers.length > 0 && (
          <section className="launch-section fade-in">
            <h2>Mais vendidos</h2>

            <div className="horizontal-wrapper">
              <div className="launch-list">
                {bestsellers.slice(0, 6).map((product) => (
                  <article
                    key={product.id}
                    className="launch-card"
                    onClick={() => goToProduct(product.id)}
                  >
                    <img 
                      src={product.images?.[0] || product.image}
                      alt={product.name} 
                      loading="lazy" />

                    <div>
                      <h3>{product.name}</h3>
                      <div className="price-row">
                        <p>
                          {Number(product.price).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </p>
                        <span className="payment-method">{formatPaymentMethod(product.paymentMethod)}</span>
                      </div>
                    </div>
                  </article>
                ))}

                {bestsellers.length > 6 && (
                  <article
                    className="see-more-card"
                    onClick={() => {
                      setFilteredProducts(
                        products.filter((p) => p.productSection === 'bestseller')
                      )
                      setActiveFilter('bestseller')
                      setFilterLabel('Mais vendidos')
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                  >
                    <span className="see-more-arrow">›</span>
                  </article>
                )}
              </div>
            </div>
          </section>
        )}

        {!loading && !activeFilter && launchProducts.length > 0 && (
          <section className="launch-section fade-in">
            <h2>Lançamentos</h2>

            <div className="horizontal-wrapper">
              <div className="launch-list">
                {launchProducts.slice(0, 6).map((product) => (
                  <article
                    key={product.id}
                    className="launch-card"
                    onClick={() => goToProduct(product.id)}
                  >
                    <img src={product.images?.[0] || product.image}
                    alt={product.name} />

                    <div>
                      <h3>{product.name}</h3>
                      <div className="price-row">
                        <p>
                          {Number(product.price).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </p>
                        <span className="payment-method">{formatPaymentMethod(product.paymentMethod)}</span>
                      </div>
                    </div>
                  </article>
                ))}

                {launchProducts.length > 6 && (
                  <article
                    className="see-more-card"
                    onClick={() => {
                      setFilteredProducts(
                        products.filter((p) => p.productSection === 'launch')
                      )
                      setActiveFilter('launch')
                      setFilterLabel('Lançamentos')
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                  >
                    <span className="see-more-arrow">›</span>
                  </article>
                )}
              </div>
            </div>
          </section>
        )}

        {!loading && !activeFilter && outlet.length > 0 && (
          <section className="launch-section fade-in">
            <h2>Outlet</h2>

            <div className="horizontal-wrapper">
              <div className="launch-list">
                {outlet.slice(0, 6).map((product) => (
                  <article
                    key={product.id}
                    className="launch-card"
                    style={{ position: 'relative' }}
                    onClick={() => goToProduct(product.id)}
                  >
                    <img src={product.images?.[0] || product.image}
                    alt={product.name} />

                    {product.oldPrice && (
                      <span className="discount-badge">
                        {Math.round((1 - product.price / product.oldPrice) * 100)}%
                      </span>
                    )}

                    <div>
                      <h3>{product.name}</h3>

                      <div className="price-row">
                        <div className="price-box">
                          {product.oldPrice && (
                            <span className="old-price">
                              {Number(product.oldPrice).toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </span>
                          )}

                          <strong className="current-price">
                            {Number(product.price).toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </strong>
                        </div>
                        <span className="payment-method">{formatPaymentMethod(product.paymentMethod)}</span>
                      </div>
                    </div>
                  </article>
                ))}

                {outlet.length > 6 && (
                  <article
                    className="see-more-card"
                    onClick={() => {
                      setFilteredProducts(
                        products.filter((p) => p.productSection === 'outlet')
                      )
                      setActiveFilter('outlet')
                      setFilterLabel('Outlet')
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                  >
                    <span className="see-more-arrow">›</span>
                  </article>
                )}
              </div>
            </div>
          </section>
        )}

        {activeFilter ? (
          <>
            <h2 className="section-title">
              {filterLabel || 'Resultados'}
            </h2>

            <section className="products-grid fade-in">
              {filteredProducts.length > 0 ? (
                filteredProducts.map((product) => (
                  <article
                    className={`product-card ${!product.available ? 'unavailable' : ''}`}
                    key={product.id}
                    onClick={() => goToProduct(product.id)}
                  >
                    <div className="product-image-wrapper">
                      <img
                        src={product.images?.[0] || product.image}
                        alt={product.name}
                        className="product-image"
                        loading='lazy'
                      />

                      {!product.available && (
                        <span className="unavailable-badge">Indisponível</span>
                      )}

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
                              {Number(product.oldPrice).toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </span>

                            <strong className="current-price">
                              {Number(product.price).toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </strong>
                          </div>
                        ) : (
                          <p>
                            {Number(product.price).toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </p>
                        )}
                        <span className="payment-method">{formatPaymentMethod(product.paymentMethod)}</span>
                      </div>
                    </div>

                    {activeFilter !== 'search' && (
                      <button
                        className={`add-cart-button ${
                          addedId === product.id ? 'added' : ''
                        }`}
                        disabled={product.available === false}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (!product.available) return

                          setSelectedProduct(product)
                          setSelectedSize('')
                        }}
                      >
                        {!product.available
                          ? 'Indisponível'
                          : addedId === product.id
                          ? '✔ Adicionado'
                          : '+ Carrinho'}
                      </button>
                    )}
                  </article>
                ))
              ) : (
                <div className="empty-products">
                  <p>Nenhum produto encontrado.</p>
                </div>
              )}
            </section>
          </>
        ) : (
          !loading && (
            <div className="view-all-wrapper fade-in">
              <button
                className="view-all-products"
                onClick={() => {
                  navigate(`${storePrefix}/produtos`)

                  setTimeout(() => {
                    window.scrollTo(0, 0)
                  }, 100)
                }}
              >
                Ver todos os produtos
              </button>

              <section className="trust-section">
                <div className="trust-grid">
                  <div className="trust-item">
                    <div className="trust-icon">
                      <img src="/escudo.png" alt="" />
                    </div>
                    <p className="trust-label">Compra segura</p>
                    <p className="trust-desc">Seus dados protegidos</p>
                  </div>

                  <div className="trust-item">
                    <div className="trust-icon">
                      <img src="/whatsapp.png" alt="" />
                    </div>
                    <p className="trust-label">Compre pelo Whatsapp</p>
                    <p className="trust-desc">Você pode comprar pelo Whatsapp</p>
                  </div>

                  <div className="trust-item">
                    <div className="trust-icon">
                      <img src="/entrega-rapida.png" alt="" />
                    </div>
                    <p className="trust-label">Entrega rápida</p>
                    <p className="trust-desc">Entregamos em todo o Brasil</p>
                  </div>

                  <div className="trust-item">
                    <div className="trust-icon">
                      <img src="/forma-de-pagamento.png" alt="" />
                    </div>
                      <p className="trust-label">Pagamento facilitado</p>
                      <p className="trust-desc">Pix e cartão disponível</p>
                  </div>
                </div>
              </section>
            </div>
          )
        )}

        {selectedProduct &&
          createPortal(
            <div
              className="size-modal-overlay"
              onClick={() => setSelectedProduct(null)}
            >
              <div
                className="size-modal"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="size-modal-close"
                  onClick={() => setSelectedProduct(null)}
                >
                  ✕
                </button>

                <h3>Escolha o tamanho</h3>
                <p>{selectedProduct.name}</p>

                <div className="size-modal-options">
                  {selectedProduct.sizes?.map((size) => (
                    <button
                      key={size}
                      className={selectedSize === size ? 'selected' : ''}
                      onClick={() => setSelectedSize(size)}
                    >
                      {size}
                    </button>
                  ))}
                </div>

                <button
                  className={`size-modal-confirm ${
                    addedId === selectedProduct?.id ? 'added' : ''
                  }`}
                  disabled={!selectedSize}
                  onClick={() => {
                    addToCart({
                      ...selectedProduct,
                      selectedSize,
                    })

                    setAddedId(selectedProduct.id)

                    setTimeout(() => {
                      setAddedId(null)
                      setSelectedProduct(null)
                      setSelectedSize('')
                    }, 800)
                  }}
                >
                  {addedId === selectedProduct?.id
                    ? '✔ Adicionado'
                    : 'Adicionar ao carrinho'}
                </button>
              </div>
            </div>,
            document.body
          )}
      </main>

      {!activeFilter && !loading && <SobreNos store={store} />}
      {!activeFilter && !loading && (
        <ReviewsCarousel store={store} storeSlug={storeSlug} />
      )}

      <CartDrawer open={openCart} onClose={() => setOpenCart(false)} />

      <div className={`side-menu ${openMenu ? 'open' : ''}`}>
        <button className="close-menu" onClick={() => setOpenMenu(false)}>
          ✕
        </button>

        <nav className="menu-list">
          <button className="menu-link" onClick={resetHome}>
            Home
          </button>

          <button
            className="menu-link"
            onClick={() => navigate(`${storePrefix}/produtos`)}
          >
            Todos os produtos
          </button>

          <button
            className="menu-link"
            onClick={() => {
              const filtered = products.filter(
                (p) => p.productSection === 'launch'
              )

              setFilteredProducts(filtered)
              setActiveFilter('launch')
              setFilterLabel('Lançamentos')
              setOpenMenu(false)
            }}
          >
            Lançamentos
          </button>

          <button
            className="menu-link"
            onClick={() => {
              const filtered = products.filter(
                (p) => p.productSection === 'bestseller'
              )

              setFilteredProducts(filtered)
              setActiveFilter('bestseller')
              setFilterLabel('Mais vendidos')
              setOpenMenu(false)
            }}
          >
            Mais vendidos
          </button>

          <button
            className="menu-link"
            onClick={() => {
              const filtered = products.filter(
                (p) => p.productSection === 'outlet'
              )

              setFilteredProducts(filtered)
              setActiveFilter('outlet')
              setFilterLabel('Outlet')
              setOpenMenu(false)
            }}
          >
            Outlet
          </button>

          {store.menu?.showBrands && (
            <button
              className="menu-link"
              onClick={() => setOpenBrands(!openBrands)}
            >
              <span>{store.menu?.brandsLabel || 'Marcas'}</span>
              <span>›</span>
            </button>
          )}

          {store.menu?.showBrands && openBrands && (
            <div className="submenu">
              {brands.map((brand) => (
                <button
                  key={brand}
                  onClick={() => {
                    const filtered = products.filter(
                      (p) => p.brand === brand
                    )

                    setFilteredProducts(filtered)
                    setActiveFilter('brand')
                    setFilterLabel(`Marca > ${brand}`)
                    setOpenMenu(false)
                  }}
                >
                  {brand}
                </button>
              ))}
            </div>
          )}

          <button
            className="menu-link"
            onClick={() => setOpenCategories(!openCategories)}
          >
            <span>{store.menu?.categoriesLabel || 'Peças'}</span>
            <span>›</span>
          </button>

          {openCategories && (
            <div className="submenu">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    const filtered = products.filter(
                      (p) => p.category === cat
                    )

                    setFilteredProducts(filtered)
                    setActiveFilter('category')
                    setFilterLabel(`${store.menu?.categoriesLabel || 'Peças'} > ${cat}`)
                    setOpenMenu(false)
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </nav>
      </div>

      {openMenu && (
        <div className="menu-overlay" onClick={() => setOpenMenu(false)}></div>
      )}
    </div>
  )
}

export default Home