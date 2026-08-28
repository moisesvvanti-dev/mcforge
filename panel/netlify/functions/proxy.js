// ============================================
// MCForge - Netlify Function Proxy
// Encaminha chamadas /api/* para o daemon MCForge
// (opcional — o painel também conecta direto no daemon via Tunnel)
//
// ⚠️ IMPORTANTE: defina a variável DAEMON_URL no Netlify
// apontando para o seu PC (ex: http://SEU_IP_PUBLICO:3000).
// Sem isso, o proxy tenta http://localhost:3000 DENTRO do
// servidor do Netlify, e dá erro 502.
// ============================================

const DAEMON_URL = process.env.DAEMON_URL || 'http://localhost:3000'

exports.handler = async (event) => {
  try {
    const path = event.path.replace(/^\/\.netlify\/functions\/proxy/, '/api')
    const target = `${DAEMON_URL}${path}${event.queryStringParameters ? '?' + new URLSearchParams(event.queryStringParameters) : ''}`

    const headers = { 'Content-Type': 'application/json' }
    if (event.headers.authorization) {
      headers['Authorization'] = event.headers.authorization
    }

    const body = event.body && event.isBase64Encoded
      ? Buffer.from(event.body, 'base64')
      : event.body

    const res = await fetch(target, {
      method: event.httpMethod,
      headers,
      body: event.httpMethod === 'GET' || event.httpMethod === 'DELETE' ? undefined : body
    })

    const text = await res.text()

    return {
      statusCode: res.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': res.headers.get('content-type') || 'application/json'
      },
      body: text
    }
  } catch (e) {
    const msg = e.message || 'Erro desconhecido'
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Daemon inacessível (502)',
        detail: `Não foi possível conectar em: ${DAEMON_URL}`,
        hint: '1) No Netlify: Site settings → Environment variables → DAEMON_URL=http://SEU_IP_PUBLICO:3000  2) Abra a porta 3000 no roteador apontando para o IP local do seu PC. 3) Ou use o Cloudflare Tunnel (recomendado, com HTTPS).',
        original: msg
      })
    }
  }
}