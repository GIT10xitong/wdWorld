const { _electron } = require('playwright-core')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const http = require('node:http')
/* global window, document */
const root = path.resolve(__dirname, '..')
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'wdworld-studio-'))
const artifacts = path.join(root, 'test-results')
fs.mkdirSync(artifacts, { recursive: true })
const requests = []
let simulationTarget = ''
const fullWorld = require('../tests/fixtures/tavern-world.json')
const server = http.createServer(async (req, res) => {
  let body = ''
  for await (const chunk of req) body += chunk
  const request = JSON.parse(body)
  requests.push(request)
  const system = request.messages[0].content
  const context = JSON.parse(request.messages[1].content)
  let result
  if (system.startsWith('Create a complete, coherent tavern roleplay world')) result = fullWorld
  else if (system.includes('虚构世界的变更推演助手')) {
    simulationTarget = context.已确认世界资料.find(
      (e) => e.title === '海港调查员' && e.type === 'character',
    ).id
    result = {
      analysis:
        '城市迁移首先改变人物居住地，之后可能影响贸易关系。这里只确认已提供人物的迁居，其余影响待核对。',
      impacts: [
        {
          entryId: simulationTarget,
          reason: '迁往新城的假设',
          content: '人物住在新城，仍然担任调查员。',
        },
      ],
    }
  } else if (system.includes('OC 角色设计助手'))
    result = { ...context.当前草稿, appearance: '灰色长衣', motivation: '调查潮汐秘密' }
  else if (system.includes('TRPG 主持人'))
    result = {
      ...context.当前草稿,
      scenes: '码头、灯塔和三条可选调查路线。',
      sessionLog: '模型伪造的跑团记录，不应覆盖原稿',
    }
  else
    result = {
      ...context.当前草稿,
      first_mes: '{{user}}，欢迎来到港口。',
      mes_example: '<START>\n{{user}}: 你好\n{{char}}: 你也在调查潮汐吗？',
    }
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(
    JSON.stringify({ choices: [{ message: { content: JSON.stringify(result) }, finish_reason: 'stop' }] }),
  )
})
async function main() {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const endpoint = 'http://127.0.0.1:' + server.address().port
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
    await page.locator('[data-mode="free"]').click()
    await page.locator('.language-picker').selectOption('zh-CN')
    await page.getByRole('button', { name: /新建世界/ }).waitFor()
  }
  const mode = async (name) => {
    await page
      .getByRole('navigation', { name: '创作模式' })
      .getByRole('button', { name, exact: true })
      .click()
    if (name === '世界观设定') await page.locator('.workspace-shell').waitFor()
    else if (name !== '小说 AI 辅助')
      await page
        .getByRole('heading', { name: name === '推演世界变更' ? 'AI 辅助推演世界变更' : name, exact: true })
        .waitFor()
    if (['OC 创作者', 'TRPG 主持人', '酒馆制作'].includes(name))
      await require('./test-plugin-helper').openStudioEditor(page)
  }
  const waitValue = async (label, value) =>
    page.waitForFunction(
      ({ label, value }) => document.querySelector('[aria-label="' + label + '"]')?.value === value,
      { label, value },
    )
  const generate = async () => {
    await page.getByRole('button', { name: '生成辅助草稿', exact: true }).click()
    await page.getByRole('button', { name: '采纳到本模式草稿', exact: true }).waitFor()
    await page.getByRole('button', { name: '采纳到本模式草稿', exact: true }).click()
  }
  const download = async (label, file) => {
    await app.evaluate(
      ({ session }, file) => {
        globalThis.__studioDownload = new Promise((resolve) =>
          session.defaultSession.once('will-download', (_event, item) => {
            item.setSavePath(file)
            item.once('done', (_e, state) => resolve(state))
          }),
        )
      },
      path.join(artifacts, file),
    )
    await page.getByRole('button', { name: label, exact: true }).click()
    assert.equal(await app.evaluate(() => globalThis.__studioDownload), 'completed')
    return fs.readFileSync(path.join(artifacts, file), 'utf8')
  }
  try {
    await launch()
    await page.getByRole('button', { name: /新建世界/ }).click()
    await page.getByPlaceholder('例如：雾海纪元').fill('多模式验收')
    await page.getByRole('button', { name: '创建并进入' }).click()
    await page.locator('.workspace-shell').waitFor()
    assert.equal(
      await page
        .getByRole('navigation', { name: '创作模式' })
        .getByRole('button', { name: '世界观设定', exact: true })
        .getAttribute('aria-current'),
      'page',
    )
    await page.evaluate(
      (endpoint) =>
        window.novelAI.saveSettings({
          provider: 'custom',
          protocol: 'chat',
          endpoint,
          model: 'studio-test',
          key: '',
          clearKey: true,
        }),
      endpoint,
    )
    await mode('OC 创作者')
    await page.getByLabel('创作随机种子', { exact: true }).fill('empty-oc-seed')
    await generate()
    assert.equal(JSON.parse(requests[0].messages[1].content).当前草稿.name, '')
    assert.match(JSON.parse(requests[0].messages[1].content).创作随机种子, /empty-oc-seed/)
    await page.getByLabel('角色名称', { exact: true }).fill('海港调查员')
    await page.getByLabel('角色概念', { exact: true }).fill('谨慎的调查员')
    await page.getByLabel('背景经历', { exact: true }).fill('住在旧城。')
    await generate()
    await waitValue('外貌与辨识特征', '灰色长衣')
    await page.getByRole('button', { name: '已同步到世界观', exact: true }).waitFor()
    await mode('TRPG 主持人')
    await page.getByLabel('团务名称', { exact: true }).fill('潮汐疑案')
    await page.getByLabel('玩家可见背景', { exact: true }).fill('港口失去了钟声。')
    await page.getByLabel('主持人秘密', { exact: true }).fill('秘密：钟在海底。')
    await page.getByLabel('实际跑团记录', { exact: true }).fill('玩家实际去了酒馆。')
    await generate()
    await waitValue('场景与分支', '码头、灯塔和三条可选调查路线。')
    assert.equal(await page.getByLabel('实际跑团记录', { exact: true }).inputValue(), '玩家实际去了酒馆。')
    const player = await download('导出玩家背景', 'studio-player.txt')
    assert.equal(player, '港口失去了钟声。')
    assert(!player.includes('海底'))
    await mode('酒馆制作')
    await page.getByRole('button', { name: '从 OC 填充空白字段' }).click()
    await waitValue('角色卡名称', '海港调查员')
    await page.getByLabel('角色卡名称', { exact: true }).fill('酒馆调查员')
    await page.getByRole('button', { name: '从所选世界设定添加' }).click()
    await page.getByLabel('世界书标题 1', { exact: true }).waitFor()
    await page.getByLabel('触发词 1', { exact: true }).fill('调查员，海港')
    await generate()
    await waitValue('开场白', '{{user}}，欢迎来到港口。')
    const card = JSON.parse(await download('导出角色卡 V2 JSON', 'studio-character.json'))
    assert.equal(card.spec, 'chara_card_v2')
    assert.equal(card.data.name, '酒馆调查员')
    assert.deepEqual(card.data.character_book.entries[0].keys, ['调查员', '海港'])
    const book = JSON.parse(await download('导出世界书 JSON', 'studio-worldbook.json'))
    assert.equal(book.entries[0].disable, false)
    await page.getByRole('button', { name: '收藏当前角色卡', exact: true }).click()
    assert.equal(await page.getByLabel('选择收藏角色卡').locator('option').count(), 2)
    const imported = structuredClone(card)
    imported.data.name = '导入角色'
    imported.data.alternate_greetings = ['备用开场一', '备用开场二']
    imported.data.extensions = { kept: true }
    await page.getByLabel('导入角色卡 JSON', { exact: true }).setInputFiles({
      name: 'card.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(imported)),
    })
    await page.getByRole('button', { name: '确认导入', exact: true }).waitFor()
    assert.equal(await page.getByLabel('角色卡名称', { exact: true }).inputValue(), '酒馆调查员')
    await page.getByRole('button', { name: '确认导入', exact: true }).click()
    await waitValue('角色卡名称', '导入角色')
    await page.getByLabel('测试对话', { exact: true }).fill('海港')
    const roundtrip = JSON.parse(await download('导出角色卡 V2 JSON', 'studio-imported-character.json'))
    assert.equal(roundtrip.data.extensions.kept, true)
    assert.deepEqual(roundtrip.data.alternate_greetings, ['备用开场一', '备用开场二'])
    const savedId = await page.getByLabel('选择收藏角色卡').locator('option').nth(1).getAttribute('value')
    await page.getByLabel('选择收藏角色卡').selectOption(savedId)
    await page.getByRole('button', { name: '预览并载入收藏', exact: true }).click()
    await page.getByRole('button', { name: '确认导入', exact: true }).click()
    await waitValue('角色卡名称', '酒馆调查员')
    console.log('Default world, OC, TRPG private handout and tavern exports passed')
    await mode('推演世界变更')
    await page.getByLabel('拟发生的世界变更', { exact: true }).fill('居民迁往新城')
    await page.getByRole('complementary').getByRole('button', { name: '推演世界变更', exact: true }).click()
    await page.getByRole('button', { name: '确认这条变更', exact: true }).waitFor()
    await mode('世界观设定')
    await page.locator(`[data-entry-id="${simulationTarget}"]`).click()
    await waitValue('条目标题', '海港调查员')
    assert.match(await page.locator('.tiptap').innerText(), /旧城/)
    await mode('推演世界变更')
    await page.getByRole('button', { name: '确认这条变更' }).click()
    await page.getByText('已确认并更新世界设定', { exact: true }).waitFor()
    await mode('世界观设定')
    await page.locator(`[data-entry-id="${simulationTarget}"]`).click()
    await waitValue('条目标题', '海港调查员')
    assert.match(await page.locator('.tiptap').innerText(), /新城/)
    await mode('推演世界变更')
    await page.getByRole('button', { name: '撤销这条变更' }).click()
    await page.getByText('已恢复变更前的正文', { exact: true }).waitFor()
    await page
      .screenshot({ path: path.join(artifacts, 'studio-simulation.png'), timeout: 4000 })
      .catch(() => {})
    await mode('TRPG 主持人')
    await page.getByLabel('实际跑团记录', { exact: true }).fill('关闭前的跑团记录')
    const closed = app.waitForEvent('close')
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close())
    await closed
    app = null
    await launch()
    await page.getByTitle('打开 多模式验收', { exact: true }).click()
    await page.locator('.workspace-shell').waitFor()
    await mode('TRPG 主持人')
    await waitValue('实际跑团记录', '关闭前的跑团记录')
    await mode('酒馆制作')
    await waitValue('触发词 1', '调查员，海港')
    await mode('世界观设定')
    await page.locator(`[data-entry-id="${simulationTarget}"]`).click()
    await waitValue('条目标题', '海港调查员')
    assert.match(await page.locator('.tiptap').innerText(), /旧城/)
    assert.equal(errors.length, 0, errors.join('\n'))
    await mode('OC 创作者')
    await waitValue('创作随机种子', 'empty-oc-seed')
    assert.equal(requests.length, 5)
    await mode('酒馆制作')
    await page.getByRole('button', { name: '随机生成整套酒馆世界', exact: true }).click()
    await page.getByRole('button', { name: '采纳整套世界与角色卡', exact: true }).waitFor()
    await mode('世界观设定')
    await page.locator('.workspace-sidebar').getByRole('button', { name: /^设定/ }).click()
    await page.locator('.workspace-sidebar').getByText('星潮边界', { exact: true }).waitFor()
    await mode('酒馆制作')
    await page.getByRole('button', { name: '采纳整套世界与角色卡', exact: true }).click()
    await waitValue('角色卡名称', '守灯人')
    assert.equal(await page.getByLabel('选择收藏角色卡').locator('option').count(), 4)
    await page.getByRole('button', { name: '保存本页', exact: true }).click()
    await app.evaluate(({ app }) => app.exit())
    app = null
    await launch()
    await page.getByTitle('打开 多模式验收', { exact: true }).click()
    await mode('酒馆制作')
    await waitValue('角色卡名称', '守灯人')
    assert.equal(await page.getByLabel('选择收藏角色卡').locator('option').count(), 4)
    console.log('Whole tavern world generation, automatic world entries, library and restart passed')
    console.log('Simulation approval/undo, independent drafts, encrypted restart and default entry passed')
  } catch (error) {
    if (page && !page.isClosed()) {
      fs.writeFileSync(path.join(artifacts, 'studio-failure.html'), await page.content())
      await page
        .screenshot({ path: path.join(artifacts, 'studio-failure.png'), timeout: 4000 })
        .catch(() => {})
    }
    throw error
  } finally {
    if (app) await app.evaluate(({ app }) => app.exit()).catch(() => {})
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
    console.log('Isolated studio profile: ' + profile)
  }
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
