const { _electron } = require('playwright-core')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const http = require('node:http')
/* global window, document */
const root = path.resolve(__dirname, '..')
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'wdworld-auto-'))
const artifacts = path.join(root, 'test-results')
fs.mkdirSync(artifacts, { recursive: true })
const requests = []
const mock = http.createServer(async (req, res) => {
  let body = ''
  for await (const chunk of req) body += chunk
  const input = JSON.parse(body)
  requests.push(input)
  let content = `自动叙事回复 ${requests.length}`
  if (input.messages[0].content.includes('Create a complete playable original TRPG world')) {
    const d = JSON.parse(input.messages[1].content).当前草稿
    content = JSON.stringify({
      ...d,
      name: '随机星港',
      premise: 'PUBLIC SPACEPORT',
      scenes: '三个场景',
      npcs: '领航员',
      secrets: 'SECRET MODULE',
      world_settings: [{ type: 'location', title: '星港入口', content: '公开的入口' }],
    })
  }
  await new Promise((r) => setTimeout(r, 700))
  if (res.destroyed) return
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ choices: [{ message: { content }, finish_reason: 'stop' }] }))
})
async function main() {
  await new Promise((r) => mock.listen(0, '127.0.0.1', r))
  const env = { ...process.env, WDWORLD_PREVIEW: '1', WDWORLD_TEST_USER_DATA: profile }
  delete env.ELECTRON_RUN_AS_NODE
  let app, page
  const errors = []
  const launch = async () => {
    app = await _electron.launch({ executablePath: require('electron'), args: [root], env })
    page = await app.firstWindow()
    await require('./test-plugin-helper').installTestModes(page)
    page.setDefaultTimeout(20000)
    page.on('pageerror', (e) => errors.push(e.message))
    await page.locator('.language-picker').selectOption('zh-CN')
    await page.locator('[data-mode="free"]').click()
  }
  const mode = async (name) => {
    await page.locator('.mode-bar').getByRole('button', { name, exact: true }).click()
    await page.waitForFunction(
      (label) => document.querySelector('.mode-bar [aria-current="page"]')?.textContent === label,
      name,
    )
    if (['OC 创作者', 'TRPG 主持人', '酒馆制作'].includes(name))
      await require('./test-plugin-helper').openStudioEditor(page)
  }
  const button = (name) => page.getByRole('button', { name, exact: true })
  const value = (label, expected) =>
    page.waitForFunction(
      ({ label, expected }) => document.querySelector(`[aria-label="${label}"]`)?.value === expected,
      { label, expected },
    )
  const state = async () => (await page.evaluate(() => window.lanRoom.state())).state
  const download = async (label, filename) => {
    const target = path.join(artifacts, filename)
    await app.evaluate(({ session }, target) => {
      globalThis.__automationDownload = new Promise((resolve) =>
        session.defaultSession.once('will-download', (_e, item) => {
          item.setSavePath(target)
          item.once('done', (_e, result) => resolve(result))
        }),
      )
    }, target)
    await button(label).click()
    assert.equal(await app.evaluate(() => globalThis.__automationDownload), 'completed')
    return fs.readFileSync(target, 'utf8')
  }
  const capture = async (file) => {
    const encoded = await app.evaluate(async ({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().endsWith('/dist/index.html'))
      await w.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true })
      await new Promise((r) => setTimeout(r, 300))
      return (await w.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true }))
        .toPNG()
        .toString('base64')
    })
    fs.writeFileSync(path.join(artifacts, file), Buffer.from(encoded, 'base64'))
  }
  const guest = async (room) => {
    const opened = app.waitForEvent('window')
    await app.evaluate(({ BrowserWindow }, port) => {
      const w = new BrowserWindow({
        show: false,
        webPreferences: {
          sandbox: true,
          nodeIntegration: false,
          contextIsolation: true,
          backgroundThrottling: false,
        },
      })
      void w.loadURL(`http://127.0.0.1:${port}`)
    }, room.port)
    const p = await opened
    p.setDefaultTimeout(20000)
    await p.locator('#code').fill(room.code)
    await p.locator('#name').fill('小雨')
    await p.locator('#join button').click()
    await p.locator('#room').waitFor()
    return p
  }
  try {
    await launch()
    await page.getByRole('button', { name: /新建世界/ }).click()
    await page.getByPlaceholder('例如：雾海纪元').fill('自动互动验收')
    await button('创建并进入').click()
    await page.evaluate(
      (endpoint) =>
        window.novelAI.saveSettings({
          provider: 'custom',
          protocol: 'chat',
          endpoint,
          model: 'auto-test',
          key: '',
          clearKey: true,
        }),
      `http://127.0.0.1:${mock.address().port}`,
    )
    await mode('酒馆制作')
    for (const [label, content] of Object.entries({
      角色卡名称: '守灯人',
      角色描述: '守护港口',
      对话场景: '公开港口',
      开场白: '{{user}}，我是{{char}}，欢迎。',
    }))
      await page.getByLabel(label, { exact: true }).fill(content)
    await button('保存角色场景卡').click()
    const card = JSON.parse(await download('导出场景卡', 'automation.scenario.json'))
    assert.equal(card.cards[0].data.name, '守灯人')
    card.title = '导入港口'
    card.scene = '导入后的公开港口'
    await page.getByLabel('导入场景卡', { exact: true }).setInputFiles({
      name: 'scene.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(card)),
    })
    await button('确认载入场景卡').click()
    await value('对话场景', '导入后的公开港口')
    await button('保存本页').click()
    await mode('局域网房间')
    await page.getByLabel('房间类型', { exact: true }).selectOption('tavern')
    await button('创建房间').click()
    await button('结束房间').waitFor()
    const tavern = await state()
    assert(tavern.automation.enabled)
    const visitor = await guest(tavern)
    await visitor
      .locator('#messages')
      .getByText(/小雨，我是守灯人，欢迎/)
      .waitFor()
    await visitor.reload()
    await visitor.locator('#room').waitFor()
    assert.equal((await state()).messages.filter((m) => m.kind === 'opening').length, 1)
    await visitor.locator('#text').fill('灯塔怎么走？')
    await visitor.locator('#chat button').click()
    await mode('世界观设定')
    await visitor
      .locator('#messages')
      .getByText(/自动叙事回复/)
      .waitFor()
    assert.equal(requests.length, 1)
    await mode('局域网房间')
    await page.getByLabel('对话内容', { exact: true }).fill('由我接管剧情')
    await button('主持人干预并暂停 AI').click()
    await visitor
      .locator('#messages')
      .getByText(/由我接管剧情/)
      .waitFor()
    assert.equal((await state()).automation.enabled, false)
    await button('保存房间为场景卡').click()
    await capture('automation-host.png')
    await button('结束房间').click()
    await visitor.close()
    console.log('Tavern scenario roundtrip, automatic greeting, background reply and host intervention PASS')
    await mode('TRPG 主持人')
    await button('预览所选副本').click()
    await button('确认载入副本').click()
    await value('团务名称', '奇幻探索：雾钟遗迹')
    await page.getByLabel('实际跑团记录', { exact: true }).fill('REAL SESSION LOG')
    await page.getByLabel('导入世界或跑团文件', { exact: true }).setInputFiles({
      name: 'private.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from('PRIVATE IMPORTED NOTES'),
    })
    await button('确认载入副本').click()
    await value('场景与分支', 'PRIVATE IMPORTED NOTES')
    assert.equal(await page.getByLabel('玩家可见背景', { exact: true }).inputValue(), '')
    await button('一键随机 TRPG 世界').click()
    await button('采纳到本模式草稿').waitFor()
    await button('采纳到本模式草稿').click()
    await value('团务名称', '随机星港')
    assert.equal(await page.getByLabel('实际跑团记录', { exact: true }).inputValue(), 'REAL SESSION LOG')
    const module = JSON.parse(await download('导出 TRPG 副本', 'automation.trpg.json'))
    assert.equal(module.draft.sessionLog, '')
    await button('保存当前副本').click()
    await button('保存本页').click()
    await capture('trpg-workshop.png')
    await mode('局域网房间')
    await page.getByLabel('房间类型', { exact: true }).selectOption('trpg')
    await page.getByLabel('玩家发言后自动回复', { exact: true }).check()
    await button('创建房间').click()
    await button('结束房间').waitFor()
    const player = await guest(await state())
    await player
      .locator('#messages')
      .getByText(/PUBLIC SPACEPORT/)
      .waitFor()
    await player.locator('#text').fill('我前往入口')
    await player.locator('#chat button').click()
    await player
      .locator('#messages')
      .getByText(/自动叙事回复/)
      .waitFor()
    assert(!JSON.stringify(requests.at(-1)).includes('SECRET MODULE'))
    assert(!JSON.stringify(requests.at(-1)).includes('PRIVATE IMPORTED NOTES'))
    await button('暂停 AI 并接管').click()
    await button('生成主持回复预览').click()
    await page.getByLabel('主持回复预览', { exact: true }).waitFor()
    await page.getByLabel('主持回复预览', { exact: true }).fill('主持人编辑后的回应')
    await button('发布主持回复').click()
    await player
      .locator('#messages')
      .getByText(/主持人编辑后的回应/)
      .waitFor()
    await button('结束房间').click()
    await player.close()
    await mode('TRPG 主持人')
    assert((await page.getByLabel('实际跑团记录', { exact: true }).inputValue()).includes('我前往入口'))
    await button('保存本页').click()
    await app.close()
    app = null
    await launch()
    await page.getByTitle('打开 自动互动验收', { exact: true }).click()
    await mode('TRPG 主持人')
    await value('团务名称', '随机星港')
    assert.equal(await page.getByLabel('选择跑团副本', { exact: true }).locator('option').count(), 6)
    await mode('酒馆制作')
    assert.equal(await page.getByLabel('选择场景卡', { exact: true }).locator('option').count(), 4)
    assert.deepEqual(errors, [])
    console.log(
      'TRPG presets, imports, random world, public-only AI, manual intervention and encrypted restart PASS',
    )
  } catch (e) {
    if (page && !page.isClosed()) {
      fs.writeFileSync(path.join(artifacts, 'automation-failure.html'), await page.content())
      await capture('automation-failure.png').catch(() => {})
    }
    throw e
  } finally {
    if (app) await app.evaluate(({ app }) => app.exit()).catch(() => {})
    mock.closeAllConnections()
    await new Promise((r) => mock.close(r))
    console.log('Isolated automation profile: ' + profile)
  }
}
main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
