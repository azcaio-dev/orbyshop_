function UpgradePlan() {
  const message = encodeURIComponent(
    'Olá! Quero fazer upgrade da minha loja para o plano PRO da ORBY.'
  )

  const whatsappUrl = `https://wa.me/5581989855952?text=${message}`

  return (
    <div className="upgrade-plan">
      <h2>Disponível no plano PRO</h2>

      <p>
        Faça upgrade para desbloquear vendas, estoque,
        financeiro e recursos avançados de gestão.
      </p>

      <a
        href={whatsappUrl}
        target="_blank"
        rel="noreferrer"
      >
        Fazer upgrade
      </a>
    </div>
  )
}

export default UpgradePlan