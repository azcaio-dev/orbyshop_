const CUSTOM_DOMAINS = {
  'calcarbem.app.br': 'calcarbem',
  'www.calcarbem.app.br': 'calcarbem',
}

export function getStoreSlugFromDomain() {
  const hostname = window.location.hostname
  return CUSTOM_DOMAINS[hostname] || null
}

// Novo: dado um storeSlug, retorna o domínio customizado (sem o www.), se existir
export function getCustomDomainFromSlug(storeSlug) {
  const entry = Object.entries(CUSTOM_DOMAINS).find(
    ([domain, slug]) => slug === storeSlug && !domain.startsWith('www.')
  )
  return entry ? entry[0] : null
}

export default CUSTOM_DOMAINS