// api/auth/melhorenvio/callback.js
//
// Rota de callback do fluxo OAuth2 do Melhor Envio.
// Uso: ÚNICO E MANUAL, feito por você (dono da Orby), uma vez, para gerar
// o access_token que a sua function de cotação de frete vai usar depois.
// O cliente final da loja NUNCA passa por essa rota.
//
// Variáveis de ambiente necessárias na Vercel:
//   MELHOR_ENVIO_CLIENT_ID
//   MELHOR_ENVIO_CLIENT_SECRET
//   MELHOR_ENVIO_REDIRECT_URI   -> ex: https://orbyshop.vercel.app/api/auth/melhorenvio/callback
//   MELHOR_ENVIO_BASE_URL       -> sandbox: https://sandbox.melhorenvio.com.br
//                                  produção: https://melhorenvio.com.br

export default async function handler(req, res) {
  const { code, error } = req.query;

  if (error) {
    return res.status(400).send(`Autorização negada pelo Melhor Envio: ${error}`);
  }

  if (!code) {
    return res.status(400).send('Parâmetro "code" ausente na URL de callback.');
  }

  const baseUrl = process.env.MELHOR_ENVIO_BASE_URL;

  // --- LOG TEMPORÁRIO DE DEBUG (remover depois de resolver) ---
  // Aparece só no painel Vercel > seu projeto > Logs, nunca na página pública.
  // Mostra só tamanho e pontas dos valores, nunca o valor completo do secret.
  const mask = (v) => (v ? `${v.slice(0, 3)}...${v.slice(-3)} (len:${v.length})` : 'AUSENTE');
  console.log('[DEBUG melhorenvio]', {
    baseUrl,
    clientId: process.env.MELHOR_ENVIO_CLIENT_ID,
    clientSecret: mask(process.env.MELHOR_ENVIO_CLIENT_SECRET),
    redirectUri: process.env.MELHOR_ENVIO_REDIRECT_URI,
  });
  // --- FIM DO LOG TEMPORÁRIO ---

  try {
    const tokenResponse = await fetch(`${baseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        // Obrigatório pela API do Melhor Envio: nome do app + email de contato
        'User-Agent': 'Orby (azevedocaio03@gmail.com)',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: process.env.MELHOR_ENVIO_CLIENT_ID,
        client_secret: process.env.MELHOR_ENVIO_CLIENT_SECRET,
        redirect_uri: process.env.MELHOR_ENVIO_REDIRECT_URI,
        code,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Erro ao trocar code por token:', tokenData);
      return res.status(tokenResponse.status).send(
        `Erro ao gerar token: ${tokenData.message || JSON.stringify(tokenData)}`
      );
    }

    // IMPORTANTE: isso aparece só na SUA tela, uma vez, para você copiar
    // e colar como variável de ambiente na Vercel. Depois disso, delete
    // essa página do histórico do navegador (ela mostra o secret na tela).
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(`
      <html>
        <body style="font-family: sans-serif; padding: 40px; max-width: 700px; margin: auto;">
          <h2>✅ Token gerado com sucesso</h2>
          <p>Copie os valores abaixo e cole nas variáveis de ambiente da Vercel.
             Depois, <strong>feche esta aba</strong> — ela não deve ficar salva no histórico.</p>
          <p><strong>MELHOR_ENVIO_ACCESS_TOKEN</strong></p>
          <textarea style="width:100%; height:100px;">${tokenData.access_token}</textarea>
          <p><strong>MELHOR_ENVIO_REFRESH_TOKEN</strong></p>
          <textarea style="width:100%; height:60px;">${tokenData.refresh_token}</textarea>
          <p>Expira em (segundos): ${tokenData.expires_in}</p>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('Erro inesperado no callback do Melhor Envio:', err);
    return res.status(500).send('Erro inesperado ao processar o callback.');
  }
}