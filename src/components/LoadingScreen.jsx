// ✅ Tela de carregamento em tela cheia.
// Usada nas páginas enquanto os dados da loja ainda não chegaram,
// pra não mostrar branco/footer antes da hora.
//
// Como "store" ainda não existe nesse momento, usamos um cache leve
// (sessionStorage) salvo da última vez que essa loja carregou, pra já
// mostrar a logo e a cor de fundo certas em navegações seguintes.
function getCachedStore(storeSlug) {
  if (!storeSlug) return null

  try {
    const raw = sessionStorage.getItem(`orby-store-cache:${storeSlug}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function LoadingScreen({ store, storeSlug }) {
  const cached = store ? null : getCachedStore(storeSlug)
  const displayStore = store || cached

  const background = displayStore?.colors?.background || '#ffffff'
  const primary = displayStore?.colors?.primary || '#111111'

  return (
    <div className="loading-screen" style={{ background }}>
      <div className="loading-spinner-wrapper" style={{ '--loading-primary': primary }}>
        <div className="loading-ring"></div>

        <div className="loading-frame" style={{ background: primary }}>
          {displayStore?.logo && (
            <img src={displayStore.logo} alt={displayStore?.name || ''} />
          )}
        </div>
      </div>
    </div>
  )
}

export default LoadingScreen