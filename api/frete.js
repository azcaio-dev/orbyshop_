// api/frete.js
//
// Calcula a cotação de frete (Correios/SEDEX e outras transportadoras) via
// Frenet. Agora suporta múltiplos "perfis de envio" — cada grupo de
// produtos com peso/dimensão diferentes vira seus próprios pacotes, e todos
// entram juntos numa única cotação.
//
// Variável de ambiente necessária na Vercel:
//   FRENET_TOKEN

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido, use POST.' });
  }

  const { cepOrigem, cepDestino, itens, perfis, valorDeclarado } = req.body || {};

  // --- Validação básica ---
  if (!cepOrigem || !cepDestino) {
    return res.status(400).json({ error: 'CEP de origem e destino são obrigatórios.' });
  }
  if (!Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ error: 'Nenhum item informado para calcular o frete.' });
  }
  if (!Array.isArray(perfis) || perfis.length === 0) {
    return res.status(400).json({ error: 'Nenhum perfil de envio configurado para essa loja.' });
  }

  const cepOrigemLimpo = String(cepOrigem).replace(/\D/g, '');
  const cepDestinoLimpo = String(cepDestino).replace(/\D/g, '');

  if (cepOrigemLimpo.length !== 8 || cepDestinoLimpo.length !== 8) {
    return res.status(400).json({ error: 'CEP inválido. Use o formato de 8 dígitos.' });
  }

  // --- Agrupa a quantidade total de itens por perfilEnvioId ---
  const quantidadePorPerfil = {};
  for (const item of itens) {
    if (!item.perfilEnvioId || !item.quantidade) {
      return res.status(400).json({ error: 'Todos os itens precisam ter um modelo de envio definido.' });
    }
    quantidadePorPerfil[item.perfilEnvioId] = (quantidadePorPerfil[item.perfilEnvioId] || 0) + Number(item.quantidade);
  }

  // --- Monta os pacotes de cada perfil, do mesmo jeito que fazíamos antes, ---
  // --- mas agora repetindo o processo pra cada perfil separadamente ---
  const shippingItemArray = [];

  for (const [perfilId, totalItensDoPerfil] of Object.entries(quantidadePorPerfil)) {
    const perfil = perfis.find((p) => p.id === perfilId);

    if (!perfil) {
      return res.status(400).json({ error: `Perfil de envio "${perfilId}" não encontrado na loja.` });
    }

    const {
      itensPorPacote = 1,
      pesoMedioPorItem = 0,
      pesoEmbalagemVazia = 0,
      dimensoes = {},
    } = perfil;

    const qtdPacotes = Math.ceil(totalItensDoPerfil / itensPorPacote);
    let itensRestantes = totalItensDoPerfil;

    for (let i = 0; i < qtdPacotes; i += 1) {
      const itensNessePacote = Math.min(itensPorPacote, itensRestantes);
      const pesoDoPacote = Number(pesoEmbalagemVazia) + itensNessePacote * Number(pesoMedioPorItem);

      shippingItemArray.push({
        Height: Number(dimensoes.altura) || 1,
        Length: Number(dimensoes.comprimento) || 1,
        Width: Number(dimensoes.largura) || 1,
        Weight: Number(pesoDoPacote.toFixed(3)) || 0.1,
        Quantity: 1,
      });

      itensRestantes -= itensNessePacote;
    }
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

    const opcoes = (data.ShippingSevicesArray || [])
      .filter((servico) => !servico.Error)
      .map((servico) => ({
        transportadora: servico.Carrier,
        servico: servico.ServiceDescription,
        prazoDias: servico.DeliveryTime,
        valor: Number(servico.ShippingPrice),
      }));

    return res.status(200).json({ opcoes, pacotes: shippingItemArray.length });
  } catch (err) {
    console.error('Erro inesperado ao calcular frete:', err);
    return res.status(500).json({ error: 'Erro inesperado ao calcular frete.' });
  }
}