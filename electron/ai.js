const fs = require('fs')
const path = require('path')
const providers = require('./ai-providers.json')
const { normalizeEndpoint, routing, listModels, streamCompletion } = require('./ai-transport')
const { prepareContext } = require('./ai-context')
const limits = require('./ai-limits.json')

function registerAI({ ipcMain, app, safeStorage, fetchImpl = fetch }) {
  const file = () => path.join(app.getPath('userData'), 'ai-settings.json')
  const write = (store) => {
    if (!safeStorage.isEncryptionAvailable() || safeStorage.getSelectedStorageBackend?.() === 'basic_text')
      throw new Error('系统加密不可用，无法保存 API 配置')
    const envelope = {
      version: 3,
      encryptedConfig: safeStorage.encryptString(JSON.stringify(store)).toString('base64'),
    }
    fs.mkdirSync(path.dirname(file()), { recursive: true })
    fs.writeFileSync(file() + '.tmp', JSON.stringify(envelope), 'utf8')
    fs.renameSync(file() + '.tmp', file())
  }
  const preset = (id) => {
    const found = providers.find((p) => p.id === id)
    if (!found) throw new Error('未知的模型服务商')
    return { provider: id, endpoint: found.endpoint, protocol: found.protocol, model: '', encryptedKey: '' }
  }
  const read = () => {
    if (!fs.existsSync(file())) return { activeProvider: 'deepseek', profiles: {} }
    let saved = JSON.parse(fs.readFileSync(file(), 'utf8'))
    if (saved.encryptedConfig) {
      try {
        saved = JSON.parse(safeStorage.decryptString(Buffer.from(saved.encryptedConfig, 'base64')))
      } catch {
        throw new Error('无法解密本机 API 配置，请在原 Windows 账号中打开')
      }
      return saved
    }
    if (saved.profiles && saved.activeProvider) {
      write(saved)
      return saved
    }
    // Existing settings retain their working Chat Completions protocol.
    const endpoint = normalizeEndpoint(saved.endpoint)
    const provider =
      providers.find((p) => p.id !== 'custom' && normalizeEndpoint(p.endpoint) === endpoint)?.id || 'custom'
    const migrated = {
      activeProvider: provider,
      profiles: { [provider]: { ...saved, endpoint, provider, protocol: 'chat' } },
    }
    write(migrated)
    return migrated
  }
  const getProfile = (store, id = store.activeProvider) => ({
    ...preset(id),
    ...store.profiles[id],
    provider: id,
  })
  const publicSettings = (config) => ({
    provider: config.provider,
    protocol: config.protocol,
    endpoint: config.endpoint,
    model: config.model,
    hasKey: !!config.encryptedKey,
  })
  const decrypt = (encryptedKey) => {
    if (!encryptedKey) return ''
    try {
      return safeStorage.decryptString(Buffer.from(encryptedKey, 'base64'))
    } catch {
      throw new Error('无法读取已保存的密钥，请重新填写并保存')
    }
  }
  const resolve = (input, store) => {
    if (!input || typeof input !== 'object') throw new Error('无效的模型配置')
    const config = routing(input)
    const previous = getProfile(store, config.provider)
    if (input.key !== undefined && (typeof input.key !== 'string' || input.key.length > 10000))
      throw new Error('无效的 API 密钥')
    const encryptedKey =
      !input.clearKey && config.endpoint === normalizeEndpoint(previous.endpoint) ? previous.encryptedKey : ''
    return { ...config, encryptedKey, suppliedKey: input.key?.trim() || '' }
  }
  ipcMain.handle('ai:settings:get', (_event, provider) => publicSettings(getProfile(read(), provider)))
  const saveSettings = (input) => {
    const store = read()
    const resolved = resolve(input, store)
    if (typeof input.model !== 'string' || !input.model.trim() || input.model.length > 200)
      throw new Error('请选择或填写有效的模型名称')
    let encryptedKey = resolved.encryptedKey
    if (resolved.suppliedKey) {
      if (!safeStorage.isEncryptionAvailable()) throw new Error('系统密钥保护不可用，无法保存密钥')
      encryptedKey = safeStorage.encryptString(resolved.suppliedKey).toString('base64')
    }
    const config = {
      provider: resolved.provider,
      protocol: resolved.protocol,
      endpoint: resolved.endpoint,
      model: input.model.trim(),
      encryptedKey,
    }
    const next = {
      version: 2,
      activeProvider: config.provider,
      profiles: { ...store.profiles, [config.provider]: config },
    }
    write(next)
    return publicSettings(config)
  }
  ipcMain.handle('ai:settings:save', (_event, input) => saveSettings(input))

  const active = new Map()
  const operation = async (event, token, timeout, execute, label) => {
    if (active.has(token) || active.size >= 3) return { ok: false, error: '已有请求，请先停止或等待完成' }
    const controller = new AbortController()
    active.set(token, controller)
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, timeout)
    const abort = () => controller.abort()
    event.sender.once('destroyed', abort)
    try {
      return { ok: true, ...(await execute(controller.signal)) }
    } catch (error) {
      return {
        ok: false,
        error: controller.signal.aborted
          ? timedOut
            ? `${label}超时，请检查网络或稍后重试`
            : '已停止生成'
          : error instanceof TypeError
            ? '无法连接模型服务，请检查网络、接口地址和接口协议'
            : error.message,
      }
    } finally {
      clearTimeout(timer)
      active.delete(token)
      if (!event.sender.isDestroyed()) event.sender.removeListener('destroyed', abort)
    }
  }
  ipcMain.handle('ai:models', (event, input) =>
    operation(
      event,
      `${event.sender.id}:models`,
      25000,
      async (signal) => {
        const config = resolve(input, read())
        const models = await listModels({
          ...config,
          key: config.suppliedKey || decrypt(config.encryptedKey),
          signal,
          fetchImpl,
        })
        return { models }
      },
      '获取模型',
    ),
  )
  ipcMain.handle('ai:test', (event, input) =>
    operation(
      event,
      `${event.sender.id}:test`,
      60000,
      async (signal) => {
        const config = resolve(input, read())
        await streamCompletion({
          ...config,
          model: input.model,
          key: config.suppliedKey || decrypt(config.encryptedKey),
          messages: [{ role: 'user', content: '请只回复：连接成功。' }],
          signal,
          fetchImpl,
          maxOutputTokens: limits.outputTokens,
        })
        return { settings: saveSettings(input) }
      },
      '测试模型',
    ),
  )
  ipcMain.handle('ai:cancel', (event, id) => {
    active.get(`${event.sender.id}:${id}`)?.abort()
    return true
  })
  const generate = async (event, request) => {
    if (
      !request ||
      typeof request.id !== 'string' ||
      request.id.length > 100 ||
      !Array.isArray(request.messages) ||
      request.messages.length > 10
    )
      throw new Error('无效的生成请求')
    if (
      request.messages.some(
        (m) => !m || !['system', 'user', 'assistant'].includes(m.role) || typeof m.content !== 'string',
      ) ||
      request.messages.reduce((sum, m) => sum + (m?.content?.length || 0), 0) > limits.maxContextChars
    )
      throw new Error('无效或过长的上下文')
    return operation(
      event,
      `${event.sender.id}:${request.id}`,
      1800000,
      async (signal) => {
        const config = getProfile(read())
        const key = decrypt(config.encryptedKey)
        let lastProgress = ''
        const progress = (state) => {
          const serialized = JSON.stringify(state)
          if (serialized === lastProgress || event.sender.isDestroyed()) return
          lastProgress = serialized
          event.sender.send('ai:progress', {
            id: request.id,
            provider: config.provider,
            model: config.model,
            ...state,
          })
        }
        const complete = async (messages, part) => {
          signal.throwIfAborted()
          const controller = new AbortController()
          const abort = () => controller.abort()
          signal.addEventListener('abort', abort, { once: true })
          let timedOut = false
          const timer = setTimeout(() => {
            timedOut = true
            controller.abort()
          }, 180000)
          try {
            return await streamCompletion({
              ...config,
              key,
              messages,
              signal: controller.signal,
              fetchImpl,
              maxOutputTokens: part ? 2048 : limits.outputTokens,
              onProgress: (phase) =>
                progress(part ? { phase: 'preparing', ...part, activity: phase } : { phase }),
              onDelta: (delta) => {
                if (!part && !event.sender.isDestroyed())
                  event.sender.send('ai:delta', { id: request.id, delta })
              },
            })
          } catch (error) {
            if (timedOut) throw new Error('本段模型请求超时，请缩小任务范围后重试')
            throw error
          } finally {
            clearTimeout(timer)
            signal.removeEventListener('abort', abort)
          }
        }
        progress({ phase: 'connecting' })
        const prepared = await prepareContext(request.messages, complete, progress, signal)
        progress({ phase: 'connecting' })
        const text = await complete(prepared.messages)
        return { text, contextDigest: prepared.contextDigest }
      },
      '生成',
    )
  }
  ipcMain.handle('ai:generate', generate)
  return {
    async generate(messages, signal) {
      const { EventEmitter } = require('node:events')
      const sender = new EventEmitter()
      sender.id = 'lan'
      sender.isDestroyed = () => false
      sender.send = () => {}
      const id = require('node:crypto').randomUUID()
      const abort = () => active.get(`lan:${id}`)?.abort()
      signal.throwIfAborted()
      signal.addEventListener('abort', abort, { once: true })
      try {
        const result = await generate({ sender }, { id, messages })
        if (!result.ok) throw new Error(result.error)
        return result.text
      } finally {
        signal.removeEventListener('abort', abort)
      }
    },
  }
}

module.exports = { registerAI, streamCompletion, normalizeEndpoint, listModels }
