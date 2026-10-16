const { _electron } = require('playwright-core')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const http = require('node:http')
const assert = require('node:assert/strict')
const fixture = require('../tests/fixtures/tavern-world.json')
/* global window, document */
const root = path.resolve(__dirname, '..')
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'wdworld-world-'))
const requests = []
const server = http.createServer(async (req, res) => {
  let body = ''
  for await (const chunk of req) body += chunk
  requests.push(JSON.parse(body))
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(
    JSON.stringify({ choices: [{ message: { content: JSON.stringify(fixture) }, finish_reason: 'stop' }] }),
  )
})
async function main() {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const env = { ...process.env, WDWORLD_PREVIEW: '1', WDWORLD_TEST_USER_DATA: profile }
  delete env.ELECTRON_RUN_AS_NODE
  let app, page
  const errors = []
  const launch = async () => {
    app = await _electron.launch({ executablePath: require('electron'), args: [root], env })
    page = await app.firstWindow()
    await require('./test-plugin-helper').installTestModes(page)
    page.setDefaultTimeout(15000)
    page.on('pageerror', (e) => errors.push(e.message))
    await page.locator('.language-picker').selectOption('zh-CN')
  }
  const mode = async (name) => {
    await page.locator('.mode-bar').getByRole('button', { name, exact: true }).click()
    if (name === '酒馆制作') await require('./test-plugin-helper').openStudioEditor(page)
  }
  const capture = async (name) => {
    const base64 = await app.evaluate(async ({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows()[0]
      await w.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true })
      await new Promise((r) => setTimeout(r, 300))
      return (await w.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true }))
        .toPNG()
        .toString('base64')
    })
    fs.mkdirSync(path.join(root, 'test-results'), { recursive: true })
    fs.writeFileSync(path.join(root, 'test-results', name), Buffer.from(base64, 'base64'))
  }
  try {
    await launch()
    await page.locator('[data-mode="tavern"]').click()
    await page.getByRole('button', { name: /新建世界/ }).click()
    await page.getByPlaceholder('例如：雾海纪元').fill('整套世界验收')
    await page.getByRole('button', { name: '创建并进入', exact: true }).click()
    await page.locator('.studio-home').waitFor()
    await require('./test-plugin-helper').openStudioEditor(page)
    assert.equal(
      await page.locator('.mode-bar').getByRole('button', { name: '切换创作模式', exact: true }).count(),
      0,
    )
    await page.evaluate(
      (endpoint) =>
        window.novelAI.saveSettings({
          provider: 'custom',
          protocol: 'chat',
          endpoint,
          model: 'world-test',
          key: '',
          clearKey: true,
        }),
      `http://127.0.0.1:${server.address().port}`,
    )
    await page.getByRole('button', { name: '随机生成整套酒馆世界', exact: true }).click()
    await page.getByRole('button', { name: '采纳整套世界与角色卡', exact: true }).waitFor()
    assert.equal(requests.length, 1)
    assert(JSON.parse(requests[0].messages[1].content).创作随机种子)
    await capture('tavern-world-preview.png')
    await mode('世界观设定')
    await page.locator('.workspace-sidebar').getByRole('button', { name: /^设定/ }).click()
    await page.locator('.workspace-sidebar').getByText('星潮边界', { exact: true }).click()
    await page.waitForFunction(
      () => document.querySelector('input[aria-label="条目标题"]')?.value === '星潮边界',
    )
    assert.equal(
      await page
        .locator('select')
        .filter({ has: page.locator('option[value="proposed"]') })
        .inputValue(),
      'proposed',
    )
    await capture('generated-world-entries.png')
    await mode('酒馆制作')
    await page.getByLabel('角色卡名称', { exact: true }).fill('作者新编辑')
    await page.getByRole('button', { name: '采纳整套世界与角色卡', exact: true }).click()
    await page
      .getByRole('alert')
      .getByText(/草稿在生成后已修改/)
      .waitFor()
    assert.equal(await page.getByLabel('选择收藏角色卡').locator('option').count(), 1)
    await page.getByLabel('角色卡名称', { exact: true }).fill('')
    await page.getByRole('button', { name: '采纳整套世界与角色卡', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('[aria-label="角色卡名称"]')?.value === '守灯人')
    assert.equal(await page.getByLabel('选择收藏角色卡').locator('option').count(), 3)
    await page.getByRole('status').filter({ hasText: '已保存到本机' }).waitFor()
    await app.evaluate(({ Menu }) =>
      Menu.getApplicationMenu().getMenuItemById('switch-creation-mode').click(),
    )
    await page.locator('.mode-picker').waitFor()
    await app.close()
    app = null
    await launch()
    await page.locator('[data-mode="tavern"]').click()
    await page.getByTitle('打开 整套世界验收', { exact: true }).click()
    await page.locator('.studio-home').waitFor()
    await require('./test-plugin-helper').openStudioEditor(page)
    assert.equal(await page.getByLabel('角色卡名称', { exact: true }).inputValue(), '守灯人')
    assert.equal(await page.getByLabel('选择收藏角色卡').locator('option').count(), 3)
    assert.equal(await page.getByLabel('世界书标题 6', { exact: true }).inputValue(), '测绘师的愿望')
    await mode('世界观设定')
    await page.locator('.workspace-sidebar').getByRole('button', { name: /^设定/ }).click()
    await page.locator('.workspace-sidebar').getByText('星潮边界', { exact: true }).click()
    await page.waitForFunction(
      () => document.querySelector('input[aria-label="条目标题"]')?.value === '星潮边界',
    )
    assert.equal(
      await page
        .locator('select')
        .filter({ has: page.locator('option[value="proposed"]') })
        .inputValue(),
      'active',
    )
    assert.deepEqual(errors, [])
    console.log(
      'Whole world generation, automatic pending entries, stale-edit guard, acceptance, native menu, default landing and encrypted restart PASS. Profile: ' +
        profile,
    )
  } finally {
    if (app) await app.evaluate(({ app }) => app.exit()).catch(() => {})
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
  }
}
main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
