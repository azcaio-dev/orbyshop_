import { useEffect, useState } from 'react'
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../services/firebase'
import Toast from '../components/Toast'
import { useParams } from 'react-router-dom'
import AdminLayout from '../layouts/AdminLayout'

function AdminBanners() {
  const [banners, setBanners] = useState([])
  const [file, setFile] = useState(null)
  const [fileDesktop, setFileDesktop] = useState(null)
  const [redirectValue, setRedirectValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState({ message: '', type: 'success' })
  const { storeSlug } = useParams()

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast({ message: '', type: 'success' }), 2500)
  }

  async function loadBanners() {
    const snapshot = await getDocs(collection(db, 'stores', storeSlug, 'banners'))
    setBanners(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
  }

  useEffect(() => { loadBanners() }, [storeSlug])

  const uploadImage = async (file) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('upload_preset', 'loja-labany')
    const response = await fetch('https://api.cloudinary.com/v1_1/dcqroxlt0/image/upload', { method: 'POST', body: formData })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error?.message)
    return data.secure_url
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!file) { showToast('Selecione uma imagem', 'warning'); return }
    setLoading(true)
    try {
      const image = await uploadImage(file)

      // Imagem de desktop é opcional. Se não for enviada, o site
      // usa a mesma imagem do mobile nas telas grandes.
      const imageDesktop = fileDesktop ? await uploadImage(fileDesktop) : null

      await addDoc(collection(db, 'stores', storeSlug, 'banners'), {
        image,
        imageDesktop,
        active: true,
        redirectType: redirectValue ? 'section' : 'none', redirectValue,
      })
      setFile(null); setFileDesktop(null); setRedirectValue(''); e.target.reset(); loadBanners()
      showToast('Banner cadastrado com sucesso!', 'success')
    } catch (error) { showToast('Erro ao cadastrar banner', 'error') }
    setLoading(false)
  }

  async function handleDelete(id) {
    if (!confirm('Deseja excluir este banner?')) return
    await deleteDoc(doc(db, 'stores', storeSlug, 'banners', id))
    loadBanners(); showToast('Banner excluído', 'success')
  }

  async function toggleActive(banner) {
    await updateDoc(doc(db, 'stores', storeSlug, 'banners', banner.id), { active: !banner.active })
    loadBanners()
    showToast(banner.active ? 'Banner desativado' : 'Banner ativado', 'success')
  }

  function getRedirectLabel(banner) {
    if (!banner.redirectValue) return 'Sem redirecionamento'
    const labels = { all: 'Todos os produtos', launch: 'Lançamentos', bestseller: 'Mais vendidos', outlet: 'Outlet' }
    return labels[banner.redirectValue] || 'Sem redirecionamento'
  }

  return (
    <AdminLayout>
      <div className="dash-content">
        <div className="dash-page-header">
          <h1 className="dash-page-title">Banners</h1>
          <p className="dash-page-subtitle">Cadastre e controle os banners da página inicial.</p>
        </div>

        <div className="orby-admin-layout">
          <form onSubmit={handleSubmit} className="orby-admin-form">
            <label>Imagem do banner (usada no celular e, se não enviar a de desktop, também no computador)</label>
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0])} required />
            <small style={{ opacity: 0.7, marginTop: '-8px', marginBottom: '4px' }}>
              Proporção recomendada: larga e baixa, tipo 900x450px
            </small>

            <label>Imagem para desktop (opcional)</label>
            <input type="file" accept="image/*" onChange={(e) => setFileDesktop(e.target.files[0])} />
            <small style={{ opacity: 0.7, marginTop: '-8px', marginBottom: '4px' }}>
              Só envie se quiser um recorte diferente em telas grandes. Proporção recomendada: bem larga, tipo 1920x440px
            </small>

            <label>Redirecionar para</label>
            <select value={redirectValue} onChange={(e) => setRedirectValue(e.target.value)}>
              <option value="">Nenhum redirecionamento</option>
              <option value="all">Todos os produtos</option>
              <option value="launch">Lançamentos</option>
              <option value="bestseller">Mais vendidos</option>
              <option value="outlet">Outlet</option>
            </select>
            <button type="submit" disabled={loading}>{loading ? 'Enviando...' : 'Cadastrar banner'}</button>
          </form>

          <section className="orby-admin-list">
            <div className="orby-list-header">
              <h2>Banners cadastrados</h2>
              <span>{banners.length} banner(s)</span>
            </div>
            {banners.map((banner) => (
              <div key={banner.id} className="orby-admin-banner">
                <img src={banner.image} alt="Banner" loading="lazy" onError={(e) => { e.target.src = '/placeholder.png' }} />
                <div className="orby-banner-info">
                  <strong>{banner.active ? 'Ativo' : 'Inativo'}</strong>
                  <span>{getRedirectLabel(banner)}</span>
                  <span>{banner.imageDesktop ? 'Com imagem de desktop própria' : 'Usando a mesma imagem no desktop'}</span>
                  <div className="admin-actions">
                    <button onClick={() => toggleActive(banner)}>{banner.active ? 'Desativar' : 'Ativar'}</button>
                    <button onClick={() => handleDelete(banner.id)}>Excluir</button>
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

export default AdminBanners