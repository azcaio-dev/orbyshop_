import { useEffect, useState } from 'react'
import { useCart } from '../context/CartContext'
import useStore from '../hooks/useStore'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../services/firebase'

function CartDrawer({ open, onClose }) {
  const { store, loading: storeLoading, storeSlug } = useStore()
  const { cart, clearCart, increaseQuantity, decreaseQuantity, vendedorSlug } = useCart()
  const [vendedorPhone, setVendedorPhone] = useState(null)

  // --- Simulação de frete SEDEX ---
  const [freteAberto, setFreteAberto] = useState(false)
  const [cepInput, setCepInput] = useState('')
  const [freteLoading, setFreteLoading] = useState(false)
  const [freteErro, setFreteErro] = useState('')
  const [freteOpcoes, setFreteOpcoes] = useState(null)

  // Busca o WhatsApp do vendedor ativo
  useEffect(() => {
    if (!vendedorSlug || !storeSlug) return
    async function loadVendedor() {
      try {
        const snapshot = await getDocs(
          query(collection(db, 'stores', storeSlug, 'vendedores'), where('slug', '==', vendedorSlug))
        )
        if (!snapshot.empty) {
          setVendedorPhone(snapshot.docs[0].data().whatsapp)
        }
      } catch { /* usa número da loja como fallback */ }
    }
    loadVendedor()
  }, [vendedorSlug, storeSlug])

  if (storeLoading || !store) return null

  function formatPrice(value) {
    let price = value
    if (typeof price === 'string') {
      price = price.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()
    }
    price = Number(price)
    if (Number.isNaN(price)) price = 0
    return price
  }

  function fmt(value) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  const total = cart.reduce((acc, item) => acc + item.quantity * formatPrice(item.price), 0)
  const perfisEnvio = store.frete?.perfis || []

  function handleCepChange(e) {
    // Aplica máscara 00000-000 enquanto digita
    const digits = e.target.value.replace(/\D/g, '').slice(0, 8)
    const masked = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
    setCepInput(masked)
    setFreteErro('')
  }

  async function handleSimularFrete() {
    const cepLimpo = cepInput.replace(/\D/g, '')

    if (cepLimpo.length !== 8) {
      setFreteErro('Digite um CEP válido (8 dígitos).')
      return
    }

    // Resolve o perfil de envio de cada item: usa o salvo no produto, ou o
    // único perfil da loja caso ela só tenha um cadastrado.
    const itensParaCotar = []
    for (const item of cart) {
      const perfilId = item.perfilEnvioId || (perfisEnvio.length === 1 ? perfisEnvio[0].id : null)

      if (!perfilId) {
        setFreteErro(`"${item.name}" não tem um modelo de envio configurado. Fale com a loja.`)
        return
      }

      itensParaCotar.push({ perfilEnvioId: perfilId, quantidade: item.quantity })
    }

    setFreteLoading(true)
    setFreteErro('')
    setFreteOpcoes(null)

    try {
      const response = await fetch('/api/frete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cepOrigem: store.frete.cepOrigem,
          cepDestino: cepLimpo,
          itens: itensParaCotar,
          perfis: perfisEnvio,
          valorDeclarado: total,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setFreteErro(data.error || 'Não foi possível calcular o frete agora.')
        return
      }

      if (!data.opcoes || data.opcoes.length === 0) {
        setFreteErro('Nenhuma opção de frete encontrada para esse CEP.')
        return
      }

      setFreteOpcoes(data.opcoes)
    } catch {
      setFreteErro('Não foi possível calcular o frete agora. Tente novamente.')
    }

    setFreteLoading(false)
  }

  const message = cart.map((item) => {
    const price = formatPrice(item.price)
    return `• ${item.quantity}x ${item.name}
${item.selectedColor ? `Cor: ${item.selectedColor}\n` : ''}Tam: ${item.selectedSize || '-'}
Preço: ${fmt(price)}`
  }).join('\n\n')

  // ✅ Usa o número do vendedor se disponível, senão usa o da loja
  const phone = vendedorPhone || String(store.whatsapp || '').replace(/\D/g, '')

  const whatsappText = `${store.checkout?.messageIntro || 'Olá! Quero finalizar meu pedido:'}

*Itens:*
${message}

*Total:* ${fmt(total)}

Pode me ajudar com o pagamento e entrega?`

  const whatsappLink = `https://wa.me/${phone}?text=${encodeURIComponent(whatsappText)}`

  return (
    <>
      <div className={`drawer ${open ? 'open' : ''}`}>
        <div className="drawer-content">
          <button className="close-drawer" onClick={onClose}>✕</button>
          <h2>Carrinho</h2>

          {vendedorSlug && vendedorPhone && (
            <p style={{ fontSize: 11, color: '#534ab7', background: '#eeedfe',
              borderRadius: 6, padding: '4px 8px', marginBottom: 8, display: 'inline-block' }}>
              Atendimento: {vendedorSlug}
            </p>
          )}

          {cart.length === 0 && <p>Seu carrinho está vazio</p>}

          {cart.map((item, index) => (
            <div
              key={`${item.id}-${item.selectedSize || 'sem-tamanho'}-${item.selectedColor || 'sem-cor'}-${index}`}
              className="cart-item"
            >
              <img src={item.image} alt={item.name} className="cart-item-image" loading="lazy" />
              <div className="cart-info">
                <strong className="cart-product-name">{item.name}</strong>
                <div className="cart-middle-row">
                  <div>
                    {item.selectedColor && <span>Cor: {item.selectedColor}</span>}
                    <span>Tam: {item.selectedSize || '-'}</span>
                  </div>
                  <div className="cart-quantity">
                    <button onClick={() => decreaseQuantity(item.id, item.selectedSize, item.selectedColor)}>−</button>
                    <span>{item.quantity}</span>
                    <button onClick={() => increaseQuantity(item.id, item.selectedSize, item.selectedColor)}>+</button>
                  </div>
                </div>
                <div className="cart-price-box">
                  {item.productSection === 'outlet' && item.oldPrice && (
                    <span className="cart-old-price">{fmt(formatPrice(item.oldPrice))}</span>
                  )}
                  <strong className="cart-current-price">{fmt(formatPrice(item.price))}</strong>
                </div>
              </div>
            </div>
          ))}

          {cart.length > 0 && (
            <>
              <h3 className="cart-total">Total: {fmt(total)}</h3>

              {/* --- Simulação de frete SEDEX (só aparece se a loja ativou) --- */}
              {store.frete?.ativo && (
                <div className="cart-frete-box">
                  <button
                    type="button"
                    className="cart-frete-toggle"
                    onClick={() => setFreteAberto((v) => !v)}
                  >
                    É de outro estado? Simule o frete via SEDEX {freteAberto ? '▲' : '▼'}
                  </button>

                  {freteAberto && (
                    <div className="cart-frete-content">
                      <div className="cart-frete-input-row">
                        <input
                          type="text"
                          placeholder="Seu CEP"
                          value={cepInput}
                          onChange={handleCepChange}
                          maxLength={9}
                        />
                        <button
                          type="button"
                          onClick={handleSimularFrete}
                          disabled={freteLoading}
                        >
                          {freteLoading ? 'Calculando...' : 'Simular'}
                        </button>
                      </div>

                      {freteErro && <p className="cart-frete-erro">{freteErro}</p>}

                      {freteOpcoes && (
                        <div className="cart-frete-resultados">
                          {freteOpcoes.map((opcao, i) => (
                            <div key={i} className="cart-frete-opcao">
                              <span>{opcao.transportadora} - {opcao.servico}</span>
                              <span>{opcao.prazoDias} dias úteis</span>
                              <strong>{fmt(opcao.valor)}</strong>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <button type="button" onClick={() => window.location.href = whatsappLink} className="whatsapp-button">
                Finalizar no WhatsApp
              </button>
              <button onClick={clearCart} className="clear-cart">Limpar carrinho</button>
            </>
          )}
        </div>
      </div>
      {open && <div className="overlay" onClick={onClose} />}
    </>
  )
}

export default CartDrawer