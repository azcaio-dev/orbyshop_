import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../services/firebase'
import { getStoreSlugFromDomain } from '../config/customDomains'

function fmt(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function OrderSummary() {
  const params = useParams()
  const storeSlug = params.storeSlug || getStoreSlugFromDomain()
  const { orderId } = params

  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    async function fetchOrder() {
      if (!storeSlug || !orderId) {
        setErro(true)
        setLoading(false)
        return
      }
      try {
        const snap = await getDoc(doc(db, 'stores', storeSlug, 'orders', orderId))
        if (snap.exists()) {
          setOrder(snap.data())
        } else {
          setErro(true)
        }
      } catch {
        setErro(true)
      }
      setLoading(false)
    }
    fetchOrder()
  }, [storeSlug, orderId])

  if (loading) {
    return (
      <div className="page-content order-summary">
        <p>Carregando pedido...</p>
      </div>
    )
  }

  if (erro || !order) {
    return (
      <div className="page-content order-summary">
        <p>Não foi possível encontrar esse pedido.</p>
      </div>
    )
  }

  return (
    <div className="page-content order-summary">
      <h1>Resumo do pedido</h1>

      <div className="order-items">
        {order.items.map((item, i) => (
          <div key={i} className="order-item-card">
            {item.imageUrl && (
              <img src={item.imageUrl} alt={item.name} className="order-item-image" loading="lazy" />
            )}
            <div className="order-item-info">
              <strong className="order-item-name">{item.name}</strong>
              <div className="order-item-variant">
                {item.color && <span>Cor: {item.color}</span>}
                {item.size && <span>Tam: {item.size}</span>}
              </div>
              <div className="order-item-price">
                {item.quantity}x {fmt(item.price)}
              </div>
            </div>
          </div>
        ))}
      </div>

      <h3 className="order-total">Total: {fmt(order.total)}</h3>
    </div>
  )
}

export default OrderSummary