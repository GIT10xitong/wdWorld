// Explicit opt-in: one short, real API generation using the app's encrypted settings.
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { _electron } = require('playwright-core')
/* global window */

async function main() {
  if (process.env.WDWORLD_LIVE_AI !== '1')
    throw new Error('Set WDWORLD_LIVE_AI=1 to run a real API smoke test')
  const source = path.join(process.env.APPDATA, 'wdworld', 'ai-settings.json')
  if (!fs.existsSync(source)) throw new Error('No saved desktop AI settings')
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'wdworld-live-check-'))
  const config = path.join(profile, 'ai-settings.json')
  fs.copyFileSync(source, config)
  // safeStorage's OS-protected key is scoped to the Electron profile on Windows.
  // Copy only its encrypted key metadata, never decrypt or print it in this script.
  const originalState = path.join(path.dirname(source), 'Local State')
  const localState = path.join(profile, 'Local State')
  if (fs.existsSync(originalState)) {
    const state = JSON.parse(fs.readFileSync(originalState, 'utf8'))
    fs.writeFileSync(localState, JSON.stringify({ os_crypt: state.os_crypt }))
  }
  const env = { ...process.env, WDWORLD_PREVIEW: '1', WDWORLD_TEST_USER_DATA: profile }
  delete env.ELECTRON_RUN_AS_NODE
  let app
  try {
    app = await _electron.launch({
      executablePath: require('electron'),
      args: [path.resolve(__dirname, '..')],
      env,
    })
    const page = await app.firstWindow()
    await page.waitForFunction(() => !!window.novelAI)
    const result = await page.evaluate(async () => {
      const settings = await window.novelAI.getSettings()
      if (!settings.hasKey) throw new Error('No saved key for the active provider')
      const phases = []
      const dispose = window.novelAI.onProgress((event) => phases.push(event.phase))
      const started = Date.now()
      try {
        const reply = await window.novelAI.generate({
          id: 'live-smoke-test',
          messages: [
            {
              role: 'system',
              content:
                '你是中文小说助手。请将故事想法整理为一个不超过 80 字的故事核心，不要生成大纲和人物表。只输出结果。',
            },
            {
              role: 'user',
              content: JSON.stringify({
                故事想法: '小城钟表匠每天都收到来自明天的维修单。',
                类型: '悬疑',
                文风: '简洁',
                作者要求: '保留悬念',
              }),
            },
          ],
        })
        return {
          ok: reply.ok,
          error: reply.error,
          model: settings.model,
          characters: reply.text?.length || 0,
          elapsedSeconds: Math.round((Date.now() - started) / 1000),
          phases: [...new Set(phases)],
        }
      } finally {
        dispose()
      }
    })
    console.log(JSON.stringify(result))
    if (!result.ok || !result.characters) process.exitCode = 1
  } finally {
    if (app) await app.evaluate(({ app }) => app.exit()).catch(() => {})
    for (const file of [config, config + '.tmp', localState]) if (fs.existsSync(file)) fs.unlinkSync(file)
  }
}
main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
