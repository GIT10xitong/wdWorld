const { _electron } = require('playwright-core')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
/* global document, window */
const root = path.resolve(__dirname, '..')
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'wdworld-layout-'))
async function main() {
  const env = { ...process.env, WDWORLD_PREVIEW: '1', WDWORLD_TEST_USER_DATA: profile }
  delete env.ELECTRON_RUN_AS_NODE
  const app = await _electron.launch({ executablePath: require('electron'), args: [root], env })
  const page = await app.firstWindow()
  page.setDefaultTimeout(15000)
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  const button = (name) => page.getByRole('button', { name, exact: true })
  const section = (name) => require('./test-plugin-helper').openStudioSection(page, name)
  const shot = async (name) => {
    await page.waitForTimeout(200)
    fs.mkdirSync(path.join(root, 'test-results'), { recursive: true })
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
    fs.writeFileSync(path.join(root, 'test-results', `layout-${name}.png`), Buffer.from(png, 'base64'))
  }
  try {
    await require('./test-plugin-helper').installTestModes(page)
    await page.locator('.language-picker').selectOption('en')
    await page.locator('[data-mode="tavern"]').click()
    await button('New world').click()
    await page.getByPlaceholder('e.g. Age of Mist').fill('中文创作内容保持原样')
    await button('Create and enter').click()
    await require('./test-plugin-helper').openStudioEditor(page)
    await section('Character workshop')
    assert.equal(await page.getByRole('button', { name: /^Choose file:/ }).count(), 2)
    assert.deepEqual(await page.locator('.file-picker:visible .file-picker-name').allTextContents(), [
      'No file selected',
      'No file selected',
    ])
    const file = {
      name: 'worldbook-localization.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify({
          entries: [
            { comment: '港口规则', key: ['harbor'], content: '保留作者的中文正文。', order: 100 },
            {
              comment: 'Long entry title for checking narrow editor and navigation layouts',
              key: ['lighthouse'],
              content: 'A long manuscript.\n'.repeat(80),
              order: 200,
            },
          ],
        }),
      ),
    }
    // The translated button must activate the file dialog with the keyboard.
    const choosing = page.waitForEvent('filechooser')
    await button('Choose file: Import worldbook JSON').focus()
    await page.keyboard.press('Enter')
    await (await choosing).setFiles(file)
    await button('Confirm import').click()
    await section('Character workshop')
    await page.getByText(file.name, { exact: true }).waitFor()
    await page.locator('.language-picker').selectOption('zh-CN')
    assert.equal(await page.getByRole('button', { name: /^选择文件：/ }).count(), 2)
    await page.getByText(file.name, { exact: true }).waitFor()
    await page.locator('.language-picker').selectOption('en')
    // Reimporting the same file still fires change and displays a new preview.
    await page.getByLabel('Import worldbook JSON', { exact: true }).setInputFiles(file)
    await button('Confirm import').click()
    assert.equal(await page.locator('.worldbook-list button').count(), 4)
    await page.locator('.worldbook-list button').nth(1).click()
    for (const language of ['en', 'zh-CN']) {
      await page.locator('.language-picker').selectOption(language)
      for (const [width, height] of [
        [1440, 900],
        [1100, 720],
        [900, 650],
        [760, 650],
      ]) {
        await app.evaluate(
          ({ BrowserWindow }, size) => {
            const win = BrowserWindow.getAllWindows()[0]
            win.setMinimumSize(640, 480)
            win.setSize(...size)
            win.showInactive()
          },
          [width, height],
        )
        await page.waitForTimeout(150)
        const clipped = await page.evaluate(() => {
          const bar = document.querySelector('.mode-bar')
          return [...bar.querySelectorAll('button, select')]
            .filter((el) => el.checkVisibility())
            .flatMap((el) => {
              const box = el.getBoundingClientRect()
              const point = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
              return box.left < 0 || box.right > window.innerWidth + 1 || !el.contains(point)
                ? [el.textContent]
                : []
            })
        })
        assert.deepEqual(clipped, [], `${language} ${width}: navigation controls are visible and clickable`)
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
        const remove = page.locator('.worldbook-remove')
        if (width > 1000) {
          const box = await remove.boundingBox()
          assert(
            box.y >= 0 && box.y + box.height <= (await page.evaluate(() => window.innerHeight)),
            `${width}: footer remains visible`,
          )
          const body = await page.locator('.worldbook-content textarea').boundingBox()
          const form = await page.locator('.worldbook-form').boundingBox()
          assert(
            body.y >= form.y && body.y + body.height <= form.y + form.height + 1,
            `${width}: the entire text control fits inside the editor`,
          )
        } else {
          await remove.scrollIntoViewIfNeeded()
          const box = await remove.boundingBox()
          assert(box.y >= 0 && box.y + box.height <= (await page.evaluate(() => window.innerHeight)))
        }
        await shot(`${language}-${width}`)
      }
    }
    assert.deepEqual(errors, [])
    console.log(
      'Localized file picker, keyboard upload, repeated imports, bilingual navigation and editor clipping checks passed. Profile: ' +
        profile,
    )
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
