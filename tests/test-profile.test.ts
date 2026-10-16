// @vitest-environment node
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
const { testProfile } = createRequire(import.meta.url)('../electron/test-profile')

it('requires explicit packaged QA and isolates it from the normal data directory', () => {
  const profile = path.join(tmpdir(), 'wdworld-package-test')
  const env = { WDWORLD_TEST_USER_DATA: profile }
  expect(testProfile(true, [], env)).toBeNull()
  expect(testProfile(true, ['--wdworld-test-mode'], {})).toBeNull()
  expect(testProfile(true, ['--wdworld-test-mode'], env)).toBe(profile)
  expect(testProfile(false, [], env)).toBe(profile)
  for (const requested of ['relative', tmpdir(), path.parse(tmpdir()).root, path.join(tmpdir(), 'other')])
    expect(() => testProfile(true, ['--wdworld-test-mode'], { WDWORLD_TEST_USER_DATA: requested })).toThrow()
})
