import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '../services/firebase'

function OrbyEditStore() {
  const navigate = useNavigate()
  const { storeSlug } = useParams()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [tagline, setTagline] = useState('')
  const [logo, setLogo] = useState('')
  const [logoFile, setLogoFile] = useState(null)
  const [whatsapp, setWhatsapp] = useState('')
  const [instagram, setInstagram] = useState('')
  const [email, setEmail] = useState('')
  const [active, setActive] = useState(true)
  const [plan, setPlan] = useState('basic')

  const [primary, setPrimary] = useState('#c5a19c')
  const [secondary, setSecondary] = useState('#eee3cf')
  const [background, setBackground] = useState('#f8f1ec')
  const [text, setText] = useState('#4f3f3c')

  const [showBrands, setShowBrands] = useState(true)
  const [showCategories, setShowCategories] = useState(true)
  const [brandsLabel, setBrandsLabel] = useState('Marcas')
  const [categoriesLabel, setCategoriesLabel] = useState('Categorias')

  const [messageIntro, setMessageIntro] = useState(
    'Olá! Tenho interesse nesses produtos:'
  )

  const uploadLogo = async (file) => {
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

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error?.message)
    }

    return data.secure_url
  }

  useEffect(() => {
    async function loadStore() {
      try {
        const storeRef = doc(db, 'stores', storeSlug)
        const storeSnap = await getDoc(storeRef)

        if (!storeSnap.exists()) {
          alert('Loja não encontrada')
          navigate('/orby-admin/dashboard')
          return
        }

        const data = storeSnap.data()

        setName(data.name || '')
        setTitle(data.title || '')
        setTagline(data.tagline || '')
        setLogo(data.logo || '')
        setWhatsapp(data.whatsapp || '')
        setInstagram(data.instagram || '')
        setEmail(data.email || '')
        setActive(data.active !== false)
        setPlan(data.plan || 'basic')

        setPrimary(data.colors?.primary || '#c5a19c')
        setSecondary(data.colors?.secondary || '#eee3cf')
        setBackground(data.colors?.background || '#f8f1ec')
        setText(data.colors?.text || '#4f3f3c')

        setShowBrands(data.menu?.showBrands !== false)
        setShowCategories(data.menu?.showCategories !== false)
        setBrandsLabel(data.menu?.brandsLabel || 'Marcas')
        setCategoriesLabel(data.menu?.categoriesLabel || 'Categorias')

        setMessageIntro(
          data.checkout?.messageIntro ||
            'Olá! Tenho interesse nesses produtos:'
        )
      } catch (error) {
        console.error(error)
        alert('Erro ao carregar loja')
      } finally {
        setLoading(false)
      }
    }

    loadStore()
  }, [storeSlug, navigate])

  async function handleSubmit(e) {
    e.preventDefault()

    setSaving(true)

    try {
      let logoUrl = logo

      if (logoFile) {
        logoUrl = await uploadLogo(logoFile)
      }

      await updateDoc(doc(db, 'stores', storeSlug), {
        name,
        title,
        tagline,
        logo: logoUrl,
        whatsapp,
        instagram,
        email,
        active,
        plan,

        colors: {
          primary,
          secondary,
          background,
          text,
        },

        menu: {
          showBrands,
          showCategories,
          brandsLabel,
          categoriesLabel,
        },

        checkout: {
          messageIntro,
        },
      })

      alert('Loja atualizada com sucesso!')
      navigate('/orby-admin/dashboard')
    } catch (error) {
      console.error(error)
      alert('Erro ao atualizar loja')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="orby-admin-page">
        <p>Carregando loja...</p>
      </main>
    )
  }

  return (
    <main className="orby-admin-page">
      <section className="orby-admin-header">
        <div>
          <h1>Editar loja</h1>
          <p>Atualize as informações de {name || storeSlug}.</p>
        </div>
      </section>

      <section className="orby-admin-layout">
        <form onSubmit={handleSubmit} className="orby-admin-form">
          <input
            type="text"
            placeholder="Nome da loja"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <input
            type="text"
            placeholder="Título da aba"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <input
            type="text"
            placeholder="Tagline"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
          />

          <label>Logo da loja</label>

          {logo && (
            <img
              src={logo}
              alt={name}
              style={{
                width: '80px',
                height: '80px',
                objectFit: 'cover',
                borderRadius: '12px',
                marginBottom: '10px',
              }}
            />
          )}

          <input
            type="file"
            accept="image/*"
            onChange={(e) => setLogoFile(e.target.files[0])}
          />

          <input
            type="text"
            placeholder="WhatsApp"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
          />

          <input
            type="text"
            placeholder="Instagram URL"
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
          />

          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label className="orby-switch-row">
                <span>Loja ativa</span>

                <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                />

                <h3>Plano da loja</h3>
                <select
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                >
                  <option value="basic">
                    BASIC
                  </option>

                  <option value="pro">
                    PRO
                  </option>
                </select>

                <span className="orby-switch"></span>
                </label>

                <h3>Cores da loja</h3>

                <div className="color-field">
                <label>Cor principal</label>

                <div className="color-input-row">
                    <input
                    type="color"
                    value={primary}
                    onChange={(e) => setPrimary(e.target.value)}
                    />

                    <span>{primary}</span>

                    <div
                    className="color-preview"
                    style={{ backgroundColor: primary }}
                    />
                </div>
                </div>

                <div className="color-field">
                <label>Cor secundária</label>

                <div className="color-input-row">
                    <input
                    type="color"
                    value={secondary}
                    onChange={(e) => setSecondary(e.target.value)}
                    />

                    <span>{secondary}</span>

                    <div
                    className="color-preview"
                    style={{ backgroundColor: secondary }}
                    />
                </div>
                </div>

                <div className="color-field">
                <label>Cor de fundo</label>

                <div className="color-input-row">
                    <input
                    type="color"
                    value={background}
                    onChange={(e) => setBackground(e.target.value)}
                    />

                    <span>{background}</span>

                    <div
                    className="color-preview"
                    style={{ backgroundColor: background }}
                    />
                </div>
                </div>

                <div className="color-field">
                <label>Cor do texto</label>

                <div className="color-input-row">
                    <input
                    type="color"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    />

                    <span>{text}</span>

                    <div
                    className="color-preview"
                    style={{ backgroundColor: text }}
                    />
                </div>
                </div>

                <h3>Menu</h3>

                <label className="orby-switch-row">
                <span>Mostrar marcas/times</span>

                <input
                    type="checkbox"
                    checked={showBrands}
                    onChange={(e) => setShowBrands(e.target.checked)}
                />

                <span className="orby-switch"></span>
                </label>

                <input
                type="text"
                placeholder="Label de marcas"
                value={brandsLabel}
                onChange={(e) => setBrandsLabel(e.target.value)}
                />

                <label className="orby-switch-row">
                <span>Mostrar categorias/peças</span>

                <input
                    type="checkbox"
                    checked={showCategories}
                    onChange={(e) => setShowCategories(e.target.checked)}
                />

                <span className="orby-switch"></span>
                </label>

                <input
                type="text"
                placeholder="Label de categorias"
                value={categoriesLabel}
                onChange={(e) => setCategoriesLabel(e.target.value)}
                />

                <h3>Checkout</h3>

                <textarea
            placeholder="Mensagem inicial do WhatsApp"
            value={messageIntro}
            onChange={(e) => setMessageIntro(e.target.value)}
          />

          <button type="submit" disabled={saving}>
            {saving ? 'Enviando logo e salvando...' : 'Salvar alterações'}
          </button>

          <button
            type="button"
            className="cancel-edit"
            onClick={() => navigate('/orby-admin/dashboard')}
          >
            Voltar
          </button>
        </form>
      </section>
    </main>
  )
}

export default OrbyEditStore