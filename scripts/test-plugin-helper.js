const fs = require('node:fs')
const path = require('node:path')
/* global window */
async function installTestModes(page) {
  await page.waitForFunction(() => !!window.wdPlugins)
  for (const id of ['wdworld.trpg', 'wdworld.tavern']) {
    const json = fs.readFileSync(
      path.join(__dirname, '..', 'tests', 'fixtures', 'plugins', id + '.json'),
      'utf8',
    )
    await page.evaluate(async (json) => {
      const preview = await window.wdPlugins.prepare({ json })
      if (!preview.ok) throw new Error(preview.error)
      const result = await window.wdPlugins.install({
        token: preview.value.token,
        permissions: preview.value.manifest.permissions,
      })
      if (!result.ok) throw new Error(result.error)
    }, json)
  }
  await page.reload()
  await page.locator('.mode-picker').waitFor()
}
async function openStudioEditor(page) {
  await page.locator('.studio-home-nav').waitFor()
  await page
    .locator('.studio-home-nav')
    .getByRole('button', { name: /^(编辑工作台|Editing workbench)$/ })
    .click()
}
module.exports = { installTestModes, openStudioEditor }
