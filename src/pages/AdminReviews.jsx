import { useEffect, useState } from 'react'
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  getDoc,
  query,
  orderBy,
} from 'firebase/firestore'
import { db } from '../services/firebase'
import Toast from '../components/Toast'
import { useParams } from 'react-router-dom'
import AdminLayout from '../layouts/AdminLayout'

// Gera um token curto e aleatório para compor o link de avaliação
function gerarToken() {
  return crypto.getRandomValues(new Uint32Array(4))
    .reduce((acc, n) => acc + n.toString(36), '')
    .slice(0, 12)
}

function AdminReviews() {
  const { storeSlug } = useParams()

  const [reviews, setReviews] = useState([])
  const [reviewToken, setReviewToken] = useState('')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState({ message: '', type: 'success' })

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast({ message: '', type: 'success' }), 2500)
  }

  async function loadStore() {
    const snap = await getDoc(doc(db, 'stores', storeSlug))
    if (snap.exists()) {
      setReviewToken(snap.data().reviewToken || '')
    }
  }

  async function loadReviews() {
    setLoading(true)
    try {
      const q = query(
        collection(db, 'stores', storeSlug, 'reviews'),
        orderBy('createdAt', 'desc')
      )
      const snapshot = await getDocs(q)
      setReviews(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })))
    } catch (error) {
      console.error('Erro ao carregar avaliações:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStore()
    loadReviews()
  }, [storeSlug])

  const reviewLink = reviewToken
    ? `${window.location.origin}/${storeSlug}/avaliar/${reviewToken}`
    : ''

  async function handleCopyLink() {
    if (!reviewLink) return
    await navigator.clipboard.writeText(reviewLink)
    showToast('Link copiado!', 'success')
  }

  async function handleGerarToken() {
    if (
      reviewToken &&
      !confirm(
        'Isso vai invalidar o link atual. Quem tiver o link antigo não vai mais conseguir avaliar. Continuar?'
      )
    ) {
      return
    }

    const novoToken = gerarToken()
    await updateDoc(doc(db, 'stores', storeSlug), { reviewToken: novoToken })
    setReviewToken(novoToken)
    showToast('Novo link gerado!', 'success')
  }

  async function toggleVisivel(review) {
    await updateDoc(doc(db, 'stores', storeSlug, 'reviews', review.id), {
      visivel: !review.visivel,
    })
    loadReviews()
    showToast(review.visivel ? 'Avaliação ocultada' : 'Avaliação publicada', 'success')
  }

  async function handleDelete(id) {
    if (!confirm('Deseja excluir esta avaliação permanentemente?')) return
    await deleteDoc(doc(db, 'stores', storeSlug, 'reviews', id))
    loadReviews()
    showToast('Avaliação excluída', 'success')
  }

  return (
    <AdminLayout>
      <div className="dash-content">
        <div className="dash-page-header">
          <h1 className="dash-page-title">Avaliações</h1>
          <p className="dash-page-subtitle">
            Compartilhe o link com clientes que já compraram e gerencie o que aparece na home.
          </p>
        </div>

        <div className="orby-admin-layout">
          <div className="orby-admin-form review-link-box">
            <label>Link de avaliação</label>

            {reviewToken ? (
              <>
                <input type="text" value={reviewLink} readOnly />
                <div className="review-link-actions">
                  <button type="button" onClick={handleCopyLink}>
                    Copiar link
                  </button>
                  <button type="button" className="secondary" onClick={handleGerarToken}>
                    Gerar novo link
                  </button>
                </div>
              </>
            ) : (
              <button type="button" onClick={handleGerarToken}>
                Gerar link de avaliação
              </button>
            )}
          </div>

          <section className="orby-admin-list">
            <div className="orby-list-header">
              <h2>Avaliações recebidas</h2>
              <span>{reviews.length} avaliação(ões)</span>
            </div>

            {loading && <p>Carregando...</p>}

            {!loading && reviews.length === 0 && (
              <p>Nenhuma avaliação recebida ainda.</p>
            )}

            {reviews.map((review) => (
              <div key={review.id} className="orby-admin-banner">
                <div className="orby-banner-info">
                  <strong>
                    {review.customerName} — {'★'.repeat(review.rating)}
                    {'☆'.repeat(5 - review.rating)}
                  </strong>
                  {review.comment && <span>{review.comment}</span>}
                  <span>{review.visivel ? 'Visível na home' : 'Oculta'}</span>

                  <div className="admin-actions">
                    <button onClick={() => toggleVisivel(review)}>
                      {review.visivel ? 'Ocultar' : 'Publicar'}
                    </button>
                    <button onClick={() => handleDelete(review.id)}>Excluir</button>
                  </div>
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
      <Toast message={toast.message} type={toast.type} />
    </AdminLayout>
  )
}

export default AdminReviews