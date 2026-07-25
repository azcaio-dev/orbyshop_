import { useParams } from 'react-router-dom'
import { getStoreSlugFromDomain } from '../config/customDomains'

// Use este hook em vez de `useParams().storeSlug` direto nas páginas
// (Home, Products, ProductDetails, etc). Ele garante que a loja certa
// seja resolvida tanto via path (/calcarbem) quanto via domínio próprio
// (calcarbem.app.br).
export function useStoreSlug() {
  const { storeSlug } = useParams()
  const domainSlug = getStoreSlugFromDomain()
  return domainSlug || storeSlug
}