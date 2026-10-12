import { createRequire } from 'node:module'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'
const require = createRequire(import.meta.url)
const { registerAI } = require('../electron/ai.js')
const folders: string[] = []
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true })
  vi.useRealTimers()
})
function harness(
  fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ data: [{ id: 'writer' }] }) })),
) {
  const dir = mkdtempSync(join(tmpdir(), 'wdworld-ai-settings-'))
  folders.push(dir)
  const handlers = new Map<string, (...args: any[]) => any>()
  const safeStorage = {
    isEncryptionAvailable: () => true,
    encryptString: (s: string) => Buffer.from('encrypted:' + s),
    decryptString: (b: Buffer) => b.toString().replace(/^encrypted:/, ''),
  }
  registerAI({
    ipcMain: { handle: (name: string, handler: any) => handlers.set(name, handler) },
    app: { getPath: () => dir },
    safeStorage,
    fetchImpl,
  })
  const sender = Object.assign(new EventEmitter(), { id: 1, isDestroyed: () => false, send: vi.fn() })
  return {
    dir,
    fetchImpl,
    sender,
    invoke: (name: string, input?: unknown) => handlers.get(name)!({ sender }, input),
  }
}

describe('provider profiles and secret isolation', () => {
  it('keeps separate encrypted profiles and never exposes their keys to the renderer', async () => {
    const h = harness()
    const deepseek = {
      provider: 'deepseek',
      protocol: 'chat',
      endpoint: 'https://api.deepseek.com',
      model: 'writer',
      key: 'deepseek-secret',
    }
    const saved = h.invoke('ai:settings:save', deepseek)
    expect(saved.hasKey).toBe(true)
    expect(JSON.stringify(saved)).not.toContain('secret')
    h.invoke('ai:settings:save', {
      provider: 'mimo',
      protocol: 'chat',
      endpoint: 'https://api.xiaomimimo.com/v1',
      model: 'mimo-writer',
      key: 'mimo-secret',
    })
    expect(h.invoke('ai:settings:get').provider).toBe('mimo')
    expect(h.invoke('ai:settings:get', 'deepseek').model).toBe('writer')
    await h.invoke('ai:models', { ...deepseek, key: '' })
    expect(h.fetchImpl.mock.calls.at(-1)?.[1].headers.Authorization).toBe('Bearer deepseek-secret')
    const stored = readFileSync(join(h.dir, 'ai-settings.json'), 'utf8')
    for (const privateValue of [
      'deepseek-secret',
      'mimo-secret',
      'api.deepseek.com',
      'writer',
      'activeProvider',
    ])
      expect(stored).not.toContain(privateValue)
    expect(JSON.parse(stored)).toHaveProperty('encryptedConfig')
    expect(h.sender.listenerCount('destroyed')).toBe(0)
  })

  it('does not send saved keys to changed endpoints or other providers, including before saving', async () => {
    const h = harness()
    const base = {
      provider: 'deepseek',
      endpoint: 'https://api.deepseek.com',
      model: 'writer',
      key: 'secret',
    }
    h.invoke('ai:settings:save', base)
    for (const changes of [
      { endpoint: 'https://other.example/v1' },
      { provider: 'custom' },
      { clearKey: true },
    ]) {
      await h.invoke('ai:models', { ...base, ...changes, key: '' })
      expect(h.fetchImpl.mock.calls.at(-1)?.[1].headers).toEqual({})
    }
    expect(h.invoke('ai:settings:get').hasKey).toBe(true)
    h.invoke('ai:settings:save', { ...base, key: '', clearKey: true })
    expect(h.invoke('ai:settings:get').hasKey).toBe(false)
  })

  it('fetches with an unsaved key without changing the active provider or writing a config', async () => {
    const h = harness()
    const result = await h.invoke('ai:models', {
      provider: 'mimo',
      endpoint: 'https://api.xiaomimimo.com/v1',
      key: 'temporary',
    })
    expect(result.ok).toBe(true)
    expect(h.fetchImpl.mock.calls[0][1].headers['api-key']).toBe('temporary')
    expect(h.invoke('ai:settings:get').provider).toBe('deepseek')
    expect(h.invoke('ai:settings:get', 'mimo').hasKey).toBe(false)
  })

  it('migrates legacy settings without losing a working model, protocol or encrypted key', async () => {
    const h = harness()
    writeFileSync(
      join(h.dir, 'ai-settings.json'),
      JSON.stringify({
        endpoint: 'https://api.openai.com/v1',
        model: 'legacy-writer',
        encryptedKey: Buffer.from('encrypted:old-key').toString('base64'),
      }),
    )
    const config = h.invoke('ai:settings:get')
    expect(config).toMatchObject({
      provider: 'openai',
      protocol: 'chat',
      model: 'legacy-writer',
      hasKey: true,
    })
    h.invoke('ai:settings:save', { ...config, key: '', protocol: 'responses' })
    expect(JSON.parse(readFileSync(join(h.dir, 'ai-settings.json'), 'utf8')).version).toBe(3)
    await h.invoke('ai:models', { ...config, key: '' })
    expect(h.fetchImpl.mock.calls.at(-1)?.[1].headers.Authorization).toBe('Bearer old-key')
  })

  it('times out discovery and cancels requests without leaking handlers', async () => {
    vi.useFakeTimers()
    const fetcher = vi.fn(
      (_url: string, options: any) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
        }),
    )
    const h = harness(fetcher as any)
    const input = { provider: 'custom', endpoint: 'http://127.0.0.1:11434/v1', key: '' }
    const pending = h.invoke('ai:models', input)
    await vi.advanceTimersByTimeAsync(25000)
    expect(await pending).toMatchObject({ ok: false, error: expect.stringContaining('超时') })
    const second = h.invoke('ai:models', input)
    h.invoke('ai:cancel', 'models')
    expect(await second).toMatchObject({ ok: false })
    expect(h.sender.listenerCount('destroyed')).toBe(0)
  })

  it('activates a successful test and uses exactly that profile for the next creation', async () => {
    const calls: any[] = []
    const h = harness(
      vi.fn(async (url: string, options: any) => {
        calls.push({ url, ...options })
        return {
          ok: true,
          headers: { get: () => 'application/json' },
          json: async () => ({ choices: [{ message: { content: '正文' }, finish_reason: 'stop' }] }),
        }
      }) as any,
    )
    const input = {
      provider: 'deepseek',
      endpoint: 'https://example.com',
      key: 'test-key',
      model: 'chosen-writer',
    }
    const tested = await h.invoke('ai:test', input)
    expect(tested.settings.model).toBe('chosen-writer')
    expect(tested.settings.hasKey).toBe(true)
    expect(
      (await h.invoke('ai:generate', { id: 'new', messages: [{ role: 'user', content: '创作想法' }] })).ok,
    ).toBe(true)
    expect(calls.map((c) => JSON.parse(c.body).model)).toEqual(['chosen-writer', 'chosen-writer'])
    expect(JSON.parse(calls[1].body).thinking).toEqual({ type: 'disabled' })
    expect(h.sender.send.mock.calls.some((c) => c[0] === 'ai:progress' && c[1].phase === 'connected')).toBe(
      true,
    )
  })
})
