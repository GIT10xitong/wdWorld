import { describe, expect, it } from 'vitest'
import { getEntryPlaceholderSource } from '@/lib/assetSources'

describe('entry placeholder assets', () => {
  it('provides a bundled image for every entry type', () => {
    const types = ['character', 'location', 'faction', 'item', 'event', 'lore', 'region', 'note'] as const

    for (const type of types) {
      expect(getEntryPlaceholderSource(type)).toMatch(/\.png$/)
    }
  })

  it('groups related entry types under the same neutral artwork', () => {
    expect(getEntryPlaceholderSource('region')).toBe(getEntryPlaceholderSource('location'))
    expect(getEntryPlaceholderSource('event')).toBe(getEntryPlaceholderSource('location'))
    expect(getEntryPlaceholderSource('lore')).toBe(getEntryPlaceholderSource('faction'))
    expect(getEntryPlaceholderSource('note')).toBe(getEntryPlaceholderSource('item'))
  })
})
