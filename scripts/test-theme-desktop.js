const { _electron } = require('playwright-core')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
/* global document, window, getComputedStyle */
const root = path.resolve(__dirname, '..')
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'wdworld-theme-'))

async function main() {
  const env = { ...process.env, WDWORLD_PREVIEW: '1', WDWORLD_TEST_USER_DATA: profile }
  delete env.ELECTRON_RUN_AS_NODE
  const app = await _electron.launch({ executablePath: require('electron'), args: [root], env })
  const page = await app.firstWindow()
  // Hidden Electron windows may suspend CSS transitions and pointer hit-testing.
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].showInactive())
  page.setDefaultTimeout(15000)
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  const button = (name) => page.getByRole('button', { name, exact: true })
  const shot = async (name) => {
    await page.waitForTimeout(200)
    const png = await app.evaluate(async ({ BrowserWindow }) =>
      (
        await BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined, {
          stayHidden: true,
          stayAwake: true,
        })
      )
        .toPNG()
        .toString('base64'),
    )
    fs.mkdirSync(path.join(root, 'test-results'), { recursive: true })
    fs.writeFileSync(path.join(root, 'test-results', `theme-${name}.png`), Buffer.from(png, 'base64'))
  }
  const audit = async (name) => {
    const mismatches = await page.evaluate(() => {
      const day = document.documentElement.dataset.theme === 'day'
      const exempt = [
        'bg-black/60',
        'bg-black/50',
        'bg-black/70',
        'bg-black/35',
        'novel-modal-backdrop',
        'desk-overlay',
        'plugins-overlay',
        'modal-backdrop',
      ]
      return [...document.querySelectorAll('body *')].flatMap((el) => {
        if (
          !(el instanceof window.HTMLElement) ||
          !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
        )
          return []
        const rect = el.getBoundingClientRect()
        if (rect.width * rect.height < 1200 || exempt.some((c) => el.classList.contains(c))) return []
        const style = getComputedStyle(el)
        const rgb = style.backgroundColor.match(/[\d.]+/g)?.map(Number)
        if (!rgb || (rgb.length === 4 && rgb[3] < 0.85)) return []
        const brightness = (rgb[0] + rgb[1] + rgb[2]) / 765
        if (day ? brightness >= 0.28 : brightness <= 0.82) return []
        return [{ tag: el.tagName, classes: el.className, background: style.backgroundColor }]
      })
    })
    assert.deepEqual(mismatches, [], `${name}: surfaces from the opposite theme`)
  }
  const setTheme = async (theme) => {
    const current = await page.evaluate(() => document.documentElement.dataset.theme)
    if (current !== theme) await button(theme === 'day' ? 'Day mode' : 'Night mode').click()
    await page.waitForTimeout(300)
  }
  const inspectPrimary = async (primary, name) => {
    if (await primary.count()) {
      await primary.hover()
      await page.waitForTimeout(200)
      assert.equal(
        await primary.evaluate((el) => {
          const probe = document.createElement('span')
          probe.style.color = 'var(--ui-on-accent)'
          probe.style.backgroundColor = 'var(--ui-accent-hover)'
          document.body.append(probe)
          const expected = getComputedStyle(probe)
          const actual = getComputedStyle(el)
          const matches =
            actual.color === expected.color && actual.backgroundColor === expected.backgroundColor
          probe.remove()
          return matches
        }),
        true,
        `${name}: primary hover keeps its contrasting text and accent`,
      )
    }
  }
  const inspectDialog = async (name, open, close, prepare = async () => {}) => {
    for (const theme of ['day', 'night']) {
      await setTheme(theme)
      await open()
      const dialog = page.getByRole('dialog')
      await dialog.waitFor({ state: 'visible' })
      await prepare(dialog)
      await page.waitForTimeout(300)
      await audit(`${name}/${theme}`)
      const controls = dialog.locator('button:visible')
      for (let i = 0; i < (await controls.count()); i++) {
        if (!(await controls.nth(i).isEnabled())) continue
        await controls.nth(i).hover()
        await page.waitForTimeout(170)
        await audit(`${name}/${theme}/hover-${i}`)
      }
      await inspectPrimary(dialog.locator('.novel-primary:enabled').first(), `${name}/${theme}`)
      await shot(`${name}-${theme}`)
      await close(dialog)
      await dialog.waitFor({ state: 'hidden' })
    }
    console.log(`Dialog theme and hover checks passed: ${name}`)
  }
  const inspectAISettings = (name) =>
    inspectDialog(
      name,
      () => button('AI settings').click(),
      () => page.getByLabel('Close settings', { exact: true }).click(),
      async (dialog) => {
        await dialog.locator('fieldset').waitFor()
        await dialog.getByRole('checkbox').check()
        await dialog.getByRole('textbox').last().fill('theme-test-model')
      },
    )
  const inspect = async (name, capture = false) => {
    for (const theme of ['day', 'night']) {
      await setTheme(theme)
      await audit(`${name}/${theme}`)
      // Exercise actual pointer hover, including the legacy dark-hover controls.
      // Shared navigation repeats on every page; sample the active page's controls.
      const controls = page.locator(
        ':is(button, summary):visible:not(.mode-bar *, .start-toolbar *, .workspace-topbar *, .workspace-sidebar *, .book-rail *, .desk-rail *)',
      )
      const count = Math.min(await controls.count(), 8)
      for (let i = 0; i < count; i++) {
        const control = controls.nth(i)
        if (!(await control.isEnabled())) continue
        await control.hover()
        await page.waitForTimeout(170)
        await audit(`${name}/${theme}/hover-${i}`)
      }
      const neutral = page.locator('[class~="hover:bg-ui-hover"]:not([style]):visible').first()
      if (await neutral.count()) {
        await neutral.hover()
        await page.waitForTimeout(350)
        assert.equal(
          await neutral.evaluate((el) => {
            const probe = document.createElement('div')
            probe.style.backgroundColor = 'var(--ui-hover)'
            document.body.append(probe)
            const matches = getComputedStyle(el).backgroundColor === getComputedStyle(probe).backgroundColor
            probe.remove()
            return matches
          }),
          true,
          `${name}/${theme}: neutral hover must use the theme hover color: ${await neutral.evaluate((el) => JSON.stringify({ classes: el.className, color: getComputedStyle(el).backgroundColor, target: getComputedStyle(el).getPropertyValue('--ui-hover') }))}`,
        )
      }
      await inspectPrimary(
        page
          .locator(
            '.desk-primary:enabled:visible, .dash-primary:enabled:visible, .novel-primary:enabled:visible, .studio-primary:enabled:visible, .home-primary:enabled:visible',
          )
          .first(),
        name + '/' + theme,
      )
      if (capture) await shot(`${name}-${theme}`)
    }
    console.log(`Theme and hover checks passed: ${name}`)
  }
  const modes = async () => {
    await app.evaluate(({ Menu }) =>
      Menu.getApplicationMenu().getMenuItemById('switch-creation-mode').click(),
    )
    await page.locator('.mode-picker').waitFor()
  }
  try {
    await require('./test-plugin-helper').installTestModes(page)
    await page.locator('.language-picker').selectOption('en')
    await inspect('mode-picker')
    await page.locator('[data-mode="free"]').click()
    await inspect('free-home', true)
    await inspectDialog(
      'updates',
      () => button('Updates').click(),
      (dialog) => dialog.getByRole('button', { name: 'Close', exact: true }).click(),
    )
    await inspectDialog(
      'plugins',
      () => button('Plugin center').click(),
      (dialog) => dialog.getByRole('button', { name: 'Close', exact: true }).click(),
    )
    await page.getByRole('button', { name: /Open example world/ }).click()
    await page.locator('.workspace-shell').waitFor()
    for (const view of [
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
      await page.locator('.view-switcher').getByRole('button', { name: view, exact: true }).click()
      await inspect(`world-${view.toLowerCase()}`, ['Wiki', 'Export', 'Templates'].includes(view))
    }
    await page.locator('.view-switcher').getByRole('button', { name: 'Templates', exact: true }).click()
    await inspectDialog(
      'template-dialog',
      () => button('New template').click(),
      () => button('Cancel').click(),
    )
    await modes()
    await page.locator('[data-mode="novel"]').click()
    await inspect('bookshelf', true)
    await button('New novel').click()
    await page.getByLabel('Book title', { exact: true }).fill('Theme regression manuscript')
    await button('Create and write').click()
    await page.getByRole('heading', { name: 'Writing desk', exact: true }).waitFor()
    await inspect('writing-desk', true)
    await inspectAISettings('ai-settings')
    await button('Creation journey').click()
    await inspect('creation-journey', true)
    for (const mode of ['oc', 'trpg', 'tavern']) {
      await modes()
      await page.locator(`[data-mode="${mode}"]`).click()
      await inspect(`${mode}-library`)
      await button('New world').click()
      await page.locator('.field-label input').first().fill(`${mode} theme regression`)
      await button('Create and enter').click()
      await page.locator('.studio-home').waitFor()
      await inspect(`${mode}-home`)
      await button('Editing workbench').click()
      await inspect(`${mode}-editor`, true)
      if (mode === 'oc') await inspectAISettings('studio-ai-settings')
      if (mode === 'trpg') {
        await require('./test-plugin-helper').openStudioSection(page, 'Module library')
        await inspect('module-library', true)
        await button('LAN room').click()
        await page.locator('.lan-workspace').waitFor()
        await inspect('lan-workspace', true)
      }
      if (mode === 'tavern') {
        await require('./test-plugin-helper').openStudioSection(page, 'World book')
        await button('New worldbook entry').click()
        await inspect('worldbook-directory', true)
        await require('./test-plugin-helper').openStudioSection(page, 'Character workshop')
        await inspect('character-library', true)
      }
    }
    assert.deepEqual(errors, [])
    console.log('Day/night, hover, world views, dialogs, novel and mode workspace regression passed.')
  } catch (error) {
    await shot('failure').catch(() => {})
    throw error
  } finally {
    await app.close()
  }
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
