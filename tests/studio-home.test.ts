import { expect, it, afterEach } from 'vitest'
import { emptyStudio } from '@/features/studio/model'
import { studioOverview, homeProfile } from '@/features/studio/homeModel'
import { setLanguage } from '@/lib/i18n'
import type { Entry, Relation } from '@/types'
afterEach(() => setLanguage('zh-CN'))
it('derives live counts without archived entries or dangling relations and keeps proposals visible', () => {
  const doc = emptyStudio()
  doc.drafts.oc.name = 'Mira'
  doc.drafts.oc.concept = '  '
  const entries = [
    { id: 'one', type: 'character', status: 'active' },
    { id: 'two', type: 'character', status: 'proposed' },
    { id: 'old', type: 'character', status: 'archived' },
  ] as Entry[]
  const relations = [
    { sourceEntryId: 'one', targetEntryId: 'two' },
    { sourceEntryId: 'one', targetEntryId: 'old' },
    { sourceEntryId: 'one', targetEntryId: 'missing' },
  ] as Relation[]
  const summary = studioOverview('oc', doc, entries, relations)
  expect(summary.characters.map((c) => c.id)).toEqual(['one', 'two'])
  expect(summary.relations).toBe(1)
  expect(summary.pending).toBe(1)
  expect(summary.filled).toBe(1)
  doc.drafts.oc.motivation = 'Find the signal'
  expect(studioOverview('oc', doc, entries, relations).filled).toBe(2)
})
it('tracks enabled lorebook entries independently and switches all mode descriptions with language', () => {
  const doc = emptyStudio()
  doc.book = [
    { id: 'one', enabled: true },
    { id: 'two', enabled: false },
  ] as typeof doc.book
  expect(studioOverview('tavern', doc, [], []).enabledBook).toBe(1)
  for (const mode of ['oc', 'trpg', 'tavern'] as const) {
    setLanguage('zh-CN')
    const zh = homeProfile(mode)
    setLanguage('en')
    const en = homeProfile(mode)
    expect(en.title).not.toBe(zh.title)
    expect(en.features.every((f) => !/[\u4e00-\u9fff]/.test(f))).toBe(true)
  }
})
