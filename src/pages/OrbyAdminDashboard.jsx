import { useEffect, useState } from 'react'
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  setDoc,
} from 'firebase/firestore'
import {
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
} from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { auth, secondaryAuth, db } from '../services/firebase'

function OrbyAdminDashboard() {
  const navigate = useNavigate()

  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [checkingAuth, setCheckingAuth] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate('/admin/login')
        return
      }

      const userRef = doc(db, 'users', user.uid)
      const userSnap = await getDoc(userRef)

      if (!userSnap.exists()) {
        await signOut(auth)
        navigate('/admin/login')
        return
      }

      const userData = userSnap.data()

      if (userData.role !== 'orbyOwner') {
        alert('Acesso negado')
        navigate('/admin/login')
        return
      }

      setCheckingAuth(false)
    })

    return () => unsubscribe()
  }, [navigate])

  useEffect(() => {
    if (checkingAuth) return

    async function loadStores() {
      try {
        const snapshot = await getDocs(collection(db, 'stores'))

        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))

        setStores(data.sort((a, b) => a.name?.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })))
      } catch (error) {
        console.error('Erro ao carregar lojas:', error)
      } finally {
        setLoading(false)
      }
    }

    loadStores()
  }, [checkingAuth])

  async function toggleStoreStatus(store) {
    try {
      await updateDoc(doc(db, 'stores', store.id), {
        active: store.active === false,
      })

      setStores((prev) =>
        prev.map((item) =>
          item.id === store.id
            ? { ...item, active: store.active === false }
            : item
        )
      )
    } catch (error) {
      console.error('Erro ao atualizar status da loja:', error)
      alert('Erro ao atualizar status da loja')
    }
  }

  async function deleteStore(store) {
    const confirmDelete = confirm(
      `Deseja excluir a loja "${store.name}"? Essa ação também removerá produtos, banners e vendas.`
    )

    if (!confirmDelete) return

    const secondConfirm = confirm(
      'Tem certeza? Essa ação não poderá ser desfeita.'
    )

    if (!secondConfirm) return

    try {
      const subcollections = [
        'products',
        'banners',
        'sales',
      ]

      for (const subcollection of subcollections) {
        const snapshot = await getDocs(
          collection(db, 'stores', store.id, subcollection)
        )

        for (const itemDoc of snapshot.docs) {
          await deleteDoc(
            doc(db, 'stores', store.id, subcollection, itemDoc.id)
          )
        }
      }

      await deleteDoc(doc(db, 'stores', store.id))

      setStores((prev) =>
        prev.filter((item) => item.id !== store.id)
      )

      alert('Loja e dados relacionados excluídos com sucesso!')
    } catch (error) {
      console.error(error)
      alert('Erro ao excluir loja')
    }
  }

  async function duplicateStore(store) {
    const newName = prompt('Nome da nova loja:')

    if (!newName) return

    const newSlug = prompt('Slug da nova loja:')

    if (!newSlug) return

    const whatsapp = prompt('WhatsApp da nova loja:') || ''
    const instagram = prompt('Instagram da nova loja:') || ''

    const shouldCreateLogin = confirm(
      'Deseja criar login e senha para o admin dessa loja?'
    )

    let adminEmail = ''
    let adminPassword = ''

    if (shouldCreateLogin) {
      adminEmail = prompt('E-mail de login do admin da loja:')

      if (!adminEmail) {
        alert('E-mail não informado. A loja não foi duplicada.')
        return
      }

      adminPassword = prompt('Senha do admin da loja:')

      if (!adminPassword) {
        alert('Senha não informada. A loja não foi duplicada.')
        return
      }

      if (adminPassword.length < 6) {
        alert('A senha precisa ter pelo menos 6 caracteres.')
        return
      }
    }

    const copyProducts = confirm(
      'Deseja copiar os produtos da loja original?'
    )

    const copyBanners = confirm(
      'Deseja copiar os banners da loja original?'
    )

    const copyFooter = confirm('Deseja copiar o footer da loja original?')

    try {
      const newStoreRef = doc(db, 'stores', newSlug)
      const newStoreSnap = await getDoc(newStoreRef)

      if (newStoreSnap.exists()) {
        alert('Já existe uma loja com esse slug.')
        return
      }

      const originalRef = doc(db, 'stores', store.id)
      const originalSnap = await getDoc(originalRef)

      if (!originalSnap.exists()) {
        alert('Loja original não encontrada')
        return
      }

      const originalData = originalSnap.data()

      await setDoc(newStoreRef, {
        ...originalData,
        name: newName,
        title: `${newName} | ORBY`,
        whatsapp,
        instagram,
        active: true,
      })

      if (shouldCreateLogin) {
        const userCredential = await createUserWithEmailAndPassword(
          secondaryAuth,
          adminEmail,
          adminPassword
        )

        await setDoc(doc(db, 'users', userCredential.user.uid), {
          email: adminEmail,
          storeSlug: newSlug,
          role: 'storeAdmin',
          createdAt: new Date(),
        })
      }

      if (copyProducts) {
        const productsSnapshot = await getDocs(
          collection(db, 'stores', store.id, 'products')
        )

        for (const productDoc of productsSnapshot.docs) {
          await setDoc(
            doc(db, 'stores', newSlug, 'products', productDoc.id),
            productDoc.data()
          )
        }
      }

      if (copyBanners) {
        const bannersSnapshot = await getDocs(
          collection(db, 'stores', store.id, 'banners')
        )

        for (const bannerDoc of bannersSnapshot.docs) {
          await setDoc(
            doc(db, 'stores', newSlug, 'banners', bannerDoc.id),
            bannerDoc.data()
          )
        }
      }

      if (copyFooter) {
      const footerSnapshot = await getDocs(
        collection(db, 'stores', store.id, 'footer')
      )

      for (const footerDoc of footerSnapshot.docs) {
        await setDoc(
          doc(db, 'stores', newSlug, 'footer', footerDoc.id),
          footerDoc.data()
        )
      }
    }

      const snapshot = await getDocs(collection(db, 'stores'))

      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))

      setStores(data.sort((a, b) => a.name?.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })))

      alert(
        shouldCreateLogin
          ? 'Loja duplicada e login criado com sucesso!'
          : 'Loja duplicada com sucesso!'
      )
    } catch (error) {
      console.error(error)

      if (error.code === 'auth/email-already-in-use') {
        alert('Esse e-mail já está sendo usado em outro login.')
        return
      }

      if (error.code === 'auth/invalid-email') {
        alert('E-mail inválido.')
        return
      }

      if (error.code === 'auth/weak-password') {
        alert('Senha muito fraca. Use pelo menos 6 caracteres.')
        return
      }

      alert('Erro ao duplicar loja')
    }
  }

  async function handleLogout() {
    await signOut(auth)
    navigate('/admin/login')
  }

  if (checkingAuth || loading) {
    return (
      <main className="orby-dashboard">
        <p>Carregando painel ORBY...</p>
      </main>
    )
  }

  return (
    <main className="orby-dashboard">
      <section className="orby-dashboard-header">
        <div>
          <div className="orby-status-inline">
            <span className="badge">Painel Master</span>
          </div>

          <h1>ORBY Admin</h1>
          <p>Gerencie todas as lojas da plataforma.</p>
        </div>

        <button className="orby-logout" onClick={handleLogout}>
          Sair
        </button>
      </section>

      <section className="orby-stats-grid">
        <div className="orby-stat-card">
          <span>Total de lojas</span>
          <strong>{stores.length}</strong>
        </div>

        <div className="orby-stat-card">
          <span>
            <span className="orby-stat-dot orby-stat-dot--active" />
            Lojas ativas
          </span>
          <strong>
            {stores.filter((store) => store.active !== false).length}
          </strong>
        </div>

        <div className="orby-stat-card">
          <span>
            <span className="orby-stat-dot orby-stat-dot--inactive" />
            Lojas inativas
          </span>
          <strong>
            {stores.filter((store) => store.active === false).length}
          </strong>
        </div>
      </section>

      <section className="orby-admin-list">
        <div className="orby-list-header">
          <h2>
            Lojas cadastradas <span>{stores.length} loja(s)</span>
          </h2>

          <button
            className="orby-nova-loja-btn"
            onClick={() => navigate('/orby-admin/criar-loja')}
          >
            + Nova loja
          </button>
        </div>

        {stores.map((store) => (
          <div key={store.id} className="orby-admin-item">
            <img
              src={store.logo || '/placeholder.png'}
              alt={store.name}
              loading="lazy"
            />

            <div className="orby-admin-item-info">
              <strong>{store.name}</strong>
              <p>{store.tagline}</p>
              <p>Slug: {store.id}</p>

              <span
                className={`orby-status-pill ${
                  store.active === false
                    ? 'orby-status-pill--inactive'
                    : 'orby-status-pill--active'
                }`}
              >
                <span className="orby-status-dot" />
                {store.active === false ? 'Inativa' : 'Ativa'}
              </span>
            </div>

            <div className="admin-actions">
              <button
                className="admin-btn admin-btn--primary"
                onClick={() => navigate(`/${store.id}`)}
              >
                Ver loja
              </button>

              <button
                className="admin-btn admin-btn--neutral"
                onClick={() => navigate(`/admin/${store.id}/dashboard`)}
              >
                Painel da loja
              </button>

              <button
                className="admin-btn admin-btn--neutral"
                onClick={() =>
                  navigate(`/orby-admin/editar-loja/${store.id}`)
                }
              >
                Editar
              </button>

              <button
                className="admin-btn admin-btn--danger-outline"
                onClick={() => deleteStore(store)}
              >
                Excluir
              </button>

              <button
                className="admin-btn admin-btn--neutral"
                onClick={() => duplicateStore(store)}
              >
                Duplicar
              </button>

              <button
                className="admin-btn admin-btn--danger"
                onClick={() => toggleStoreStatus(store)}
              >
                {store.active === false ? 'Ativar' : 'Inativar'}
              </button>
            </div>
          </div>
        ))}
      </section>
    </main>
  )
}

export default OrbyAdminDashboard