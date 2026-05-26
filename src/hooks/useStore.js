import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { useLocation, useParams } from 'react-router-dom'
import { db } from '../services/firebase'

function useStore() {
  const params = useParams()
  const location = useLocation()

  const slugFromParams = params.storeSlug

  const slugFromPath =
    location.pathname.split('/')[1] &&
    !['admin', 'orby-admin', 'produto', 'produtos'].includes(
      location.pathname.split('/')[1]
    )
      ? location.pathname.split('/')[1]
      : 'labany'

  const storeSlug = slugFromParams || slugFromPath || 'labany'

  const [store, setStore] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadStore() {
      try {
        setLoading(true)

        const storeRef = doc(db, 'stores', storeSlug)
        const storeSnap = await getDoc(storeRef)

        if (storeSnap.exists()) {
          setStore({
            plan: 'basic',
            ...storeSnap.data(),
          })        
          } else {
          console.warn('Loja não encontrada:', storeSlug)
          setStore(null)
        }
      } catch (error) {
        console.error('Erro ao carregar loja:', error)
        setStore(null)
      } finally {
        setLoading(false)
      }
    }

    loadStore()
  }, [storeSlug])

  return {
    store,
    loading,
    storeSlug,
  }
}

export default useStore