const fs = require('fs')
const path = require('path')

// The complete directory is portable; project data stays in Electron userData.
const root = path.resolve(__dirname, '..')
const pkg = require('../package.json')
const runtime = path.join(root, 'node_modules', 'electron', 'dist')
const output = path.join(root, 'release', 'v' + pkg.version, 'WDWorld-Desktop-' + pkg.version)
if (process.platform !== 'win32') throw new Error('Use npm run electron:build for other platforms')
if (!fs.existsSync(path.join(runtime, 'electron.exe')))
  throw new Error('Electron runtime missing. Run: node node_modules/electron/install.js')
if (!fs.existsSync(path.join(root, 'dist', 'index.html'))) throw new Error('Run npm run build first')
if (fs.existsSync(output))
  throw new Error('Output already exists: ' + output + '. Move the old build before packaging again.')
fs.mkdirSync(output, { recursive: true })
fs.cpSync(runtime, output, { recursive: true })
fs.renameSync(path.join(output, 'electron.exe'), path.join(output, 'WD World.exe'))
const appDir = path.join(output, 'resources', 'app')
fs.mkdirSync(appDir, { recursive: true })
fs.cpSync(path.join(root, 'dist'), path.join(appDir, 'dist'), { recursive: true })
fs.cpSync(path.join(root, 'electron'), path.join(appDir, 'electron'), { recursive: true })
fs.writeFileSync(
  path.join(appDir, 'package.json'),
  JSON.stringify(
    { name: pkg.name, productName: 'WD World', version: pkg.version, main: 'electron/main.js' },
    null,
    2,
  ),
)
fs.cpSync(path.join(root, 'docs'), path.join(output, 'docs'), { recursive: true })
for (const name of ['README.md', 'README.en.md', 'QUICKSTART.md', 'CHANGELOG.md'])
  fs.copyFileSync(path.join(root, name), path.join(output, name))
console.log('Desktop build ready: ' + path.join(output, 'WD World.exe'))
