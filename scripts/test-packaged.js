const { _electron } = require('playwright-core')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const assert = require('node:assert/strict')
const fixture = require('../tests/fixtures/legacy/project-1.7.0.json')
const pkg = require('../package.json')
/* global window */

async function main() {
  const executablePath = path.resolve(process.argv[2])
  const kind = process.argv[3] || 'portable'
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'wdworld-packaged-'))
  const project = JSON.parse(fixture.projectJson)
  const folder = path.join(profile, 'wdworld', 'projects', project.id)
  fs.mkdirSync(folder, { recursive: true })
  fs.writeFileSync(path.join(folder, 'project.json'), fixture.projectJson)
  fs.writeFileSync(path.join(folder, 'database.db'), Buffer.from(fixture.dbBase64, 'base64'))
  fs.writeFileSync(
    path.join(profile, 'wdworld', 'recent-projects.json'),
    JSON.stringify([{ ...project, lastOpened: new Date().toISOString() }]),
  )
  const env = { ...process.env, WDWORLD_TEST_USER_DATA: profile }
  delete env.ELECTRON_RUN_AS_NODE
  let app
  const errors = []
  const launch = async () => {
    app = await _electron.launch({ executablePath, args: ['--wdworld-test-mode'], env })
    const actual = await app.evaluate(({ app }) => ({
      packaged: app.isPackaged,
      profile: app.getPath('userData'),
      version: app.getVersion(),
    }))
    assert.deepEqual(actual, { packaged: true, profile, version: pkg.version })
    const page = await app.firstWindow()
    page.setDefaultTimeout(20000)
    page.on('pageerror', (error) => errors.push(error.message))
    await page.locator('.language-picker').selectOption('en')
    await page.locator('[data-mode="free"]').click()
    await page.locator('.recent-item-main').filter({ hasText: project.name }).click()
    await page
      .locator('.workspace-sidebar')
      .getByRole('button', { name: 'Legacy migration sentinel', exact: true })
      .click()
    return page
  }
  try {
    let page = await launch()
    assert.equal(
      await page.getByLabel('Entry summary', { exact: true }).inputValue(),
      'Created with version 1.7.0; preserve through upgrades.',
    )
    await page.getByLabel('Entry summary', { exact: true }).fill('Packaged edit survived restart')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await app.close()
    app = null
    const sealed = fs.readFileSync(path.join(folder, 'project.wdw'))
    assert(!sealed.includes(Buffer.from('Legacy migration sentinel')))
    assert(!fs.existsSync(path.join(folder, 'database.db')))
    assert(!fs.existsSync(path.join(folder, 'project.json')))
    page = await launch()
    assert.equal(
      await page.getByLabel('Entry summary', { exact: true }).inputValue(),
      'Packaged edit survived restart',
    )
    const updates = await page.evaluate(() => window.appUpdates.state())
    assert.equal(updates.state.current, pkg.version)
    assert.equal(updates.state.supported, kind === 'installer')
    assert.deepEqual(errors, [])
    const report = {
      version: pkg.version,
      kind,
      executablePath,
      profile,
      passed: true,
      checks: [
        'actual packaged executable',
        'isolated profile',
        '1.7.0 database migration',
        'encrypted persistence',
        'edit/save/restart',
        'update capability',
      ],
    }
    fs.mkdirSync(path.join(__dirname, '../test-results'), { recursive: true })
    fs.writeFileSync(
      path.join(__dirname, `../test-results/packaged-${kind}.json`),
      JSON.stringify(report, null, 2),
    )
    console.log(`Packaged ${kind} migration, save and restart passed: ${executablePath}`)
  } finally {
    if (app) await app.close()
  }
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
