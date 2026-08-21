// ✅ Ativa a animação "sobe e aparece" em qualquer elemento com a
// classe .fade-in, no momento em que ele entra na tela durante o scroll.
//
// Funciona de forma global e automática: não precisa importar nada
// em cada página, nem trocar a classe em cada seção — o CSS já usa
// .fade-in em quase tudo (produtos, "Sobre nós", avaliações, banners
// de confiança etc). Esse observer detecta inclusive elementos que
// aparecem depois (produtos carregando, troca de página).
//
// Chamado uma única vez, no App.jsx.
let started = false

export function initScrollReveal() {
  if (started) return
  started = true

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view')
          observer.unobserve(entry.target)
        }
      })
    },
    { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
  )

  function observeNode(node) {
    if (node.nodeType !== 1) return

    if (node.classList?.contains('fade-in') && !node.classList.contains('in-view')) {
      observer.observe(node)
    }

    node.querySelectorAll?.('.fade-in:not(.in-view)').forEach((el) => observer.observe(el))
  }

  // Observa o que já está na tela ao iniciar
  document.querySelectorAll('.fade-in:not(.in-view)').forEach((el) => observer.observe(el))

  // Observa elementos novos inseridos depois (ex: produtos que chegam
  // do Firestore, troca de rota entre páginas)
  const mutationObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach(observeNode)
    })
  })

  mutationObserver.observe(document.body, { childList: true, subtree: true })
}