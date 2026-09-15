// components/WhatsAppFloat.jsx
//
// Desktop: botão flutuante fixo no canto inferior direito, sempre visível.
// Mobile: "gotinha" fixa na lateral direita; ao tocar, expande em um botão
// com o link do WhatsApp. Fecha sozinha em 3 casos:
//   1) toque fora do componente
//   2) rolagem da tela (scroll, tipo feed)
//   3) timeout de alguns segundos sem interação
//
// Uso: <WhatsAppFloat store={store} />
// Espera store.whatsapp no mesmo formato já usado no footer.jsx / CartDrawer.jsx

import { useEffect, useRef, useState } from 'react'

const AUTO_CLOSE_MS = 5000
const SCROLL_CLOSE_THRESHOLD = 40 // px rolados para considerar "deslizou o feed"

export default function WhatsAppFloat({ store, message = 'Olá! Vim pelo site e queria saber mais 🙂' }) {
  const [expanded, setExpanded] = useState(false)
  const containerRef = useRef(null)
  const closeTimerRef = useRef(null)
  const scrollStartRef = useRef(0)

  if (!store?.whatsapp) return null

  const waLink = `https://wa.me/${store.whatsapp}?text=${encodeURIComponent(message)}`

  function scheduleAutoClose() {
    clearTimeout(closeTimerRef.current)
    closeTimerRef.current = setTimeout(() => setExpanded(false), AUTO_CLOSE_MS)
  }

  function handleDropClick() {
    setExpanded(true)
    scheduleAutoClose()
  }

  // Fecha ao tocar/clicar fora do componente
  useEffect(() => {
    if (!expanded) return

    function handleOutsideClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setExpanded(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('touchstart', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('touchstart', handleOutsideClick)
    }
  }, [expanded])

  // Fecha ao rolar a tela (deslizar feed pra cima/baixo)
  useEffect(() => {
    if (!expanded) return

    scrollStartRef.current = window.scrollY

    function handleScroll() {
      if (Math.abs(window.scrollY - scrollStartRef.current) > SCROLL_CLOSE_THRESHOLD) {
        setExpanded(false)
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [expanded])

  useEffect(() => {
    return () => clearTimeout(closeTimerRef.current)
  }, [])

  return (
    <div ref={containerRef}>
      {/* Desktop: botão fixo sempre visível */}
      <a
        href={waLink}
        target="_blank"
        rel="noopener noreferrer"
        className="wa-float-desktop"
        aria-label="Fale conosco pelo WhatsApp"
      >
        <img src="/whatsapp.png" alt="" />
      </a>

      {/* Mobile: gotinha -> expande em botão */}
      <div className={`wa-drop ${expanded ? 'wa-drop--expanded' : ''}`}>
        {!expanded ? (
          <button
            type="button"
            className="wa-drop-tab"
            onClick={handleDropClick}
            aria-label="Abrir WhatsApp"
          >
            <img src="/whatsapp.png" alt="" />
          </button>
        ) : (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="wa-drop-button"
          >
            <img src="/whatsapp.png" alt="" />
            <span>Fale conosco</span>
          </a>
        )}
      </div>
    </div>
  )
}