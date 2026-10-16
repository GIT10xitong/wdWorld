const { _electron } = require('playwright-core')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
/* global document, window */
const root = path.resolve(__dirname, '..')
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'wdworld-mode-homes-'))
async function main() {
  const env = { ...process.env, WDWORLD_PREVIEW: '1', WDWORLD_TEST_USER_DATA: profile }
  delete env.ELECTRON_RUN_AS_NODE
  let app, page
  const errors = []
  const button = (name) => page.getByRole('button', { name, exact: true })
  const home = async () => {
    await button('创作主页').click()
    await page.locator('.studio-home').waitFor()
  }
  const editor = () => button('编辑工作台').click()
  const switchModes = async () => {
    await app.evaluate(({ Menu }) =>
      Menu.getApplicationMenu().getMenuItemById('switch-creation-mode').click(),
    )
    await page.locator('.mode-picker').waitFor()
  }
  const create = async (mode, name) => {
    await page.locator(`[data-mode="${mode}"]`).click()
    await page.locator('.mode-landing').waitFor()
    await button('新建世界').click()
    await page.getByPlaceholder('例如：雾海纪元').fill(name)
    await button('创建并进入').click()
    await page.locator('.studio-home').waitFor()
  }
  const shot = async (name) => {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].showInactive())
    await page.waitForTimeout(250)
    await page.screenshot({ path: path.join(root, 'test-results', name + '.png') })
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].hide())
  }
  try {
    app = await _electron.launch({ executablePath: require('electron'), args: [root], env })
    page = await app.firstWindow()
    page.setDefaultTimeout(20000)
    page.on('pageerror', (e) => errors.push(e.message))
    await require('./test-plugin-helper').installTestModes(page)
    await create('oc', '星灯角色企划')
    assert.deepEqual(await page.locator('.home-stat-grid strong').allTextContents(), ['0', '0', '0', '0'])
    await button('编辑人物档案').click()
    await page.getByLabel('角色名称', { exact: true }).fill('星灯守望者')
    await page.getByLabel('角色概念', { exact: true }).fill('在废弃灯塔接收来自未来的信号。')
    await page.getByLabel('目标与动机', { exact: true }).fill('找到最后一次失联航行的真相。')
    await shot('mode-editor-oc-day')
    await button('确认新建人物条目').click()
    await page.getByText('已加入世界观人物库', { exact: true }).waitFor()
    await home()
    assert.deepEqual(await page.locator('.home-stat-grid strong').allTextContents(), ['1', '0', '1', '0'])
    await shot('mode-home-oc-zh')
    await button('夜晚模式').click()
    await shot('mode-home-oc-night')
    await button('白天模式').click()
    await page.locator('.home-entry-grid button').first().click()
    await page.locator('.workspace-shell').waitFor()
    await page.locator('.mode-bar').getByRole('button', { name: 'OC 创作者', exact: true }).click()
    await page.locator('.studio-home').waitFor()
    await button('WD WORLD · 返回主页').click()
    await page.getByLabel('搜索本模式项目').fill('没有此项目')
    await page.getByText('没有找到匹配项目。', { exact: true }).waitFor()
    await page.getByLabel('搜索本模式项目').fill('星灯')
    await shot('mode-library-oc-zh')
    await button('打开 星灯角色企划').click()
    await page.locator('.studio-home').waitFor()
    await editor()
    assert.equal(await page.getByLabel('角色名称', { exact: true }).inputValue(), '星灯守望者')
    await switchModes()
    await create('trpg', '雾港调查团')
    await button('选择或导入副本').click()
    await button('预览所选副本').click()
    await button('确认载入副本').click()
    await page.waitForFunction(() => document.querySelector('[aria-label="团务名称"]')?.value.length > 0)
    await page.getByLabel('主持人秘密', { exact: true }).fill('PRIVATE_GM_HOME_TEST')
    await home()
    assert(!(await page.locator('.studio-home').innerText()).includes('PRIVATE_GM_HOME_TEST'))
    assert.equal((await page.locator('.home-stat-grid strong').allTextContents())[0], '1')
    await shot('mode-home-trpg-zh')
    await page
      .locator('.home-tool-grid')
      .getByRole('button', { name: /局域网房间/ })
      .click()
    await page.locator('.lan-workspace').waitFor()
    await shot('mode-lan-trpg-day')
    assert.equal((await page.evaluate(() => window.lanRoom.state())).state, null)
    await page.locator('.mode-bar').getByRole('button', { name: 'TRPG 主持人', exact: true }).click()
    await page.locator('.studio-home').waitFor()
    await button('WD WORLD · 返回主页').click()
    await page.locator('.mode-landing').waitFor()
    await switchModes()
    await create('tavern', '午夜灯塔酒馆')
    await button('制作角色卡').click()
    await page.getByLabel('角色卡名称', { exact: true }).fill('守灯人')
    await page.getByLabel('角色描述', { exact: true }).fill('守着海边最后一座灯塔，等待夜航的客人。')
    await page.getByLabel('开场白', { exact: true }).fill('{{user}}，今晚的潮声和往常不同。')
    await button('收藏当前角色卡').click()
    await button('新建世界书条目').click()
    await page.getByLabel('世界书标题 1', { exact: true }).fill('灯塔规则')
    await shot('mode-editor-tavern-day')
    await page.getByLabel('触发词 1', { exact: true }).fill('灯塔')
    await page.getByLabel('世界书正文 1', { exact: true }).fill('入夜之后必须保持灯光。')
    await button('保存角色场景卡').click()
    await home()
    assert.deepEqual(await page.locator('.home-stat-grid strong').allTextContents(), ['1', '1', '1', '1'])
    await shot('mode-home-tavern-zh')
    await button('编辑世界书').click()
    assert.equal(await page.getByLabel('世界书标题 1', { exact: true }).inputValue(), '灯塔规则')
    await home()
    await page
      .locator('.home-tool-grid')
      .getByRole('button', { name: /酒馆扩展/ })
      .click()
    await page.getByRole('heading', { name: '酒馆扩展', exact: true }).waitFor()
    await shot('mode-extensions-tavern-day')
    await page.locator('.mode-bar').getByRole('button', { name: '酒馆制作', exact: true }).click()
    await page.locator('.studio-home').waitFor()
    await page.locator('.language-picker').selectOption('en')
    await button('Craft character card').waitFor()
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1100, 720))
    await shot('mode-home-tavern-compact-en')
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    await button('WD WORLD · Home').click()
    await page.getByRole('heading', { name: 'A whole world, starting with one character card.' }).waitFor()
    await button('Open 午夜灯塔酒馆').click()
    await page.locator('.studio-home').waitFor()
    assert.deepEqual(await page.locator('.home-stat-grid strong').allTextContents(), ['1', '1', '1', '1'])
    await button('Save this page').click()
    assert.deepEqual(errors, [])
    console.log(
      'OC/TRPG/tavern home navigation, counters, project library, lore links, module loading, card preservation, LAN isolation and bilingual layout passed. Profile: ' +
        profile,
    )
  } catch (e) {
    if (page && !page.isClosed()) {
      await shot('mode-homes-failure').catch(() => {})
      fs.writeFileSync(path.join(root, 'test-results/mode-homes-failure.html'), await page.content())
    }
    throw e
  } finally {
    if (app) await app.close()
  }
}
main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
