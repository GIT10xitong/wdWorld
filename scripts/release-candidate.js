const fs = require('node:fs')
const path = require('node:path')
const { spawnSync, execFileSync } = require('node:child_process')
const crypto = require('node:crypto')
const yaml = require('js-yaml')
const assert = require('node:assert/strict')
const pkg = require('../package.json')
const root = path.resolve(__dirname, '..')
const output = path.join(root, 'release', `v${pkg.version}`)
const installer = path.join(output, 'installer')
const portable = path.join(output, `WDWorld-Desktop-${pkg.version}`)
function run(script, args = []) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: root, stdio: 'inherit' })
  if (result.status !== 0) throw new Error(`Build step failed: ${script}`)
}
function digest(file, encoding = 'hex', algorithm = 'sha256') {
  return crypto.createHash(algorithm).update(fs.readFileSync(file)).digest(encoding)
}
function main() {
  assert.equal(process.platform, 'win32', 'Build the Windows candidate on Windows')
  if (fs.existsSync(output)) throw new Error(`Refusing to overwrite ${output}`)
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
  const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim()
  if (dirty) throw new Error('Commit the candidate source before packaging so the build is traceable')
  run(require.resolve('typescript/bin/tsc'))
  run(path.join(root, 'node_modules/vite/bin/vite.js'), ['build'])
  run(path.join(__dirname, 'package.js'))
  run(require.resolve('electron-builder/cli.js'), [
    '--win',
    'nsis',
    '--x64',
    '--publish',
    'never',
    `--config.directories.output=${installer}`,
  ])
  const metadata = yaml.load(fs.readFileSync(path.join(installer, 'latest.yml'), 'utf8'))
  assert.equal(metadata.version, pkg.version)
  const exe = path.join(installer, `WDWorld-Setup-${pkg.version}.exe`)
  const entry = metadata.files.find((file) => file.url === path.basename(exe))
  assert(entry, 'Update manifest must point to this installer')
  assert.equal(entry.sha512, digest(exe, 'base64', 'sha512'))
  assert.equal(entry.size, fs.statSync(exe).size)
  assert(fs.existsSync(exe + '.blockmap'))
  assert(fs.existsSync(path.join(installer, 'win-unpacked/resources/app-update.yml')))
  run(path.join(__dirname, 'test-packaged.js'), [path.join(portable, 'WD World.exe'), 'portable'])
  run(path.join(__dirname, 'test-packaged.js'), [
    path.join(installer, 'win-unpacked/WD World.exe'),
    'installer',
  ])
  const files = [exe, exe + '.blockmap', path.join(installer, 'latest.yml')]
  const manifest = {
    version: pkg.version,
    revision,
    builtAt: new Date().toISOString(),
    published: false,
    files: files.map((file) => ({
      path: path.relative(output, file),
      bytes: fs.statSync(file).size,
      sha256: digest(file),
    })),
  }
  fs.writeFileSync(path.join(output, 'candidate.json'), JSON.stringify(manifest, null, 2))
  fs.writeFileSync(
    path.join(output, 'SHA256SUMS.txt'),
    manifest.files.map((file) => `${file.sha256}  ${file.path}`).join('\n') + '\n',
  )
  console.log(`Verified local candidate: ${output}`)
}
try {
  main()
} catch (error) {
  console.error(error)
  process.exitCode = 1
}
