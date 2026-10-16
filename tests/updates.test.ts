// @vitest-environment node
import { it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { EventEmitter } from 'node:events'
const { createUpdates, newer } = createRequire(import.meta.url)('../electron/updates')
it('ignores prereleases, equal versions and downgrades', () => {
  expect(newer('v1.10.0', '1.9.0')).toBe(true)
  for (const version of ['1.8.0', '1.9.0', '2.0.0-beta', 'unknown'])
    expect(newer(version, '1.9.0')).toBe(false)
})
it('checks portable versions but never runs an installer', async () => {
  const manager = createUpdates({
    version: '1.9.0',
    supported: false,
    fetchImpl: async () =>
      new Response(JSON.stringify({ tag_name: 'v1.10.0', draft: false, prerelease: false })),
  })
  expect((await manager.check()).phase).toBe('available')
  await expect(manager.download()).rejects.toThrow()
  await expect(manager.install()).rejects.toThrow()
})
it('serializes download and requires a downloaded update and successful save gate to install', async () => {
  const updater: any = new EventEmitter()
  let installs = 0,
    canSave = false,
    release: () => void = () => {}
  updater.checkForUpdates = async () => updater.emit('update-available', { version: '1.10.0' })
  updater.downloadUpdate = async () => {
    await new Promise<void>((r) => {
      release = r
    })
    updater.emit('update-downloaded', { version: '1.10.0' })
  }
  updater.quitAndInstall = () => {
    installs++
  }
  const manager = createUpdates({
    version: '1.9.0',
    supported: true,
    updater,
    beforeInstall: async () => {
      if (!canSave) throw new Error('disk')
    },
  })
  expect(updater.autoInstallOnAppQuit).toBe(false)
  expect(updater.allowDowngrade).toBe(false)
  await manager.check()
  await expect(manager.install()).rejects.toThrow()
  const first = manager.download()
  await expect(manager.download()).rejects.toThrow()
  release()
  await first
  await manager.install()
  expect(installs).toBe(0)
  expect(manager.state().phase).toBe('ready')
  canSave = true
  await manager.install()
  expect(installs).toBe(1)
})
it('treats a legacy release without update metadata as current only when it is not newer', async () => {
  const updater: any = new EventEmitter()
  updater.checkForUpdates = async () => {
    throw new Error('missing manifest')
  }
  let tag = 'v1.7.0'
  const manager = createUpdates({
    version: '1.9.0',
    supported: true,
    updater,
    fetchImpl: async () => new Response(JSON.stringify({ tag_name: tag })),
  })
  expect((await manager.check()).phase).toBe('latest')
  tag = 'v2.0.0'
  expect((await manager.check()).phase).toBe('error')
})
