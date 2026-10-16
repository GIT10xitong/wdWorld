const path = require('node:path')
const fs = require('node:fs')
const { createProtectedStorage } = require('./protected-storage')
function validateHome(data) {
  if (
    !data ||
    typeof data.draft !== 'string' ||
    data.draft.length > 5000 ||
    !Number.isInteger(data.goal) ||
    data.goal < 1 ||
    data.goal > 100000 ||
    !Array.isArray(data.notes) ||
    data.notes.length > 200 ||
    !data.notes.every(
      (n) =>
        n &&
        typeof n.id === 'string' &&
        n.id.length <= 100 &&
        typeof n.text === 'string' &&
        n.text.length <= 5000 &&
        typeof n.createdAt === 'string' &&
        n.createdAt.length <= 40,
    )
  )
    throw new Error('Invalid notebook data')
  return data
}
function registerNovelHome({ app, ipcMain, safeStorage }) {
  const file = path.join(app.getPath('userData'), 'novel-home.wdw'),
    vault = createProtectedStorage(safeStorage)
  ipcMain.handle('novel-home:load', () => {
    try {
      return {
        ok: true,
        data: fs.existsSync(file)
          ? validateHome(JSON.parse(vault.read(file, 'novel-home').toString()))
          : { draft: '', goal: 3000, notes: [] },
      }
    } catch {
      return { ok: false, error: 'Cannot read encrypted notebook' }
    }
  })
  ipcMain.handle('novel-home:save', (_event, data) => {
    try {
      vault.write(file, JSON.stringify(validateHome(data)), 'novel-home')
      return { ok: true }
    } catch {
      return { ok: false, error: 'Cannot save encrypted notebook' }
    }
  })
}
module.exports = { registerNovelHome, validateHome }
