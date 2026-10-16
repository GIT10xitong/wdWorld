// @vitest-environment node
import { afterEach, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { registerNovelHome } = require('../electron/novel-home')
const roots: string[] = []
const safeStorage = {
  isEncryptionAvailable: () => true,
  encryptString: (s: string) => Buffer.from(s),
  decryptString: (b: Buffer) => b.toString(),
}
afterEach(() => {
  for (const root of roots.splice(0)) {
    if (!path.resolve(root).startsWith(path.join(os.tmpdir(), 'wdworld-notebook-')))
      throw new Error('Unexpected test path')
    fs.rmSync(root, { recursive: true, force: true })
  }
})
function open(root: string, storage = safeStorage) {
  const handlers: Record<string, (...args: any[]) => any> = {}
  registerNovelHome({
    app: { getPath: () => root },
    ipcMain: {
      handle: (id: string, fn: any) => {
        handlers[id] = fn
      },
    },
    safeStorage: storage,
  })
  return {
    load: () => handlers['novel-home:load'](),
    save: (data: any) => handlers['novel-home:save']({}, data),
  }
}
it('encrypts notebook drafts and notes, reopens them, and preserves data after invalid writes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wdworld-notebook-'))
  roots.push(root)
  const home = open(root)
  expect(home.load()).toEqual({ ok: true, data: { draft: '', goal: 3000, notes: [] } })
  const data = {
    draft: 'PRIVATE_DRAFT',
    goal: 2000,
    notes: [{ id: 'n1', text: 'PRIVATE_NOTE', createdAt: new Date().toISOString() }],
  }
  expect(home.save(data)).toEqual({ ok: true })
  const file = path.join(root, 'novel-home.wdw'),
    encrypted = fs.readFileSync(file)
  expect(encrypted.includes(Buffer.from('PRIVATE_'))).toBe(false)
  expect(open(root).load()).toEqual({ ok: true, data })
  for (const invalid of [
    { ...data, goal: 0 },
    { ...data, draft: 'a'.repeat(5001) },
    { ...data, notes: [{ id: 'n', text: 123, createdAt: '' }] },
  ]) {
    expect(home.save(invalid).ok).toBe(false)
    expect(fs.readFileSync(file)).toEqual(encrypted)
  }
  fs.writeFileSync(file, 'corrupt')
  expect(home.load().ok).toBe(false)
})
it('does not fall back to plaintext if OS encryption is unavailable', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wdworld-notebook-'))
  roots.push(root)
  const home = open(root, { ...safeStorage, isEncryptionAvailable: () => false })
  expect(home.save({ draft: 'PRIVATE', goal: 3000, notes: [] }).ok).toBe(false)
  expect(fs.existsSync(path.join(root, 'novel-home.wdw'))).toBe(false)
})
