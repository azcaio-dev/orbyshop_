// Mapa de domínio customizado -> slug da loja na plataforma.
// Quando vender um novo domínio pra outro cliente, só adiciona uma linha aqui.
const CUSTOM_DOMAINS = {
  'calcarbem.app.br': 'calcarbem',
  'www.calcarbem.app.br': 'calcarbem',
}

export function getStoreSlugFromDomain() {
  const hostname = window.location.hostname
  return CUSTOM_DOMAINS[hostname] || null
}

export default CUSTOM_DOMAINS