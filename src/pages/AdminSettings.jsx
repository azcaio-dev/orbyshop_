import { useEffect, useState } from 'react'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { useParams } from 'react-router-dom'
import { db } from '../services/firebase'
import Toast from '../components/Toast'
import AdminLayout from '../layouts/AdminLayout'

function AdminSettings() {
  const { storeSlug } = useParams()

  const [form, setForm] = useState({
    tagline: '',
    sobre: '',
    endereco: '',
    telefone: '',
    email: '',
    horario: '',
    whatsapp: '',
    instagram: '',
  })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState({ message: '', type: 'success' })

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast({ message: '', type: 'success' }), 2500)
  }

  async function loadStore() {
    setLoading(true)
    try {
      const storeRef = doc(db, 'stores', storeSlug)
      const storeSnap = await getDoc(storeRef)

      if (storeSnap.exists()) {
        const data = storeSnap.data()
        setForm({
          tagline: data.tagline || '',
          sobre: data.sobre || '',
          endereco: data.endereco || '',
          telefone: data.telefone || '',
          email: data.email || '',
          horario: data.horario || '',
          whatsapp: data.whatsapp || '',
          instagram: data.instagram || '',
        })
      }
    } catch (error) {
      showToast('Erro ao carregar configurações', 'error')
    }
    setLoading(false)
  }

  useEffect(() => { loadStore() }, [storeSlug])

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const storeRef = doc(db, 'stores', storeSlug)
      await updateDoc(storeRef, { ...form })
      showToast('Configurações salvas com sucesso!', 'success')
    } catch (error) {
      showToast('Erro ao salvar configurações', 'error')
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="dash-content">
          <p>Carregando...</p>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="dash-content">
        <div className="dash-page-header">
          <h1 className="dash-page-title">Configurações</h1>
          <p className="dash-page-subtitle">Informações exibidas no rodapé da sua loja.</p>
        </div>

        <form onSubmit={handleSubmit} className="orby-admin-form">
          <label>Tagline</label>
          <input
            type="text"
            name="tagline"
            value={form.tagline}
            onChange={handleChange}
            placeholder="Ex: Moda feminina com estilo e elegância"
          />

          <label>Sobre nós</label>
          <textarea
            name="sobre"
            value={form.sobre}
            onChange={handleChange}
            rows={4}
            placeholder="Um texto curto contando sobre a loja"
          />

          <label>Endereço</label>
          <input
            type="text"
            name="endereco"
            value={form.endereco}
            onChange={handleChange}
            placeholder="Rua, número, bairro, cidade"
          />

          <label>Telefone</label>
          <input
            type="text"
            name="telefone"
            value={form.telefone}
            onChange={handleChange}
            placeholder="(00) 00000-0000"
          />

          <label>Email</label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="contato@sualoja.com"
          />

          <label>Horário de funcionamento</label>
          <input
            type="text"
            name="horario"
            value={form.horario}
            onChange={handleChange}
            placeholder="Seg-Sex 9h-18h"
          />

          <label>WhatsApp</label>
          <input
            type="text"
            name="whatsapp"
            value={form.whatsapp}
            onChange={handleChange}
            placeholder="5581999999999 (só números, com DDI e DDD)"
          />

          <label>Instagram</label>
          <input
            type="text"
            name="instagram"
            value={form.instagram}
            onChange={handleChange}
            placeholder="https://instagram.com/sualoja"
          />

          <button type="submit" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar configurações'}
          </button>
        </form>
      </div>
      <Toast message={toast.message} type={toast.type} />
    </AdminLayout>
  )
}

export default AdminSettings