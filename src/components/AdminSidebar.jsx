import { NavLink, useParams, useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../services/firebase'
import logoOrby from '/logo-orby.png'

function AdminSidebar({ open, onClose, store }) {
  const { storeSlug } = useParams()
  const navigate = useNavigate()

  async function handleLogout() {
    await signOut(auth)
    navigate('/admin/login')
  }

  const links = [
    { label: 'Dashboard',   path: `/admin/${storeSlug}/dashboard`,   icon: 'ti-layout-dashboard' },
    { label: 'Produtos',    path: `/admin/${storeSlug}/produtos`,     icon: 'ti-package' },
    { label: 'Mídia',       path: `/admin/${storeSlug}/banners`,      icon: 'ti-photo' },
    { label: 'Vendas',      path: `/admin/${storeSlug}/vendas`,       icon: 'ti-shopping-cart', pro: true },
    { label: 'Estoque',     path: `/admin/${storeSlug}/estoque`,      icon: 'ti-box',           pro: true },
    { label: 'Financeiro',  path: `/admin/${storeSlug}/financeiro`,   icon: 'ti-credit-card',   pro: true },
    { label: 'Vendedores',  path: `/admin/${storeSlug}/vendedores`,   icon: 'ti-users',         pro: true },
  ]

  return (
    <aside className={`admin-sidebar ${open ? 'open' : ''}`}>
      <div className="admin-sidebar-logo">
        <img src={logoOrby} alt="Orby" className="admin-sidebar-logo-img" />
        <span className="admin-sidebar-logo-text">Orby</span>
        <button className="admin-sidebar-close" onClick={onClose} aria-label="Fechar menu">
          <i className="ti ti-x" />
        </button>
      </div>

      <nav className="admin-sidebar-nav">
        {links.map((link) => (
          <NavLink
            key={link.path}
            to={link.path}
            onClick={onClose}
            className={({ isActive }) => `admin-sidebar-link ${isActive ? 'active' : ''}`}
          >
            <i className={`ti ${link.icon}`} aria-hidden="true" />
            <span className="admin-sidebar-link-label">{link.label}</span>
            {link.pro && <small className="admin-sidebar-pro">PRO</small>}
          </NavLink>
        ))}
      </nav>

      <div className="admin-sidebar-footer">
        <div className="admin-sidebar-store-pill">
          <span className="admin-sidebar-store-dot" />
          <div className="admin-sidebar-store-info">
            <span className="admin-sidebar-store-name">{store?.name || 'Minha Loja'}</span>
            <span className="admin-sidebar-store-plan">Plano {(store?.plan || 'basic').toUpperCase()} ativo</span>
          </div>
        </div>

        <div className="admin-sidebar-actions">
          <button className="admin-sidebar-action-btn" onClick={() => navigate(`/${storeSlug}`)}>
            <i className="ti ti-external-link" aria-hidden="true" />
            Ver loja
          </button>
          <button className="admin-sidebar-action-btn admin-sidebar-action-btn--danger" onClick={handleLogout}>
            <i className="ti ti-logout" aria-hidden="true" />
            Sair
          </button>
        </div>
      </div>
    </aside>
  )
}

export default AdminSidebar