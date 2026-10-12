const { _electron } = require('playwright-core')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const http = require('node:http')

const root = path.resolve(__dirname, '..')
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'wdworld-test-'))
const artifacts = path.join(root, 'test-results')
fs.mkdirSync(artifacts, { recursive: true })
const requests = []
const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url.includes('/models')) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    if (req.url.startsWith('/gemini/')) {
      assert.equal(req.headers['x-goog-api-key'], 'desktop-test-key')
      res.end(
        JSON.stringify({
          models: [
            {
              name: 'models/gemini-test',
              displayName: 'Gemini test',
              supportedGenerationMethods: ['generateContent'],
            },
          ],
        }),
      )
    } else {
      if (req.url.startsWith('/mimo/')) assert.equal(req.headers['api-key'], 'desktop-test-key')
      else if (req.url.startsWith('/openai/') || req.url.startsWith('/deepseek/'))
        assert.equal(req.headers.authorization, 'Bearer desktop-test-key')
      res.end(JSON.stringify({ data: [{ id: 'mock-model' }, { id: 'mock-model-alternate' }] }))
    }
    return
  }
  let body = ''
  for await (const chunk of req) body += chunk
  const request = JSON.parse(body)
  requests.push(request)
  if (req.url.endsWith('/responses')) {
    assert.equal(request.store, false)
    assert(Array.isArray(request.input))
    res.writeHead(200, { 'Content-Type': 'text/event-stream' })
    res.end(
      'data: ' +
        JSON.stringify({ type: 'response.output_text.delta', delta: '连接成功' }) +
        '\n\ndata: ' +
        JSON.stringify({ type: 'response.completed', response: { status: 'completed' } }) +
        '\n\n',
    )
    return
  }
  if (req.url.includes(':streamGenerateContent')) {
    assert.equal(req.headers['x-goog-api-key'], 'desktop-test-key')
    assert.equal(request.contents[0].role, 'user')
    res.writeHead(200, { 'Content-Type': 'text/event-stream' })
    res.end(
      'data: ' +
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: '连接成功' }] }, finishReason: 'STOP' }],
        }) +
        '\n\n',
    )
    return
  }
  if (request.messages.length === 1) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ choices: [{ message: { content: '连接成功' }, finish_reason: 'stop' }] }))
    return
  }
  const system = request.messages[0].content
  if (system.includes('当前只整理资料')) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        choices: [
          {
            message: { content: '调查员只能记住昨天，收到明天的证词。保留时间悖论和纸质记录。' },
            finish_reason: 'stop',
          },
        ],
      }),
    )
    return
  }
  const context = system.includes('以下资料已分段提炼') ? {} : JSON.parse(request.messages[1].content)
  let text
  if (system.includes('只根据作者的故事想法'))
    text = '一个只能记住昨天的调查员，收到来自明天的证词，必须在午夜前找到保留真相的方法。'
  else if (system.includes('提出人物和世界规则'))
    text = JSON.stringify({
      proposals: [
        {
          type: 'lore',
          title: '记忆规则',
          content: '记忆会在午夜重置，纸质记录不受影响。',
          evidence: '故事想法',
        },
      ],
    })
  else if (system.includes('拆分章节'))
    text = JSON.stringify({
      chapters: [
        { volume: '第一卷', title: '午夜来信', outline: '调查员收到自己写来的警告。' },
        { volume: '第一卷', title: '纸上的证人', outline: '寻找一份没有被改写的记录。' },
      ],
    })
  else if (system.includes('制定完整故事大纲'))
    text = '第一幕：收到警告。\n第二幕：追索记忆重置的代价。\n第三幕：选择留下真实的记录。'
  else if (system.includes('生成事实摘要')) text = '林默在午夜从笔记中发现未来的警告，证人的身份仍是悬念。'
  else if (system.includes('仅检查当前章节'))
    text = JSON.stringify({
      issues: [
        { title: '核对时间', evidence: '正文：钟声停在午夜。', suggestion: '确认与世界规则的重置时刻一致。' },
      ],
      proposals: [
        {
          type: 'character',
          title: '林默',
          content: '林默是一名依靠纸质记录追查真相的调查员。',
          targetEntryId: context.已确认的参考设定.find((e) => e.名称 === '林默')?.id,
          evidence: '本章以纸条作为调查线索。',
        },
      ],
    })
  else text = '钟声停在午夜。林默翻开笔记，发现最后一页是自己尚未写下的字：不要相信明天的证人。'
  res.writeHead(200, { 'Content-Type': 'text/event-stream' })
  const chunks = text.match(/.{1,8}/gs) || []
  let i = 0
  const timer = setInterval(
    () => {
      if (res.destroyed) {
        clearInterval(timer)
        return
      }
      if (i < chunks.length)
        res.write('data: ' + JSON.stringify({ choices: [{ delta: { content: chunks[i++] } }] }) + '\n\n')
      else {
        clearInterval(timer)
        res.end('data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n')
      }
    },
    context.作者要求 === '测试停止' ? 2000 : 5,
  )
  res.on('close', () => clearInterval(timer))
})

async function main() {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const endpoint = 'http://127.0.0.1:' + server.address().port
  const env = { ...process.env, WDWORLD_PREVIEW: '1', WDWORLD_TEST_USER_DATA: profile }
  delete env.ELECTRON_RUN_AS_NODE
  let app
  let page
  const errors = []
  const launch = async () => {
    app = await _electron.launch({ executablePath: require('electron'), args: [root], env })
    page = await app.firstWindow()
    page.setDefaultTimeout(12000)
    page.on('pageerror', (error) => errors.push(error.message))
    await page.locator('[data-mode="free"]').click()
    await page.locator('.language-picker').selectOption('zh-CN')
    await page.getByRole('button', { name: /新建世界/ }).waitFor()
  }
  const step = async (name) => {
    await page
      .getByRole('navigation', { name: '创作步骤' })
      .getByRole('button', { name: new RegExp(name) })
      .click()
    assert.equal(await page.getByRole('button', { name: '保存本页', exact: true }).count(), 1)
  }
  const generate = async (name) => {
    await page.getByRole('button', { name, exact: true }).click()
    await page.getByRole('button', { name: /^(采纳结果|追加这些章节|保留为待确认建议)$/ }).waitFor()
  }
  const waitInput = async (name, value) => {
    await page.waitForFunction(
      ({ name, value }) => globalThis.document.querySelector('[aria-label="' + name + '"]')?.value === value,
      { name, value },
    )
  }
  try {
    await launch()
    console.log('Desktop window and preload loaded')
    const desktopDefaults = await app.evaluate(({ Menu, BrowserWindow }) => ({
      labels: Menu.getApplicationMenu().items.map((item) => item.label),
      preferences: BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences(),
    }))
    assert.deepEqual(desktopDefaults.labels, ['文件', '编辑', '视图', '设置', '帮助'])
    assert.equal(desktopDefaults.preferences.sandbox, true)
    assert.equal(desktopDefaults.preferences.nodeIntegration, false)
    assert.equal(desktopDefaults.preferences.contextIsolation, true)
    assert.equal(desktopDefaults.preferences.webviewTag, false)
    await app.evaluate(({ Menu }) => Menu.getApplicationMenu().getMenuItemById('language-en').click())
    assert.equal(await app.evaluate(({ Menu }) => Menu.getApplicationMenu().items[0].label), 'File')
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(profile, 'preferences.json'), 'utf8')).menuLanguage,
      'en',
    )
    await page.getByRole('button', { name: /New world/ }).waitFor()
    await page.locator('.language-picker').selectOption('zh-CN')
    await page.getByRole('button', { name: /新建世界/ }).click()
    await page.getByPlaceholder('例如：雾海纪元').fill('桌面流程验收')
    await page.getByRole('button', { name: '创建并进入' }).click()
    await page
      .getByRole('navigation', { name: '创作模式' })
      .getByRole('button', { name: '小说 AI 辅助', exact: true })
      .click()
    await page.getByRole('heading', { name: '故事想法', exact: true }).waitFor()
    await page.getByLabel('故事想法', { exact: true }).fill('一个只能记住昨天的调查员，收到来自明天的证词。')
    await page.getByLabel('故事类型', { exact: true }).fill('悬疑')
    assert(
      await page
        .getByRole('navigation')
        .getByRole('button', { name: /故事大纲/ })
        .isDisabled(),
    )
    await page.getByRole('status').filter({ hasText: '已保存到本机' }).waitFor({ timeout: 15000 })
    await page
      .screenshot({ path: path.join(artifacts, 'novel-idea.png'), timeout: 4000 })
      .catch(() => console.log('Optional idea screenshot unavailable in hidden window'))
    await step('人物与规则')
    await page.getByLabel('名称', { exact: true }).fill('林默')
    await page.getByLabel('设定内容', { exact: true }).fill('一位谨慎的调查员。')
    await page.getByRole('button', { name: '加入设定库' }).click()
    await page.getByRole('heading', { name: '林默', exact: true }).waitFor()
    console.log('Manual story and canon creation passed')
    await page.getByRole('button', { name: 'AI 设置', exact: true }).click()
    for (const provider of ['mimo', 'deepseek', 'openai', 'gemini']) {
      await page.getByLabel('模型服务商', { exact: true }).selectOption(provider)
      const endpointInput = page.getByLabel('接口地址', { exact: true })
      await endpointInput.fill(endpoint + '/' + provider + (provider === 'gemini' ? '/v1beta' : '/v1'))
      await page.getByLabel('API 密钥', { exact: true }).fill('desktop-test-key')
      await page.getByRole('button', { name: '获取模型', exact: true }).click()
      await page.getByRole('status').filter({ hasText: '已获取' }).waitFor()
      await page
        .getByLabel('选择模型', { exact: true })
        .selectOption(provider === 'gemini' ? 'gemini-test' : 'mock-model')
      await page.getByRole('button', { name: '测试模型', exact: true }).click()
      await page.getByText('模型连接成功，配置已加密保存并用于创作。').waitFor()
      await page.getByRole('button', { name: '保存配置', exact: true }).click()
      await page.getByText('配置已保存。可以关闭设置并开始生成。').waitFor()
      assert.equal(await page.getByLabel('API 密钥', { exact: true }).inputValue(), '')
    }
    await page.getByLabel('模型服务商', { exact: true }).selectOption('mimo')
    await page
      .getByLabel('API 密钥', { exact: true })
      .getAttribute('placeholder')
      .then((v) => assert.match(v, /已加密保存/))
    await page.getByRole('button', { name: '获取模型', exact: true }).click()
    await page.getByRole('status').filter({ hasText: '已获取' }).waitFor()
    await page
      .screenshot({ path: path.join(artifacts, 'ai-settings-models.png'), timeout: 4000 })
      .catch(() => console.log('Optional settings screenshot unavailable in hidden window'))
    console.log('Provider discovery, test calls and encrypted profile switching passed')
    await page.getByLabel('模型服务商', { exact: true }).selectOption('custom')
    await page.getByLabel('接口地址', { exact: true }).fill(endpoint)
    await page.getByRole('button', { name: '获取模型', exact: true }).click()
    await page.getByRole('status').filter({ hasText: '已获取' }).waitFor()
    await page.getByLabel('选择模型', { exact: true }).selectOption('mock-model')
    await page.getByRole('button', { name: '保存配置' }).click()
    await page.getByText('配置已保存。可以关闭设置并开始生成。').waitFor()
    await page.getByRole('button', { name: '关闭设置' }).click()
    const encrypted = fs.readFileSync(path.join(profile, 'ai-settings.json'), 'utf8')
    assert.equal(JSON.parse(encrypted).version, 3)
    for (const value of ['desktop-test-key', 'mock-model', endpoint]) assert(!encrypted.includes(value))
    await step('故事想法')
    const longIdea = '调查员收到明天的证词。'.repeat(10000)
    await page.getByLabel('故事想法', { exact: true }).fill(longIdea)
    await generate('完善故事想法')
    assert.equal((await page.getByLabel('故事想法', { exact: true }).inputValue()).length, longIdea.length)
    await page.getByText('查看本次分段整理资料', { exact: true }).waitFor()
    assert(requests.filter((r) => r.messages?.[0]?.content.includes('当前只整理资料')).length >= 10)
    for (const r of requests.filter((r) => r.messages))
      assert(r.messages.reduce((sum, m) => sum + m.content.length, 0) <= 16000)
    await page.getByRole('button', { name: '采纳结果' }).click()
    await page.getByRole('button', { name: '保存本页', exact: true }).click()
    await step('人物与规则')
    console.log('Ten-second save, ordered stages and long input segmentation passed')
    await generate('构思人物与规则')
    assert.equal(
      await page.locator('main').getByRole('heading', { name: '记忆规则', exact: true }).count(),
      1,
    )
    await page
      .locator('main')
      .getByText(/AI 待确认/)
      .waitFor()
    await page.getByRole('button', { name: '保留为待确认建议' }).click()
    await page.getByRole('button', { name: '确认并更新设定库' }).click()
    await page.getByText('已确认', { exact: true }).waitFor()
    console.log('AI streaming and author approval passed')
    await step('故事大纲')
    await generate('生成故事大纲')
    await page.getByRole('button', { name: '采纳结果' }).click()
    assert.match(await page.getByLabel('故事大纲', { exact: true }).inputValue(), /第一幕/)
    await step('拆分章节')
    await generate('拆分章节')
    await page.getByRole('button', { name: '追加这些章节' }).click()
    await page.getByLabel('章节标题', { exact: true }).waitFor()
    await step('辅助写作')
    await page.locator('.tiptap').fill('雨停了。')
    await generate('续写本章')
    await page.getByRole('button', { name: '采纳结果' }).click()
    assert.match(await page.locator('.tiptap').innerText(), /雨停了。.*钟声停在午夜/s)
    await page.getByLabel(/本章摘要/).fill('林默在午夜发现自己的警告。')
    await generate('生成摘要候选')
    assert.equal(await page.getByLabel(/本章摘要/).inputValue(), '林默在午夜发现自己的警告。')
    await page.getByRole('button', { name: '采纳结果' }).click()
    assert.match(await page.getByLabel(/本章摘要/).inputValue(), /证人的身份仍是悬念/)
    assert.match(await page.locator('.tiptap').innerText(), /雨停了/)
    await page
      .screenshot({ path: path.join(artifacts, 'novel-writing.png'), timeout: 4000 })
      .catch(() => console.log('Optional writing screenshot unavailable in hidden window'))
    console.log('Outline, chapter planning and prose acceptance passed')
    await step('检查矛盾')
    await generate('检查本章矛盾')
    await page.getByRole('button', { name: '保留为待确认建议' }).click()
    assert.equal(await page.getByLabel('问题', { exact: true }).inputValue(), '核对时间')
    await page.getByLabel('当前章节').selectOption({ index: 2 })
    assert.equal(await page.getByLabel('问题', { exact: true }).count(), 0)
    await page.getByRole('button', { name: '手动记录问题' }).click()
    await page.getByLabel('问题', { exact: true }).fill('第二章的问题')
    await page.getByLabel('当前章节').selectOption({ index: 1 })
    assert.equal(await page.getByLabel('问题', { exact: true }).inputValue(), '核对时间')
    await page.getByRole('checkbox', { name: /显示全部章节/ }).check()
    assert.equal(await page.getByLabel('问题', { exact: true }).count(), 2)
    await page.getByRole('checkbox', { name: /显示全部章节/ }).uncheck()
    await step('确认设定')
    await page.getByRole('button', { name: '确认并更新设定库' }).click()
    await page.getByText('等待作者确认', { exact: true }).waitFor({ state: 'hidden' })
    await page
      .screenshot({ path: path.join(artifacts, 'novel-canon.png'), timeout: 4000 })
      .catch(() => console.log('Optional canon screenshot unavailable in hidden window'))
    console.log('Consistency review and explicit canon update passed')
    await page.getByRole('button', { name: '撤销这次设定更新' }).click()
    await page.getByText('已撤销更新', { exact: true }).waitFor()
    await step('人物与规则')
    await page.locator('.novel-setting-excerpt').filter({ hasText: '一位谨慎的调查员。' }).waitFor()
    console.log('AI summary, chapter review isolation and canon undo passed')
    await step('辅助写作')
    await page.getByLabel('写作任务').selectOption('write')
    await page.getByLabel('给助手的要求', { exact: true }).fill('测试停止')
    await page.getByRole('button', { name: '续写本章', exact: true }).click()
    await page.getByRole('button', { name: '停止生成' }).click()
    await page.getByRole('alert').filter({ hasText: '已停止生成' }).waitFor()
    await page.getByRole('button', { name: '版本历史', exact: true }).click()
    await page.getByRole('button', { name: '保存当前版本' }).click()
    const backupPath = path.join(artifacts, 'desktop-backup.json')
    // Electron downloads use the native session and Save dialog, not a browser download page.
    await app.evaluate(({ session }, destination) => {
      globalThis.__wdTestDownload = new Promise((resolve) => {
        const timer = setTimeout(() => resolve('timeout'), 12000)
        session.defaultSession.once('will-download', (_event, item) => {
          item.setSavePath(destination)
          item.once('done', (_event, state) => {
            clearTimeout(timer)
            resolve(state)
          })
        })
      })
    }, backupPath)
    await page.getByRole('button', { name: '导出完整项目备份' }).click()
    assert.equal(await app.evaluate(() => globalThis.__wdTestDownload), 'completed')
    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'))
    assert.equal(backup.novel.chapters.length, 2)
    assert.equal(backup.novel.proposals.filter((p) => p.status === 'accepted').length, 1)
    assert.equal(backup.novel.proposals.filter((p) => p.status === 'reverted').length, 1)
    assert.match(backup.entries.find((e) => e.title === '林默').content, /一位谨慎的调查员/)
    assert.equal(new Set(backup.novel.issues.map((issue) => issue.chapterId)).size, 2)
    assert(backup.novel.snapshots.length >= 4)
    await page.getByRole('button', { name: '关闭版本历史' }).click()
    // Close immediately after editing, before the periodic save can persist the change.
    await page.getByLabel(/本章摘要/).fill('关闭前最后一次修改')
    const closed = app.waitForEvent('close')
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close())
    await closed
    app = null
    await launch()
    assert.equal(await app.evaluate(({ Menu }) => Menu.getApplicationMenu().items[0].label), '\u6587\u4ef6')
    await app.evaluate(({ Menu }) => Menu.getApplicationMenu().getMenuItemById('language-zh').click())
    assert.equal(await app.evaluate(({ Menu }) => Menu.getApplicationMenu().items[0].label), '文件')
    await page.getByTitle('打开 桌面流程验收', { exact: true }).click()
    await page
      .getByRole('navigation', { name: '创作模式' })
      .getByRole('button', { name: '小说 AI 辅助', exact: true })
      .click()
    await step('辅助写作')
    assert.equal(await page.getByLabel(/本章摘要/).inputValue(), '关闭前最后一次修改')
    assert.match(await page.locator('.tiptap').innerText(), /钟声停在午夜/)
    await page.getByRole('button', { name: '世界资料库', exact: true }).click()
    const sidebar = page.locator('.workspace-sidebar')
    await sidebar.getByRole('button', { name: '林默', exact: true }).click()
    // Former effect feedback loop blanked the title after one second, then
    // alternated between the old and empty values forever.
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(550)
      assert.equal(await page.getByLabel('条目标题', { exact: true }).inputValue(), '林默')
      assert.equal(await sidebar.getByRole('button', { name: '林默', exact: true }).count(), 1)
    }
    await page.getByLabel('条目标题', { exact: true }).fill('林默·改名验证')
    await page.getByLabel('条目摘要', { exact: true }).fill('连续编辑摘要仍然保留')
    await sidebar.getByRole('button', { name: /^设定/ }).click()
    await sidebar.getByRole('button', { name: '记忆规则', exact: true }).click()
    await waitInput('条目标题', '记忆规则')
    assert.equal(await page.getByLabel('条目标题', { exact: true }).inputValue(), '记忆规则')
    await page.getByLabel('条目摘要', { exact: true }).fill('第二个条目的独立草稿')
    await sidebar.getByRole('button', { name: '林默·改名验证', exact: true }).click()
    await waitInput('条目标题', '林默·改名验证')
    assert.equal(await page.getByLabel('条目摘要', { exact: true }).inputValue(), '连续编辑摘要仍然保留')
    await page.getByLabel('条目标题', { exact: true }).fill('林默')
    await page.getByRole('button', { name: '保存', exact: true }).click()
    await page.waitForTimeout(2200)
    assert.equal(await sidebar.getByRole('button', { name: '林默', exact: true }).count(), 1)
    await page
      .screenshot({ path: path.join(artifacts, 'world-entry-stable.png'), timeout: 4000 })
      .catch(() => {})
    const projectsDir = path.join(profile, 'wdworld', 'projects')
    const ids = fs.readdirSync(projectsDir)
    assert(ids.length > 0)
    for (const id of ids) {
      const dir = path.join(projectsDir, id)
      for (const name of ['project.wdw', 'project.wdw.bak']) {
        const raw = fs.readFileSync(path.join(dir, name))
        for (const secret of ['桌面流程验收', '林默', '钟声停在午夜'])
          assert(!raw.includes(Buffer.from(secret)))
      }
      assert(!fs.existsSync(path.join(dir, 'database.db')))
      assert(!fs.existsSync(path.join(dir, 'project.json')))
    }
    assert(
      !fs
        .readFileSync(path.join(profile, 'wdworld', 'recent-projects.wdw'))
        .includes(Buffer.from('桌面流程验收')),
    )
    console.log('Stable entry names, isolated drafts, bilingual menus and encrypted project files passed')
    await page
      .getByRole('navigation', { name: '创作模式' })
      .getByRole('button', { name: '小说 AI 辅助', exact: true })
      .click()
    await step('辅助写作')
    assert.match(await page.locator('.tiptap').innerText(), /钟声停在午夜/)
    assert.equal(errors.length, 0, errors.join('\n'))
    assert(requests.length >= 6)
    console.log('Stop, backup export, window-close flush and reopen passed')
    console.log('Desktop workflow PASS. Artifacts: ' + artifacts)
  } catch (error) {
    if (page && !page.isClosed()) {
      await page
        .screenshot({ path: path.join(artifacts, 'desktop-failure.png'), timeout: 4000 })
        .catch(() => {})
      fs.writeFileSync(path.join(artifacts, 'desktop-failure.html'), await page.content())
    }
    throw error
  } finally {
    if (app) await app.evaluate(({ app }) => app.exit()).catch(() => {})
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
    console.log('Isolated test profile: ' + profile)
  }
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
