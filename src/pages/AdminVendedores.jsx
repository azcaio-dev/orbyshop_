import { useEffect, useState } from 'react'
import { collection, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore'
import { db } from '../services/firebase'
import AdminLayout from '../layouts/AdminLayout'
import Toast from '../components/Toast'
import AdminDialog from '../components/AdminDialog'
import useStore from '../hooks/useStore'

function AdminVendedores() {
  const { store, loading: storeLoading, storeSlug } = useStore()
  const [vendedores, setVendedores] = useState([])
  const [nome, setNome] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState({ message: '', type: 'success' })
  const [dialog, setDialog] = useState({ message: '', onConfirm: null })
  const [copied, setCopied] = useState(null)

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast({ message: '', type: 'success' }), 2500)
  }
  function showDialog(message, onConfirm) { setDialog({ message, onConfirm }) }
  function closeDialog() { setDialog({ message: '', onConfirm: null }) }

  async function loadVendedores() {
    const snapshot = await getDocs(collection(db, 'stores', storeSlug, 'vendedores'))
    setVendedores(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })))
  }

  useEffect(() => { if (storeSlug) loadVendedores() }, [storeSlug])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!nome.trim() || !whatsapp.trim()) { showToast('Preencha nome e WhatsApp', 'warning'); return }

    // Gera slug a partir do nome: "João Silva" → "joao-silva"
    const slug = nome.trim()
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    setLoading(true)
    try {
      await addDoc(collection(db, 'stores', storeSlug, 'vendedores'), {
        nome: nome.trim(),
        whatsapp: whatsapp.replace(/\D/g, ''),
        slug,
        createdAt: new Date(),
      })
      setNome(''); setWhatsapp('')
      loadVendedores()
      showToast('Vendedor cadastrado!', 'success')
    } catch { showToast('Erro ao cadastrar vendedor', 'error') }
    setLoading(false)
  }

  function handleDelete(id) {
    showDialog('Deseja excluir este vendedor?', async () => {
      closeDialog()
      await deleteDoc(doc(db, 'stores', storeSlug, 'vendedores', id))
      loadVendedores()
      showToast('Vendedor removido', 'success')
    })
  }

  function getLink(slug) {
    return `${window.location.origin}/${storeSlug}?v=${slug}`
  }

  function copyLink(slug, id) {
    navigator.clipboard.writeText(getLink(slug))
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  if (storeLoading || !store) return <AdminLayout><div className="dash-loading">Carregando...</div></AdminLayout>

  return (
    <AdminLayout>
      <div className="dash-content">
        <div className="dash-page-header">
          <h1 className="dash-page-title">Vendedores</h1>
          <p className="dash-page-subtitle">Cadastre vendedores com links personalizados para rastrear atendimentos.</p>
        </div>

        <div className="orby-admin-layout">
          <form onSubmit={handleSubmit} className="orby-admin-form">
            <label>Nome do vendedor</label>
            <input type="text" placeholder="Ex: João Silva" value={nome} onChange={(e) => setNome(e.target.value)} />

            <label>WhatsApp</label>
            <input type="text" placeholder="Ex: 5581999999999" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
            <p style={{ fontSize: 12, color: '#6b7280', margin: '-8px 0 0' }}>
              Número completo com DDI e DDD, sem espaços ou símbolos.
            </p>

            <button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Cadastrar vendedor'}
            </button>
          </form>

          <section className="orby-admin-list">
            <div className="orby-list-header">
              <h2>Vendedores cadastrados</h2>
              <span>{vendedores.length} vendedor(es)</span>
            </div>

            {vendedores.length === 0 ? (
              <div className="dash-empty" style={{ padding: '24px 0' }}>
                <i className="ti ti-users" style={{ fontSize: 32, opacity: 0.4 }} />
                <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>Nenhum vendedor cadastrado ainda.</p>
              </div>
            ) : (
              vendedores.map((v) => (
                <div key={v.id} className="orby-admin-item" style={{ marginBottom: 12 }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <strong style={{ fontSize: 15 }}>{v.nome}</strong>
                    <p style={{ fontSize: 13, color: '#6b7280', margin: '2px 0' }}>
                      WhatsApp: {v.whatsapp}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8,
                      padding: '8px 10px', background: '#f6f7fb', borderRadius: 8 }}>
                      <p style={{ fontSize: 12, color: '#534ab7', margin: 0, flex: 1,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {getLink(v.slug)}
                      </p>
                      <button
                        onClick={() => copyLink(v.slug, v.id)}
                        style={{ flexShrink: 0, background: copied === v.id ? '#eeedfe' : '#7f77dd',
                          color: copied === v.id ? '#534ab7' : '#fff', border: 'none',
                          borderRadius: 6, padding: '5px 10px', fontSize: 12,
                          fontWeight: 600, cursor: 'pointer', transition: '0.15s' }}>
                        {copied === v.id ? '✓ Copiado' : 'Copiar link'}
                      </button>
                    </div>

                    <div style={{ marginTop: 8 }}>
                      <button className="admin-btn admin-btn--danger-outline"
                        onClick={() => handleDelete(v.id)}>
                        Excluir
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </section>
        </div>
      </div>

      <Toast message={toast.message} type={toast.type} />
      <AdminDialog message={dialog.message} onConfirm={dialog.onConfirm} onCancel={closeDialog} />
    </AdminLayout>
  )
}

export default AdminVendedores