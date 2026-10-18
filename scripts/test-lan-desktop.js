const { _electron } = require('playwright-core')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const http = require('node:http')
/* global window, document */
const root = path.resolve(__dirname, '..')
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'wdworld-lan-'))
const requests = []
const mock = http.createServer(async (req, res) => {
  let body = ''
  for await (const chunk of req) body += chunk
  const request = JSON.parse(body)
  requests.push(request)
  const immersive = request.messages.some((m) => m.content.includes('Return ONLY JSON:'))
  const content = immersive
    ? JSON.stringify({
        reply: 'Welcome to the harbor.',
        story: {
          location: 'Harbor',
          goal: 'Find a ship',
          summary: 'The keeper greets the party.',
          choices: ['Ask about the ship', 'Inspect the docks', 'Wait for dawn'],
        },
      })
    : 'Welcome to the harbor.'
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ choices: [{ message: { content }, finish_reason: 'stop' }] }))
})
async function main() {
  await new Promise((resolve) => mock.listen(0, '127.0.0.1', resolve))
  const env = { ...process.env, WDWORLD_PREVIEW: '1', WDWORLD_TEST_USER_DATA: profile }
  delete env.ELECTRON_RUN_AS_NODE
  let app
  const errors = []
  try {
    app = await _electron.launch({ executablePath: require('electron'), args: [root], env })
    const capture = async (name) => {
      const encoded = await app.evaluate(async ({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows().find((win) =>
          win.webContents.getURL().endsWith('/dist/index.html'),
        )
        await win.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true })
        await new Promise((resolve) => setTimeout(resolve, 300))
        return (await win.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true }))
          .toPNG()
          .toString('base64')
      })
      fs.mkdirSync(path.join(root, 'test-results'), { recursive: true })
      fs.writeFileSync(path.join(root, 'test-results', name), Buffer.from(encoded, 'base64'))
    }
    const page = await app.firstWindow()
    await require('./test-plugin-helper').installTestModes(page)
    page.setDefaultTimeout(15000)
    page.on('pageerror', (e) => errors.push(e.message))
    const mode = async (name) => {
      if (name === 'Switch creation mode') {
        assert.equal(await page.locator('.mode-bar').getByRole('button', { name, exact: true }).count(), 0)
        await app.evaluate(({ Menu }) =>
          Menu.getApplicationMenu().getMenuItemById('switch-creation-mode').click(),
        )
        await page.locator('.mode-picker').waitFor()
        return
      }
      const button = page.locator('.mode-bar').getByRole('button', { name, exact: true })
      await button.click()
      if (name === 'Switch creation mode') await page.locator('.mode-picker').waitFor()
      else
        await page.waitForFunction(
          (name) =>
            [...document.querySelectorAll('.mode-bar button')].some(
              (b) =>
                b.textContent === name &&
                (b.getAttribute('aria-current') === 'page' || b.getAttribute('aria-pressed') === 'true'),
            ),
          name,
        )
      if (['OC creator', 'TRPG game master', 'Tavern creator'].includes(name))
        await require('./test-plugin-helper').openStudioEditor(page)
    }
    const create = async (id, name) => {
      await page.locator(`[data-mode="${id}"]`).click()
      await page.getByRole('button', { name: /New world/ }).click()
      await page.getByPlaceholder('e.g. Age of Mist').fill(name)
      await page.getByRole('button', { name: 'Create and enter' }).click()
      const landing = {
        trpg: 'TRPG game master',
        tavern: 'Tavern creator',
        oc: 'OC creator',
        novel: 'Novel AI assistant',
        free: 'Worldbuilding',
      }[id]
      await page.waitForFunction(
        (label) => document.querySelector('.mode-bar [aria-current="page"]')?.textContent === label,
        landing,
      )
      await mode('Worldbuilding')
      await page.locator('.workspace-shell').waitFor()
    }
    await page.locator('.language-picker').selectOption('en')
    await page.getByRole('heading', { name: 'Choose how you create' }).waitFor()
    assert.equal(await app.evaluate(({ Menu }) => Menu.getApplicationMenu().items[0].label), 'File')
    await create('trpg', 'TRPG world')
    assert.equal(
      await page.locator('.mode-bar').getByRole('button', { name: 'OC creator', exact: true }).count(),
      0,
    )
    assert.equal(
      await page.locator('.view-switcher').getByRole('button', { name: 'Map', exact: true }).count(),
      1,
    )
    await mode('TRPG game master')
    await page.getByLabel('GM secrets', { exact: true }).fill('DO-NOT-PUBLISH-GM-SECRET')
    await page.getByLabel('Player-visible background', { exact: true }).fill('The village needs help.')
    await page.getByRole('button', { name: 'Save this page', exact: true }).click()
    await mode('LAN room')
    await page.getByRole('button', { name: 'Create room', exact: true }).click()
    await page.getByRole('button', { name: 'End room', exact: true }).waitFor()
    const room = (await page.evaluate(() => window.lanRoom.state())).state
    async function guest(name, targetRoom = room) {
      const next = app.waitForEvent('window')
      await app.evaluate(({ BrowserWindow }, url) => {
        const win = new BrowserWindow({
          show: false,
          webPreferences: {
            sandbox: true,
            nodeIntegration: false,
            contextIsolation: true,
            backgroundThrottling: false,
          },
        })
        void win.loadURL(url)
      }, `http://127.0.0.1:${targetRoom.port}`)
      const guest = await next
      guest.setDefaultTimeout(15000)
      guest.on('pageerror', (e) => errors.push(e.message))
      await guest.locator('#language').selectOption('en')
      await guest.locator('#code').fill(targetRoom.code)
      await guest.locator('#name').fill(name)
      await guest.getByRole('button', { name: 'Join', exact: true }).click()
      await guest.locator('#room').waitFor()
      return guest
    }
    const alice = await guest('Alice'),
      bob = await guest('Bob')
    await alice.locator('#characterName').fill('Captain')
    await alice.locator('#description').fill('<img src=x onerror=alert(1)>')
    await alice.locator('#maxHp').fill('20')
    await alice.locator('#hp').fill('16')
    await alice.getByRole('button', { name: 'Save character', exact: true }).click()
    await bob
      .locator('#players')
      .getByText(/Captain/)
      .waitFor()
    await alice.locator('#text').fill('Hello from Alice')
    await alice.getByRole('button', { name: 'Send', exact: true }).click()
    await bob
      .locator('#messages')
      .getByText(/Hello from Alice/)
      .waitFor()
    await bob.locator('#expression').fill('2d6+3')
    await bob.getByRole('button', { name: 'Roll dice', exact: true }).click()
    await alice
      .locator('#messages')
      .getByText(/2d6\+3/)
      .waitFor()
    assert(!(await bob.locator('body').innerText()).includes('DO-NOT-PUBLISH'))
    assert.equal(await bob.evaluate(() => typeof window.novelAI), 'undefined')
    await page.getByRole('button', { name: 'Load player background', exact: true }).click()
    await page.getByRole('button', { name: 'Publish scene', exact: true }).click()
    await bob.locator('#scene').getByText('The village needs help.').waitFor()
    await page.getByLabel('Initiative', { exact: true }).fill('Captain = 17\nGoblin = 8')
    await page.getByRole('button', { name: 'Publish initiative', exact: true }).click()
    await bob.locator('#initiative').getByText('Captain: 17').waitFor()
    await page.getByLabel('Handout title', { exact: true }).fill('Public clue')
    await page.getByLabel('Handout draft', { exact: true }).fill('The gate opens at dawn.')
    await page.getByRole('button', { name: 'Confirm and publish handout', exact: true }).click()
    await alice.locator('#handouts').getByText('The gate opens at dawn.').waitFor()
    await page.getByRole('button', { name: 'Pause AI and take over', exact: true }).click()
    await page.getByLabel('Wait for all players to submit actions', { exact: true }).click()
    await alice
      .locator('#roundStatus')
      .getByText(/Round 1/)
      .waitFor()
    await alice.locator('#text').fill('Search the gate')
    await alice.getByRole('button', { name: 'Send', exact: true }).click()
    await alice.waitForFunction(() => document.getElementById('sendChat').disabled)
    await bob.getByRole('button', { name: 'Step away', exact: true }).click()
    await page.getByText('Waiting for GM response', { exact: false }).first().waitFor()
    await page.getByLabel('Player to check', { exact: true }).selectOption({ label: 'Captain' })
    await page.getByLabel('Check name', { exact: true }).fill('Search gate')
    await page.getByRole('button', { name: 'Request check', exact: true }).click()
    await alice.getByRole('button', { name: 'Roll check', exact: true }).click()
    await bob
      .locator('#checks')
      .getByText(/Search gate.*(Success|Failure)/)
      .waitFor()
    const afterCheck = (await page.evaluate(() => window.lanRoom.state())).state
    assert.equal(afterCheck.checks[0].status, 'resolved')
    assert.equal(afterCheck.round.number, 1)
    await page.getByRole('button', { name: 'End round as GM', exact: true }).click()
    await alice
      .locator('#roundStatus')
      .getByText(/Round 2/)
      .waitFor()
    assert.equal(await alice.locator('#sendChat').isDisabled(), false)
    await bob.getByRole('button', { name: 'Return to play', exact: true }).click()
    await capture('lan-host-en.png')
    await page.getByRole('button', { name: 'End room', exact: true }).click()
    await page.getByRole('button', { name: 'Create room', exact: true }).waitFor()
    assert.equal((await page.evaluate(() => window.lanRoom.state())).state, null)
    await alice.close()
    await bob.close()
    const archives = fs.readdirSync(path.join(profile, 'lan-sessions')).filter((n) => n.endsWith('.wdw'))
    assert.equal(archives.length, 1)
    assert(
      !fs
        .readFileSync(path.join(profile, 'lan-sessions', archives[0]))
        .includes(Buffer.from('Hello from Alice')),
    )
    await mode('TRPG game master')
    assert(
      (await page.getByLabel('Actual session log', { exact: true }).inputValue()).includes(
        'Hello from Alice',
      ),
    )
    await mode('Switch creation mode')
    await create('oc', 'OC world')
    assert.equal(
      await page.locator('.view-switcher').getByRole('button', { name: 'Map', exact: true }).count(),
      0,
    )
    await mode('OC creator')
    await page.getByLabel('Character name', { exact: true }).fill('中文角色原文')
    await page.locator('.language-picker').selectOption('zh-CN')
    assert.equal(await page.getByLabel('角色名称', { exact: true }).inputValue(), '中文角色原文')
    await page.locator('.language-picker').selectOption('en')
    assert.equal(await page.getByLabel('Character name', { exact: true }).inputValue(), '中文角色原文')
    await mode('Switch creation mode')
    await page.locator('[data-mode="trpg"]').click()
    assert.equal(await page.getByTitle('Open OC world', { exact: true }).count(), 0)
    await page.getByTitle('Open TRPG world', { exact: true }).click()
    await mode('TRPG game master')
    assert.equal(
      await page.getByLabel('GM secrets', { exact: true }).inputValue(),
      'DO-NOT-PUBLISH-GM-SECRET',
    )
    await mode('Switch creation mode')
    await create('tavern', 'Tavern world')
    await mode('Tavern creator')
    await page.getByLabel('Character card name', { exact: true }).fill('Harbor keeper')
    await page.getByLabel('Character description', { exact: true }).fill('A quiet harbor keeper.')
    await page.getByLabel('Creator notes', { exact: true }).fill('PRIVATE-CREATOR-NOTE')
    await require('./test-plugin-helper').openStudioSection(page, 'Character workshop')
    await page.getByRole('button', { name: 'Save character to library', exact: true }).click()
    await page.getByRole('button', { name: 'Save this page', exact: true }).click()
    await page.evaluate(
      (endpoint) =>
        window.novelAI.saveSettings({
          provider: 'custom',
          protocol: 'chat',
          endpoint,
          model: 'lan-test',
          key: 'private-key',
          clearKey: false,
        }),
      'http://127.0.0.1:' + mock.address().port,
    )
    await mode('LAN room')
    await page.getByRole('button', { name: 'Create room', exact: true }).click()
    await page.getByRole('button', { name: 'Generate response preview', exact: true }).click()
    await page.waitForFunction(
      () =>
        document.querySelector('textarea[aria-label="AI response preview"]')?.value ===
        'Welcome to the harbor.',
    )
    assert.equal((await page.evaluate(() => window.lanRoom.state())).state.messages.length, 0)
    assert(!JSON.stringify(requests).includes('PRIVATE-CREATOR-NOTE'))
    await page.getByRole('button', { name: 'Confirm and publish response', exact: true }).click()
    await page.locator('.lan-messages').getByText('Welcome to the harbor.').waitFor()
    const tavernRoom = (await page.evaluate(() => window.lanRoom.state())).state
    const carol = await guest('Carol', tavernRoom),
      dan = await guest('Dan', tavernRoom)
    await page.getByLabel('Story tracking & suggested actions', { exact: false }).check()
    await page.getByRole('button', { name: 'Apply automation settings', exact: true }).click()
    await carol.locator('#text').fill('Where can I find a ship?')
    await carol.getByRole('button', { name: 'Send', exact: true }).click()
    await dan
      .locator('#storyState')
      .getByText(/Harbor/)
      .waitFor()
    await carol.getByRole('button', { name: 'Ask about the ship', exact: true }).click()
    assert.equal(await carol.locator('#text').inputValue(), 'Ask about the ship')
    assert.equal(
      (await page.evaluate(() => window.lanRoom.state())).state.messages.filter(
        (m) => m.text === 'Ask about the ship',
      ).length,
      0,
    )
    await page.getByRole('button', { name: 'Edit story state as host', exact: true }).click()
    await page.getByLabel('Current location', { exact: true }).fill('Harbor office')
    await page.getByRole('button', { name: 'Save story state', exact: true }).click()
    await dan
      .locator('#storyState')
      .getByText(/Harbor office/)
      .waitFor()
    assert.equal(await dan.locator('#storyChoices button').count(), 0)
    await page
      .getByRole('button', { name: "Preview selected character's public profile", exact: true })
      .click()
    await page.getByLabel('Public character description').fill('Public keeper profile')
    await page.getByRole('button', { name: 'Publish available character', exact: true }).click()
    await carol.getByRole('button', { name: 'Claim character', exact: true }).click()
    await dan.getByRole('button', { name: 'Claimed', exact: true }).waitFor()
    assert.equal(await dan.getByRole('button', { name: 'Claimed', exact: true }).isDisabled(), true)
    assert.equal(await carol.locator('#characterName').isDisabled(), true)
    assert(!(await carol.locator('body').innerText()).includes('PRIVATE-CREATOR'))
    await page.getByRole('button', { name: 'Pause roleplay', exact: true }).click()
    await carol
      .locator('#pauseStatus')
      .getByText(/paused/)
      .waitFor()
    await carol.locator('#ooc').check()
    await carol.locator('#text').fill('PRIVATE-OOC-FOR-PLAYERS')
    await carol.getByRole('button', { name: 'Send', exact: true }).click()
    await dan
      .locator('#messages')
      .getByText(/PRIVATE-OOC-FOR-PLAYERS/)
      .waitFor()
    await page.getByRole('button', { name: 'Resume roleplay', exact: true }).click()
    const libraryId = await page.getByLabel('AI speaker').locator('option').nth(1).getAttribute('value')
    await page.getByLabel('AI speaker').selectOption(libraryId)
    await page.getByRole('button', { name: 'Generate response preview', exact: true }).click()
    await page.waitForFunction(
      () =>
        document.querySelector('textarea[aria-label="AI response preview"]')?.value ===
        'Welcome to the harbor.',
    )
    assert(!JSON.stringify(requests.at(-1)).includes('PRIVATE-OOC-FOR-PLAYERS'))
    await dan.locator('#text').fill('New event after generation')
    await dan.getByRole('button', { name: 'Send', exact: true }).click()
    await page.getByText('The room has changed. Generate a new reply.', { exact: true }).waitFor()
    assert.equal(
      await page.getByRole('button', { name: 'Confirm and publish response', exact: true }).isDisabled(),
      true,
    )
    await carol.getByRole('button', { name: 'Release my character', exact: true }).click()
    await dan.getByRole('button', { name: 'Claim character', exact: true }).click()
    await capture('tavern-multiplayer-en.png')
    await carol.close()
    await dan.close()
    await mode('Switch creation mode')
    assert.equal((await page.evaluate(() => window.lanRoom.state())).state, null)
    await create('free', 'Free world')
    for (const label of [
      'Editor',
      'Wiki',
      'Map',
      'Graph',
      'Timeline',
      'Templates',
      'Export',
      'Sharing',
      'Cards',
    ]) {
      await page.locator('.view-switcher').getByRole('button', { name: label, exact: true }).click()
      const text = await page.locator('.mode-content').innerText()
      assert(!/[\u3400-\u9fff]/.test(text), `Untranslated ${label}: ${text}`)
    }
    for (const label of [
      'Novel AI assistant',
      'OC creator',
      'TRPG game master',
      'Tavern creator',
      'Simulate world changes',
      'LAN room',
    ]) {
      await mode(label)
      const text = await page.locator('.mode-content').innerText()
      assert(!/[\u3400-\u9fff]/.test(text), `Untranslated ${label}: ${text}`)
    }
    assert.deepEqual(errors, [])
    fs.mkdirSync(path.join(root, 'test-results'), { recursive: true })
    await mode('Switch creation mode')
    await capture('mode-picker-en.png')
    await app.close()
    app = await _electron.launch({ executablePath: require('electron'), args: [root], env })
    const reopened = await app.firstWindow()
    await reopened.getByRole('heading', { name: 'Choose how you create' }).waitFor()
    assert.equal(await reopened.locator('.language-picker').inputValue(), 'en')
    assert.equal(await app.evaluate(({ Menu }) => Menu.getApplicationMenu().items[0].label), 'File')
    await reopened.locator('[data-mode="oc"]').click()
    assert.equal(await reopened.getByTitle('Open TRPG world', { exact: true }).count(), 0)
    await reopened.getByTitle('Open OC world', { exact: true }).click()
    await reopened.locator('.mode-bar').getByRole('button', { name: 'OC creator', exact: true }).click()
    assert.equal(await reopened.getByLabel('Character name', { exact: true }).inputValue(), '中文角色原文')
    console.log(
      'LAN browser clients, host-only AI, GM isolation, encryption, mode isolation and full UI language passed. Profile: ' +
        profile,
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
