import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { doc, getDoc, getDocs, collection, query, where } from 'firebase/firestore'
import { db } from '../services/firebase'
import { useCart } from '../context/CartContext'
import { createOrderSnapshot } from '../services/orders'
import CartDrawer from '../components/CartDrawer'
import cartIcon from '../assets/cart.png'
import Toast from '../components/Toast'
import useStore from '../hooks/useStore'
import useStoreTheme from '../hooks/useStoreTheme'
import LoadingScreen from '../components/LoadingScreen'

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

// ✅ Formata a forma de pagamento pra exibição (fallback quando não há PIX nem parcelamento configurados)
function formatPaymentMethod(paymentMethod) {
  if (!paymentMethod || paymentMethod === 'vista') return 'À vista'
  return `${paymentMethod} sem juros`
}

// ✅ Preço no PIX: só existe para produtos parcelados (Nx sem juros).
// Produto à vista nunca mostra a linha de PIX — o price já é o valor final.
// Valor manual do produto vence, senão calcula pelo desconto padrão da loja.
function getPixPrice(product, storePaymentInfo) {
  if (!product.paymentMethod || product.paymentMethod === 'vista') return null
  if (product.pixPrice != null) return Number(product.pixPrice)
  if (storePaymentInfo?.pixDiscountPercent > 0) {
    return Number(product.price) * (1 - storePaymentInfo.pixDiscountPercent / 100)
  }
  return null
}

// ✅ Parcelamento: reaproveita o paymentMethod ('vista' | '2x'...'10x') já existente
function getInstallmentInfo(product) {
  if (!product.paymentMethod || product.paymentMethod === 'vista') return null
  const count = parseInt(product.paymentMethod, 10)
  if (!count) return null
  return { count, value: Number(product.price) / count }
}

function formatBRL(value) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
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
  const [comprando, setComprando] = useState(false)
  const [toast, setToast] = useState({ message: '', type: 'success' })
  const [vendedorPhone, setVendedorPhone] = useState(null)

  const cartQuantity = cart.reduce((acc, item) => acc + item.quantity, 0)

  // ✅ Salva logo/cores em cache leve pra próxima tela de carregamento
  // já nascer com a identidade certa, sem precisar esperar o Firestore.
  useEffect(() => {
    if (!store || !storeSlug) return
    try {
      sessionStorage.setItem(
        `orby-store-cache:${storeSlug}`,
        JSON.stringify({ logo: store.logo, name: store.name, colors: store.colors })
      )
    } catch {
      // sessionStorage indisponível (modo privado, etc.) — sem problema, só não cacheia
    }
  }, [store, storeSlug])

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

  if (storeLoading || !store) return <LoadingScreen store={store} storeSlug={storeSlug} />

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

  if (loading) return <LoadingScreen store={store} storeSlug={storeSlug} />
  if (!product) return <main className="container product-empty"><h2>Produto não encontrado</h2></main>

  const productImages = product.images?.length > 0
    ? product.images : [product.image, product.image2].filter(Boolean)

  const formattedPrice = Number(product.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const pixPrice = getPixPrice(product, store.paymentInfo)
  const installmentInfo = getInstallmentInfo(product)

  const availableSizes = getSizesWithStock(product, selectedVariation)
  const allSizes = selectedVariation?.sizes || product.sizes || []
  const outOfStockSizes = allSizes.filter((size) => !availableSizes.includes(size))

  const selectedColor = selectedVariation?.colorName || product.mainColor || '-'

  // ✅ Usa número do vendedor se disponível, senão usa o da loja
  const phone = vendedorPhone || String(store.whatsapp || '').replace(/\D/g, '')

  // Cria o snapshot do pedido (mesmo padrão do CartDrawer, com 1 item só) e
  // abre o WhatsApp já com o link de resumo, com foto e detalhe do produto.
  async function handleComprarAgora() {
    if (comprando) return
    if (!product.available || availableSizes.length === 0) { showToast('Produto indisponível', 'warning'); return }
    if (!selectedSize) { showToast('Selecione um tamanho', 'warning'); return }
    if (!sizeHasStock(product, selectedVariation, selectedSize)) { showToast('Este tamanho está esgotado', 'warning'); return }
    if (product.variations?.length > 0 && !selectedVariation && !product.mainColor) { showToast('Selecione uma cor', 'warning'); return }

    setComprando(true)

    const item = {
      ...product,
      image: selectedImage || productImages[0],
      selectedSize,
      selectedColor,
      price: product.price,
      quantity: 1,
    }

    const detalhes = `Produto: ${product.name}
${selectedColor && selectedColor !== '-' ? `Cor: ${selectedColor}\n` : ''}Tamanho: ${selectedSize}
Preço: ${formattedPrice}`

    try {
      const orderLink = await createOrderSnapshot(storeSlug, [item], Number(product.price))

      const whatsappText = `${store.checkout?.messageIntro || 'Olá! Tenho interesse nesse produto:'}

${detalhes}

🔗 Detalhes do pedido (com foto): ${orderLink}

Pode me ajudar?`

      window.location.href = `https://wa.me/${phone}?text=${encodeURIComponent(whatsappText)}`
    } catch {
      // Se salvar o snapshot falhar (ex: sem internet), não trava o cliente:
      // manda a mensagem sem o link, do jeito que já funcionava antes.
      const whatsappText = `${store.checkout?.messageIntro || 'Olá! Tenho interesse nesse produto:'}

${detalhes}

Pode me ajudar?`

      window.location.href = `https://wa.me/${phone}?text=${encodeURIComponent(whatsappText)}`
    }

    setComprando(false)
  }

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
          <div className="price-row">
            <div className="product-price-box">
              {product.productSection === 'outlet' && product.oldPrice && (
                <span className="product-old-price">
                  {Number(product.oldPrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              )}
              <span className="price-pix-row">
                <strong className="product-current-price">
                  {pixPrice != null ? formatBRL(pixPrice) : formattedPrice}
                </strong>
                {pixPrice != null && <span className="pix-label-inline">no PIX</span>}
              </span>
            </div>
          </div>

          {/* ✅ Linha secundária: mostra a alternativa (preço cheio / parcelado).
              Nunca dois valores com o mesmo destaque ao mesmo tempo. */}
          {pixPrice != null ? (
            <p className="price-alt-note">
              ou {formattedPrice}
              {installmentInfo && ` em ${installmentInfo.count}x de ${formatBRL(installmentInfo.value)} sem juros`}
            </p>
          ) : installmentInfo ? (
            <p className="installments-info">
              {installmentInfo.count}x de {formatBRL(installmentInfo.value)} sem juros
            </p>
          ) : (
            <p className="installments-info">{formatPaymentMethod(product.paymentMethod)}</p>
          )}

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
              className={`whatsapp-button add-cart-button ${added ? 'added' : ''}`}
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
              {!product.available || availableSizes.length === 0 ? 'Indisponível' : added ? '✔ Adicionado' : 'Adicionar ao carrinho'}
            </button>

            {product.available && availableSizes.length > 0 && (
              <button className="whatsapp-button" disabled={comprando} onClick={handleComprarAgora}>
                {comprando ? 'Preparando pedido...' : 'Comprar pelo WhatsApp'}
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