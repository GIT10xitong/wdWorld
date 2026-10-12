const http = require('node:http')
const crypto = require('node:crypto')
const os = require('node:os')
const fs = require('node:fs')
const path = require('node:path')
const { createAutomation, normalizeAutomation } = require('./lan-automation')

function localAddress(address = '') {
  const ip = address.replace(/^::ffff:/, '')
  return (
    ip === '::1' ||
    /^127\./.test(ip) ||
    /^10\./.test(ip) ||
    /^192\.168\./.test(ip) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    /^169\.254\./.test(ip)
  )
}
function rollDice(expression) {
  const match = /^(\d{1,2})d(\d{1,4})(?:([+-])(\d{1,4}))?$/i.exec(String(expression).trim())
  if (!match) throw new Error('Use NdM, for example 1d20+3')
  const count = Number(match[1]),
    sides = Number(match[2]),
    modifier = Number(match[4] || 0) * (match[3] === '-' ? -1 : 1)
  if (count < 1 || count > 20 || sides < 2 || sides > 1000 || Math.abs(modifier) > 1000)
    throw new Error('Dice limits: 1–20 dice, 2–1000 sides, modifier ±1000')
  const rolls = Array.from({ length: count }, () => crypto.randomInt(1, sides + 1))
  return {
    expression: String(expression).trim(),
    rolls,
    modifier,
    total: rolls.reduce((a, b) => a + b, modifier),
  }
}
const clean = (value, limit, required = false) => {
  if (typeof value !== 'string' || value.length > limit || (required && !value.trim()))
    throw new Error('Invalid text or text is too long')
  return value.trim()
}
const token = () => crypto.randomBytes(32).toString('base64url')

function createLanServer({
  onArchive = () => {},
  clientDir = path.join(__dirname, 'lan-client'),
  generate,
  automationDelay,
} = {}) {
  let server = null,
    room = null,
    revision = 0,
    starting = false
  const sessions = new Map(),
    rates = new Map()
  const changed = () => {
    revision++
  }
  const message = (speaker, text, kind = 'chat', extra = {}) => {
    const item = { id: crypto.randomUUID(), at: new Date().toISOString(), speaker, text, kind, ...extra }
    room.messages.push(item)
    if (room.messages.length > 300) room.messages.shift()
    changed()
    return item
  }
  const automation = createAutomation({
    room: () => room,
    changed,
    message,
    generate,
    delay: automationDelay,
  })
  const publicState = () =>
    room
      ? {
          id: room.id,
          title: room.title,
          mode: room.mode,
          revision,
          scene: room.scene,
          handouts: room.handouts,
          players: room.players,
          messages: room.messages,
          initiative: room.initiative,
          locked: room.locked,
          roles: room.roles,
          paused: room.paused,
          automation: automation.status(),
        }
      : null
  const hostState = () =>
    room
      ? {
          ...publicState(),
          projectId: room.projectId,
          code: room.code,
          addresses: room.addresses,
          port: room.port,
          automation: automation.host(),
        }
      : null
  const assertRoom = () => {
    if (!room) throw new Error('No room is running')
  }
  const archive = () => {
    if (room) onArchive({ ...publicState(), projectId: room.projectId })
  }
  const hostAction = (action, input = {}) => {
    assertRoom()
    switch (action) {
      case 'automation':
        automation.configure(input.config)
        break
      case 'ai-request':
        automation.request()
        break
      case 'ai-publish':
        automation.publish(input.text)
        break
      case 'ai-pause':
        automation.pause()
        break
      case 'intervene': {
        const content = clean(input.text, 4000, true)
        automation.pause()
        message('主持人 / GM', content)
        break
      }
      case 'chat':
        automation.invalidate()
        message(clean(input.speaker || '主持人 / Host', 120), clean(input.text, 4000, true))
        break
      case 'ai':
        if (input.expectedRevision !== undefined && input.expectedRevision !== revision)
          throw new Error('Room changed; regenerate the reply')
        if (input.roleId && room.players.some((p) => p.roleId === input.roleId))
          throw new Error('This character is controlled by a player')
        automation.invalidate()
        message(clean(input.speaker, 120, true), clean(input.text, 12000, true), 'ai', {
          roleId: input.roleId || '',
        })
        break
      case 'pause':
        automation.invalidate()
        room.paused = !!input.paused
        changed()
        break
      case 'role': {
        if (room.mode !== 'tavern') throw new Error('Tavern room required')
        const id = clean(input.id, 100, true)
        if (room.roles.some((r) => r.id === id)) throw new Error('Character already published')
        if (room.roles.length >= 40) throw new Error('Maximum 40 characters')
        room.roles.push({
          id,
          name: clean(input.name, 120, true),
          description: clean(input.description, 4000),
        })
        changed()
        break
      }
      case 'remove-role':
        automation.invalidate()
        room.roles = room.roles.filter((r) => r.id !== input.id)
        for (const player of room.players)
          if (player.roleId === input.id) {
            player.roleId = ''
            player.character = { name: '', description: '', hp: 0, maxHp: 0 }
          }
        changed()
        break
      case 'roll': {
        const result = rollDice(input.expression)
        message('主持人 / Host', result.expression, 'roll', { roll: result })
        break
      }
      case 'scene':
        automation.invalidate()
        room.scene = clean(input.text, 12000)
        changed()
        break
      case 'handout': {
        automation.invalidate()
        if (room.handouts.length >= 50) throw new Error('Maximum 50 handouts')
        room.handouts.push({
          id: crypto.randomUUID(),
          title: clean(input.title, 120, true),
          content: clean(input.content, 20000, true),
        })
        changed()
        break
      }
      case 'remove-handout':
        automation.invalidate()
        room.handouts = room.handouts.filter((h) => h.id !== input.id)
        changed()
        break
      case 'kick':
        automation.invalidate()
        if (!room.players.some((p) => p.id === input.id)) throw new Error('Unknown player')
        for (const [key, id] of sessions) if (id === input.id) sessions.delete(key)
        room.players = room.players.filter((p) => p.id !== input.id)
        room.initiative = room.initiative.filter((p) => p.playerId !== input.id)
        changed()
        break
      case 'lock':
        room.locked = !!input.locked
        changed()
        break
      case 'initiative': {
        automation.invalidate()
        if (!Array.isArray(input.items) || input.items.length > 40) throw new Error('Invalid initiative list')
        room.initiative = input.items
          .map((p) => {
            if (!Number.isFinite(p.value) || Math.abs(p.value) > 1000) throw new Error('Invalid initiative')
            return { playerId: clean(p.playerId || '', 100), name: clean(p.name, 120, true), value: p.value }
          })
          .sort((a, b) => b.value - a.value)
        changed()
        break
      }
      default:
        throw new Error('Unknown host action')
    }
    return hostState()
  }
  const readBody = (req) =>
    new Promise((resolve, reject) => {
      let size = 0,
        chunks = []
      req.on('data', (chunk) => {
        size += chunk.length
        if (size > 32768) {
          chunks = []
          reject(new Error('Request too large'))
          req.destroy()
        } else chunks.push(chunk)
      })
      req.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
        } catch {
          reject(new Error('Invalid JSON'))
        }
      })
      req.on('error', reject)
    })
  const respond = (res, status, value) => {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'same-origin',
    })
    res.end(value === undefined ? '' : JSON.stringify(value))
  }
  const start = async (input) => {
    if (server || starting) throw new Error('A room is already running')
    const mode = input?.mode
    if (!['trpg', 'tavern'].includes(mode)) throw new Error('Invalid room mode')
    const title = clean(input.title, 120, true),
      projectId = clean(input.projectId, 200, true)
    const automationConfig = normalizeAutomation(input.automation)
    const initialScene = clean(input.scene || '', 12000)
    const port = input.port === undefined ? 0 : Number(input.port)
    if (!Number.isInteger(port) || (port !== 0 && (port < 1024 || port > 65535)))
      throw new Error('Invalid port')
    const addressSet = new Set(['127.0.0.1', 'localhost'])
    for (const list of Object.values(os.networkInterfaces()))
      for (const info of list || [])
        if (info.family === 'IPv4' && !info.internal && localAddress(info.address))
          addressSet.add(info.address)
    const nextServer = http.createServer(async (req, res) => {
      try {
        if (!room || !localAddress(req.socket.remoteAddress))
          return respond(res, 403, { error: 'Local network only' })
        const host = req.headers.host || ''
        if (![...addressSet].some((ip) => host === `${ip}:${room.port}`))
          return respond(res, 403, { error: 'Invalid host' })
        const origin = `http://${host}`
        if (req.headers.origin && req.headers.origin !== origin)
          return respond(res, 403, { error: 'Invalid origin' })
        const url = new URL(req.url, origin)
        if (
          req.method === 'GET' &&
          ['/', '/client.js', '/client.css', '/errors.json'].includes(url.pathname)
        ) {
          const name = {
            '/': 'index.html',
            '/client.js': 'client.js',
            '/client.css': 'client.css',
            '/errors.json': 'errors.json',
          }[url.pathname]
          res.writeHead(200, {
            'Content-Type': name.endsWith('.json')
              ? 'application/json; charset=utf-8'
              : name.endsWith('.js')
                ? 'text/javascript; charset=utf-8'
                : name.endsWith('.css')
                  ? 'text/css; charset=utf-8'
                  : 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
            'Referrer-Policy': 'no-referrer',
            'Content-Security-Policy':
              "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
          })
          return res.end(fs.readFileSync(path.join(clientDir, name)))
        }
        const rateKey = req.socket.remoteAddress + ':' + (url.pathname === '/join' ? 'join' : 'api')
        const rate = rates.get(rateKey) || { since: Date.now(), count: 0 }
        if (Date.now() - rate.since > 60000) {
          rate.since = Date.now()
          rate.count = 0
        }
        rate.count++
        rates.set(rateKey, rate)
        if (rates.size > 1000) rates.delete(rates.keys().next().value)
        if (rate.count > (url.pathname === '/join' ? 20 : 1200))
          return respond(res, 429, { error: 'Too many requests; retry later' })
        if (
          req.method === 'POST' &&
          (!req.headers['content-type']?.startsWith('application/json') || req.headers.origin !== origin)
        )
          return respond(res, 403, { error: 'JSON and same-origin required' })
        if (req.method === 'POST' && url.pathname === '/join') {
          const body = await readBody(req)
          const supplied = crypto.createHash('sha256').update(String(body.code)).digest()
          if (!crypto.timingSafeEqual(supplied, room.codeHash))
            return respond(res, 401, { error: 'Invalid room code' })
          if (room.locked || room.players.length >= 16)
            return respond(res, 403, { error: 'Room is locked or full' })
          const player = {
            id: crypto.randomUUID(),
            name: clean(body.name, 80, true),
            character: { name: '', description: '', hp: 0, maxHp: 0 },
            roleId: '',
          }
          room.players.push(player)
          const accessToken = token()
          sessions.set(accessToken, player.id)
          changed()
          automation.joined(player)
          return respond(res, 200, { token: accessToken, playerId: player.id, state: publicState() })
        }
        const accessToken = req.headers.authorization?.replace(/^Bearer /, '')
        const playerId = sessions.get(accessToken)
        const player = room.players.find((p) => p.id === playerId)
        if (!player) return respond(res, 401, { error: 'Join the room again' })
        if (req.method === 'GET' && url.pathname === '/state')
          return respond(
            res,
            Number(url.searchParams.get('revision')) === revision ? 204 : 200,
            Number(url.searchParams.get('revision')) === revision ? undefined : publicState(),
          )
        if (req.method === 'POST' && url.pathname === '/action') {
          const body = await readBody(req)
          if (body.action === 'chat') {
            if (room.paused && !body.ooc) throw new Error('Roleplay is paused; use OOC chat')
            const role = room.roles.find((r) => r.id === player.roleId)
            message(
              body.ooc ? player.name : role?.name || player.character.name || player.name,
              clean(body.text, 4000, true),
              body.ooc ? 'ooc' : 'chat',
              { playerId, roleId: body.ooc ? '' : player.roleId },
            )
            if (!body.ooc) automation.playerMessage()
          } else if (body.action === 'roll') {
            if (room.paused) throw new Error('Roleplay is paused; use OOC chat')
            const result = rollDice(body.expression)
            message(player.character.name || player.name, result.expression, 'roll', {
              playerId,
              roll: result,
            })
            if (room.mode === 'trpg') automation.playerMessage()
          } else if (body.action === 'character') {
            if (player.roleId) throw new Error('Release your claimed character before editing')
            const hp = Number(body.hp),
              maxHp = Number(body.maxHp)
            if (![hp, maxHp].every((n) => Number.isInteger(n) && n >= 0 && n <= 100000) || hp > maxHp)
              throw new Error('Invalid HP')
            player.character = {
              name: clean(body.name, 120),
              description: clean(body.description, 4000),
              hp,
              maxHp,
            }
            automation.invalidate()
            changed()
          } else if (body.action === 'claim') {
            if (room.mode !== 'tavern') throw new Error('Tavern room required')
            const role = room.roles.find((r) => r.id === body.id)
            if (body.id && !role) throw new Error('Unknown character')
            if (body.id && room.players.some((p) => p.id !== playerId && p.roleId === body.id))
              throw new Error('Character already claimed')
            player.roleId = role?.id || ''
            automation.invalidate()
            player.character = {
              name: role?.name || '',
              description: role?.description || '',
              hp: 0,
              maxHp: 0,
            }
            changed()
          } else if (body.action === 'leave') {
            automation.invalidate()
            sessions.delete(accessToken)
            room.players = room.players.filter((p) => p.id !== playerId)
            room.initiative = room.initiative.filter((p) => p.playerId !== playerId)
            changed()
          } else return respond(res, 403, { error: 'This action is host-only' })
          return respond(res, 200, publicState())
        }
        respond(res, 404, { error: 'Not found' })
      } catch (e) {
        if (!res.destroyed && !res.headersSent) respond(res, 400, { error: e.message })
      }
    })
    nextServer.requestTimeout = 10000
    nextServer.headersTimeout = 10000
    starting = true
    try {
      await new Promise((resolve, reject) => {
        nextServer.once('error', reject)
        nextServer.listen(port, '0.0.0.0', resolve)
      })
    } finally {
      starting = false
    }
    server = nextServer
    const code = crypto.randomBytes(6).toString('hex').toUpperCase()
    const boundPort = server.address().port
    room = {
      id: crypto.randomUUID(),
      projectId,
      mode,
      title,
      port: boundPort,
      code,
      codeHash: crypto.createHash('sha256').update(code).digest(),
      addresses: [...addressSet].filter((ip) => ip !== 'localhost').map((ip) => `http://${ip}:${boundPort}`),
      scene: initialScene,
      handouts: [],
      players: [],
      messages: [],
      initiative: [],
      locked: false,
      paused: false,
      roles: [],
    }
    sessions.clear()
    rates.clear()
    revision = 1
    automation.configure(automationConfig)
    return hostState()
  }
  const stop = async () => {
    if (!server) return
    archive()
    automation.stop()
    const previous = server
    server = null
    room = null
    sessions.clear()
    rates.clear()
    await new Promise((resolve) => {
      previous.close(resolve)
      previous.closeAllConnections()
    })
  }
  return { start, stop, state: hostState, hostAction, archive }
}

function registerLan({ ipcMain, app, safeStorage, generate }) {
  const { createProtectedStorage } = require('./protected-storage')
  const vault = createProtectedStorage(safeStorage)
  const lan = createLanServer({
    generate,
    onArchive: (data) =>
      vault.write(
        path.join(app.getPath('userData'), 'lan-sessions', data.id + '.wdw'),
        JSON.stringify(data),
        'lan-session:' + data.id,
      ),
  })
  const invoke = (fn) => async (_event, input) => {
    try {
      return { ok: true, state: await fn(input) }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  }
  ipcMain.handle(
    'lan:start',
    invoke((input) => {
      if (!vault.available()) throw new Error('System encryption is unavailable')
      return lan.start(input)
    }),
  )
  ipcMain.handle(
    'lan:state',
    invoke(() => lan.state()),
  )
  ipcMain.handle(
    'lan:action',
    invoke((input) => lan.hostAction(input.action, input)),
  )
  ipcMain.handle(
    'lan:stop',
    invoke(async () => {
      await lan.stop()
      return null
    }),
  )
  ipcMain.handle(
    'lan:archive',
    invoke(() => {
      lan.archive()
      return lan.state()
    }),
  )
  let archiveError = ''
  const timer = setInterval(() => {
    try {
      lan.archive()
      archiveError = ''
    } catch (e) {
      archiveError = e.message
    }
  }, 10000)
  timer.unref()
  ipcMain.handle('lan:archive-status', () => ({ error: archiveError }))
  ipcMain.handle('lan:history', async (_event, projectId) => {
    const dir = path.join(app.getPath('userData'), 'lan-sessions')
    if (!fs.existsSync(dir)) return []
    const records = []
    for (const name of fs.readdirSync(dir).filter((name) => /^[a-f0-9-]+\.wdw$/.test(name))) {
      const id = name.slice(0, -4)
      try {
        const record = JSON.parse(vault.read(path.join(dir, name), 'lan-session:' + id).toString())
        if (record.projectId === projectId) records.push(record)
      } catch {
        /* An unreadable archive does not hide readable records. */
      }
    }
    return records.reverse()
  })
  app.on('before-quit', () => {
    try {
      lan.archive()
    } catch {
      /* Project export remains available in the host UI. */
    }
  })
  return lan
}
module.exports = { createLanServer, registerLan, rollDice, localAddress }
