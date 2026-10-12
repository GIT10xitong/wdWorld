import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
const require = createRequire(import.meta.url)
const { trustedSender, externalUrl } = require('../electron/security')

describe('desktop source isolation', () => {
  it('accepts only the app main frame, never subframes or other pages', () => {
    const url = 'file:///app/dist/index.html'
    const mainFrame = { url }
    const webContents = { mainFrame }
    const windows = [{ isDestroyed: () => false, webContents }]
    expect(trustedSender({ sender: webContents, senderFrame: mainFrame }, windows, url)).toBe(true)
    expect(trustedSender({ sender: webContents, senderFrame: { url } }, windows, url)).toBe(false)
    expect(trustedSender({ sender: {}, senderFrame: mainFrame }, windows, url)).toBe(false)
    mainFrame.url = 'https://attacker.example'
    expect(trustedSender({ sender: webContents, senderFrame: mainFrame }, windows, url)).toBe(false)
    mainFrame.url = 'file:///some-other-file.html'
    expect(trustedSender({ sender: webContents, senderFrame: mainFrame }, windows, url)).toBe(false)
  })
  it('blocks shell/file/javascript protocols and credentials in external URLs', () => {
    for (const url of [
      'file:///C:/file',
      'javascript:alert(1)',
      'ms-settings:privacy',
      'https://secret@host',
      'bad',
    ])
      expect(externalUrl(url)).toBe(false)
    expect(externalUrl('https://example.com/story')).toBe(true)
  })
})
