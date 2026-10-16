const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const suites = [
  'desktop',
  'studio-desktop',
  'world-desktop',
  'lan-desktop',
  'automation-desktop',
  'plugins-desktop',
  'novel-desk',
  'mode-homes',
  'theme-desktop',
]
const root = path.resolve(__dirname, '..')
const from = process.argv.indexOf('--from')
const startAt = from === -1 ? 0 : suites.indexOf(process.argv[from + 1])
if (startAt === -1) throw new Error('Unknown desktop suite')
const reportFile = path.join(root, 'test-results', 'desktop-summary.json')
const results = startAt ? JSON.parse(fs.readFileSync(reportFile, 'utf8')).slice(0, startAt) : []
if (results.length !== startAt || results.some((result, i) => !result.passed || result.suite !== suites[i]))
  throw new Error('Cannot resume without passing results for preceding suites')
fs.mkdirSync(path.join(root, 'test-results'), { recursive: true })
for (const suite of suites.slice(startAt)) {
  console.log(`\nRunning desktop suite: ${suite}`)
  const start = Date.now()
  const result = spawnSync(process.execPath, [path.join(__dirname, `test-${suite}.js`)], {
    cwd: root,
    stdio: 'inherit',
    timeout: 10 * 60 * 1000,
  })
  results.push({
    suite,
    passed: result.status === 0,
    durationMs: Date.now() - start,
    error: result.error?.message,
  })
  fs.writeFileSync(reportFile, JSON.stringify(results, null, 2))
  if (result.status !== 0) {
    console.error(result.error?.message || `${suite} failed with exit code ${result.status}`)
    process.exitCode = 1
    break
  }
}
