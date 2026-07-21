function SobreNos({ store }) {
  if (!store?.sobre) {
    return null
  }

  const primary = store.colors?.primary || '#c5a19c'
  const background = store.colors?.background || '#f8f1ec'

  return (
    <section
      className="sobre-section fade-in"
      style={{
        '--sobre-primary': primary,
        '--sobre-bg': background,
      }}
    >
      <div className="sobre-content">
        {store.logo && (
          <div className="sobre-logo-wrapper">
            <img
              src={store.logo}
              alt={store.name}
              className="sobre-logo"
              loading="lazy"
            />
          </div>
        )}

        <div className="sobre-text-wrapper">
          <span className="sobre-eyebrow">Nossa história</span>
          <h2 className="sobre-title">Sobre nós</h2>
          <div className="sobre-divider"></div>
          <p className="sobre-text">{store.sobre}</p>
        </div>
      </div>
    </section>
  )
}

export default SobreNos