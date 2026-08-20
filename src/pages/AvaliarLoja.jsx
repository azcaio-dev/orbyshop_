import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../services/firebase'
import useStoreTheme from '../hooks/useStoreTheme'
import { getStoreSlugFromDomain } from '../config/customDomains'

// ✅ Página pública de avaliação.
// Só funciona se o token da URL bater com o reviewToken salvo na loja.
// Isso impede que qualquer pessoa avalie sem ter recebido o link do admin.
//
// Funciona em dois formatos de link:
//   - /:storeSlug/avaliar/:reviewToken   (domínio padrão da Orby)
//   - /avaliar/:reviewToken              (domínio próprio da loja, ex: calcarbem.app.br)
function AvaliarLoja() {
  const { storeSlug: storeSlugFromUrl, reviewToken } = useParams()
  const storeSlug = storeSlugFromUrl || getStoreSlugFromDomain()

  const [store, setStore] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tokenValido, setTokenValido] = useState(false)

  const [customerName, setCustomerName] = useState('')
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [website, setWebsite] = useState('') // honeypot anti-spam
  const [sending, setSending] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState('')

  useStoreTheme(store)

  useEffect(() => {
    async function loadStore() {
      if (!storeSlug) {
        setLoading(false)
        return
      }

      try {
        const snap = await getDoc(doc(db, 'stores', storeSlug))

        if (!snap.exists()) {
          setLoading(false)
          return
        }

        const data = { id: snap.id, ...snap.data() }
        setStore(data)
        setTokenValido(Boolean(data.reviewToken) && data.reviewToken === reviewToken)
      } catch (error) {
        console.error('Erro ao carregar loja:', error)
      } finally {
        setLoading(false)
      }
    }

    loadStore()
  }, [storeSlug, reviewToken])

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')

    if (!customerName.trim()) {
      setErro('Digite seu nome.')
      return
    }

    if (rating === 0) {
      setErro('Selecione uma nota de 1 a 5 estrelas.')
      return
    }

    setSending(true)

    try {
      await addDoc(collection(db, 'stores', storeSlug, 'reviews'), {
        customerName: customerName.trim(),
        rating,
        comment: comment.trim(),
        token: reviewToken,
        website, // honeypot: deve chegar vazio nas regras do Firestore
        visivel: true,
        createdAt: serverTimestamp(),
      })

      setEnviado(true)
    } catch (error) {
      console.error('Erro ao enviar avaliação:', error)
      setErro('Não foi possível enviar sua avaliação. Tente novamente.')
    } finally {
      setSending(false)
    }
  }

  if (loading) return null

  if (!store || !tokenValido) {
    return (
      <main className="avaliar-page avaliar-invalido">
        <div className="avaliar-card">
          <h1>Link inválido</h1>
          <p>Este link de avaliação não é válido ou expirou.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="avaliar-page">
      <div className="avaliar-card">
        {store.logo && (
          <img src={store.logo} alt={store.name} className="avaliar-logo" />
        )}

        {enviado ? (
          <div className="avaliar-sucesso">
            <h1>Obrigado! 🎉</h1>
            <p>Sua avaliação foi enviada com sucesso.</p>
          </div>
        ) : (
          <>
            <h1>Como foi sua experiência com a {store.name}?</h1>
            <p className="avaliar-subtitle">
              Sua opinião ajuda outros clientes e a gente também 💛
            </p>

            <form onSubmit={handleSubmit} className="avaliar-form">
              <label>Seu nome</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Como você quer aparecer na avaliação"
                maxLength={80}
                required
              />

              <label>Sua nota</label>
              <div className="avaliar-stars">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    type="button"
                    key={star}
                    className={`avaliar-star ${
                      star <= (hoverRating || rating) ? 'active' : ''
                    }`}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    aria-label={`${star} estrela(s)`}
                  >
                    ★
                  </button>
                ))}
              </div>

              <label>Comentário (opcional)</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Conte como foi a sua compra..."
                maxLength={500}
                rows={4}
              />

              {/* Honeypot: campo invisível para humanos, visível para bots */}
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="avaliar-honeypot"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
              />

              {erro && <p className="avaliar-erro">{erro}</p>}

              <button type="submit" disabled={sending}>
                {sending ? 'Enviando...' : 'Enviar avaliação'}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  )
}

export default AvaliarLoja