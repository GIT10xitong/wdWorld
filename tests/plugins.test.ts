// @vitest-environment node
import { afterEach, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { createPluginManager, validateManifest, CATALOG } = require('../electron/plugins')
const { hash, serviceUrl } = require('../electron/plugin-network')
const { createLanServer } = require('../electron/lan')
const roots: string[] = [],
  rooms: any[] = []
const safeStorage = {
  isEncryptionAvailable: () => true,
  encryptString: (s: string) => Buffer.from(s),
  decryptString: (b: Buffer) => b.toString(),
}
it('accepts declared novel/service targets but rejects mode spoofing and unsupported memory targets', () => {
  const manifest = { ...fixture('image'), id: 'external.novel-image', targets: ['novel'], dependencies: [] }
  expect(() => validateManifest(manifest)).not.toThrow()
  expect(() => validateManifest({ ...manifest, mode: 'tavern' })).toThrow()
  expect(() => validateManifest({ ...manifest, targets: ['unknown'] })).toThrow()
  expect(() => validateManifest({ ...manifest, targets: ['trpg'] })).toThrow()
  expect(() => validateManifest({ ...fixture('memory'), targets: ['novel'], dependencies: [] })).toThrow()
})
afterEach(async () => {
  for (const s of rooms.splice(0)) await s.stop()
  for (const root of roots.splice(0)) {
    if (!root.startsWith(path.join(os.tmpdir(), 'wdworld-plugins-'))) throw new Error('Unexpected test path')
    fs.rmSync(root, { recursive: true, force: true })
  }
})
function fixture(id: string) {
  return JSON.parse(fs.readFileSync(`tests/fixtures/plugins/wdworld.${id}.json`, 'utf8'))
}
function setup(extra = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wdworld-plugins-'))
  roots.push(root)
  return { manager: createPluginManager({ root, safeStorage, ...extra }), root }
}
async function install(manager: any, manifest: any) {
  const review = await manager.prepare({ json: JSON.stringify(manifest) })
  return manager.install({ token: review.token, permissions: manifest.permissions })
}

it('starts empty, installs only after review, checks dependencies and preserves memory across reinstalls', async () => {
  const { manager, root } = setup()
  expect(manager.list()).toEqual([])
  expect(() => manager.requireMode('trpg')).toThrow('required mode')
  expect(() => manager.requireMode('free')).not.toThrow()
  await expect(install(manager, fixture('memory'))).rejects.toThrow('dependencies')
  await install(manager, fixture('tavern'))
  const review = await manager.prepare({ json: JSON.stringify(fixture('memory')) })
  expect(() => manager.install({ token: review.token, permissions: [] })).toThrow('permissions')
  manager.install({ token: review.token, permissions: review.manifest.permissions })
  expect(() => manager.install({ token: review.token, permissions: review.manifest.permissions })).toThrow(
    'expired',
  )
  manager.memory({ id: 'wdworld.memory', projectId: 'project-a', text: 'HIDDEN_MEMORY' }, true)
  expect(manager.memory({ id: 'wdworld.memory', projectId: 'project-b' })).toBe('')
  expect(() => manager.change({ id: 'wdworld.tavern', action: 'disable' })).toThrow('dependent')
  manager.change({ id: 'wdworld.memory', action: 'uninstall' })
  await install(manager, fixture('memory'))
  expect(manager.memory({ id: 'wdworld.memory', projectId: 'project-a' })).toBe('HIDDEN_MEMORY')
  expect(
    fs.readFileSync(path.join(root, 'plugins/registry.wdw')).includes(Buffer.from('HIDDEN_MEMORY')),
  ).toBe(false)
  const reopened = createPluginManager({ root, safeStorage })
  expect(reopened.memory({ id: 'wdworld.memory', projectId: 'project-a' })).toBe('HIDDEN_MEMORY')
})
it('rejects native scripts, incompatible versions, traversal and undeclared capabilities', () => {
  expect(() => validateManifest({ display_name: 'ST', js: 'index.js' })).toThrow('adapter')
  for (const patch of [
    { id: '../escape' },
    { id: 'constructor' },
    { apiVersion: 99 },
    { minAppVersion: '99.0.0' },
    { js: 'script.js' },
    { permissions: ['filesystem.all'] },
    { mode: 'free' },
  ])
    expect(() => validateManifest({ ...fixture('trpg'), ...patch })).toThrow()
  expect(() => validateManifest({ ...fixture('image'), permissions: [] })).toThrow('capability')
  expect(() => serviceUrl('http://external.example')).toThrow('HTTPS')
  expect(() => serviceUrl('https://name:secret@example.org')).toThrow('credentials')
  expect(serviceUrl('http://127.0.0.1:1234/v1/')).toBe('http://127.0.0.1:1234/v1')
})
it('checks catalog digests and permits offline package review', async () => {
  const bytes = JSON.stringify(fixture('trpg')),
    manifest = fixture('trpg')
  const entry = {
    id: manifest.id,
    version: manifest.version,
    name: manifest.name,
    description: manifest.description,
    sha256: hash(Buffer.from(bytes)),
    url: 'https://raw.githubusercontent.com/actrox/wdWorld-plugins/main/packages/wdworld.trpg.json',
  }
  let corrupt = false
  const { manager } = setup({
    fetchImpl: async (url: string) =>
      new Response(
        url === CATALOG ? JSON.stringify({ apiVersion: 1, plugins: [entry] }) : bytes + (corrupt ? ' ' : ''),
      ),
  })
  const preview = await manager.prepare({ catalogId: manifest.id })
  expect(preview.catalogVerified).toBe(true)
  corrupt = true
  await expect(manager.prepare({ catalogId: manifest.id })).rejects.toThrow('integrity')
  manager.install({ token: preview.token, permissions: [] })
  expect(manager.enabled(manifest.id)).toBe(true)
})
it('keeps keys out of renderer state, clears them on endpoint changes and validates service media', async () => {
  const calls: any[] = []
  const { manager, root } = setup({
    fetchImpl: async (url: string, options: any) => {
      calls.push({ url, ...options })
      return new Response(JSON.stringify({ data: [{ b64_json: 'aW1hZ2U=' }] }), {
        headers: { 'Content-Type': 'application/json' },
      })
    },
  })
  await install(manager, fixture('tavern'))
  await install(manager, fixture('image'))
  manager.configure({
    id: 'wdworld.image',
    endpoint: 'http://127.0.0.1:9001/v1',
    model: 'image',
    key: 'SECRET_API_KEY',
  })
  expect(JSON.stringify(manager.list())).not.toContain('SECRET_API_KEY')
  expect(
    fs.readFileSync(path.join(root, 'plugins/registry.wdw')).includes(Buffer.from('SECRET_API_KEY')),
  ).toBe(false)
  const output = await manager.invoke({ id: 'wdworld.image', text: 'Harbor' })
  expect(output).toMatchObject({ type: 'image', mime: 'image/png' })
  expect(calls[0].headers.Authorization).toBe('Bearer SECRET_API_KEY')
  expect(JSON.parse(calls[0].body).prompt).toBe('Harbor')
  expect(calls[0].redirect).toBe('error')
  manager.configure({ id: 'wdworld.image', endpoint: 'http://127.0.0.1:9002/v1', model: 'image', key: '' })
  await manager.invoke({ id: 'wdworld.image', text: 'Ship' })
  expect(calls[1].headers.Authorization).toBeUndefined()
})
it('supports third-party service packages, speech output and cancellation without executing plugin code', async () => {
  let fail = false
  const { manager } = setup({
    fetchImpl: async (url: string, options: any) => {
      if (url.includes('hold'))
        return new Promise((_resolve, reject) =>
          options.signal.addEventListener('abort', () => reject(new Error('Aborted'))),
        )
      if (url.endsWith('/audio/speech'))
        return new Response(Buffer.from('audio'), { headers: { 'Content-Type': 'audio/mpeg' } })
      return new Response(
        JSON.stringify(
          fail
            ? { type: 'html', text: '<script>evil()</script>' }
            : { type: 'text', text: 'Third-party output' },
        ),
      )
    },
  })
  await install(manager, fixture('tavern'))
  await install(manager, fixture('speech'))
  const ext = {
    ...fixture('image'),
    id: 'community.example',
    capability: 'service',
    protocol: 'wdworld-service-v1',
    permissions: ['network.request'],
  }
  await install(manager, ext)
  manager.configure({ id: ext.id, endpoint: 'http://localhost:9999', model: '' })
  expect(await manager.invoke({ id: ext.id, text: 'test' })).toEqual({
    type: 'text',
    text: 'Third-party output',
  })
  fail = true
  await expect(manager.invoke({ id: ext.id, text: 'test' })).rejects.toThrow('unsupported')
  manager.configure({ id: 'wdworld.speech', endpoint: 'http://localhost:9999/v1', model: 'voice' })
  expect(await manager.invoke({ id: 'wdworld.speech', text: 'Hello' })).toMatchObject({
    type: 'audio',
    mime: 'audio/mpeg',
  })
  manager.configure({ id: ext.id, endpoint: 'http://localhost:9999/hold', model: '' })
  const pending = manager.invoke({ id: ext.id, text: 'test' })
  await expect(manager.invoke({ id: ext.id, text: 'test' })).rejects.toThrow('already running')
  manager.cancel(ext.id)
  await expect(pending).rejects.toThrow('Aborted')
})
it('blocks runtime mode changes and rejects dependency cycles before writing', async () => {
  let locked = false
  const { manager } = setup({
    guardChange: () => {
      if (locked) throw new Error('running room')
    },
  })
  await install(manager, fixture('tavern'))
  const a = { ...fixture('memory'), id: 'community.a' },
    b = { ...fixture('memory'), id: 'community.b', dependencies: ['wdworld.tavern', 'community.a'] }
  await install(manager, a)
  await install(manager, b)
  await expect(install(manager, { ...a, dependencies: ['wdworld.tavern', 'community.b'] })).rejects.toThrow(
    'cycle',
  )
  expect(manager.enabled(a.id)).toBe(true)
  locked = true
  expect(() => manager.change({ id: b.id, action: 'disable' })).toThrow('running room')
})
it('injects only enabled project memory into Tavern automation, excluding other projects and OOC', async () => {
  const { manager } = setup()
  await install(manager, fixture('tavern'))
  await install(manager, fixture('memory'))
  manager.memory({ id: 'wdworld.memory', projectId: 'p', text: '港口的守卫名叫林默。' }, true)
  manager.memory({ id: 'wdworld.memory', projectId: 'other', text: 'OTHER_PROJECT_SECRET' }, true)
  const calls: any[] = []
  const server = createLanServer({
    automationDelay: 0,
    getMemory: manager.memoryContext,
    generate: async (m: any) => {
      calls.push(m)
      return 'Hello.'
    },
  })
  rooms.push(server)
  await server.start({
    mode: 'tavern',
    projectId: 'p',
    title: 'Room',
    automation: { enabled: false, character: { name: 'Guide', description: 'Guide' } },
  })
  server.hostAction('ai-request')
  for (let i = 0; i < 50 && !calls.length; i++) await new Promise((r) => setTimeout(r, 10))
  expect(JSON.stringify(calls)).toContain('林默')
  expect(JSON.stringify(calls)).not.toContain('OTHER_PROJECT_SECRET')
  manager.change({ id: 'wdworld.memory', action: 'disable' })
  expect(manager.memoryContext('p', '港口')).toBe('')
})
