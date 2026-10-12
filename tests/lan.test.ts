// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import http from 'node:http'
const require = createRequire(import.meta.url)
const { createLanServer, rollDice, localAddress } = require('../electron/lan.js')
const servers: any[] = []
afterEach(async () => {
  for (const server of servers.splice(0)) await server.stop()
})
async function room(mode = 'trpg') {
  const server = createLanServer()
  servers.push(server)
  const host = await server.start({ mode, title: 'Test room', projectId: 'secret-project-id' })
  const url = `http://127.0.0.1:${host.port}`
  const post = (path: string, body: object, token?: string, origin = url) =>
    fetch(url + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: origin,
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      body: JSON.stringify(body),
    })
  const join = async (name: string) => (await post('/join', { code: host.code, name })).json()
  return { server, host, url, post, join }
}
describe('LAN rooms', () => {
  it('claims characters exclusively, isolates OOC and enforces stale AI reply checks', async () => {
    const { server, post, join } = await room('tavern')
    const alice = await join('Alice'),
      bob = await join('Bob')
    server.hostAction('role', {
      id: 'guide',
      name: 'Guide',
      description: 'Public bio',
      creator_notes: 'SECRET',
    })
    expect(JSON.stringify(server.state())).not.toContain('SECRET')
    expect((await post('/action', { action: 'role', id: 'evil', name: 'Evil' }, alice.token)).status).toBe(
      403,
    )
    const claimed = await (
      await post('/action', { action: 'claim', id: 'guide', playerId: bob.playerId }, alice.token)
    ).json()
    expect(claimed.players.find((p: any) => p.id === alice.playerId).roleId).toBe('guide')
    expect((await post('/action', { action: 'claim', id: 'guide' }, bob.token)).status).toBe(400)
    expect(
      (
        await post(
          '/action',
          { action: 'character', name: 'Fake', description: '', hp: 0, maxHp: 0 },
          alice.token,
        )
      ).status,
    ).toBe(400)
    expect(() => server.hostAction('ai', { roleId: 'guide', speaker: 'Guide', text: 'Fake' })).toThrow(
      'controlled by a player',
    )
    await post('/action', { action: 'chat', speaker: 'Forged', text: 'Hello' }, alice.token)
    expect(server.state().messages.at(-1).speaker).toBe('Guide')
    server.hostAction('pause', { paused: true })
    expect((await post('/action', { action: 'chat', text: 'IC' }, alice.token)).status).toBe(400)
    await post('/action', { action: 'chat', text: 'OOC', ooc: true }, alice.token)
    expect(server.state().messages.at(-1)).toMatchObject({ kind: 'ooc', speaker: 'Alice' })
    const revision = server.state().revision
    server.hostAction('pause', { paused: false })
    expect(() =>
      server.hostAction('ai', { speaker: 'Other', text: 'Stale', expectedRevision: revision }),
    ).toThrow('Room changed')
    await post('/action', { action: 'leave' }, alice.token)
    expect((await post('/action', { action: 'claim', id: 'guide' }, bob.token)).status).toBe(200)
    server.hostAction('remove-role', { id: 'guide' })
    expect(server.state().players[0].roleId).toBe('')
    expect(server.state().players[0].character.name).toBe('')
    server.hostAction('ai', { speaker: 'Other', text: 'Fresh', expectedRevision: server.state().revision })
    expect(server.state().messages.at(-1).text).toBe('Fresh')
  })
  it('shares only public state and isolates player characters and host actions', async () => {
    const { server, host, post, join, url } = await room()
    const alice = await join('Alice'),
      bob = await join('Bob')
    expect(alice.token).not.toBe(bob.token)
    expect(JSON.stringify(alice.state)).not.toContain(host.code)
    expect(JSON.stringify(alice.state)).not.toContain('secret-project-id')
    expect((await fetch(url + '/state')).status).toBe(401)
    expect((await post('/action', { action: 'ai', text: 'forged' }, bob.token)).status).toBe(403)
    expect((await post('/action', { action: 'scene', text: 'forged' }, bob.token)).status).toBe(403)
    await post(
      '/action',
      {
        action: 'character',
        playerId: bob.playerId,
        name: 'Alice character',
        description: '<script>alert(1)</script>',
        hp: 8,
        maxHp: 10,
      },
      alice.token,
    )
    expect(server.state().players.find((p: any) => p.id === bob.playerId).character.name).toBe('')
    expect(server.state().players.find((p: any) => p.id === alice.playerId).character.hp).toBe(8)
    await post('/action', { action: 'chat', text: 'hello' }, alice.token)
    const rolled = await (await post('/action', { action: 'roll', expression: '2d6+3' }, bob.token)).json()
    expect(rolled.messages[0].speaker).toBe('Alice character')
    expect(rolled.messages[1].roll.total).toBeGreaterThanOrEqual(5)
    server.hostAction('handout', { title: 'Public map', content: 'Published only' })
    const state = await (
      await fetch(url + '/state?revision=-1', { headers: { Authorization: 'Bearer ' + bob.token } })
    ).json()
    expect(state.handouts[0].title).toBe('Public map')
    expect(
      (
        await fetch(url + '/state?revision=' + state.revision, {
          headers: { Authorization: 'Bearer ' + bob.token },
        })
      ).status,
    ).toBe(204)
    server.hostAction('kick', { id: bob.playerId })
    expect((await post('/action', { action: 'chat', text: 'late' }, bob.token)).status).toBe(401)
  })
  it('checks join code, origin, host, bounds and room locking', async () => {
    const { server, host, post, join, url } = await room('tavern')
    expect((await post('/join', { code: 'wrong', name: 'X' })).status).toBe(401)
    expect(
      (await post('/join', { code: host.code, name: 'X' }, undefined, 'https://evil.example')).status,
    ).toBe(403)
    const hostileHostStatus = await new Promise((resolve) => {
      http.get(url, { headers: { Host: 'evil.example' } }, (res) => {
        res.resume()
        resolve(res.statusCode)
      })
    })
    expect(hostileHostStatus).toBe(403)
    const player = await join('Player')
    expect(
      (
        await post(
          '/action',
          { action: 'character', name: 'X', description: '', hp: 10, maxHp: 1 },
          player.token,
        )
      ).status,
    ).toBe(400)
    expect((await post('/action', { action: 'chat', text: 'x'.repeat(4001) }, player.token)).status).toBe(400)
    server.hostAction('lock', { locked: true })
    expect((await post('/join', { code: host.code, name: 'X' })).status).toBe(403)
    const page = await fetch(url)
    expect(page.headers.get('content-security-policy')).toContain("frame-ancestors 'none'")
    expect(await page.text()).toContain('client.js')
    expect((await fetch(url + '/client.js')).status).toBe(200)
    await server.stop()
    expect(server.state()).toBeNull()
    await expect(fetch(url)).rejects.toThrow()
  })
  it('rejects concurrent rooms and invalid dice', async () => {
    const server = createLanServer()
    servers.push(server)
    const results = await Promise.allSettled(
      [1, 2].map(() => server.start({ mode: 'trpg', title: 'Test', projectId: 'p' })),
    )
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    for (const expression of ['0d6', '21d6', '1d1', '1d1001', '1d6+1001', '<script>'])
      expect(() => rollDice(expression)).toThrow()
    expect(localAddress('192.168.1.2')).toBe(true)
    expect(localAddress('172.32.1.2')).toBe(false)
    expect(localAddress('8.8.8.8')).toBe(false)
  })
})
