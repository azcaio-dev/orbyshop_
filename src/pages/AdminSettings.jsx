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

  // Configuração de frete SEDEX/Correios (feature separada, com toggle próprio)
  const [frete, setFrete] = useState({
    ativo: false,
    cepOrigem: '',
    itensPorPacote: 1,
    pesoMedioPorItem: '', // em kg
    pesoEmbalagemVazia: '', // em kg
    dimensoes: {
      altura: '',
      largura: '',
      comprimento: '',
    },
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

        if (data.frete) {
          setFrete({
            ativo: data.frete.ativo || false,
            cepOrigem: data.frete.cepOrigem || '',
            itensPorPacote: data.frete.itensPorPacote || 1,
            pesoMedioPorItem: data.frete.pesoMedioPorItem || '',
            pesoEmbalagemVazia: data.frete.pesoEmbalagemVazia || '',
            dimensoes: {
              altura: data.frete.dimensoes?.altura || '',
              largura: data.frete.dimensoes?.largura || '',
              comprimento: data.frete.dimensoes?.comprimento || '',
            },
          })
        }
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

  async function handleFreteToggle() {
    const novoValor = !frete.ativo
    setFrete((prev) => ({ ...prev, ativo: novoValor }))

    try {
      const storeRef = doc(db, 'stores', storeSlug)
      await updateDoc(storeRef, { 'frete.ativo': novoValor })
      showToast(novoValor ? 'Frete via SEDEX ativado!' : 'Frete via SEDEX desativado.', 'success')
    } catch (error) {
      // Reverte o toggle visualmente se salvar falhar
      setFrete((prev) => ({ ...prev, ativo: !novoValor }))
      showToast('Erro ao atualizar. Tente novamente.', 'error')
    }
  }

  function handleFreteChange(e) {
    const { name, value } = e.target
    setFrete((prev) => ({ ...prev, [name]: value }))
  }

  function handleDimensaoChange(e) {
    const { name, value } = e.target
    setFrete((prev) => ({
      ...prev,
      dimensoes: { ...prev.dimensoes, [name]: value },
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const storeRef = doc(db, 'stores', storeSlug)
      await updateDoc(storeRef, {
        ...form,
        frete: {
          ativo: frete.ativo,
          cepOrigem: frete.cepOrigem.replace(/\D/g, ''),
          itensPorPacote: Number(frete.itensPorPacote) || 1,
          pesoMedioPorItem: Number(frete.pesoMedioPorItem) || 0,
          pesoEmbalagemVazia: Number(frete.pesoEmbalagemVazia) || 0,
          dimensoes: {
            altura: Number(frete.dimensoes.altura) || 0,
            largura: Number(frete.dimensoes.largura) || 0,
            comprimento: Number(frete.dimensoes.comprimento) || 0,
          },
        },
      })
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

        {/* --- Seção de frete SEDEX/Correios --- */}
        <div className="dash-page-header" style={{ marginTop: '2.5rem' }}>
          <h1 className="dash-page-title">Frete via SEDEX</h1>
          <p className="dash-page-subtitle">
            Permite que o cliente simule o frete direto no carrinho antes de fechar o pedido.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="orby-admin-form">
          <label className="orby-toggle-row">
            <span>Oferecer envio por SEDEX/Correios</span>
            <span className="orby-ios-switch">
              <input
                type="checkbox"
                checked={frete.ativo}
                onChange={handleFreteToggle}
              />
              <span className="orby-ios-switch-slider" />
            </span>
          </label>

          {frete.ativo && (
            <>
              <label>CEP de origem</label>
              <input
                type="text"
                name="cepOrigem"
                value={frete.cepOrigem}
                onChange={handleFreteChange}
                placeholder="00000-000"
                maxLength={9}
              />

              <label>Itens por pacote</label>
              <input
                type="number"
                name="itensPorPacote"
                value={frete.itensPorPacote}
                onChange={handleFreteChange}
                min={1}
                placeholder="Ex: 3"
              />

              <label>Peso médio por item (kg)</label>
              <input
                type="number"
                name="pesoMedioPorItem"
                value={frete.pesoMedioPorItem}
                onChange={handleFreteChange}
                step="0.001"
                min={0}
                placeholder="Ex: 0.05 (50g)"
              />

              <label>Peso da embalagem vazia (kg)</label>
              <input
                type="number"
                name="pesoEmbalagemVazia"
                value={frete.pesoEmbalagemVazia}
                onChange={handleFreteChange}
                step="0.001"
                min={0}
                placeholder="Ex: 0.03 (30g)"
              />

              <label>Dimensões padrão do pacote (cm)</label>
              <div className="orby-form-grid">
                <input
                  type="number"
                  name="altura"
                  value={frete.dimensoes.altura}
                  onChange={handleDimensaoChange}
                  placeholder="Altura"
                  min={0}
                />
                <input
                  type="number"
                  name="largura"
                  value={frete.dimensoes.largura}
                  onChange={handleDimensaoChange}
                  placeholder="Largura"
                  min={0}
                />
                <input
                  type="number"
                  name="comprimento"
                  value={frete.dimensoes.comprimento}
                  onChange={handleDimensaoChange}
                  placeholder="Comprimento"
                  min={0}
                />
              </div>
            </>
          )}

          {frete.ativo && (
            <button type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar configurações de frete'}
            </button>
          )}
        </form>
      </div>
      <Toast message={toast.message} type={toast.type} />
    </AdminLayout>
  )
}

export default AdminSettings