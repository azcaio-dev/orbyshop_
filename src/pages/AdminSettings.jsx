import { useEffect, useState } from 'react'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { useParams } from 'react-router-dom'
import { db } from '../services/firebase'
import Toast from '../components/Toast'
import AdminLayout from '../layouts/AdminLayout'

const PERFIL_VAZIO = {
  id: null,
  nome: '',
  pesoMedioPorItem: '',
  pesoEmbalagemVazia: '',
  itensPorPacote: 1,
  dimensoes: { altura: '', largura: '', comprimento: '' },
}

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

  // Configuração de frete SEDEX/Correios
  const [freteAtivo, setFreteAtivo] = useState(false)
  const [cepOrigem, setCepOrigem] = useState('')
  const [perfis, setPerfis] = useState([]) // lista de modelos de envio (peso/dimensões)

  // Modal de criar/editar perfil de envio
  const [modalAberto, setModalAberto] = useState(false)
  const [perfilEditando, setPerfilEditando] = useState(PERFIL_VAZIO)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingCep, setSavingCep] = useState(false)
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
          setFreteAtivo(data.frete.ativo || false)
          setCepOrigem(data.frete.cepOrigem || '')
          setPerfis(data.frete.perfis || [])
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

  // --- Toggle de ativar/desativar frete: salva sozinho, sem depender de botão ---
  async function handleFreteToggle() {
    const novoValor = !freteAtivo
    setFreteAtivo(novoValor)

    try {
      const storeRef = doc(db, 'stores', storeSlug)
      await updateDoc(storeRef, { 'frete.ativo': novoValor })
      showToast(novoValor ? 'Frete via SEDEX ativado!' : 'Frete via SEDEX desativado.', 'success')
    } catch (error) {
      setFreteAtivo(!novoValor)
      showToast('Erro ao atualizar. Tente novamente.', 'error')
    }
  }

  // --- CEP de origem: salva sozinho ao sair do campo ---
  function handleCepChange(e) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 8)
    const masked = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
    setCepOrigem(masked)
  }

  async function handleCepBlur() {
    const cepLimpo = cepOrigem.replace(/\D/g, '')
    if (cepLimpo.length !== 8) return

    setSavingCep(true)
    try {
      const storeRef = doc(db, 'stores', storeSlug)
      await updateDoc(storeRef, { 'frete.cepOrigem': cepLimpo })
      showToast('CEP de origem salvo!', 'success')
    } catch (error) {
      showToast('Erro ao salvar CEP.', 'error')
    }
    setSavingCep(false)
  }

  // --- Perfis de envio (modelos de peso/dimensão) ---
  function abrirNovoPerfil() {
    setPerfilEditando({ ...PERFIL_VAZIO, id: crypto.randomUUID() })
    setModalAberto(true)
  }

  function abrirEditarPerfil(perfil) {
    setPerfilEditando({ ...perfil })
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setPerfilEditando(PERFIL_VAZIO)
  }

  function handlePerfilChange(e) {
    const { name, value } = e.target
    setPerfilEditando((prev) => ({ ...prev, [name]: value }))
  }

  function handlePerfilDimensaoChange(e) {
    const { name, value } = e.target
    setPerfilEditando((prev) => ({
      ...prev,
      dimensoes: { ...prev.dimensoes, [name]: value },
    }))
  }

  async function salvarPerfis(novaLista) {
    setSaving(true)
    try {
      const storeRef = doc(db, 'stores', storeSlug)
      await updateDoc(storeRef, { 'frete.perfis': novaLista })
      setPerfis(novaLista)
      showToast('Perfis de envio atualizados!', 'success')
    } catch (error) {
      showToast('Erro ao salvar perfil de envio.', 'error')
    }
    setSaving(false)
  }

  async function handleSalvarPerfil(e) {
    e.preventDefault()

    if (!perfilEditando.nome.trim()) {
      showToast('Dê um nome pro perfil de envio.', 'error')
      return
    }

    const perfilFormatado = {
      id: perfilEditando.id,
      nome: perfilEditando.nome.trim(),
      pesoMedioPorItem: Number(perfilEditando.pesoMedioPorItem) || 0,
      pesoEmbalagemVazia: Number(perfilEditando.pesoEmbalagemVazia) || 0,
      itensPorPacote: Number(perfilEditando.itensPorPacote) || 1,
      dimensoes: {
        altura: Number(perfilEditando.dimensoes.altura) || 0,
        largura: Number(perfilEditando.dimensoes.largura) || 0,
        comprimento: Number(perfilEditando.dimensoes.comprimento) || 0,
      },
    }

    const jaExiste = perfis.some((p) => p.id === perfilFormatado.id)
    const novaLista = jaExiste
      ? perfis.map((p) => (p.id === perfilFormatado.id ? perfilFormatado : p))
      : [...perfis, perfilFormatado]

    await salvarPerfis(novaLista)
    fecharModal()
  }

  async function handleExcluirPerfil(id) {
    if (!window.confirm('Remover esse perfil de envio? Produtos que usam ele vão precisar de um novo perfil selecionado.')) {
      return
    }
    const novaLista = perfis.filter((p) => p.id !== id)
    await salvarPerfis(novaLista)
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

        {/* --- Seção de frete SEDEX/Correios --- */}
        <div className="orby-card" style={{ marginTop: '2rem' }}>
          <div className="orby-toggle-row">
            <div>
              <h2 className="orby-card-title">Frete via SEDEX/Correios</h2>
              <p className="orby-card-subtitle">
                Permite que o cliente simule o frete direto no carrinho antes de fechar o pedido.
              </p>
            </div>
            <span className="orby-ios-switch">
              <input
                type="checkbox"
                checked={freteAtivo}
                onChange={handleFreteToggle}
              />
              <span className="orby-ios-switch-slider" />
            </span>
          </div>

          {freteAtivo && (
            <div className="orby-field" style={{ maxWidth: 260, marginTop: 16 }}>
              <label>CEP de origem</label>
              <input
                type="text"
                value={cepOrigem}
                onChange={handleCepChange}
                onBlur={handleCepBlur}
                placeholder="00000-000"
                maxLength={9}
              />
              {savingCep && <span className="orby-field-hint">Salvando...</span>}
            </div>
          )}
        </div>

        {/* --- Perfis de envio (modelos de peso/dimensão) --- */}
        {freteAtivo && (
          <div className="orby-card" style={{ marginTop: '1.25rem' }}>
            <div className="orby-card-header-row">
              <div>
                <h2 className="orby-card-title">Perfis de envio</h2>
                <p className="orby-card-subtitle">
                  Um perfil pra cada tipo de produto que pesa/mede diferente. Se você cadastrar só um, ele vale pra loja toda automaticamente.
                </p>
              </div>
              <button type="button" className="orby-btn-primary" onClick={abrirNovoPerfil}>
                + Novo perfil
              </button>
            </div>

            {perfis.length === 0 ? (
              <p className="orby-empty-state">Nenhum perfil cadastrado ainda.</p>
            ) : (
              <table className="orby-table">
                <thead>
                  <tr>
                    <th>Nome do perfil</th>
                    <th>Peso médio (kg)</th>
                    <th>Dimensões do pacote (cm)</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {perfis.map((perfil) => (
                    <tr key={perfil.id}>
                      <td>{perfil.nome}</td>
                      <td>{perfil.pesoMedioPorItem}</td>
                      <td>
                        {perfil.dimensoes.altura} x {perfil.dimensoes.largura} x {perfil.dimensoes.comprimento}
                      </td>
                      <td className="orby-table-actions">
                        <button type="button" onClick={() => abrirEditarPerfil(perfil)} title="Editar">
                          ✎
                        </button>
                        <button type="button" onClick={() => handleExcluirPerfil(perfil.id)} title="Excluir">
                          🗑
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* --- Modal de criar/editar perfil --- */}
        {modalAberto && (
          <div className="orby-modal-overlay" onClick={fecharModal}>
            <div className="orby-modal" onClick={(e) => e.stopPropagation()}>
              <h3>{perfis.some((p) => p.id === perfilEditando.id) ? 'Editar perfil' : 'Novo perfil de envio'}</h3>

              <form onSubmit={handleSalvarPerfil} className="orby-admin-form">
                <label>Nome do perfil</label>
                <input
                  type="text"
                  name="nome"
                  value={perfilEditando.nome}
                  onChange={handlePerfilChange}
                  placeholder="Ex: Camisas de time"
                />

                <div className="orby-form-grid-2">
                  <div className="orby-field">
                    <label>Peso médio por item (kg)</label>
                    <input
                      type="number"
                      name="pesoMedioPorItem"
                      value={perfilEditando.pesoMedioPorItem}
                      onChange={handlePerfilChange}
                      step="0.001"
                      min={0}
                      placeholder="Ex: 0.3"
                    />
                  </div>
                  <div className="orby-field">
                    <label>Peso da embalagem vazia (kg)</label>
                    <input
                      type="number"
                      name="pesoEmbalagemVazia"
                      value={perfilEditando.pesoEmbalagemVazia}
                      onChange={handlePerfilChange}
                      step="0.001"
                      min={0}
                      placeholder="Ex: 0.05"
                    />
                  </div>
                </div>

                <div className="orby-field">
                  <label>Itens por pacote</label>
                  <input
                    type="number"
                    name="itensPorPacote"
                    value={perfilEditando.itensPorPacote}
                    onChange={handlePerfilChange}
                    min={1}
                    placeholder="Ex: 5"
                  />
                </div>

                <div className="orby-field">
                  <label>Dimensões padrão do pacote (cm)</label>
                  <div className="orby-form-grid-3">
                    <div className="orby-field orby-field-mini">
                      <span>Altura</span>
                      <input
                        type="number"
                        name="altura"
                        value={perfilEditando.dimensoes.altura}
                        onChange={handlePerfilDimensaoChange}
                        min={0}
                      />
                    </div>
                    <div className="orby-field orby-field-mini">
                      <span>Largura</span>
                      <input
                        type="number"
                        name="largura"
                        value={perfilEditando.dimensoes.largura}
                        onChange={handlePerfilDimensaoChange}
                        min={0}
                      />
                    </div>
                    <div className="orby-field orby-field-mini">
                      <span>Comprimento</span>
                      <input
                        type="number"
                        name="comprimento"
                        value={perfilEditando.dimensoes.comprimento}
                        onChange={handlePerfilDimensaoChange}
                        min={0}
                      />
                    </div>
                  </div>
                </div>

                <div className="orby-modal-actions">
                  <button type="button" className="orby-btn-secondary" onClick={fecharModal}>
                    Cancelar
                  </button>
                  <button type="submit" className="orby-btn-primary" disabled={saving}>
                    {saving ? 'Salvando...' : 'Salvar perfil'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
      <Toast message={toast.message} type={toast.type} />
    </AdminLayout>
  )
}

export default AdminSettings