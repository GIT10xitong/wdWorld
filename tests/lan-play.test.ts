// @vitest-environment node
import { afterEach, expect, it } from 'vitest'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { createLanServer } = require('../electron/lan')
const { resolveCheck } = require('../electron/lan-trpg')
const servers: any[] = []
afterEach(async () => {
  for (const s of servers.splice(0)) await s.stop()
})
const tick = () => new Promise((resolve) => setTimeout(resolve, 25))
async function until(fn: () => boolean) {
  for (let i = 0; i < 100 && !fn(); i++) await tick()
  expect(fn()).toBe(true)
}
async function setup(mode = 'trpg', reply?: string, config = {}) {
  const requests: any[] = []
  const server = createLanServer({
    automationDelay: 0,
    generate: async (m: any) => {
      requests.push(m)
      return reply || 'A new path opens.'
    },
  })
  servers.push(server)
  const host = await server.start({
    title: 'Play',
    mode,
    projectId: 'p',
    automation: {
      enabled: true,
      character: {
        name: 'Guide',
        description: 'Explorer',
        system_prompt: 'WRITE_BRIEFLY',
        post_history_instructions: 'USE_DIALOGUE',
        creator_notes: 'SECRET_NOTES',
      },
      ...config,
    },
  })
  const url = `http://127.0.0.1:${host.port}`
  async function post(path: string, body: object, token?: string) {
    const res = await fetch(url + path, {
      method: 'POST',
      headers: {
        Origin: url,
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    })
    return { status: res.status, data: await res.json() }
  }
  const join = async (name: string) => (await post('/join', { name, code: host.code })).data
  const alice = await join('Alice'),
    bob = await join('Bob')
  const action = (who: any, body: object) => post('/action', body, who.token)
  return { server, requests, alice, bob, action, join }
}
const check = (playerId: string, extra = {}) => ({
  playerId,
  label: 'Search',
  rule: 'd20',
  target: 12,
  modifier: 2,
  advantage: 'normal',
  ...extra,
})

it('evaluates d20 advantage/disadvantage and d100 boundaries without narrative criticals', () => {
  const values = [1, 20]
  expect(resolveCheck(check('p', { advantage: 'advantage' }), () => values.shift())).toEqual({
    rolls: [1, 20],
    total: 22,
    success: true,
  })
  expect(resolveCheck(check('p', { advantage: 'disadvantage' }), () => 1).success).toBe(false)
  expect(resolveCheck(check('p', { target: 30 }), () => 20).success).toBe(false)
  expect(resolveCheck(check('p', { target: 1, modifier: 0 }), () => 1).success).toBe(true)
  expect(resolveCheck(check('p', { rule: 'd100', target: 50, modifier: 0 }), () => 50).success).toBe(true)
  expect(resolveCheck(check('p', { rule: 'd100', target: 50, modifier: 0 }), () => 51).success).toBe(false)
})
it('waits for every active player and pending checks; prevents forged and duplicate rolls', async () => {
  const { server, requests, alice, bob, action } = await setup()
  server.hostAction('round-config', { enabled: true })
  server.hostAction('check-request', check(alice.playerId))
  const id = server.state().checks[0].id
  expect((await action(bob, { action: 'check-roll', id })).status).toBe(400)
  expect((await action(alice, { action: 'round-force' })).status).toBe(403)
  await action(alice, { action: 'chat', text: 'I search' })
  expect((await action(alice, { action: 'chat', text: 'Duplicate' })).status).toBe(400)
  await action(bob, { action: 'chat', text: 'I wait', ooc: true })
  await tick()
  expect(requests).toHaveLength(0)
  await action(bob, { action: 'chat', text: 'I watch' })
  await tick()
  expect(requests).toHaveLength(0)
  expect(() => server.hostAction('round-force')).toThrow('pending checks')
  await action(alice, { action: 'check-roll', id, result: { total: 999 } })
  await until(() => requests.length === 1 && !server.state().automation.busy)
  expect(server.state().round).toMatchObject({ number: 2, phase: 'collecting', submitted: [] })
  const rolled = JSON.stringify(server.state().checks[0])
  await action(alice, { action: 'check-roll', id })
  await tick()
  expect(JSON.stringify(server.state().checks[0])).toBe(rolled)
  expect(requests).toHaveLength(1)
  expect(server.state().messages.filter((m: any) => m.kind === 'check')).toHaveLength(1)
  const context = JSON.parse(requests[0][1].content)
  expect(context.checks[0].result.total).toBeLessThanOrEqual(22)
  expect(context.round.number).toBe(1)
})
it('allows away players, GM manual rounds, cancelled checks and departure without deadlock', async () => {
  const { server, requests, alice, bob, action } = await setup()
  server.hostAction('round-config', { enabled: true })
  server.hostAction('ai-pause')
  await action(bob, { action: 'away', away: true })
  expect((await action(bob, { action: 'chat', text: 'away action' })).status).toBe(400)
  await action(alice, { action: 'chat', text: 'Proceed' })
  expect(server.state().round.phase).toBe('ready')
  expect(requests).toHaveLength(0)
  server.hostAction('round-next')
  expect(server.state().round.number).toBe(2)
  server.hostAction('check-request', check(bob.playerId))
  await action(bob, { action: 'leave' })
  expect(server.state().checks[0].status).toBe('cancelled')
  server.hostAction('ai-request')
  await until(() => !!server.state().automation.preview)
  server.hostAction('ai-publish', { text: 'GM edited response' })
  expect(server.state().round.number).toBe(3)
  server.hostAction('pause', { paused: true })
  expect((await action(alice, { action: 'away', away: true })).status).toBe(400)
  expect(() => server.hostAction('check-request', check(alice.playerId))).toThrow('paused')
})
it('keeps free-chat automation enabled while a check is pending and validates requests', async () => {
  const { server, requests, alice, action } = await setup()
  expect(() => server.hostAction('check-request', check(alice.playerId, { rule: 'eval' }))).toThrow(
    'Invalid check',
  )
  expect(() =>
    server.hostAction('check-request', check(alice.playerId, { rule: 'd100', modifier: 2 })),
  ).toThrow('Invalid check')
  server.hostAction('check-request', check(alice.playerId))
  server.hostAction('check-request', check(alice.playerId))
  expect(server.state().checks).toHaveLength(1)
  await action(alice, { action: 'chat', text: 'I search' })
  await action(alice, { action: 'roll', expression: '1d20' })
  await tick()
  expect(requests).toHaveLength(0)
  expect(server.state().automation.enabled).toBe(true)
  await action(alice, { action: 'check-roll', id: server.state().checks[0].id })
  await until(() => requests.length === 1)
  await until(() => !server.state().automation.busy)
  server.hostAction('check-request', check(alice.playerId, { label: 'Second check' }))
  await action(alice, { action: 'chat', text: 'Continue after GM cancellation' })
  server.hostAction('check-cancel', { id: server.state().checks.at(-1).id })
  await until(() => requests.length === 2)
})
it('shares structured tavern story suggestions and applies card preferences without exposing private notes', async () => {
  const story = {
    location: 'Harbor',
    goal: 'Find guide',
    summary: 'The party reached the docks.',
    choices: ['Ask the guide', 'Inspect the ship', 'Wait'],
  }
  const { server, requests, alice, action } = await setup(
    'tavern',
    JSON.stringify({ reply: 'Welcome to the harbor.', story }),
    { immersive: true },
  )
  await action(alice, { action: 'chat', text: 'Hello' })
  await until(() => !!server.state().story)
  expect(server.state().story).toEqual(story)
  expect(server.state().messages.at(-1).text).toBe('Welcome to the harbor.')
  expect(JSON.stringify(requests)).toMatch(/WRITE_BRIEFLY/)
  expect(JSON.stringify(requests)).toMatch(/USE_DIALOGUE/)
  expect(JSON.stringify(requests)).not.toContain('SECRET_NOTES')
  const response = await action(alice, { action: 'chat', ooc: true, text: 'OOC' })
  expect(response.data.story).toEqual(story)
  expect(JSON.stringify(response.data)).not.toMatch(/WRITE_BRIEFLY|USE_DIALOGUE|SECRET_NOTES/)
  expect((await action(alice, { action: 'story', ...story })).status).toBe(403)
  server.hostAction('story', { location: 'Inn', goal: '', summary: 'Host revision' })
  expect(server.state().story).toEqual({ location: 'Inn', goal: '', summary: 'Host revision', choices: [] })
  server.hostAction('scene', { text: 'A new place' })
  expect(server.state().story).toBeNull()
})
it('requires explicit publication of preview story state and stops malformed JSON retry loops', async () => {
  const story = { location: 'Inn', goal: 'Rest', summary: '', choices: ['Rest'] }
  const first = await setup('tavern', JSON.stringify({ reply: 'Hello', story }), {
    immersive: true,
    enabled: false,
  })
  first.server.hostAction('ai-request')
  await until(() => !!first.server.state().automation.preview)
  expect(first.server.state().story).toBeNull()
  first.server.hostAction('story', { location: 'Host', goal: '', summary: '' })
  expect(() => first.server.hostAction('ai-publish')).toThrow('Room changed')
  first.server.hostAction('ai-request')
  await until(() => !!first.server.state().automation.preview)
  first.server.hostAction('ai-publish')
  expect(first.server.state().story).toEqual(story)
  const second = await setup('tavern', '{"reply":"Incomplete"}', { immersive: true })
  await second.action(second.alice, { action: 'chat', text: 'Hello' })
  await until(() => !second.server.state().automation.enabled)
  expect(second.server.state().automation.error).toContain('Invalid immersive reply')
  expect(second.server.state().story).toBeNull()
  expect(second.server.state().messages.some((m: any) => m.kind === 'ai')).toBe(false)
  await tick()
  expect(second.requests).toHaveLength(1)
})
