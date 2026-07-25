import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { useLocation, useParams } from 'react-router-dom'
import { db } from '../services/firebase'
import { getStoreSlugFromDomain } from '../config/customDomains'

function useStore() {
  const params = useParams()
  const location = useLocation()

  const slugFromDomain = getStoreSlugFromDomain()

  const slugFromParams = params.storeSlug

  const slugFromPath =
    location.pathname.split('/')[1] &&
    !['admin', 'orby-admin', 'produto', 'produtos'].includes(
      location.pathname.split('/')[1]
    )
      ? location.pathname.split('/')[1]
      : null

  // Prioridade: domínio customizado > param da rota > primeiro segmento do path
  const storeSlug = slugFromDomain || slugFromParams || slugFromPath || null

  const [store, setStore] = useState(null)
  const [loading, setLoading] = useState(true)

    useEffect(() => {
      async function loadStore() {
        console.log('storeSlug:', storeSlug)
        
        if (!storeSlug) {
          setLoading(false)
          return
        }

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