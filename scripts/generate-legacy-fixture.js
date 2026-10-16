const { _electron } = require('playwright-core')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const crypto = require('node:crypto')
const assert = require('node:assert/strict')
/* global window */

async function main() {
  const oldApp = path.resolve(process.argv[2] || 'release/v1.7.0/WDWorld-Desktop-1.7.0/resources/app')
  assert.equal(JSON.parse(fs.readFileSync(path.join(oldApp, 'package.json'))).version, '1.7.0')
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'wdworld-legacy-'))
  const env = { ...process.env, WDWORLD_PREVIEW: '1', WDWORLD_TEST_USER_DATA: profile }
  delete env.ELECTRON_RUN_AS_NODE
  const app = await _electron.launch({ executablePath: require('electron'), args: [oldApp], env })
  try {
    assert.equal(await app.evaluate(({ app }) => app.getPath('userData')), profile)
    const page = await app.firstWindow()
    page.setDefaultTimeout(20000)
    await page.locator('.language-picker').selectOption('en')
    await page.locator('[data-mode="free"]').click()
    await page.getByRole('button', { name: /Open example world/ }).click()
    await page.locator('.workspace-shell').waitFor()
    await page.locator('.workspace-sidebar').getByRole('button', { name: '陈渡', exact: true }).click()
    await page.getByLabel('Entry title', { exact: true }).fill('Legacy migration sentinel')
    await page
      .getByLabel('Entry summary', { exact: true })
      .fill('Created with version 1.7.0; preserve through upgrades.')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await page.waitForTimeout(1500)
    const result = await page.evaluate(async () => {
      const list = await window.wdAPI.listProjects()
      if (!list.ok || list.projects.length !== 1) throw new Error('Expected one synthetic project')
      return window.wdAPI.loadProject(list.projects[0].id)
    })
    assert.equal(result.ok, true)
    const fixture = {
      sourceVersion: '1.7.0',
      sourceBundleSha256: crypto
        .createHash('sha256')
        .update(fs.readFileSync(path.join(oldApp, 'dist/index.html')))
        .digest('hex'),
      description: 'Synthetic built-in example edited by the 1.7.0 renderer; contains no user data.',
      projectJson: result.projectJson,
      dbBase64: result.dbBase64,
    }
    const target = path.join(__dirname, '../tests/fixtures/legacy/project-1.7.0.json')
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, JSON.stringify(fixture, null, 2) + '\n')
    console.log('Legacy fixture saved. Original encrypted test profile: ' + profile)
  } finally {
    await app.close()
  }
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
