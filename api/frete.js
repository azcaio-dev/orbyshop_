// api/frete.js
//
// Calcula a cotação de frete (Correios/SEDEX e outras transportadoras)
// via API da Frenet, dividindo o carrinho em pacotes conforme a
// configuração da loja (dimensões padrão, peso por item, itens por pacote).
//
// Variável de ambiente necessária na Vercel:
//   FRENET_TOKEN

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido, use POST.' });
  }

  const {
    cepOrigem,
    cepDestino,
    totalItens,
    itensPorPacote,
    pesoMedioPorItem, // em kg
    pesoEmbalagemVazia, // em kg
    dimensoes, // { altura, largura, comprimento } em cm
    valorDeclarado, // opcional, valor total dos itens em R$
  } = req.body || {};

  // --- Validação básica dos dados recebidos ---
  const camposObrigatorios = {
    cepOrigem,
    cepDestino,
    totalItens,
    itensPorPacote,
    pesoMedioPorItem,
    pesoEmbalagemVazia,
    dimensoes,
  };
  const faltando = Object.entries(camposObrigatorios)
    .filter(([, v]) => v === undefined || v === null || v === '')
    .map(([k]) => k);

  if (faltando.length > 0) {
    return res.status(400).json({ error: `Campos ausentes: ${faltando.join(', ')}` });
  }

  const cepOrigemLimpo = String(cepOrigem).replace(/\D/g, '');
  const cepDestinoLimpo = String(cepDestino).replace(/\D/g, '');

  if (cepOrigemLimpo.length !== 8 || cepDestinoLimpo.length !== 8) {
    return res.status(400).json({ error: 'CEP inválido. Use o formato de 8 dígitos.' });
  }

  // --- Monta os pacotes: divide os itens em grupos de "itensPorPacote" ---
  // Cada pacote leva o peso da embalagem vazia + peso dos itens que ele carrega.
  // O último pacote pode ter menos itens, então pesa menos que um pacote cheio.
  const qtdPacotes = Math.ceil(totalItens / itensPorPacote);
  const shippingItemArray = [];

  let itensRestantes = totalItens;
  for (let i = 0; i < qtdPacotes; i += 1) {
    const itensNessePacote = Math.min(itensPorPacote, itensRestantes);
    const pesoDoPacote = Number(pesoEmbalagemVazia) + itensNessePacote * Number(pesoMedioPorItem);

    shippingItemArray.push({
      Height: Number(dimensoes.altura),
      Length: Number(dimensoes.comprimento),
      Width: Number(dimensoes.largura),
      Weight: Number(pesoDoPacote.toFixed(3)),
      Quantity: 1,
    });

    itensRestantes -= itensNessePacote;
  }

  try {
    const frenetResponse = await fetch('https://api.frenet.com.br/shipping/quote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        token: process.env.FRENET_TOKEN,
      },
      body: JSON.stringify({
        SellerCEP: cepOrigemLimpo,
        RecipientCEP: cepDestinoLimpo,
        ShipmentInvoiceValue: valorDeclarado ? Number(valorDeclarado) : 50,
        ShippingItemArray: shippingItemArray,
      }),
    });

    const data = await frenetResponse.json();

    if (!frenetResponse.ok) {
      console.error('Erro na Frenet:', data);
      return res.status(frenetResponse.status).json({ error: 'Erro ao consultar frete.', detalhe: data });
    }

    // A Frenet retorna um array de serviços; filtramos erros e simplificamos
    // pro formato que o carrinho precisa.
    const opcoes = (data.ShippingSevicesArray || [])
      .filter((servico) => !servico.Error)
      .map((servico) => ({
        transportadora: servico.Carrier,
        servico: servico.ServiceDescription,
        prazoDias: servico.DeliveryTime,
        valor: Number(servico.ShippingPrice),
      }));

    return res.status(200).json({ opcoes, pacotes: qtdPacotes });
  } catch (err) {
    console.error('Erro inesperado ao calcular frete:', err);
    return res.status(500).json({ error: 'Erro inesperado ao calcular frete.' });
  }
}