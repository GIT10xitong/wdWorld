const path = require('node:path')
const os = require('node:os')

// Packaged QA must be explicit and confined to a temporary profile. Normal
// launches continue to use the established wdworld data directory.
function testProfile(isPackaged, argv = process.argv, env = process.env) {
  const requested = env.WDWORLD_TEST_USER_DATA
  if (!requested || (isPackaged && !argv.includes('--wdworld-test-mode'))) return null
  if (!path.isAbsolute(requested)) throw new Error('Test profile must be an absolute path')
  const resolved = path.resolve(requested)
  if (isPackaged) {
    const relative = path.relative(os.tmpdir(), resolved)
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative))
      throw new Error('Packaged test profile must be inside the temporary directory')
    if (!path.basename(resolved).startsWith('wdworld-'))
      throw new Error('Packaged test profile must have a wdworld- prefix')
  }
  return resolved
}

module.exports = { testProfile }
