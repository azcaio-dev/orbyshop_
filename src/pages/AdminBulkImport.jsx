import { useState } from 'react'
import Papa from 'papaparse'
import { addDoc, collection } from 'firebase/firestore'
import { db } from '../services/firebase'
import useStore from '../hooks/useStore'
import AdminLayout from '../layouts/AdminLayout'
import Toast from '../components/Toast'

// ======================= AJUSTES RÁPIDOS =======================
const TAMANHOS_PADRAO = ['36', '37', '38', '39', '40', '41', '42', '43', '44']
const DESCRICAO_PADRAO = 'Tênis réplica, idêntico ao original'
const NOME_PADRAO = 'Tênis'
const ESTOQUE_POR_TAMANHO = 1
// =================================================================

function compressImage(file, maxWidth = 1000, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const reader = new FileReader()
    reader.onload = (e) => {
      img.src = e.target.result
    }
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const scale = Math.min(maxWidth / img.width, 1)
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Erro ao comprimir imagem'))
            return
          }
          resolve(new File([blob], file.name.replace(/\.[^/.]+$/, '.webp'), { type: 'image/webp' }))
        },
        'image/webp',
        quality
      )
    }
    img.onerror = reject
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function uploadImage(file) {
  const compressedFile = await compressImage(file)
  const formData = new FormData()
  formData.append('file', compressedFile)
  formData.append('upload_preset', 'loja-labany')
  const response = await fetch('https://api.cloudinary.com/v1_1/dcqroxlt0/image/upload', {
    method: 'POST',
    body: formData,
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error?.message || 'Falha no upload da imagem')
  return data.secure_url
}

// Extrai o preço de textos tipo "170 pix 180 cartão" -> usa só o primeiro valor (pix).
// oldPrice fica de fora aqui: só é usado quando o produto vai pra seção Outlet,
// e esse cadastro em massa não direciona pra nenhuma seção específica.
function parsePreco(texto) {
  const numeros = String(texto || '').match(/\d+([.,]\d+)?/g) || []
  const valores = numeros.map((n) => Number(n.replace(',', '.')))
  return valores[0] ?? null
}

function normalizarChave(str) {
  return String(str || '').trim().toLowerCase()
}

// Lê o formato "catalogo_0506.png — R$ 180 Pix / R$ 190 cartão" (um item por linha)
// e transforma em linhas no mesmo formato que o CSV usa (arquivo + preco).
function parseListaColada(texto) {
  const linhaRegex = /^([^\s]+\.\w+)[\s\-–—:]+.*?R?\$?\s*(\d+([.,]\d+)?)/i
  return texto
    .split('\n')
    .map((linha) => linha.trim())
    .filter(Boolean)
    .map((linha) => {
      const match = linha.match(linhaRegex)
      if (!match) return null
      return { arquivo: match[1], preco: match[2] }
    })
    .filter(Boolean)
}

export default function AdminBulkImport() {
  const { store, storeSlug } = useStore()
  const freteAtivo = store?.frete?.ativo === true
  const perfisEnvio = store?.frete?.perfis || []
  const perfilAutomatico = freteAtivo && perfisEnvio.length === 1 ? perfisEnvio[0].id : null

  const [linhasCsv, setLinhasCsv] = useState([])
  const [textoColado, setTextoColado] = useState('')
  const [fotos, setFotos] = useState({}) // nomeDoArquivo -> File
  const [itens, setItens] = useState([]) // linhas combinadas prontas pra revisão
  const [processando, setProcessando] = useState(false)
  const [progresso, setProgresso] = useState({ atual: 0, total: 0 })
  const [resultados, setResultados] = useState([])
  const [toast, setToast] = useState({ message: '', type: 'success' })

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast({ message: '', type: 'success' }), 3000)
  }

  function handleCsv(e) {
    const file = e.target.files[0]
    if (!file) return
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (resultado) => {
        setLinhasCsv(resultado.data)
        showToast(`${resultado.data.length} linhas lidas do CSV`, 'success')
      },
      error: (err) => showToast('Erro ao ler CSV: ' + err.message, 'error'),
    })
  }

  function processarTextoColado() {
    const linhas = parseListaColada(textoColado)
    if (linhas.length === 0) {
      showToast('Não consegui reconhecer nenhuma linha. Confira o formato.', 'warning')
      return
    }
    setLinhasCsv(linhas)
    showToast(`${linhas.length} linhas reconhecidas na lista`, 'success')
  }

  function handleFotos(e) {
    const arquivos = [...e.target.files]
    const mapa = {}
    arquivos.forEach((f) => {
      mapa[f.name] = f
    })
    setFotos(mapa)
    showToast(`${arquivos.length} fotos carregadas`, 'success')
  }

  function montarItens() {
    if (linhasCsv.length === 0) {
      showToast('Carregue o CSV primeiro', 'warning')
      return
    }
    if (Object.keys(fotos).length === 0) {
      showToast('Carregue as fotos primeiro', 'warning')
      return
    }

    const montados = linhasCsv.map((linha, index) => {
      const chaves = Object.keys(linha).reduce((acc, k) => {
        acc[normalizarChave(k)] = linha[k]
        return acc
      }, {})
      const nomeArquivo = (chaves['arquivo'] || chaves['foto'] || chaves['file'] || chaves['imagem'] || '').trim()
      const textoPreco = chaves['preco'] || chaves['preço'] || chaves['price'] || ''
      const nomeProduto = (chaves['nome'] || chaves['name'] || '').trim() || NOME_PADRAO
      const price = parsePreco(textoPreco)
      const foto = fotos[nomeArquivo]

      return {
        id: index,
        nomeArquivo,
        nomeProduto,
        price,
        foto,
        temFoto: Boolean(foto),
      }
    })

    setItens(montados)
  }

  async function iniciarCadastro() {
    const validos = itens.filter((i) => i.temFoto && i.price)
    if (validos.length === 0) {
      showToast('Nenhum item válido pra cadastrar (confira fotos e preços)', 'warning')
      return
    }

    setProcessando(true)
    setResultados([])
    setProgresso({ atual: 0, total: validos.length })

    const sizeStocks = TAMANHOS_PADRAO.reduce((acc, tamanho) => {
      acc[tamanho] = ESTOQUE_POR_TAMANHO
      return acc
    }, {})
    const stockTotal = TAMANHOS_PADRAO.length * ESTOQUE_POR_TAMANHO

    const novosResultados = []

    for (let i = 0; i < validos.length; i++) {
      const item = validos[i]
      try {
        const imageUrl = await uploadImage(item.foto)
        await addDoc(collection(db, 'stores', storeSlug, 'products'), {
          name: item.nomeProduto,
          oldPrice: null,
          price: item.price,
          paymentMethod: 'vista',
          description: DESCRICAO_PADRAO,
          mainColor: '',
          brand: '',
          category: '',
          productSection: '',
          sizeType: 'number',
          sizes: TAMANHOS_PADRAO,
          images: [imageUrl],
          variations: [],
          costPrice: null,
          sizeStocks,
          stock: stockTotal,
          available: true,
          perfilEnvioId: perfilAutomatico,
        })
        novosResultados.push({ nomeArquivo: item.nomeArquivo, status: 'ok', mensagem: 'Cadastrado' })
      } catch (err) {
        novosResultados.push({ nomeArquivo: item.nomeArquivo, status: 'erro', mensagem: err.message })
      }
      setProgresso({ atual: i + 1, total: validos.length })
      setResultados([...novosResultados])
    }

    setProcessando(false)
    showToast('Cadastro em massa concluído!', 'success')
  }

  function baixarErros() {
    const erros = resultados.filter((r) => r.status === 'erro')
    const csv = Papa.unparse(erros)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'erros-cadastro.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const semFoto = itens.filter((i) => !i.temFoto)
  const semPreco = itens.filter((i) => i.temFoto && !i.price)
  const prontos = itens.length - semFoto.length - semPreco.length
  const sucesso = resultados.filter((r) => r.status === 'ok').length
  const erro = resultados.filter((r) => r.status === 'erro').length

  return (
    <AdminLayout>
      <div className="dash-content">
        <div className="dash-page-header">
          <h1 className="dash-page-title">Cadastro em massa</h1>
          <p className="dash-page-subtitle">
            Suba um CSV com as colunas <code>arquivo</code> e <code>preco</code> (opcionalmente <code>nome</code>), junto
            com a pasta de fotos correspondente. Tamanho fixo 36 ao 44, descrição padrão "{DESCRICAO_PADRAO}".
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 760 }}>
          <div>
            <label>1. Lista de fotos + preços</label>
            <br />
            <p style={{ fontSize: 13, color: '#666', margin: '4px 0' }}>
              Cole a lista direto (um item por linha, formato "catalogo_0506.png — R$ 180 Pix / R$ 190 cartão"):
            </p>
            <textarea
              rows={6}
              style={{ width: '100%', fontFamily: 'monospace', fontSize: 13 }}
              placeholder={'catalogo_0506.png — R$ 180 Pix / R$ 190 cartão\ncatalogo_0507.png — R$ 150 Pix / R$ 160 cartão'}
              value={textoColado}
              onChange={(e) => setTextoColado(e.target.value)}
            />
            <button type="button" onClick={processarTextoColado} style={{ marginTop: 6 }}>
              Usar essa lista
            </button>

            <p style={{ fontSize: 13, color: '#666', margin: '12px 0 4px' }}>
              Ou, se preferir, suba um arquivo CSV (colunas <code>arquivo</code> e <code>preco</code>):
            </p>
            <input type="file" accept=".csv" onChange={handleCsv} />
            {linhasCsv.length > 0 && <p>{linhasCsv.length} linhas prontas</p>}
          </div>

          <div>
            <label>2. Fotos dos produtos (selecione todas de uma vez)</label>
            <br />
            <input type="file" accept="image/*" multiple onChange={handleFotos} />
            {Object.keys(fotos).length > 0 && <p>{Object.keys(fotos).length} fotos carregadas</p>}
          </div>

          <button type="button" onClick={montarItens}>
            Conferir combinação
          </button>

          {itens.length > 0 && (
            <div>
              <p>
                <strong>{itens.length}</strong> linhas no total · <strong>{prontos}</strong> prontas pra cadastrar
              </p>
              {semFoto.length > 0 && (
                <p style={{ color: 'crimson' }}>
                  {semFoto.length} sem foto correspondente:{' '}
                  {semFoto
                    .slice(0, 5)
                    .map((i) => i.nomeArquivo)
                    .join(', ')}
                  {semFoto.length > 5 ? '...' : ''}
                </p>
              )}
              {semPreco.length > 0 && <p style={{ color: 'crimson' }}>{semPreco.length} sem preço reconhecido no CSV</p>}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', maxHeight: 320, overflowY: 'auto' }}>
                {itens.slice(0, 12).map((item) => (
                  <div key={item.id} style={{ border: '1px solid #ccc', borderRadius: 6, padding: 6, width: 100, fontSize: 11 }}>
                    {item.foto && (
                      <img src={URL.createObjectURL(item.foto)} alt={item.nomeArquivo} style={{ width: '100%', borderRadius: 4 }} />
                    )}
                    <p style={{ margin: '4px 0 0' }}>{item.nomeProduto}</p>
                    <p style={{ margin: 0, color: item.price ? '#333' : 'crimson' }}>R$ {item.price ?? '?'}</p>
                  </div>
                ))}
              </div>
              {itens.length > 12 && <p>...e mais {itens.length - 12}</p>}

              <button type="button" onClick={iniciarCadastro} disabled={processando || prontos === 0} style={{ marginTop: 16 }}>
                {processando ? 'Cadastrando...' : `Cadastrar ${prontos} produtos`}
              </button>
            </div>
          )}

          {processando && (
            <p>
              Processando {progresso.atual} de {progresso.total}... (pode levar um tempo, não feche essa aba)
            </p>
          )}

          {resultados.length > 0 && !processando && (
            <div>
              <p>
                {sucesso} cadastrados com sucesso, {erro} com erro.
              </p>
              {erro > 0 && (
                <button type="button" onClick={baixarErros}>
                  Baixar lista de erros (.csv)
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <Toast message={toast.message} type={toast.type} />
    </AdminLayout>
  )
}