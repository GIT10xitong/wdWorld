// @vitest-environment node
import { afterEach, expect, it } from 'vitest'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { createLanServer } = require('../electron/lan')
const servers: any[] = []
afterEach(async () => {
  for (const s of servers.splice(0)) await s.stop()
})
const tick = () => new Promise((resolve) => setTimeout(resolve, 20))
async function until(fn: () => boolean) {
  for (let i = 0; i < 100 && !fn(); i++) await tick()
  expect(fn()).toBe(true)
}
async function setup(mode: string, generate: (...args: any[]) => Promise<string>) {
  const server = createLanServer({ generate, automationDelay: 0 })
  servers.push(server)
  const config = {
    enabled: true,
    greet: true,
    roleId: mode === 'tavern' ? 'guide' : '',
    opening: 'Welcome {{user}}, I am {{char}}.',
    character: { name: 'Guide', description: 'A guide.', creator_notes: 'NEVER_SEND_NOTES' },
    book: [{ keys: 'beacon', content: 'BEACON_LORE', enabled: true, constant: false }],
    system: 'Narrative',
    secrets: 'NEVER_SEND_SECRETS',
    instructions: 'HOST_GUIDANCE',
  }
  const host = await server.start({
    title: 'Room',
    projectId: 'project',
    mode,
    scene: 'PUBLIC',
    automation: config,
  })
  const url = `http://127.0.0.1:${host.port}`
  const post = async (path: string, body: unknown, token?: string) => {
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
  const joined = await post('/join', { name: 'Alice', code: host.code })
  const action = (body: unknown) => post('/action', body, joined.data.token)
  return { server, config, joined, action, url }
}
it('greets once on join, automatically replies, filters private metadata and ignores OOC', async () => {
  const requests: any[] = []
  const { server, joined, action, url } = await setup('tavern', async (m) => {
    requests.push(m)
    return 'Welcome to the beacon.'
  })
  expect(joined.data.state.messages).toHaveLength(1)
  expect(joined.data.state.messages[0].text).toBe('Welcome Alice, I am Guide.')
  expect(JSON.stringify(joined.data.state)).not.toMatch(/HOST_GUIDANCE|NEVER_SEND|BEACON_LORE/)
  await fetch(url + '/state', { headers: { Authorization: `Bearer ${joined.data.token}` } })
  expect(server.state().messages).toHaveLength(1)
  await action({ action: 'chat', text: 'OOC hello', ooc: true })
  await tick()
  expect(requests).toHaveLength(0)
  await action({ action: 'chat', text: 'Where is the beacon?' })
  await until(() => server.state().messages.at(-1)?.kind === 'ai')
  expect(requests).toHaveLength(1)
  expect(JSON.stringify(requests)).toContain('BEACON_LORE')
  expect(JSON.stringify(requests)).not.toMatch(/NEVER_SEND|OOC hello/)
  await tick()
  expect(requests).toHaveLength(1)
  expect((await action({ action: 'automation', config: {} })).status).toBe(403)
})
it('serializes overlapping player messages and discards replies after host intervention', async () => {
  const jobs: { resolve: (s: string) => void; signal: AbortSignal }[] = []
  const { server, action, config } = await setup(
    'tavern',
    (_m, signal) => new Promise((resolve) => jobs.push({ resolve, signal })),
  )
  await action({ action: 'chat', text: 'first' })
  await until(() => jobs.length === 1)
  await action({ action: 'chat', text: 'second' })
  expect(jobs[0].signal.aborted).toBe(true)
  expect(jobs).toHaveLength(1)
  jobs[0].resolve('STALE')
  await until(() => jobs.length === 2)
  jobs[1].resolve('fresh')
  await until(() => !server.state().automation.busy)
  expect(
    server
      .state()
      .messages.filter((m: any) => m.kind === 'ai')
      .map((m: any) => m.text),
  ).toEqual(['fresh'])
  await action({ action: 'chat', text: 'third' })
  await until(() => jobs.length === 3)
  server.hostAction('intervene', { text: 'Host takes over.' })
  jobs[2].resolve('LATE')
  await until(() => !server.state().automation.busy)
  expect(server.state().messages.at(-1).text).toBe('Host takes over.')
  expect(server.state().automation.enabled).toBe(false)
  server.hostAction('automation', { config })
  server.hostAction('role', { id: 'guide', name: 'Guide', description: 'Public' })
  await action({ action: 'claim', id: 'guide' })
  await action({ action: 'chat', text: 'I control the guide' })
  await until(() => !!server.state().automation.error)
  expect(jobs).toHaveLength(3)
})
it('TRPG reacts to dice, supports editable preview and pause, and never supplies secrets', async () => {
  const requests: any[] = []
  const { server, action, config } = await setup('trpg', async (m) => {
    requests.push(m)
    return 'You hear footsteps.'
  })
  await action({ action: 'roll', expression: '1d20' })
  await until(() => server.state().messages.at(-1)?.kind === 'ai')
  expect(JSON.stringify(requests)).not.toMatch(/NEVER_SEND|BEACON_LORE|creator_notes/)
  server.hostAction('automation', { config: { ...config, enabled: false } })
  server.hostAction('ai-request')
  await until(() => !!server.state().automation.preview)
  server.hostAction('ai-publish', { text: 'Edited by host.' })
  expect(server.state().messages.at(-1).text).toBe('Edited by host.')
  server.hostAction('ai-request')
  await until(() => !!server.state().automation.preview)
  server.hostAction('scene', { text: 'new location' })
  expect(() => server.hostAction('ai-publish', {})).toThrow('Room changed')
  server.hostAction('pause', { paused: true })
  expect((await action({ action: 'roll', expression: '1d20' })).status).toBe(400)
})
it('stops automatic retries on errors and never publishes a result into a new room', async () => {
  let count = 0
  const { server, action } = await setup('trpg', async () => {
    count++
    throw new Error('Test outage')
  })
  await action({ action: 'chat', text: 'go' })
  await until(() => !server.state().automation.enabled)
  await action({ action: 'chat', text: 'more' })
  await tick()
  expect(count).toBe(1)
  expect(server.state().automation.error).toBe('Test outage')
  let finish!: (s: string) => void
  const other = await setup(
    'trpg',
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  await other.action({ action: 'chat', text: 'go' })
  await until(() => !!finish)
  await other.server.stop()
  await other.server.start({ title: 'New', mode: 'trpg', projectId: 'new' })
  finish('old room reply')
  await tick()
  expect(other.server.state().messages).toHaveLength(0)
})
