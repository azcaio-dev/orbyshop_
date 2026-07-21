import whatsappIcon from '../assets/whatsapp.png'
import instagramIcon from '../assets/instagram.png'
import useStore from '../hooks/useStore'

function Footer() {
  const { store, loading } = useStore()

  if (loading || !store) {
    return null
  }

  return (
    <footer
      className="footer"
      style={{
        backgroundColor: store.colors?.primary || '#000',
      }}
    >
      <div className="footer-content">

        <div className="footer-brand">
          <img
            src={store.logo}
            alt={store.name}
            className="footer-logo"
            loading='lazy'
          />
          <p className="footer-description">
            {store.tagline}
          </p>

          <div className="footer-social">
            {store.whatsapp && (
              <a
                href={`https://wa.me/${store.whatsapp}`}
                target="_blank"
                rel="noreferrer"
                aria-label="WhatsApp"
              >
                <img src={whatsappIcon} alt="WhatsApp" />
              </a>
            )}

            {store.instagram && (
              <a
                href={store.instagram}
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
              >
                <img src={instagramIcon} alt="Instagram" />
              </a>
            )}
          </div>
        </div>

        {(store.telefone || store.whatsapp || store.email) && (
          <div className="footer-col">
            <h4 className="footer-title">Contato</h4>

            {store.telefone && (
              <p className="footer-text footer-line">
                <i className="ti ti-phone"></i>
                {store.telefone}
              </p>
            )}

            {store.whatsapp && (
              <a
                className="footer-text footer-link footer-line"
                href={`https://wa.me/${store.whatsapp}`}
                target="_blank"
                rel="noreferrer"
              >
                <i className="ti ti-brand-whatsapp"></i>
                WhatsApp
              </a>
            )}

            {store.email && (
              <a
                className="footer-text footer-link footer-line"
                href={`mailto:${store.email}`}
              >
                <i className="ti ti-mail"></i>
                {store.email}
              </a>
            )}
          </div>
        )}

        {(store.endereco || store.horario) && (
          <div className="footer-col">
            <h4 className="footer-title">Endereço</h4>

            {store.endereco && (
              <p className="footer-text footer-line">
                <i className="ti ti-map-pin"></i>
                {store.endereco}
              </p>
            )}

            {store.horario && (
              <p className="footer-text footer-line footer-horario">
                <i className="ti ti-clock"></i>
                {store.horario}
              </p>
            )}
          </div>
        )}

      </div>

      <div className="footer-bottom">
        <p className="footer-copy">
          © {new Date().getFullYear()} {store.name}. Todos os direitos reservados.
        </p>
        <p className="footer-powered">Desenvolvido pela Orby</p>
      </div>
    </footer>
  )
}

export default Footer