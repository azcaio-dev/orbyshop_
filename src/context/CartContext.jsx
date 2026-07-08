import { createContext, useContext, useState, useEffect } from 'react'

const CartContext = createContext()

function getStoreSlugFromUrl() {
  const slug = window.location.pathname.split('/')[1]
  return slug || 'labany'
}

function getCartKey() {
  const storeSlug = getStoreSlugFromUrl()
  return `@orby:${storeSlug}:cart`
}

function getInitialCart() {
  const savedCart = localStorage.getItem(getCartKey())
  return savedCart ? JSON.parse(savedCart) : []
}

// ── Detecta e persiste vendedor ativo ──────────────────────────
function getVendedorKey() {
  return `@orby:${getStoreSlugFromUrl()}:vendedor`
}

function getInitialVendedor() {
  return localStorage.getItem(getVendedorKey()) || null
}

function detectVendedorFromUrl() {
  const params = new URLSearchParams(window.location.search)
  return params.get('v') || null
}

export function CartProvider({ children }) {
  const [cart, setCart] = useState(getInitialCart)
  const [vendedorSlug, setVendedorSlug] = useState(getInitialVendedor)

  // Ao montar, verifica se há ?v= na URL e salva
  useEffect(() => {
    const slugFromUrl = detectVendedorFromUrl()
    if (slugFromUrl) {
      localStorage.setItem(getVendedorKey(), slugFromUrl)
      setVendedorSlug(slugFromUrl)
    }
  }, [])

  function saveCart(newCart) {
    localStorage.setItem(getCartKey(), JSON.stringify(newCart))
    setCart(newCart)
  }

  function addToCart(product) {
    const storeSlug = getStoreSlugFromUrl()
    setCart((prev) => {
      const exists = prev.find(
        (item) =>
          item.id === product.id &&
          item.selectedSize === product.selectedSize &&
          item.selectedColor === product.selectedColor
      )
      let updatedCart
      if (exists) {
        updatedCart = prev.map((item) =>
          item.id === product.id &&
          item.selectedSize === product.selectedSize &&
          item.selectedColor === product.selectedColor
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      } else {
        updatedCart = [...prev, { ...product, storeSlug, quantity: 1 }]
      }
      localStorage.setItem(getCartKey(), JSON.stringify(updatedCart))
      return updatedCart
    })
  }

  function removeFromCart(id, selectedSize, selectedColor) {
    saveCart(cart.filter(
      (item) => !(item.id === id && item.selectedSize === selectedSize && item.selectedColor === selectedColor)
    ))
  }

  function increaseQuantity(id, selectedSize, selectedColor) {
    saveCart(cart.map((item) =>
      item.id === id && item.selectedSize === selectedSize && item.selectedColor === selectedColor
        ? { ...item, quantity: item.quantity + 1 } : item
    ))
  }

  function decreaseQuantity(id, selectedSize, selectedColor) {
    saveCart(cart
      .map((item) =>
        item.id === id && item.selectedSize === selectedSize && item.selectedColor === selectedColor
          ? { ...item, quantity: item.quantity - 1 } : item
      )
      .filter((item) => item.quantity > 0)
    )
  }

  function clearCart() {
    saveCart([])
  }

  return (
    <CartContext.Provider value={{
      cart, addToCart, removeFromCart, increaseQuantity, decreaseQuantity,
      clearCart, vendedorSlug,
    }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  return useContext(CartContext)
}