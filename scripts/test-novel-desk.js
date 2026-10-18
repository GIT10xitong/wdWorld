const { _electron } = require('playwright-core')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const http = require('node:http')
/* global document, window */
const root = path.resolve(__dirname, '..')
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'wdworld-novel-desk-'))
const requests = []
const server = http.createServer(async (req, res) => {
  let body = ''
  for await (const chunk of req) body += chunk
  const input = JSON.parse(body)
  requests.push(input)
  const system = input.messages[0].content
  const text = system.startsWith('Revise')
    ? 'The lighthouse was dark. Mira waited by the locked door.'
    : system.startsWith('Analyze only')
      ? 'The excerpt establishes a goal, then delays it with an obstacle.'
      : 'Candidate from the writing workflow.'
  res.writeHead(200, { 'Content-Type': 'text/event-stream' })
  res.end(
    'data: ' +
      JSON.stringify({ choices: [{ delta: { content: text }, finish_reason: null }] }) +
      '\n\ndata: ' +
      JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] }) +
      '\n\ndata: [DONE]\n\n',
  )
})
async function main() {
  fs.mkdirSync(path.join(root, 'test-results'), { recursive: true })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const env = { ...process.env, WDWORLD_PREVIEW: '1', WDWORLD_TEST_USER_DATA: profile }
  delete env.ELECTRON_RUN_AS_NODE
  let app, page
  const errors = []
  async function launch() {
    app = await _electron.launch({ executablePath: require('electron'), args: [root], env })
    page = await app.firstWindow()
    page.setDefaultTimeout(20000)
    page.on('pageerror', (e) => errors.push(e.message))
    await page.locator('.language-picker').selectOption('en')
    await page.locator('[data-mode="novel"]').click()
    await page.getByRole('heading', { name: 'My bookshelf', exact: false }).waitFor()
  }
  const nav = () => page.getByRole('navigation', { name: 'Novel workspace' })
  async function shot(name) {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].showInactive())
    await page.waitForTimeout(300)
    await page.screenshot({ path: path.join(root, 'test-results', name + '.png') })
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].hide())
  }
  try {
    await launch()
    assert.equal(
      await page.locator('.book-rail').getByRole('button', { name: 'Writing desk', exact: true }).count(),
      0,
    )
    assert.equal(await page.getByRole('heading', { name: 'Creative tools', exact: true }).count(), 0)
    await page.getByLabel('Quick idea', { exact: true }).fill('PRIVATE_HOME_IDEA: a signal from tomorrow.')
    await page.getByLabel('Daily character goal', { exact: true }).fill('2000')
    await page.getByRole('button', { name: 'Keep this idea', exact: true }).click()
    await page.getByRole('button', { name: 'Notebook', exact: true }).click()
    await page.getByText('PRIVATE_HOME_IDEA: a signal from tomorrow.', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Home', exact: true }).click()
    await page.getByLabel('Quick idea', { exact: true }).fill('PRIVATE_DRAFT_IDEA: the keeper waits.')
    await page.waitForFunction(
      async () => (await window.novelHome.load()).data?.draft === 'PRIVATE_DRAFT_IDEA: the keeper waits.',
      null,
      { timeout: 15000 },
    )
    console.log('Notebook draft autosave passed')
    await page.getByRole('button', { name: 'New novel', exact: true }).first().click()
    await page.getByLabel('Book title', { exact: true }).fill('The Last Lighthouse')
    await page.getByLabel('Story idea', { exact: true }).fill('A keeper searches for a missing signal.')
    await page.getByRole('button', { name: 'Create and write', exact: true }).click()
    await page.getByRole('heading', { name: 'Writing desk', exact: true }).waitFor()
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'day')
    await shot('novel-desk-day')
    await page.getByRole('button', { name: 'Night mode', exact: true }).click()
    await shot('novel-desk-night')
    await page.getByRole('button', { name: 'New chapter', exact: true }).first().click()
    await page.getByLabel('Chapter title', { exact: true }).fill('A light in the fog')
    await page.locator('.tiptap').fill('The lighthouse was very dark. Mira stood near a door.')
    await page.getByLabel('Chapter outline', { exact: true }).fill('Find the signal; discover a locked door.')
    await page.getByRole('button', { name: 'Chapter notes', exact: true }).click()
    assert.equal(await page.locator('#chapter-context').isVisible(), false)
    assert.match(await page.locator('.tiptap').innerText(), /Mira/)
    await page.getByRole('button', { name: 'Chapter notes', exact: true }).click()
    assert.equal(
      await page.getByLabel('Chapter outline', { exact: true }).inputValue(),
      'Find the signal; discover a locked door.',
    )
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1100, 720))
    await page.getByRole('button', { name: 'Focus', exact: true }).click()
    assert.equal(await page.locator('.desk-rail').isVisible(), false)
    assert.equal(await page.locator('.desk-chapters').isVisible(), false)
    assert.equal(await page.locator('#chapter-context').isVisible(), false)
    assert(await page.locator('.desk-manuscript').evaluate((el) => el.clientWidth > 800))
    await shot('novel-focus-compact')
    await page.getByRole('button', { name: 'Exit focus', exact: true }).click()
    assert(await page.locator('.desk-main').evaluate((el) => el.scrollWidth <= el.clientWidth))
    await shot('novel-desk-compact')
    assert(await page.locator('.desk-top').evaluate((el) => el.scrollWidth <= el.clientWidth))
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1440, 940))
    await nav().getByRole('button', { name: 'Author memory', exact: true }).click()
    await page
      .getByLabel('Author preferences and memory', { exact: true })
      .fill('PRIVATE_AUTHOR_MEMORY: concrete sensory detail, restrained narration.')
    await page.getByRole('button', { name: 'Save author memory', exact: true }).click()
    await nav().getByRole('button', { name: 'Story board', exact: true }).click()
    await page.getByRole('button', { name: 'Add card', exact: true }).click()
    await page.getByLabel('Title', { exact: true }).fill('The missing key')
    await page.getByLabel('Content', { exact: true }).fill('Reveal the key in the second act.')
    await nav().getByRole('button', { name: 'Resource library', exact: true }).click()
    await page.getByLabel('Import TXT / Markdown (up to 1 MB)', { exact: true }).setInputFiles({
      name: 'source.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from('A traveler wants to cross a bridge, but the ferryman refuses.'),
    })
    await page.getByLabel('Title', { exact: true }).waitFor()
    await nav().getByRole('button', { name: 'Custom panels', exact: true }).click()
    await page.getByRole('button', { name: 'Add card', exact: true }).click()
    await page.getByLabel('Title', { exact: true }).fill('Writing checklist')
    await page.getByLabel('Content', { exact: true }).fill('Read dialogue aloud.')
    await page.getByRole('button', { name: 'Save this page', exact: true }).click()
    await page.evaluate(
      (endpoint) =>
        window.novelAI.saveSettings({
          provider: 'custom',
          protocol: 'chat',
          endpoint,
          model: 'test',
          key: 'test-key',
          clearKey: false,
        }),
      'http://127.0.0.1:' + server.address().port + '/v1',
    )
    await nav().getByRole('button', { name: 'Style revision', exact: true }).click()
    await page.getByRole('button', { name: 'Generate candidate', exact: true }).click()
    await page.getByRole('button', { name: 'Replace original chapter (keep snapshot)', exact: true }).click()
    await nav().getByRole('button', { name: 'Writing desk', exact: true }).click()
    assert.match(await page.locator('.tiptap').innerText(), /Mira waited by the locked door/)
    await shot('novel-desk-en')
    await nav().getByRole('button', { name: 'Book analysis', exact: true }).click()
    await page.getByLabel('Analysis source', { exact: true }).selectOption({ label: 'source.md' })
    await page.getByRole('button', { name: 'Generate candidate', exact: true }).click()
    await page
      .getByText('The excerpt establishes a goal, then delays it with an obstacle.', { exact: true })
      .first()
      .waitFor()
    const analysis = requests.find((r) => r.messages[0].content.startsWith('Analyze only'))
    assert(!JSON.stringify(analysis).includes('PRIVATE_AUTHOR_MEMORY'))
    await nav().getByRole('button', { name: 'Agents', exact: true }).click()
    await page.getByRole('button', { name: 'Run enabled workflow', exact: true }).click()
    await page.getByRole('button', { name: 'Run enabled workflow', exact: true }).waitFor()
    await page.waitForFunction(
      () =>
        !Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Run enabled workflow')
          ?.disabled,
    )
    assert.equal(requests.filter((r) => r.messages[0].content.startsWith('Act as')).length, 3)
    await page.getByRole('button', { name: 'Append to linked chapter (keep snapshot)', exact: true }).click()
    await nav().getByRole('button', { name: 'World lore links', exact: true }).click()
    await page.getByLabel('Search linked material').fill('Idea')
    await page.locator('.lore-link-list').getByRole('button', { name: 'Story idea', exact: true }).click()
    await page.getByRole('button', { name: 'Confirm sync to world', exact: true }).click()
    await page.getByRole('button', { name: 'Open linked lore', exact: true }).waitFor()
    await shot('novel-lore-links-night')
    await page.getByRole('button', { name: 'Open linked lore', exact: true }).click()
    await page.locator('.workspace-shell').waitFor()
    assert.equal(await page.locator('.editor-canvas img').count(), 0)
    await page.getByRole('button', { name: 'Day mode', exact: true }).click()
    await shot('novel-world-day')
    await page.getByRole('button', { name: 'Night mode', exact: true }).click()
    await page.locator('.mode-bar').getByRole('button', { name: 'Novel AI assistant', exact: true }).click()
    await page.locator('.desk-shell').waitFor()
    await page.getByRole('button', { name: 'Save this page', exact: true }).click()
    await page.getByRole('button', { name: 'Creation journey', exact: true }).click()
    await page.getByRole('heading', { name: 'Story idea', exact: true }).waitFor()
    await shot('novel-journey-night')
    await page.getByRole('button', { name: 'Day mode', exact: true }).click()
    await shot('novel-journey-day')
    await page.getByRole('button', { name: 'Writing desk', exact: true }).click()
    await page.getByRole('heading', { name: 'Writing desk', exact: true }).waitFor()
    await page.getByRole('button', { name: 'WD WORLD · Home', exact: true }).click()
    await page.getByRole('heading', { name: 'My bookshelf', exact: false }).waitFor()
    console.log('Writing desk tools and return to dashboard passed')
    await page.getByRole('button', { name: 'Night mode', exact: true }).click()
    await shot('novel-home-night')
    await page.getByRole('button', { name: 'Day mode', exact: true }).click()
    await page.waitForFunction(() => Number(document.querySelector('.dash-meter strong')?.textContent) > 0)
    assert.deepEqual(await page.locator('.dash-meter strong').allTextContents(), [
      '44',
      String(3 + 'Candidate from the writing workflow.'.replace(/\s/g, '').length),
    ])
    assert.equal(await page.getByLabel('Daily character goal').inputValue(), '2000')
    await page.getByRole('button', { name: 'All books', exact: true }).click()
    await page.getByLabel('Search books', { exact: true }).fill('no matching title')
    await page.getByText('No matching books.', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Home', exact: true }).click()
    await page.getByRole('button', { name: 'Open The Last Lighthouse', exact: true }).click()
    await nav().getByRole('button', { name: 'Author memory', exact: true }).click()
    await page.getByLabel('Author preferences and memory', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Bookshelf', exact: true }).click()
    await page.getByRole('heading', { name: 'My bookshelf', exact: false }).waitFor()
    await shot('novel-bookshelf-en')
    await page.locator('.language-picker').selectOption('zh-CN')
    await page.getByRole('heading', { name: '我的书架', exact: false }).waitFor()
    await shot('novel-bookshelf-zh')
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1100, 720))
    await shot('novel-bookshelf-compact-zh')
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1440, 940))
    await page.getByRole('button', { name: '应用更新', exact: true }).click()
    await page.getByRole('dialog', { name: '应用更新', exact: true }).waitFor()
    assert((await page.getByRole('dialog').innerText()).includes(require('../package.json').version))
    await page.getByRole('button', { name: '关闭', exact: true }).click()
    console.log(
      'Bookshelf, writing, cards, author memory, polishing, analysis, three-agent workflow and update UI passed',
    )
    await app.close()
    app = null
    await launch()
    assert.equal(await page.getByLabel('Daily character goal').inputValue(), '2000')
    assert.equal(
      await page.getByLabel('Quick idea', { exact: true }).inputValue(),
      'PRIVATE_DRAFT_IDEA: the keeper waits.',
    )
    await page.getByRole('button', { name: 'Notebook', exact: true }).click()
    await page.getByText('PRIVATE_HOME_IDEA: a signal from tomorrow.', { exact: true }).waitFor()
    assert(!fs.readFileSync(path.join(profile, 'novel-home.wdw')).includes(Buffer.from('PRIVATE_HOME_IDEA')))
    await page.getByRole('button', { name: 'Home', exact: true }).click()
    await page.getByRole('button', { name: 'Open The Last Lighthouse', exact: true }).click()
    assert.match(await page.locator('.tiptap').innerText(), /Mira waited by the locked door/)
    await nav().getByRole('button', { name: 'Author memory', exact: true }).click()
    await page.waitForFunction(() =>
      document.querySelector('textarea')?.value.includes('PRIVATE_AUTHOR_MEMORY'),
    )
    for (const id of fs.readdirSync(path.join(profile, 'wdworld/projects')))
      assert(
        !fs
          .readFileSync(path.join(profile, 'wdworld/projects', id, 'project.wdw'))
          .includes(Buffer.from('PRIVATE_AUTHOR_MEMORY')),
      )
    assert.deepEqual(errors, [])
    console.log('Encrypted restart and novel desk desktop tests passed. Profile: ' + profile)
  } catch (e) {
    if (page && !page.isClosed()) {
      await shot('novel-desk-failure').catch(() => {})
      fs.writeFileSync(path.join(root, 'test-results/novel-desk-failure.html'), await page.content())
    }
    throw e
  } finally {
    if (app) await app.close()
    server.closeAllConnections()
    server.close()
  }
}
main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
