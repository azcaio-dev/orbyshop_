import { useEffect, useState } from 'react'
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore'
import { db } from '../services/firebase'

// Buscamos sempre o teto do desktop (36); no mobile usamos só os 24 primeiros
// desse mesmo array, sem re-consultar o Firestore no resize.
const MAX_REVIEWS_DESKTOP = 36
const MAX_REVIEWS_MOBILE = 24

// Quantos cards aparecem por "slide" em cada breakpoint.
// 36/3 = 12 slides no desktop, 24/2 = 12 slides no mobile — bate com o limite de dots.
const CARDS_PER_SLIDE_DESKTOP = 3
const CARDS_PER_SLIDE_MOBILE = 2

const MOBILE_BREAKPOINT = 768

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false
  )

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return isMobile
}

// ✅ Carrossel de avaliações exibido na Home.
// Busca só reviews com visivel === true, mais recentes primeiro, limitado a MAX_REVIEWS_DESKTOP.
// Renderiza em grid: 3 cards por slide no desktop, 2 no mobile.
function ReviewsCarousel({ store, storeSlug }) {
  const [allReviews, setAllReviews] = useState([])
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const isMobile = useIsMobile()
  const cardsPerSlide = isMobile ? CARDS_PER_SLIDE_MOBILE : CARDS_PER_SLIDE_DESKTOP

  const primary = store?.colors?.primary || '#c5a19c'
  const background = store?.colors?.background || '#f8f1ec'

  useEffect(() => {
    async function loadReviews() {
      try {
        const q = query(
          collection(db, 'stores', storeSlug, 'reviews'),
          where('visivel', '==', true),
          orderBy('createdAt', 'desc'),
          limit(MAX_REVIEWS_DESKTOP)
        )

        const snapshot = await getDocs(q)

        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))

        setAllReviews(data)
      } catch (error) {
        console.error('Erro ao carregar avaliações:', error)
      } finally {
        setLoaded(true)
      }
    }

    if (storeSlug) loadReviews()
  }, [storeSlug])

  // No mobile usamos só os 24 primeiros; no desktop, os até 36 já buscados
  const reviews = isMobile ? allReviews.slice(0, MAX_REVIEWS_MOBILE) : allReviews

  // Agrupa em slides de acordo com o breakpoint. Último slide pode ficar incompleto.
  const slides = []
  for (let i = 0; i < reviews.length; i += cardsPerSlide) {
    slides.push(reviews.slice(i, i + cardsPerSlide))
  }

  // Se o número de slides mudar (ex: resize mudando cardsPerSlide) e o slide
  // atual não existir mais, volta pro início.
  useEffect(() => {
    if (current >= slides.length) setCurrent(0)
  }, [slides.length, current])

  useEffect(() => {
    if (slides.length <= 1 || paused) return

    const interval = setInterval(() => {
      setCurrent((prev) => (prev === slides.length - 1 ? 0 : prev + 1))
    }, 5000)

    return () => clearInterval(interval)
  }, [slides.length, paused])

  function goTo(index) {
    setCurrent(index)
  }

  function goPrev() {
    setCurrent((prev) => (prev === 0 ? slides.length - 1 : prev - 1))
  }

  function goNext() {
    setCurrent((prev) => (prev === slides.length - 1 ? 0 : prev + 1))
  }

  // Enquanto carrega ou se não houver avaliações, não renderiza nada
  if (!loaded || reviews.length === 0) return null

  return (
    <section
      className="reviews-section fade-in"
      style={{
        '--reviews-primary': primary,
        '--reviews-bg': background,
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <span className="reviews-eyebrow">Quem já comprou aprova</span>
      <h2 className="reviews-title">Avaliações de clientes</h2>
      <div className="reviews-divider"></div>

      <div className="reviews-carousel">
        {slides.length > 1 && (
          <button
            className="reviews-arrow reviews-arrow-left"
            onClick={goPrev}
            aria-label="Slide anterior"
          >
            ‹
          </button>
        )}

        <div className="reviews-track">
          {slides.map((slideReviews, slideIndex) => (
            <div
              key={slideIndex}
              className={`reviews-slide ${slideIndex === current ? 'active' : ''}`}
              style={{
                transform: `translateX(${(slideIndex - current) * 100}%)`,
              }}
            >
              <div className="reviews-grid">
                {slideReviews.map((review) => (
                  <div key={review.id} className="reviews-card">
                    <div className="reviews-card-header">
                      {review.photoURL ? (
                        <img
                          src={review.photoURL}
                          alt={review.customerName}
                          className="reviews-avatar"
                        />
                      ) : (
                        <div className="reviews-avatar reviews-avatar-fallback">
                          {review.customerName?.charAt(0).toUpperCase()}
                        </div>
                      )}

                      <div className="reviews-card-headtext">
                        <p className="reviews-author">{review.customerName}</p>
                        <div className="reviews-stars">
                          {'★'.repeat(review.rating)}
                          {'☆'.repeat(5 - review.rating)}
                        </div>
                      </div>
                    </div>

                    {review.comment && (
                      <p className="reviews-comment">"{review.comment}"</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {slides.length > 1 && (
          <button
            className="reviews-arrow reviews-arrow-right"
            onClick={goNext}
            aria-label="Próximo slide"
          >
            ›
          </button>
        )}
      </div>

      {slides.length > 1 && (
        <div className="reviews-dots">
          {slides.map((_, index) => (
            <button
              key={index}
              className={index === current ? 'active' : ''}
              onClick={() => goTo(index)}
              aria-label={`Ir para slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  )
}

export default ReviewsCarousel