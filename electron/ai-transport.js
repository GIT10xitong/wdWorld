const providers = require('./ai-providers.json')

function normalizeEndpoint(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error('请填写有效的接口地址')
  }
  if (url.username || url.password || url.search || url.hash)
    throw new Error('接口地址不能包含凭据、查询参数或片段')
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local))
    throw new Error('请使用 HTTPS 接口，或本机 HTTP 服务')
  url.pathname = url.pathname.replace(/\/+$/, '').replace(/\/(chat\/completions|responses|models)$/, '')
  if (!url.pathname || url.pathname === '/') {
    if (['api.openai.com', 'api.xiaomimimo.com'].includes(url.hostname)) url.pathname = '/v1'
    if (url.hostname === 'generativelanguage.googleapis.com') url.pathname = '/v1beta'
  }
  return url.href.replace(/\/$/, '')
}

function routing(input) {
  const provider = input.provider || 'custom'
  const preset = providers.find((p) => p.id === provider)
  if (!preset) throw new Error('未知的模型服务商')
  const protocol = input.protocol || preset.protocol
  if (!['chat', 'responses', 'gemini'].includes(protocol)) throw new Error('不支持的接口协议')
  return { provider, protocol, endpoint: normalizeEndpoint(input.endpoint) }
}

function authHeaders(provider, protocol, key) {
  if (!key) return {}
  if (protocol === 'gemini') return { 'x-goog-api-key': key }
  if (provider === 'mimo') return { 'api-key': key }
  return { Authorization: `Bearer ${key}` }
}

async function checkResponse(response, action) {
  if (response.ok) return
  if (response.status === 400 || response.status === 413) {
    let message = ''
    try {
      const body = await response.json()
      message = String(body?.error?.message || body?.error?.code || '')
    } catch {
      /* Do not echo provider error bodies. */
    }
    if (
      response.status === 413 ||
      /context.{0,60}(length|limit|exceed)|input.{0,60}(long|limit|exceed)/i.test(message)
    )
      throw new Error('输入资料超过该模型的上下文限制，请缩小单次创作范围或使用更大上下文的模型。')
  }
  const hints = {
    400: '请检查所选模型和接口协议是否匹配。',
    401: '密钥无效或未填写，请重新填写 API 密钥。',
    403: '当前密钥没有访问权限，请检查服务商账号权限。',
    404: '接口或模型不存在；请检查地址，也可手动填写模型。',
    429: '请求过于频繁或额度不足，请稍后重试并检查额度。',
  }
  throw new Error(
    `${action}失败（HTTP ${response.status}）。${hints[response.status] || '请检查服务状态、接口地址或额度。'}`,
  )
}

async function readJSON(response) {
  try {
    return await response.json()
  } catch {
    throw new Error('接口未返回有效 JSON，请检查地址和接口协议')
  }
}

async function listModels({ key, signal, fetchImpl = fetch, ...input }) {
  const { provider, protocol, endpoint } = routing(input)
  const models = new Map()
  const tokens = new Set()
  let token = ''
  for (let page = 0; page < 20; page++) {
    const url = new URL(endpoint + '/models')
    if (protocol === 'gemini') {
      url.searchParams.set('pageSize', '1000')
      if (token) url.searchParams.set('pageToken', token)
    }
    const response = await fetchImpl(url.href, {
      method: 'GET',
      redirect: 'error',
      signal,
      headers: authHeaders(provider, protocol, key),
    })
    await checkResponse(response, '获取模型')
    const data = await readJSON(response)
    const items = protocol === 'gemini' ? data?.models : data?.data
    if (!Array.isArray(items)) throw new Error('服务未返回模型列表，可切换为手动填写模型名称')
    for (const item of items) {
      if (!item || typeof item !== 'object') continue
      if (protocol === 'gemini' && !item.supportedGenerationMethods?.includes('generateContent')) continue
      if (Array.isArray(item.output_modalities) && !item.output_modalities.includes('text')) continue
      const id = protocol === 'gemini' ? item.name?.replace(/^models\//, '') : item.id
      if (typeof id !== 'string' || !id.trim() || id.length > 200) continue
      const name = item.displayName || item.name || id
      models.set(id, { id, name: typeof name === 'string' ? name.slice(0, 200) : id })
    }
    token = protocol === 'gemini' ? data.nextPageToken : ''
    if (!token) return [...models.values()].sort((a, b) => a.id.localeCompare(b.id))
    if (typeof token !== 'string' || tokens.has(token))
      throw new Error('模型列表分页异常，请重试或手动填写模型')
    tokens.add(token)
  }
  throw new Error('模型列表分页过多，请手动填写模型名称')
}

async function streamCompletion({
  model,
  key,
  messages,
  signal,
  onDelta = () => {},
  onProgress = () => {},
  fetchImpl = fetch,
  maxOutputTokens = 4096,
  ...input
}) {
  const { provider, protocol, endpoint } = routing(input)
  if (typeof model !== 'string' || !model.trim() || model.length > 200)
    throw new Error('请先选择或填写模型名称')
  let url = endpoint + '/chat/completions'
  let body = { model, messages, stream: true, max_tokens: maxOutputTokens }
  if (provider === 'deepseek' && protocol === 'chat') body.thinking = { type: 'disabled' }
  if (protocol === 'responses') {
    url = endpoint + '/responses'
    body = { model, input: messages, stream: true, store: false, max_output_tokens: maxOutputTokens }
    if (provider === 'deepseek') body.reasoning = { effort: 'none' }
  } else if (protocol === 'gemini') {
    url =
      endpoint +
      '/models/' +
      encodeURIComponent(model.replace(/^models\//, '')) +
      ':streamGenerateContent?alt=sse'
    const system = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n')
    body = {
      contents: messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      generationConfig: { maxOutputTokens },
    }
  }
  const response = await fetchImpl(url, {
    method: 'POST',
    redirect: 'error',
    signal,
    headers: { 'Content-Type': 'application/json', ...authHeaders(provider, protocol, key) },
    body: JSON.stringify(body),
  })
  await checkResponse(response, '模型请求')
  onProgress('connected')
  let text = ''
  let finished = false
  const append = (delta) => {
    if (typeof delta !== 'string') return
    text += delta
    if (delta) onProgress('generating')
    if (text.length > 200000) throw new Error('生成内容过长，请缩小任务范围')
    onDelta(delta)
  }
  const incomplete = () => {
    throw new Error('模型回复达到输出上限，尚未完整生成。请每次生成更少章节或更短正文；这不是连接失败。')
  }
  const readOutput = (data) => {
    for (const item of data?.output || []) {
      if (item.type !== 'message') continue
      for (const part of item.content || []) {
        if (part.type === 'output_text') append(part.text)
      }
    }
  }
  const consume = (data, streaming) => {
    if (!data || data.error || data.type === 'error')
      throw new Error('模型服务返回错误，请检查服务配置后重试')
    if (protocol === 'responses') {
      if (data.type?.includes('reasoning')) onProgress('thinking')
      if (!streaming) {
        if (data.status !== 'completed') incomplete()
        readOutput(data)
        finished = true
      } else {
        if (data.type === 'response.failed') throw new Error('模型服务未完成此次生成，请稍后重试')
        if (data.type === 'response.incomplete') incomplete()
        if (data.type === 'response.output_text.delta') append(data.delta)
        if (data.type === 'response.completed') {
          if (data.response?.status !== 'completed') incomplete()
          if (!text) readOutput(data.response)
          finished = true
        }
      }
    } else if (protocol === 'gemini') {
      if (data.promptFeedback?.blockReason) throw new Error('服务未完成此次生成，请调整输入后重试')
      const candidate = data.candidates?.[0]
      if (candidate?.finishReason === 'MAX_TOKENS') incomplete()
      if (candidate?.finishReason && candidate.finishReason !== 'STOP') throw new Error('服务未完成此次生成')
      for (const part of candidate?.content?.parts || []) {
        if (part.thought) onProgress('thinking')
        else append(part.text)
      }
      if (candidate?.finishReason === 'STOP') finished = true
    } else {
      const choice = data.choices?.[0]
      if (choice?.delta?.reasoning_content) onProgress('thinking')
      if (choice?.finish_reason === 'length') incomplete()
      if (choice?.finish_reason && choice.finish_reason !== 'stop') throw new Error('服务未完成此次文字生成')
      append(streaming ? choice?.delta?.content : choice?.message?.content)
      if (choice?.finish_reason === 'stop' || !streaming) finished = true
    }
  }
  if (response.headers.get('content-type')?.includes('application/json')) {
    consume(await readJSON(response), false)
  } else {
    if (!response.body) throw new Error('接口未返回内容')
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let pending = ''
    let eventData = []
    const dispatch = () => {
      const raw = eventData.join('\n').trim()
      eventData = []
      if (!raw) return
      if (raw === '[DONE]') {
        if (protocol === 'chat') finished = true
        return
      }
      let data
      try {
        data = JSON.parse(raw)
      } catch {
        throw new Error('模型返回了无效的流式数据，请检查接口协议')
      }
      consume(data, true)
    }
    const line = (raw) => {
      if (!raw) dispatch()
      else if (raw.startsWith('data:')) eventData.push(raw.slice(5).trimStart())
    }
    try {
      while (!finished) {
        const { done, value } = await reader.read()
        pending += done ? decoder.decode() : decoder.decode(value, { stream: true })
        if (pending.length > 2000000) throw new Error('模型返回的数据过大')
        const lines = pending.split('\n')
        pending = lines.pop() || ''
        for (const raw of lines) {
          line(raw.replace(/\r$/, ''))
          if (finished) break
        }
        if (done) {
          if (pending) line(pending.replace(/\r$/, ''))
          dispatch()
          break
        }
      }
    } finally {
      await reader.cancel().catch(() => {})
      reader.releaseLock()
    }
  }
  if (!finished) throw new Error('连接提前结束，未完整生成，请重试')
  if (!text.trim()) throw new Error('模型未返回文本，请选择支持文字生成的模型')
  return text
}

module.exports = { normalizeEndpoint, routing, listModels, streamCompletion }
