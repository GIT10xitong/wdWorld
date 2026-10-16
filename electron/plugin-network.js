const crypto = require('node:crypto')

function serviceUrl(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error('Invalid plugin service URL')
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) ||
    url.username ||
    url.password ||
    url.hash ||
    url.search
  )
    throw new Error('Plugin services require HTTPS or localhost HTTP; no credentials in URLs')
  return url.href.replace(/\/$/, '')
}
async function readResponse(response, limit) {
  if (!response.ok) throw new Error(`Plugin request failed (HTTP ${response.status})`)
  if (Number(response.headers.get('content-length') || 0) > limit)
    throw new Error('Plugin response is too large')
  const chunks = []
  let size = 0
  for await (const chunk of response.body) {
    size += chunk.length
    if (size > limit) throw new Error('Plugin response is too large')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}
async function download(url, fetchImpl = fetch) {
  const endpoint = serviceUrl(url)
  if (!endpoint.startsWith('https://')) throw new Error('Plugin downloads require HTTPS')
  const response = await fetchImpl(endpoint, { redirect: 'error', signal: AbortSignal.timeout(20000) })
  return readResponse(response, 2 * 1024 * 1024)
}
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex')
async function callService(manifest, config, input, signal, fetchImpl = fetch) {
  const endpoint = serviceUrl(config.endpoint)
  const headers = {
    'Content-Type': 'application/json',
    ...(config.key ? { Authorization: `Bearer ${config.key}` } : {}),
  }
  let body, route
  if (manifest.protocol === 'openai-image') {
    route = '/images/generations'
    body = { model: config.model, prompt: input.text, n: 1, response_format: 'b64_json' }
  } else if (manifest.protocol === 'openai-speech') {
    route = '/audio/speech'
    body = { model: config.model, input: input.text, voice: config.voice || 'alloy', response_format: 'wav' }
  } else {
    route = '/invoke'
    body = { apiVersion: 1, capability: manifest.capability, text: input.text }
  }
  const response = await fetchImpl(endpoint + route, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    redirect: 'error',
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(120000)]) : AbortSignal.timeout(120000),
  })
  const bytes = await readResponse(response, 12 * 1024 * 1024)
  if (manifest.protocol === 'openai-speech') {
    const mime = (response.headers.get('content-type') || '').split(';')[0].toLowerCase()
    if (!['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav'].includes(mime))
      throw new Error('Plugin returned an unsupported media type')
    return {
      type: 'audio',
      mime: mime.includes('wav') ? 'audio/wav' : 'audio/mpeg',
      base64: bytes.toString('base64'),
    }
  }
  let data
  try {
    data = JSON.parse(bytes.toString('utf8'))
  } catch {
    throw new Error('Plugin returned invalid JSON')
  }
  if (manifest.protocol === 'openai-image')
    data = { type: 'image', mime: 'image/png', base64: data.data?.[0]?.b64_json }
  if (data.type === 'text' && typeof data.text === 'string' && data.text.length <= 20000)
    return { type: 'text', text: data.text }
  const media =
    data.type === 'image'
      ? ['image/png', 'image/jpeg', 'image/webp']
      : data.type === 'audio'
        ? ['audio/mpeg', 'audio/wav', 'audio/ogg']
        : []
  if (
    !media.includes(data.mime) ||
    typeof data.base64 !== 'string' ||
    !data.base64 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(data.base64) ||
    data.base64.length > 16 * 1024 * 1024
  )
    throw new Error('Plugin returned unsupported output; use text or base64 image/audio')
  // Only passive raster/audio formats are returned; remote URLs and HTML never execute.
  return { type: data.type, mime: data.mime, base64: data.base64 }
}
module.exports = { serviceUrl, readResponse, download, hash, callService }
