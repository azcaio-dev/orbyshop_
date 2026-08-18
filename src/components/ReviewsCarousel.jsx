import { useEffect, useState } from 'react'
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore'
import { db } from '../services/firebase'

// Máximo de avaliações exibidas no carrossel da Home.
// Evita centenas de "dots" se a loja acumular muitas avaliações.
const MAX_REVIEWS_HOME = 12

// ✅ Carrossel de avaliações exibido na Home.
// Busca só reviews com visivel === true, mais recentes primeiro, limitado a MAX_REVIEWS_HOME.
function ReviewsCarousel({ store, storeSlug }) {
  const [reviews, setReviews] = useState([])
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const primary = store?.colors?.primary || '#c5a19c'
  const background = store?.colors?.background || '#f8f1ec'

  useEffect(() => {
    async function loadReviews() {
      try {
        const q = query(
          collection(db, 'stores', storeSlug, 'reviews'),
          where('visivel', '==', true),
          orderBy('createdAt', 'desc'),
          limit(MAX_REVIEWS_HOME)
        )

        const snapshot = await getDocs(q)

        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))

        setReviews(data)
      } catch (error) {
        console.error('Erro ao carregar avaliações:', error)
      } finally {
        setLoaded(true)
      }
    }

    if (storeSlug) loadReviews()
  }, [storeSlug])

  useEffect(() => {
    if (reviews.length <= 1 || paused) return

    const interval = setInterval(() => {
      setCurrent((prev) => (prev === reviews.length - 1 ? 0 : prev + 1))
    }, 5000)

    return () => clearInterval(interval)
  }, [reviews, paused])

  function goTo(index) {
    setCurrent(index)
  }

  function goPrev() {
    setCurrent((prev) => (prev === 0 ? reviews.length - 1 : prev - 1))
  }

  function goNext() {
    setCurrent((prev) => (prev === reviews.length - 1 ? 0 : prev + 1))
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
        {reviews.length > 1 && (
          <button
            className="reviews-arrow reviews-arrow-left"
            onClick={goPrev}
            aria-label="Avaliação anterior"
          >
            ‹
          </button>
        )}

        <div className="reviews-track">
          {reviews.map((review, index) => (
            <div
              key={review.id}
              className={`reviews-card ${index === current ? 'active' : ''}`}
              style={{
                transform: `translateX(${(index - current) * 100}%)`,
              }}
            >
              <div className="reviews-stars">
                {'★'.repeat(review.rating)}
                {'☆'.repeat(5 - review.rating)}
              </div>

              {review.comment && (
                <p className="reviews-comment">"{review.comment}"</p>
              )}

              <p className="reviews-author">{review.customerName}</p>
            </div>
          ))}
        </div>

        {reviews.length > 1 && (
          <button
            className="reviews-arrow reviews-arrow-right"
            onClick={goNext}
            aria-label="Próxima avaliação"
          >
            ›
          </button>
        )}
      </div>

      {reviews.length > 1 && (
        <div className="reviews-dots">
          {reviews.map((_, index) => (
            <button
              key={index}
              className={index === current ? 'active' : ''}
              onClick={() => goTo(index)}
              aria-label={`Ir para avaliação ${index + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  )
}

export default ReviewsCarousel