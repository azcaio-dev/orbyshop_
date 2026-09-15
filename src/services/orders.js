import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'
import { getCustomDomainFromSlug } from '../config/customDomains'

// Preço já vem formatado como string ("R$ 99,90") em alguns itens do carrinho.
// Mesma lógica de parse usada no CartDrawer, pra manter o snapshot consistente.
function parsePrice(value) {
  let price = value
  if (typeof price === 'string') {
    price = price.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()
  }
  price = Number(price)
  return Number.isNaN(price) ? 0 : price
}

/**
 * Salva um snapshot do pedido (itens + total) no Firestore e retorna
 * a URL pública do resumo do pedido, já respeitando domínio customizado.
 */
export async function createOrderSnapshot(storeSlug, cart, total) {
  const orderData = {
    createdAt: serverTimestamp(),
    total,
    items: cart.map((item) => ({
      productId: item.id,
      name: item.name,
      color: item.selectedColor || null,
      size: item.selectedSize || null,
      price: parsePrice(item.price),
      quantity: item.quantity,
      imageUrl: item.image || null,
    })),
  }

  // TODO: log temporário para diagnosticar por que a gravação falha em
  // algumas lojas e não em outras.
  console.log('[createOrderSnapshot] storeSlug:', storeSlug)
  console.log('[createOrderSnapshot] total:', total, typeof total)
  console.log('[createOrderSnapshot] items:', JSON.stringify(orderData.items, null, 2))

  const orderRef = await addDoc(collection(db, 'stores', storeSlug, 'orders'), orderData)

  const customDomain = getCustomDomainFromSlug(storeSlug)
  const baseUrl = customDomain
    ? `https://${customDomain}`
    : `${window.location.origin}/${storeSlug}`

  return `${baseUrl}/pedido/${orderRef.id}`
}