import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { doc, getDoc, getDocs, collection, query, where } from 'firebase/firestore'
import { db } from '../services/firebase'
import { useCart } from '../context/CartContext'
import CartDrawer from '../components/CartDrawer'
import cartIcon from '../assets/cart.png'
import Toast from '../components/Toast'
import useStore from '../hooks/useStore'
import useStoreTheme from '../hooks/useStoreTheme'

function getSizesWithStock(product, variation) {
  const sizes = variation?.sizes || product.sizes || []
  const sizeStocks = variation?.sizeStocks || product.sizeStocks
  if (!sizeStocks || Object.keys(sizeStocks).length === 0) return sizes
  return sizes.filter((size) => Number(sizeStocks[size] || 0) > 0)
}

function sizeHasStock(product, variation, size) {
  const sizeStocks = variation?.sizeStocks || product.sizeStocks
  if (!sizeStocks || Object.keys(sizeStocks).length === 0) return true
  return Number(sizeStocks[size] || 0) > 0
}

function ProductDetails() {
  const navigate = useNavigate()
  const { cart, addToCart, vendedorSlug } = useCart()
  const { id } = useParams()
  const { store, loading: storeLoading, storeSlug } = useStore()

  useStoreTheme(store)

  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedImage, setSelectedImage] = useState('')
  const [selectedSize, setSelectedSize] = useState('')
  const [selectedVariation, setSelectedVariation] = useState(null)
  const [openCart, setOpenCart] = useState(false)
  const [added, setAdded] = useState(false)
  const [toast, setToast] = useState({ message: '', type: 'success' })
  const [vendedorPhone, setVendedorPhone] = useState(null)

  const cartQuantity = cart.reduce((acc, item) => acc + item.quantity, 0)

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast({ message: '', type: 'success' }), 2500)
  }

  // Busca o WhatsApp do vendedor ativo
  useEffect(() => {
    if (!vendedorSlug || !storeSlug) return
    async function loadVendedor() {
      try {
        const snapshot = await getDocs(
          query(collection(db, 'stores', storeSlug, 'vendedores'), where('slug', '==', vendedorSlug))
        )
        if (!snapshot.empty) setVendedorPhone(snapshot.docs[0].data().whatsapp)
      } catch { /* usa número da loja como fallback */ }
    }
    loadVendedor()
  }, [vendedorSlug, storeSlug])

  useEffect(() => {
    if (product) document.title = `${product.name} | ${store.name}`
  }, [product, store])

  useEffect(() => {
    async function loadProduct() {
      try {
        setLoading(true)
        const productRef = doc(db, 'stores', storeSlug, 'products', id)
        const productSnap = await getDoc(productRef)
        if (productSnap.exists()) {
          const data = { id: productSnap.id, ...productSnap.data() }
          const productImages = data.images?.length > 0
            ? data.images : [data.image, data.image2].filter(Boolean)
          setProduct(data)
          setSelectedImage(productImages[0] || '')
          setSelectedVariation(null)
          setSelectedSize('')
        } else { setProduct(null) }
      } catch (error) { console.error(error); setProduct(null) }
      finally { setLoading(false) }
    }
    loadProduct()
  }, [storeSlug, id])

  if (storeLoading || !store) return null

  if (store.active === false) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', flexDirection: 'column', gap: '16px',
        background: store.colors?.background || '#fff', color: store.colors?.text || '#111',
        padding: '24px', textAlign: 'center' }}>
        <img src={store.logo} alt={store.name} style={{ width: '120px', objectFit: 'contain' }} />
        <h1 style={{ fontSize: '28px', margin: 0 }}>Loja temporariamente indisponível</h1>
        <p style={{ maxWidth: '420px', opacity: 0.7, lineHeight: 1.6 }}>
          Esta loja está desativada no momento. Tente novamente mais tarde.
        </p>
      </main>
    )
  }

  if (loading) return <main className="container product-loading"><p>Carregando produto...</p></main>
  if (!product) return <main className="container product-empty"><h2>Produto não encontrado</h2></main>

  const productImages = product.images?.length > 0
    ? product.images : [product.image, product.image2].filter(Boolean)

  const formattedPrice = Number(product.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const availableSizes = getSizesWithStock(product, selectedVariation)
  const allSizes = selectedVariation?.sizes || product.sizes || []
  const outOfStockSizes = allSizes.filter((size) => !availableSizes.includes(size))

  const selectedColor = selectedVariation?.colorName || product.mainColor || '-'

  // ✅ Usa número do vendedor se disponível, senão usa o da loja
  const phone = vendedorPhone || String(store.whatsapp || '').replace(/\D/g, '')

  const whatsappMessage = `${store.checkout?.messageIntro || 'Olá! Tenho interesse nesse produto:'}

Produto: ${product.name}
Preço: ${formattedPrice}
Cor: ${selectedColor}
Tamanho: ${selectedSize || '-'}`

  const whatsappLink = `https://wa.me/${phone}?text=${encodeURIComponent(whatsappMessage)}`

  return (
    <>
      <header className="details-header full-details-header">
        <button className="details-back-button" onClick={() => navigate(-1)}>← Voltar</button>
        <button className="details-cart-button" onClick={() => setOpenCart(true)}>
          <img src={cartIcon} alt="Carrinho" className="cart-icon" />
          {cartQuantity > 0 && <span className="cart-badge">{cartQuantity}</span>}
        </button>
      </header>

      <main className="product-details fade-in">
        <section className="product-gallery">
          <div style={{ position: 'relative' }}>
            <img src={selectedImage || productImages[0]} alt={product.name} className="main-product-image" />
            {product.productSection === 'outlet' && product.oldPrice && (
              <span className="discount-badge">
                {Math.round((1 - product.price / product.oldPrice) * 100)}%
              </span>
            )}
          </div>
          <div className="thumbs">
            {productImages.map((image, index) => (
              <img key={index} src={image} alt={product.name} loading="lazy"
                onClick={() => { setSelectedImage(image); setSelectedVariation(null); setSelectedSize('') }} />
            ))}
            {product.variations?.map((variation, index) => (
              <img key={index} src={variation.image} alt={variation.colorName} loading="lazy"
                onClick={() => { setSelectedVariation(variation); setSelectedImage(variation.image); setSelectedSize('') }} />
            ))}
          </div>
        </section>

        <section className="product-content">
          <h1>{product.name}</h1>
          <div className="product-price-box">
            {product.productSection === 'outlet' && product.oldPrice && (
              <span className="product-old-price">
                {Number(product.oldPrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            )}
            <strong className="product-current-price">{formattedPrice}</strong>
          </div>

          <div className="product-description">
            <h3>Descrição</h3>
            <p>{product.description || 'Sem descrição cadastrada.'}</p>
          </div>

          {(product.mainColor || product.variations?.length > 0) && (
            <div className="product-colors">
              <h3>Cores disponíveis</h3>
              <div className="size-options">
                {product.mainColor && (
                  <button className={!selectedVariation ? 'selected' : ''}
                    onClick={() => { setSelectedVariation(null); setSelectedImage(productImages[0]); setSelectedSize('') }}>
                    {product.mainColor}
                  </button>
                )}
                {product.variations?.map((variation, index) => (
                  <button key={index}
                    className={selectedVariation?.colorName === variation.colorName ? 'selected' : ''}
                    onClick={() => { setSelectedVariation(variation); setSelectedImage(variation.image); setSelectedSize('') }}>
                    {variation.colorName}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="product-sizes">
            <h3>Tamanhos disponíveis</h3>
            <div className="size-options">
              {availableSizes.map((size) => (
                <button key={size} className={selectedSize === size ? 'selected' : ''}
                  onClick={() => setSelectedSize(size)}>{size}</button>
              ))}
              {outOfStockSizes.map((size) => (
                <button key={size} disabled
                  style={{ opacity: 0.35, cursor: 'not-allowed', textDecoration: 'line-through' }}>
                  {size}
                </button>
              ))}
            </div>
            {outOfStockSizes.length > 0 && (
              <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '6px' }}>
                Tamanhos riscados estão esgotados
              </p>
            )}
          </div>

          <div className="product-actions">
            <button
              className={`add-cart-button ${added ? 'added' : ''}`}
              disabled={!product.available || availableSizes.length === 0}
              onClick={() => {
                if (!product.available || availableSizes.length === 0) { showToast('Produto indisponível', 'warning'); return }
                if (!selectedSize) { showToast('Selecione um tamanho', 'warning'); return }
                if (!sizeHasStock(product, selectedVariation, selectedSize)) { showToast('Este tamanho está esgotado', 'warning'); return }
                if (product.variations?.length > 0 && !selectedVariation && !product.mainColor) { showToast('Selecione uma cor', 'warning'); return }
                addToCart({
                  ...product,
                  image: selectedImage || productImages[0],
                  selectedSize,
                  selectedColor: selectedVariation?.colorName || product.mainColor || '',
                  price: product.price,
                })
                setAdded(true)
                showToast('Produto adicionado ao carrinho', 'success')
                setTimeout(() => setAdded(false), 1000)
              }}
            >
              {!product.available || availableSizes.length === 0 ? 'Indisponível' : added ? '✔ Adicionado' : 'Adicionar'}
            </button>

            {product.available && availableSizes.length > 0 && (
              <button className="whatsapp-button" onClick={() => { window.location.href = whatsappLink }}>
                Comprar pelo WhatsApp
              </button>
            )}
          </div>
        </section>
      </main>

      <CartDrawer open={openCart} onClose={() => setOpenCart(false)} />
      <Toast message={toast.message} type={toast.type} />
    </>
  )
}

export default ProductDetails