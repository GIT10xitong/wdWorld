const { _electron } = require('playwright-core')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const http = require('node:http')
/* global window, document */
const root = path.resolve(__dirname, '..')
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'wdworld-plugin-ui-'))
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3ioAAAAASUVORK5CYII='
const wav = Buffer.alloc(44 + 8000)
wav.write('RIFF')
wav.writeUInt32LE(wav.length - 8, 4)
wav.write('WAVEfmt ', 8)
wav.writeUInt32LE(16, 16)
wav.writeUInt16LE(1, 20)
wav.writeUInt16LE(1, 22)
wav.writeUInt32LE(16000, 24)
wav.writeUInt32LE(32000, 28)
wav.writeUInt16LE(2, 32)
wav.writeUInt16LE(16, 34)
wav.write('data', 36)
wav.writeUInt32LE(8000, 40)
const calls = []
const mock = http.createServer(async (req, res) => {
  let text = ''
  for await (const chunk of req) text += chunk
  calls.push({ url: req.url, body: JSON.parse(text), auth: req.headers.authorization })
  if (req.url.endsWith('/audio/speech')) {
    res.writeHead(200, { 'Content-Type': 'audio/wav' })
    return res.end(wav)
  }
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(
    JSON.stringify(
      req.url.endsWith('/images/generations')
        ? { data: [{ b64_json: png }] }
        : { type: 'text', text: 'Service adapter works' },
    ),
  )
})
async function main() {
  await new Promise((resolve) => mock.listen(0, '127.0.0.1', resolve))
  const env = { ...process.env, WDWORLD_PREVIEW: '1', WDWORLD_TEST_USER_DATA: profile }
  delete env.ELECTRON_RUN_AS_NODE
  let app
  const errors = []
  try {
    app = await _electron.launch({ executablePath: require('electron'), args: [root], env })
    let page = await app.firstWindow()
    page.on('pageerror', (e) => errors.push(e.message))
    page.setDefaultTimeout(15000)
    await page.locator('.language-picker').selectOption('en')
    await page.locator('.mode-picker').waitFor()
    assert.deepEqual(
      (await page.locator('[data-mode]').evaluateAll((nodes) => nodes.map((n) => n.dataset.mode))).sort(),
      ['free', 'novel', 'oc'],
    )
    assert.deepEqual((await page.evaluate(() => window.wdPlugins.list())).value, [])
    const blocked = await page.evaluate(() =>
      window.lanRoom.start({ mode: 'tavern', projectId: 'fake', title: 'Forbidden' }),
    )
    assert.equal(blocked.ok, false)
    await page.getByRole('button', { name: 'Plugin center', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog
      .getByLabel('Choose plugin JSON', { exact: true })
      .setInputFiles(path.join(root, 'tests/fixtures/plugins/wdworld.memory.json'))
    await dialog.getByRole('alert').filter({ hasText: 'another category' }).waitFor()
    assert.equal(await dialog.locator('.plugin-review').count(), 0)
    async function install(id) {
      await dialog
        .getByLabel('Choose plugin JSON', { exact: true })
        .setInputFiles(path.join(root, 'tests/fixtures/plugins', id + '.json'))
      await dialog.getByLabel('I reviewed the source and approve these permissions', { exact: true }).check()
      await dialog.getByRole('button', { name: 'Confirm installation and enable', exact: true }).click()
      await dialog.locator(`[data-plugin="${id}"]`).waitFor()
      await dialog.locator('.plugin-review').waitFor({ state: 'hidden' })
    }
    for (const id of ['wdworld.trpg', 'wdworld.tavern']) await install(id)
    await dialog.getByRole('button', { name: 'Close', exact: true }).click()
    assert.equal(await page.locator('[data-mode]').count(), 5)
    console.log('Default modes, package review and dependency activation passed')
    await page.locator('[data-mode="tavern"]').click()
    await page.getByRole('button', { name: 'Plugin extensions', exact: true }).click()
    for (const id of ['wdworld.memory', 'wdworld.image', 'wdworld.speech']) await install(id)
    assert.equal(await dialog.locator('[data-plugin="wdworld.tavern"]').count(), 0)
    await dialog.getByRole('button', { name: 'Close', exact: true }).click()
    await page.getByRole('button', { name: /New world/ }).click()
    await page.getByPlaceholder('e.g. Age of Mist').fill('Plugin world')
    await page.getByRole('button', { name: 'Create and enter', exact: true }).click()
    await require('./test-plugin-helper').openStudioEditor(page)
    await page.getByLabel('Character card name', { exact: true }).fill('Keeper')
    await page.getByLabel('Character description', { exact: true }).fill('A guide')
    await page.getByRole('button', { name: 'Save this page', exact: true }).click()
    await page.locator('.mode-bar').getByRole('button', { name: 'Tavern extensions', exact: true }).click()
    await page.getByLabel('Project memory', { exact: true }).fill('PRIVATE_MEMORY_KEEPER')
    await page.getByRole('button', { name: 'Save and activate memory', exact: true }).click()
    await page.getByText('Memory saved and encrypted', { exact: true }).waitFor()
    const endpoint = 'http://127.0.0.1:' + mock.address().port + '/v1'
    for (const name of ['Text to image', 'Text to speech']) {
      await page.getByRole('button', { name, exact: true }).click()
      await page.getByLabel('Service base URL', { exact: true }).fill(endpoint)
      await page.getByLabel('Model name', { exact: true }).fill('test-model')
      await page.getByLabel('API key', { exact: true }).fill('PRIVATE_EXTENSION_KEY')
      await page.getByRole('button', { name: 'Save extension settings', exact: true }).click()
      await page.getByText('Extension settings saved and encrypted', { exact: true }).waitFor()
      await page.getByLabel('Text to send to the extension', { exact: true }).fill('The harbor is quiet.')
      await page.getByRole('button', { name: 'Confirm text and run extension', exact: true }).click()
      if (name === 'Text to image') await page.getByAltText('Image generated by extension').waitFor()
      else {
        await page.locator('audio').waitFor()
        await page.waitForFunction(() => document.querySelector('audio')?.duration > 0)
      }
    }
    assert.equal(calls.length, 2)
    assert(calls.every((c) => c.auth === 'Bearer PRIVATE_EXTENSION_KEY'))
    const registry = fs.readFileSync(path.join(profile, 'plugins/registry.wdw'))
    assert(!registry.includes(Buffer.from('PRIVATE_EXTENSION_KEY')))
    assert(!registry.includes(Buffer.from('PRIVATE_MEMORY_KEEPER')))
    assert(
      !JSON.stringify((await page.evaluate(() => window.wdPlugins.list())).value).includes(
        'PRIVATE_EXTENSION_KEY',
      ),
    )
    console.log('Encrypted memory, image generation and playable speech passed')
    await page.locator('.language-picker').selectOption('zh-CN')
    await page.getByRole('heading', { name: '酒馆扩展', exact: true }).waitFor()
    fs.mkdirSync(path.join(root, 'test-results'), { recursive: true })
    const screenshot = await app.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0]
      return (await win.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true }))
        .toPNG()
        .toString('base64')
    })
    fs.writeFileSync(
      path.join(root, 'test-results/plugins-extensions-zh.png'),
      Buffer.from(screenshot, 'base64'),
    )
    await app.close()
    app = await _electron.launch({ executablePath: require('electron'), args: [root], env })
    page = await app.firstWindow()
    await page.locator('.mode-picker').waitFor()
    assert.equal(await page.locator('[data-mode]').count(), 5)
    await page.locator('[data-mode="tavern"]').click()
    await page.getByTitle('打开 Plugin world', { exact: true }).click()
    await require('./test-plugin-helper').openStudioEditor(page)
    await page.getByLabel('角色卡名称', { exact: true }).waitFor()
    assert.equal(await page.getByLabel('角色卡名称', { exact: true }).inputValue(), 'Keeper')
    await page.locator('.mode-bar').getByRole('button', { name: '酒馆扩展', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('textarea')?.value === 'PRIVATE_MEMORY_KEEPER')
    assert.deepEqual(errors, [])
    console.log(
      'Plugin desktop installation, media, localization and restart persistence passed. Profile: ' + profile,
    )
  } finally {
    if (app) await app.close()
    mock.close()
  }
}
main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
