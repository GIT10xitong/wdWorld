const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const MAGIC = Buffer.from('WDWORLD-SEALED-1\n')

// Large manuscripts use authenticated encryption; only the small random key is
// wrapped by the operating system. No application-wide hard-coded secret.
function createProtectedStorage(safeStorage) {
  const available = () =>
    safeStorage.isEncryptionAvailable() && safeStorage.getSelectedStorageBackend?.() !== 'basic_text'
  const seal = (data, purpose) => {
    if (!available()) throw new Error('系统加密不可用，已停止保存，避免写入明文。')
    const key = crypto.randomBytes(32)
    try {
      const iv = crypto.randomBytes(12)
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
      cipher.setAAD(Buffer.from(purpose))
      const encrypted = Buffer.concat([cipher.update(data), cipher.final()])
      const wrapped = safeStorage.encryptString(key.toString('base64'))
      const size = Buffer.alloc(4)
      size.writeUInt32BE(wrapped.length)
      return Buffer.concat([MAGIC, size, wrapped, iv, cipher.getAuthTag(), encrypted])
    } finally {
      key.fill(0)
    }
  }
  const open = (data, purpose) => {
    let key
    try {
      if (!data.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('format')
      const size = data.readUInt32BE(MAGIC.length)
      const offset = MAGIC.length + 4
      if (size < 1 || size > 65536 || data.length < offset + size + 28) throw new Error('format')
      key = Buffer.from(safeStorage.decryptString(data.subarray(offset, offset + size)), 'base64')
      const start = offset + size
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, data.subarray(start, start + 12))
      decipher.setAAD(Buffer.from(purpose))
      decipher.setAuthTag(data.subarray(start + 12, start + 28))
      return Buffer.concat([decipher.update(data.subarray(start + 28)), decipher.final()])
    } catch {
      throw new Error('本地数据解密失败或文件已损坏。请使用原电脑的系统账号，勿覆盖现有文件。')
    } finally {
      key?.fill(0)
    }
  }
  const write = (file, data, purpose, backup = true) => {
    const encrypted = seal(Buffer.isBuffer(data) ? data : Buffer.from(data), purpose)
    // Verify before replacing any existing file or retiring a legacy copy.
    open(encrypted, purpose)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file + '.tmp', encrypted, { mode: 0o600 })
    if (backup && fs.existsSync(file)) {
      open(fs.readFileSync(file), purpose)
      fs.copyFileSync(file, file + '.bak')
    }
    fs.renameSync(file + '.tmp', file)
  }
  return { available, seal, open, write, read: (file, purpose) => open(fs.readFileSync(file), purpose) }
}

function createProjectStorage(root, safeStorage) {
  const vault = createProtectedStorage(safeStorage)
  const projectDir = (id) => {
    if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,200}$/.test(id)) throw new Error('无效的项目 ID')
    const dir = path.join(root, 'projects', id)
    for (const folder of [root, path.join(root, 'projects'), dir]) {
      if (fs.existsSync(folder) && fs.lstatSync(folder).isSymbolicLink())
        throw new Error('项目目录不能是符号链接')
    }
    return dir
  }
  const validate = (id, data) => {
    if (
      typeof data.projectJson !== 'string' ||
      data.projectJson.length > 1000000 ||
      typeof data.dbBase64 !== 'string' ||
      data.dbBase64.length > 512 * 1024 * 1024
    )
      throw new Error('项目数据格式或大小无效')
    const meta = JSON.parse(data.projectJson)
    if (meta.id !== id || typeof meta.name !== 'string') throw new Error('项目元信息不匹配')
    const db = Buffer.from(data.dbBase64, 'base64')
    if (db.subarray(0, 16).toString() !== 'SQLite format 3\0') throw new Error('项目数据库无效')
    return data
  }
  const retireLegacy = (dir, id) => {
    // Preserve pre-upgrade recovery copies as an encrypted archive too.
    const archive = path.join(dir, 'legacy-recovery.wdw')
    const copies = {}
    for (const name of ['project.json.bak', 'database.db.bak', 'project.json.tmp', 'database.db.tmp']) {
      const file = path.join(dir, name)
      if (fs.existsSync(file)) copies[name] = fs.readFileSync(file).toString('base64')
    }
    if (Object.keys(copies).length) {
      if (fs.existsSync(archive)) vault.read(archive, 'legacy-recovery:' + id)
      else vault.write(archive, JSON.stringify(copies), 'legacy-recovery:' + id, false)
    }
    for (const name of ['project.json', 'database.db']) {
      for (const suffix of ['', '.bak', '.tmp']) {
        const file = path.join(dir, name + suffix)
        if (fs.existsSync(file)) fs.unlinkSync(file)
      }
    }
  }
  const save = (id, projectJson, dbBase64) => {
    const data = validate(id, { projectJson, dbBase64 })
    const dir = projectDir(id)
    vault.write(path.join(dir, 'project.wdw'), JSON.stringify(data), 'project:' + id)
    retireLegacy(dir, id)
  }
  const load = (id) => {
    const dir = projectDir(id)
    const file = path.join(dir, 'project.wdw')
    if (fs.existsSync(file)) {
      const data = validate(id, JSON.parse(vault.read(file, 'project:' + id).toString()))
      retireLegacy(dir, id)
      return data
    }
    const data = validate(id, {
      projectJson: fs.readFileSync(path.join(dir, 'project.json'), 'utf8'),
      dbBase64: fs.readFileSync(path.join(dir, 'database.db')).toString('base64'),
    })
    save(id, data.projectJson, data.dbBase64)
    return data
  }
  const recentFile = path.join(root, 'recent-projects.wdw')
  const retireRecent = () => {
    for (const suffix of ['', '.bak', '.tmp']) {
      const file = path.join(root, 'recent-projects.json' + suffix)
      if (fs.existsSync(file)) fs.unlinkSync(file)
    }
  }
  const saveRecent = (list) => {
    if (!Array.isArray(list) || list.length > 100 || JSON.stringify(list).length > 1000000)
      throw new Error('最近项目列表无效')
    vault.write(recentFile, JSON.stringify(list), 'recent-projects')
    retireRecent()
  }
  const loadRecent = () => {
    if (fs.existsSync(recentFile)) {
      const list = JSON.parse(vault.read(recentFile, 'recent-projects').toString())
      retireRecent()
      return list
    }
    const legacy = path.join(root, 'recent-projects.json')
    if (!fs.existsSync(legacy)) return null
    const list = JSON.parse(fs.readFileSync(legacy, 'utf8'))
    saveRecent(list)
    return list
  }
  return { save, load, saveRecent, loadRecent, projectDir }
}

module.exports = { createProtectedStorage, createProjectStorage }
