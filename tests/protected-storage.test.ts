import { createRequire } from 'node:module'
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
const require = createRequire(import.meta.url)
const { createProtectedStorage, createProjectStorage } = require('../electron/protected-storage')
const folders: string[] = []
const safeStorage = {
  isEncryptionAvailable: () => true,
  encryptString: (s: string) => Buffer.from(s),
  decryptString: (b: Buffer) => b.toString(),
}
function harness() {
  const root = mkdtempSync(join(tmpdir(), 'wdworld-protected-'))
  folders.push(root)
  return { root, store: createProjectStorage(root, safeStorage), vault: createProtectedStorage(safeStorage) }
}
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true })
})
const meta = JSON.stringify({ id: 'project_1', name: '秘密作品', createdAt: '2026-10-10' })
const db = Buffer.from('SQLite format 3\0秘密正文与世界设定').toString('base64')

describe('encrypted local projects', () => {
  it('encrypts metadata, body and prior backup; preserves exact round trips', () => {
    const { root, store } = harness()
    store.save('project_1', meta, db)
    const file = join(root, 'projects/project_1/project.wdw')
    store.save('project_1', meta.replace('秘密作品', '新作品'), db)
    for (const suffix of ['', '.bak']) {
      const raw = readFileSync(file + suffix)
      expect(raw.includes(Buffer.from('秘密'))).toBe(false)
      expect(raw.includes(Buffer.from(db))).toBe(false)
      expect(raw.subarray(0, 16).toString()).not.toBe('SQLite format 3\0')
    }
    expect(store.load('project_1')).toEqual({ projectJson: meta.replace('秘密作品', '新作品'), dbBase64: db })
    store.saveRecent([{ id: 'project_1', name: '秘密作品' }])
    expect(readFileSync(join(root, 'recent-projects.wdw')).includes(Buffer.from('秘密作品'))).toBe(false)
    expect(store.loadRecent()[0].name).toBe('秘密作品')
  })

  it('migrates plaintext only after encryption succeeds, including old backup/temp copies', () => {
    const { root, store, vault } = harness()
    const dir = join(root, 'projects/project_1')
    mkdirSync(dir, { recursive: true })
    for (const suffix of ['', '.bak', '.tmp']) {
      writeFileSync(join(dir, 'project.json' + suffix), meta)
      writeFileSync(join(dir, 'database.db' + suffix), Buffer.from(db, 'base64'))
    }
    const locked = createProjectStorage(root, { ...safeStorage, isEncryptionAvailable: () => false })
    expect(() => locked.load('project_1')).toThrow('系统加密不可用')
    expect(readFileSync(join(dir, 'project.json'), 'utf8')).toBe(meta)
    expect(store.load('project_1')).toEqual({ projectJson: meta, dbBase64: db })
    const archived = JSON.parse(
      vault.read(join(dir, 'legacy-recovery.wdw'), 'legacy-recovery:project_1').toString(),
    )
    expect(Buffer.from(archived['project.json.bak'], 'base64').toString()).toBe(meta)
    expect(archived['database.db.bak']).toBe(db)
    for (const name of ['project.json', 'database.db'])
      for (const suffix of ['', '.bak', '.tmp']) expect(existsSync(join(dir, name + suffix))).toBe(false)
    writeFileSync(join(root, 'recent-projects.json'), JSON.stringify([{ id: 'project_1', name: '秘密作品' }]))
    expect(store.loadRecent()[0].id).toBe('project_1')
    expect(existsSync(join(root, 'recent-projects.json'))).toBe(false)
  })

  it('rejects tampering and copying ciphertext between projects; refuses to overwrite corruption', () => {
    const { root, store, vault } = harness()
    const encrypted = vault.seal(Buffer.from('私有文字'), 'project:one')
    expect(() => vault.open(encrypted, 'project:two')).toThrow('解密失败')
    encrypted[encrypted.length - 1] ^= 1
    expect(() => vault.open(encrypted, 'project:one')).toThrow('解密失败')
    store.save('project_1', meta, db)
    const file = join(root, 'projects/project_1/project.wdw')
    const damaged = readFileSync(file)
    damaged[damaged.length - 1] ^= 1
    writeFileSync(file, damaged)
    expect(() => store.load('project_1')).toThrow('解密失败')
    expect(() => store.save('project_1', meta, db)).toThrow('解密失败')
    expect(readFileSync(file)).toEqual(damaged)
  })

  it('rejects insecure encryption backends, invalid IDs and mismatched project data', () => {
    const { store } = harness()
    const vault = createProtectedStorage({ ...safeStorage, getSelectedStorageBackend: () => 'basic_text' })
    expect(() => vault.seal(Buffer.from('text'), 'project')).toThrow('系统加密不可用')
    expect(() => store.load('../outside')).toThrow('无效的项目 ID')
    expect(() => store.save('other', meta, db)).toThrow('元信息不匹配')
    expect(() => store.save('project_1', meta, Buffer.from('bad').toString('base64'))).toThrow('数据库无效')
  })
})
