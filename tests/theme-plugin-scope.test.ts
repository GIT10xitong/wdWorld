import { it, expect } from 'vitest'
import { initializeTheme, setTheme } from '@/lib/theme'
import { inPluginScope } from '@/features/plugins/store'
it('persists day/night independently of mode and restores it on startup', () => {
  setTheme('night')
  initializeTheme()
  expect(document.documentElement.dataset.theme).toBe('night')
  setTheme('day')
  initializeTheme()
  expect(document.documentElement.style.colorScheme).toBe('light')
})
it('separates mode packages, legacy tavern add-ons and explicitly targeted extensions', () => {
  expect(inPluginScope({ id: 'wdworld.tavern' }, 'modes')).toBe(true)
  expect(inPluginScope({ id: 'wdworld.memory' }, 'modes')).toBe(false)
  expect(inPluginScope({ id: 'wdworld.memory' }, 'tavern')).toBe(true)
  expect(inPluginScope({ id: 'wdworld.memory' }, 'novel')).toBe(false)
  const extension = {
    id: 'external.writer',
    kind: 'extension',
    targets: ['novel', 'oc'] as ('novel' | 'oc')[],
  }
  expect(inPluginScope(extension, 'novel')).toBe(true)
  expect(inPluginScope(extension, 'oc')).toBe(true)
  expect(inPluginScope(extension, 'tavern')).toBe(false)
})
