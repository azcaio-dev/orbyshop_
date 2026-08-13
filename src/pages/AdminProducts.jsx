import { useEffect, useState, useRef } from 'react'
import { addDoc, collection, deleteDoc, doc, getDocs, updateDoc } from 'firebase/firestore'
import { db } from '../services/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { auth } from '../services/firebase'
import Toast from '../components/Toast'
import AdminLayout from '../layouts/AdminLayout'
import useStore from '../hooks/useStore'
import { hasFeature } from '../utils/features'
import lupaIcon from '../assets/lupa.png'

function AdminProducts() {
  const [products, setProducts] = useState([])
  const [editingId, setEditingId] = useState(null)
  const { store, loading: storeLoading, storeSlug } = useStore()
  const brandLabel = store?.menu?.brandsLabel || 'Marca'
  const categoryLabel = store?.menu?.categoriesLabel || 'Peças'
  const [name, setName] = useState('')
  const [oldPrice, setOldPrice] = useState('')
  const [price, setPrice] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('vista')
  const [pixPrice, setPixPrice] = useState('')
  const [description, setDescription] = useState('')
  const [mainColor, setMainColor] = useState('')
  const [productImages, setProductImages] = useState([null])
  const [loading, setLoading] = useState(false)
  const [brand, setBrand] = useState('')
  const [category, setCategory] = useState('')
  const [productSection, setProductSection] = useState('')
  const [sizeType, setSizeType] = useState('letter')
  const [sizes, setSizes] = useState([])
  const [costPrice, setCostPrice] = useState('')
  const [sizeStocks, setSizeStocks] = useState({})
  const [variationSizeStocks, setVariationSizeStocks] = useState({})
  const [showVariationForm, setShowVariationForm] = useState(false)
  const [variationColorName, setVariationColorName] = useState('')
  const [variationFile, setVariationFile] = useState(null)
  const [variationSizeType, setVariationSizeType] = useState('letter')
  const [variationSizes, setVariationSizes] = useState([])
  const [variations, setVariations] = useState([])
  const [toast, setToast] = useState({ message: '', type: 'success' })
  const [productSearch, setProductSearch] = useState('')
  const [perfilEnvioId, setPerfilEnvioId] = useState('')
  const navigate = useNavigate()
  const formRef = useRef(null)

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast({ message: '', type: 'success' }), 2500)
  }

  const lastSizeTypeKey = `orby-last-size-type-${storeSlug}`

  function getLastSizeType() {
    return localStorage.getItem(lastSizeTypeKey) || 'letter'
  }

  function handleSizeTypeChange(value) {
    setSizeType(value)
    setSizes(value === 'unique' ? ['Tamanho único'] : [])
    localStorage.setItem(lastSizeTypeKey, value)
  }

  // ✅ Ao trocar de loja/carregar a página, usa o último tipo de tamanho usado nessa loja
  useEffect(() => {
    if (!storeSlug) return
    const restoredSizeType = getLastSizeType()
    setSizeType(restoredSizeType)
    setSizes(restoredSizeType === 'unique' ? ['Tamanho único'] : [])
  }, [storeSlug])

  // --- Frete: perfis de envio cadastrados na loja ---
  const perfisEnvio = store?.frete?.perfis || []
  const freteAtivo = store?.frete?.ativo === true
  // Só exige escolha do lojista quando existe mais de um perfil; com 0 ou 1, é automático
  const precisaEscolherPerfil = freteAtivo && perfisEnvio.length > 1

  // Se a loja só tem 1 perfil, aplica ele automaticamente (sem exibir seletor)
  useEffect(() => {
    if (freteAtivo && perfisEnvio.length === 1 && !editingId) {
      setPerfilEnvioId(perfisEnvio[0].id)
    }
  }, [freteAtivo, perfisEnvio.length, editingId])

  const brands = [...new Set(products.map((p) => p.brand).filter(Boolean))]
  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))]
  const filteredAdminProducts = products.filter((product) => {
    const term = productSearch.trim().toLowerCase()
    if (!term) return true
    return [product.name, product.brand, product.category].some((field) => (field || '').toLowerCase().includes(term))
  })
  const letterSizes = ['PP','P','M','G','GG','G1','G2','G3']
  const numberSizes = ['28','29','30','31','32','33','34','35','36','37','38','39','40','41','42','43','44','45','46','47','48','49','50','51','52','53','54','55','56']
  const ageSizes = ['3 meses','6 meses','9 meses','1 ano','2 anos','3 anos','4 anos','5 anos','6 anos','7 anos','8 anos','9 anos','10 anos','11 anos','12 anos','13 anos','14 anos']
  const sizeOptions = sizeType === 'letter' ? letterSizes : sizeType === 'number' ? numberSizes : sizeType === 'age' ? ageSizes : ['Tamanho único']
  const variationSizeOptions = variationSizeType === 'letter' ? letterSizes : variationSizeType === 'number' ? numberSizes : variationSizeType === 'age' ? ageSizes : ['Tamanho único']
  const paymentMethodOptions = [
    { value: 'vista', label: 'À vista' },
    ...Array.from({ length: 10 }, (_, i) => ({ value: `${i + 1}x`, label: `${i + 1}x sem juros` })),
  ]

  function toggleSize(size) {
    setSizes((prev) => {
      const already = prev.includes(size)
      if (already) { setSizeStocks((s) => { const u = { ...s }; delete u[size]; return u }); return prev.filter((i) => i !== size) }
      setSizeStocks((s) => ({ ...s, [size]: 1 }))
      return [...prev, size]
    })
  }

  function updateSizeStock(size, value) { setSizeStocks((prev) => ({ ...prev, [size]: value })) }

  function toggleVariationSize(size) {
    setVariationSizes((prev) => {
      const already = prev.includes(size)
      if (already) { setVariationSizeStocks((s) => { const u = { ...s }; delete u[size]; return u }); return prev.filter((i) => i !== size) }
      setVariationSizeStocks((s) => ({ ...s, [size]: 1 }))
      return [...prev, size]
    })
  }

  function updateVariationSizeStock(size, value) { setVariationSizeStocks((prev) => ({ ...prev, [size]: value })) }
  function updateProductImage(index, file) { setProductImages((prev) => { const u = [...prev]; u[index] = file; return u }) }
  function addNewImageField() { setProductImages((prev) => [...prev, null]) }

  useEffect(() => { if (store) document.title = `Produtos - ${store.name}` }, [store])
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => { if (!user) navigate('/admin') })
    return () => unsubscribe()
  }, [navigate])

  async function loadProducts() {
    const snapshot = await getDocs(collection(db, 'stores', storeSlug, 'products'))
    setProducts(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
  }

  useEffect(() => { loadProducts() }, [storeSlug])

  function compressImage(file, maxWidth = 1000, quality = 0.75) {
    return new Promise((resolve, reject) => {
      const img = new Image(); const reader = new FileReader()
      reader.onload = (e) => { img.src = e.target.result }
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const scale = Math.min(maxWidth / img.width, 1)
        canvas.width = img.width * scale; canvas.height = img.height * scale
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error('Erro ao comprimir imagem')); return }
          resolve(new File([blob], file.name.replace(/\.[^/.]+$/, '.webp'), { type: 'image/webp' }))
        }, 'image/webp', quality)
      }
      img.onerror = reject; reader.onerror = reject; reader.readAsDataURL(file)
    })
  }

  const uploadImage = async (file) => {
    const compressedFile = await compressImage(file)
    const formData = new FormData()
    formData.append('file', compressedFile); formData.append('upload_preset', 'loja-labany')
    const response = await fetch('https://api.cloudinary.com/v1_1/dcqroxlt0/image/upload', { method: 'POST', body: formData })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error?.message)
    return data.secure_url
  }

  async function addVariation() {
    if (!variationColorName || !variationFile) { showToast('Informe o nome da cor e selecione uma imagem', 'warning'); return }
    if (variationSizes.length === 0) { showToast('Selecione pelo menos um tamanho para a variação', 'warning'); return }
    setLoading(true)
    try {
      const image = await uploadImage(variationFile)
      setVariations((prev) => [...prev, { colorName: variationColorName, image, sizeType: variationSizeType, sizes: variationSizes, sizeStocks: variationSizeStocks }])
      setVariationColorName(''); setVariationFile(null); setVariationSizeType('letter')
      setVariationSizes([]); setVariationSizeStocks({}); setShowVariationForm(false)
      showToast('Variação adicionada com sucesso!', 'success')
    } catch (error) { showToast('Erro ao adicionar variação', 'error') }
    setLoading(false)
  }

  function removeVariation(indexToRemove) { setVariations((prev) => prev.filter((_, i) => i !== indexToRemove)) }

  function clearForm() {
    const restoredSizeType = getLastSizeType()
    setName(''); setOldPrice(''); setPrice(''); setPaymentMethod('vista'); setPixPrice(''); setDescription(''); setMainColor('')
    setProductImages([null]); setEditingId(null); setBrand(''); setCategory('')
    setProductSection(''); setSizeType(restoredSizeType); setSizes(restoredSizeType === 'unique' ? ['Tamanho único'] : []); setCostPrice(''); setSizeStocks({}); setShowVariationForm(false); setVariationColorName('')
    setVariationFile(null); setVariationSizeType('letter'); setVariationSizes([])
    setVariationSizeStocks({}); setVariations([])
    // Se só existe 1 perfil de envio, já deixa ele pré-selecionado; senão, limpa
    setPerfilEnvioId(freteAtivo && perfisEnvio.length === 1 ? perfisEnvio[0].id : '')
  }

  function handleEdit(product) {
    setEditingId(product.id); setName(product.name || ''); setOldPrice(product.oldPrice ?? '')
    setPrice(product.price || ''); setPaymentMethod(product.paymentMethod || 'vista'); setPixPrice(product.pixPrice ?? ''); setDescription(product.description || ''); setMainColor(product.mainColor || '')
    setBrand(product.brand || ''); setCategory(product.category || ''); setProductSection(product.productSection || '')
    setSizeType(product.sizeType || 'letter'); setSizes(product.sizes || []); setCostPrice(product.costPrice || '')
    setSizeStocks(product.sizeStocks || {}); setVariations(product.variations || [])
    setShowVariationForm(false); setVariationColorName(''); setVariationFile(null)
    setVariationSizeType('letter'); setVariationSizes([]); setVariationSizeStocks({}); setProductImages([null])
    setPerfilEnvioId(product.perfilEnvioId || (freteAtivo && perfisEnvio.length === 1 ? perfisEnvio[0].id : ''))
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function calculateTotalStock() {
    if (!isPro) return 0
    const mainStock = sizes.reduce((total, size) => total + Number(sizeStocks[size] || 0), 0)
    const variationsStock = variations.reduce((total, variation) =>
      total + Object.values(variation.sizeStocks || {}).reduce((acc, v) => acc + Number(v || 0), 0), 0)
    return mainStock + variationsStock
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (sizes.length === 0) { showToast('Selecione pelo menos um tamanho', 'warning'); return }
    if (precisaEscolherPerfil && !perfilEnvioId) {
      showToast('Selecione o modelo de envio deste produto', 'warning')
      return
    }
    setLoading(true)
    try {
      // Perfil de envio: só grava se o frete estiver ativo e existir um perfil aplicável
      const perfilParaSalvar = freteAtivo && perfilEnvioId ? perfilEnvioId : null

      if (editingId) {
        const updatedData = { name, oldPrice: oldPrice ? Number(oldPrice) : null, price: Number(price), paymentMethod,
          pixPrice: pixPrice ? Number(pixPrice) : null,
          description, mainColor, brand, category, productSection, sizeType, sizes, variations,
          costPrice: costPrice ? Number(costPrice) : null, sizeStocks, stock: calculateTotalStock(), available: calculateTotalStock() > 0,
          perfilEnvioId: perfilParaSalvar }
        const validImages = productImages.filter(Boolean)
        if (validImages.length > 0) updatedData.images = await Promise.all(validImages.map((f) => uploadImage(f)))
        await updateDoc(doc(db, 'stores', storeSlug, 'products', editingId), updatedData)
        showToast('Produto atualizado com sucesso!', 'success')
      } else {
        const validImages = productImages.filter(Boolean)
        if (validImages.length === 0) { showToast('Selecione pelo menos uma foto do produto', 'warning'); setLoading(false); return }
        const uploadedImages = await Promise.all(validImages.map((f) => uploadImage(f)))
        await addDoc(collection(db, 'stores', storeSlug, 'products'), {
          name, oldPrice: oldPrice ? Number(oldPrice) : null, price: Number(price), paymentMethod,
          pixPrice: pixPrice ? Number(pixPrice) : null,
          description, mainColor,
          brand, category, productSection, sizeType, sizes, images: uploadedImages, variations,
          costPrice: costPrice ? Number(costPrice) : null, sizeStocks, stock: calculateTotalStock(), available: calculateTotalStock() > 0,
          perfilEnvioId: perfilParaSalvar,
        })
        showToast('Produto cadastrado com sucesso!', 'success')
      }
      clearForm(); e.target.reset(); loadProducts()
    } catch (error) { console.error(error); showToast('Erro ao salvar produto', 'error') }
    setLoading(false)
  }

  async function handleDelete(id) {
    if (!confirm('Deseja excluir este produto?')) return
    await deleteDoc(doc(db, 'stores', storeSlug, 'products', id)); loadProducts()
  }

  async function toggleAvailable(product) {
    await updateDoc(doc(db, 'stores', storeSlug, 'products', product.id), { available: !product.available }); loadProducts()
  }

  if (storeLoading || !store) return <AdminLayout><div className="dash-loading">Carregando...</div></AdminLayout>
  const isPro = hasFeature(store, 'stock')

  return (
    <AdminLayout>
      <div className="dash-content">
        <div className="dash-page-header">
          <h1 className="dash-page-title">Produtos</h1>
          <p className="dash-page-subtitle">Cadastre, edite e gerencie os produtos da {store.name}.</p>
        </div>

        <div className="orby-admin-layout">
          <form ref={formRef} onSubmit={handleSubmit} className="orby-admin-form">
            <input type="text" placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} required />

            <div className="form-row-3">
              <input type="number" placeholder="Preço antigo (opcional)" value={oldPrice} onChange={(e) => setOldPrice(e.target.value)} />
              <input type="number" placeholder="Preço atual" value={price} onChange={(e) => setPrice(e.target.value)} required />
              <select
                value={paymentMethod}
                onChange={(e) => {
                  setPaymentMethod(e.target.value)
                  if (e.target.value === 'vista') setPixPrice('')
                }}
              >
                {paymentMethodOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            {paymentMethod !== 'vista' && (
              <div className="orby-field">
                <label>Valor no PIX (opcional)</label>
                <input
                  type="number"
                  placeholder="Deixe em branco para usar o desconto padrão da loja"
                  value={pixPrice}
                  onChange={(e) => setPixPrice(e.target.value)}
                />
                <span className="field-hint">
                  Preencha só se este produto tiver um valor de PIX diferente do calculado automaticamente pela loja.
                </span>
              </div>
            )}

            <div className="form-row-3">
              {isPro && (
                <input type="number" placeholder="Preço de custo" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} />
              )}

              {store.menu?.showBrands !== false && (
                <>
                  <input type="text" placeholder={brandLabel} list="brand-options" value={brand} onChange={(e) => setBrand(e.target.value)} />
                  <datalist id="brand-options">{brands.map((item) => <option key={item} value={item} />)}</datalist>
                </>
              )}

              {store.menu?.showCategories !== false && (
                <>
                  <input type="text" placeholder={categoryLabel} list="category-options" value={category} onChange={(e) => setCategory(e.target.value)} />
                  <datalist id="category-options">{categories.map((item) => <option key={item} value={item} />)}</datalist>
                </>
              )}
            </div>

            <select value={sizeType} onChange={(e) => handleSizeTypeChange(e.target.value)}>
              <option value="letter">Tamanho por letra</option>
              <option value="number">Tamanho por número</option>
              <option value="age">Tamanho por idade</option>
              <option value="unique">Tamanho único</option>
            </select>

            <div className="sizes-box">
              {sizeOptions.map((size) => (
                <button type="button" key={size} className={`size-button ${sizes.includes(size) ? 'active' : ''}`} onClick={() => toggleSize(size)}>{size}</button>
              ))}
            </div>


            {isPro && sizes.length > 0 && (
              <div className="size-stock-box">
                <p>Estoque por tamanho</p>
                {sizes.map((size) => (
                  <div key={size} className="size-stock-row">
                    <label>{size}</label>
                    <input type="number" min="0" value={sizeStocks[size] || ''} onChange={(e) => updateSizeStock(size, e.target.value)} placeholder="Quantidade" />
                  </div>
                ))}
              </div>
            )}

            <textarea placeholder="Descrição" value={description} onChange={(e) => setDescription(e.target.value)} required />
            <input type="text" placeholder="Cor principal do produto (opcional)" value={mainColor} onChange={(e) => setMainColor(e.target.value)} />

            {/* --- Modelo de envio: só aparece se o frete estiver ativo e houver mais de 1 perfil --- */}
            {precisaEscolherPerfil && (
              <div className="orby-field">
                <label>Modelo de envio</label>
                <select value={perfilEnvioId} onChange={(e) => setPerfilEnvioId(e.target.value)} required>
                  <option value="">Selecione um perfil de envio</option>
                  {perfisEnvio.map((perfil) => (
                    <option key={perfil.id} value={perfil.id}>{perfil.nome}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="product-images-box">
              <p>Fotos do produto</p>
              {productImages.map((image, index) => (
                <div key={index}>
                  <label>Foto {index + 1} {editingId && '(opcional)'}</label>
                  <input type="file" accept="image/*" onChange={(e) => updateProductImage(index, e.target.files[0])} required={!editingId && index === 0} />
                </div>
              ))}
              <button type="button" onClick={addNewImageField} className="add-color-button">Adicionar nova foto</button>
            </div>

            <div className="color-variation-box">
              <p>Variações de cor (opcional)</p>
              <button type="button" onClick={() => setShowVariationForm((prev) => !prev)} className="add-color-button">
                {showVariationForm ? 'Cancelar variação' : 'Adicionar variação de cor'}
              </button>
              {showVariationForm && (
                <div className="variation-form">
                  <input type="text" placeholder="Nome da cor" value={variationColorName} onChange={(e) => setVariationColorName(e.target.value)} />
                  <label>Imagem da cor</label>
                  <input type="file" accept="image/*" onChange={(e) => setVariationFile(e.target.files[0])} />
                  <select value={variationSizeType} onChange={(e) => { setVariationSizeType(e.target.value); setVariationSizes(e.target.value === 'unique' ? ['Tamanho único'] : []) }}>
                    <option value="letter">Tamanho por letra</option>
                    <option value="number">Tamanho por número</option>
                    <option value="age">Tamanho por idade</option>
                    <option value="unique">Tamanho único</option>
                  </select>
                  <div className="sizes-box">
                    {variationSizeOptions.map((size) => (
                      <button type="button" key={size} className={`size-button ${variationSizes.includes(size) ? 'active' : ''}`} onClick={() => toggleVariationSize(size)}>{size}</button>
                    ))}
                  </div>
                  {isPro && variationSizes.length > 0 && (
                    <div className="size-stock-box">
                      <p>Estoque da variação</p>
                      {variationSizes.map((size) => (
                        <div key={size} className="size-stock-row">
                          <label>{size}</label>
                          <input type="number" min="0" value={variationSizeStocks[size] || ''} onChange={(e) => updateVariationSizeStock(size, e.target.value)} placeholder="Quantidade" />
                        </div>
                      ))}
                    </div>
                  )}
                  <button type="button" onClick={addVariation} className="add-color-button" disabled={loading}>Salvar variação</button>
                </div>
              )}
              {variations.length > 0 && (
                <div className="colors-preview">
                  {variations.map((variation, index) => (
                    <div key={index} className="color-preview-item">
                      <img src={variation.image} alt={variation.colorName} width={50} />
                      <span>{variation.colorName} - {variation.sizes?.join(', ')}</span>
                      <button type="button" onClick={() => removeVariation(index)}>Remover</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="product-section-box">
              <p>Seção do produto</p>
              <div className="product-section-options">
                {[{ label: 'Lançamento', value: 'launch' }, { label: 'Outlet', value: 'outlet' }, { label: 'Mais vendidos', value: 'bestseller' }].map((item) => (
                  <button type="button" key={item.value} className={`section-button ${productSection === item.value ? 'active' : ''}`} onClick={() => setProductSection((prev) => (prev === item.value ? '' : item.value))}>{item.label}</button>
                ))}
              </div>
            </div>

            <button type="submit" disabled={loading}>
              {loading ? 'Otimizando imagens...' : editingId ? 'Atualizar produto' : 'Cadastrar produto'}
            </button>
            {editingId && <button type="button" onClick={clearForm} className="cancel-edit">Cancelar edição</button>}
          </form>

          <section className="orby-admin-list">
            <div className="orby-list-header">
              <h2>Produtos cadastrados</h2>
              <span>{filteredAdminProducts.length} produto(s)</span>
            </div>

            <div className="admin-search-box">
              <img src={lupaIcon} alt="Buscar" className="admin-search-icon" />
              <input
                type="text"
                placeholder="Buscar por nome, marca ou categoria"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
              />
            </div>

            {filteredAdminProducts.length === 0 && (
              <p className="admin-search-empty">Nenhum produto encontrado.</p>
            )}

            {filteredAdminProducts.map((product) => {
              const productImage = product.images?.[0] || product.image || ''
              return (
                <div key={product.id} className="orby-admin-item">
                  <img src={productImage} alt={product.name} loading="lazy" />
                  <div>
                    <strong>{product.name}</strong>
                    <p>{Number(product.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    <p>{product.paymentMethod && product.paymentMethod !== 'vista' ? `${product.paymentMethod} sem juros` : 'À vista'}</p>
                    {product.pixPrice != null && (
                      <p>PIX: {Number(product.pixPrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    )}
                    {product.brand && <p>{brandLabel}: {product.brand}</p>}
                    {product.category && <p>Categorias: {product.category}</p>}
                    <p>{product.available ? 'Disponível' : 'Indisponível'}</p>
                    {isPro && <p>Estoque: {product.stock ?? 0}</p>}
                  </div>
                  <div className="admin-actions">
                    <button onClick={() => handleEdit(product)}>Editar</button>
                    <button onClick={() => toggleAvailable(product)}>{product.available ? 'Desativar' : 'Ativar'}</button>
                    <button onClick={() => handleDelete(product.id)}>Excluir</button>
                  </div>
                </div>
              )
            })}
          </section>
        </div>
      </div>
      <Toast message={toast.message} type={toast.type} />
    </AdminLayout>
  )
}

export default AdminProducts