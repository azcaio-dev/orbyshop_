import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../services/firebase'
import AdminSidebar from '../components/AdminSidebar'

function AdminLayout({ children }) {
  const [openSidebar, setOpenSidebar] = useState(false)
  const [store, setStore] = useState(null)
  const { storeSlug } = useParams()

  useEffect(() => {
    if (!storeSlug) return
    getDoc(doc(db, 'stores', storeSlug)).then((snap) => {
      if (snap.exists()) setStore(snap.data())
    })
  }, [storeSlug])

  return (
    <div className="admin-shell">
      <AdminSidebar
        open={openSidebar}
        onClose={() => setOpenSidebar(false)}
        store={store}
      />

      {openSidebar && (
        <div
          className="admin-sidebar-overlay"
          onClick={() => setOpenSidebar(false)}
        />
      )}

      <div className="admin-main">
        {/* Botão sanduíche — só aparece no mobile */}
        <button
          className="admin-hamburger"
          onClick={() => setOpenSidebar(true)}
          aria-label="Abrir menu"
        >
          <i className="ti ti-menu-2" />
        </button>

        <div className="admin-scroll-area">
          {children}
        </div>
      </div>
    </div>
  )
}

export default AdminLayout