import path from 'node:path'
import { fileURLToPath } from 'node:url'

export default path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../node_modules/sql.js/dist/sql-wasm.wasm',
)
