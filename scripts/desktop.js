const { spawn } = require('child_process')
const path = require('path')
const electron = require('electron')
const env = { ...process.env, WDWORLD_PREVIEW: '1' }
delete env.ELECTRON_RUN_AS_NODE
const child = spawn(electron, [path.resolve(__dirname, '..')], { env, stdio: 'inherit' })
child.on('error', (error) => {
  console.error(error.message)
  process.exitCode = 1
})
child.on('exit', (code) => {
  process.exitCode = code || 0
})
