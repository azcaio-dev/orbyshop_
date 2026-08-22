import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../services/firebase'
import useStoreTheme from '../hooks/useStoreTheme'
import { getStoreSlugFromDomain } from '../config/customDomains'

const MAX_PHOTO_SIZE = 5 * 1024 * 1024 // 5MB

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

  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')

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

  // Libera a URL do preview quando o componente desmonta ou a foto muda,
  // pra não vazar memória com objectURLs
  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview)
    }
  }, [photoPreview])

  function handlePhotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setErro('O arquivo precisa ser uma imagem.')
      return
    }

    if (file.size > MAX_PHOTO_SIZE) {
      setErro('A imagem precisa ter até 5MB.')
      return
    }

    setErro('')
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  function removePhoto() {
    setPhotoFile(null)
    setPhotoPreview('')
  }

  // Mesmo padrão do uploadLogo: cloud name e preset do projeto Orby/Labany na Cloudinary.
  async function uploadPhotoToCloudinary(file) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('upload_preset', 'loja-labany')

    const response = await fetch(
      'https://api.cloudinary.com/v1_1/dcqroxlt0/image/upload',
      {
        method: 'POST',
        body: formData,
      }
    )

    if (!response.ok) {
      throw new Error('Falha no upload da foto')
    }

    const data = await response.json()
    return data.secure_url
  }

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
      let photoURL = null

      if (photoFile) {
        try {
          photoURL = await uploadPhotoToCloudinary(photoFile)
        } catch (uploadError) {
          console.error('Erro ao subir foto:', uploadError)
          setErro('Não foi possível enviar sua foto. Tente novamente ou envie sem foto.')
          setSending(false)
          return
        }
      }

      await addDoc(collection(db, 'stores', storeSlug, 'reviews'), {
        customerName: customerName.trim(),
        rating,
        comment: comment.trim(),
        photoURL,
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
          <div
            className="avaliar-logo-frame"
            style={{ backgroundColor: store?.colors?.primary || '#c5a19c' }}
          >
            <img src={store.logo} alt={store.name} className="avaliar-logo" />
          </div>
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
              <label>Foto de perfil (opcional)</label>
              <div className="avaliar-photo-upload">
                {photoPreview ? (
                  <div className="avaliar-photo-preview">
                    <img src={photoPreview} alt="Pré-visualização" />
                    <button
                      type="button"
                      className="avaliar-photo-remove"
                      onClick={removePhoto}
                      aria-label="Remover foto"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <label className="avaliar-photo-input">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                    />
                    <span>Escolher foto</span>
                  </label>
                )}
              </div>

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