import { expect, it } from 'vitest'
import { emptyNovel, newChapter, validateNovel } from '@/features/novel/model'
import { localDay, manuscriptWords, recordWriting, writingSeries } from '@/features/novel/activity'

it('counts only positive manuscript additions and keeps manual and accepted AI separate', () => {
  const before = emptyNovel()
  const chapter = newChapter('One')
  const after = { ...before, chapters: [{ ...chapter, content: '<p>abc def</p>' }] }
  const now = new Date(2026, 9, 14, 0, 1)
  const manual = recordWriting(before, after, 'manual', now)
  expect(manuscriptWords(manual)).toBe(6)
  expect(manual.activity).toEqual([{ date: '2026-10-14', manual: 6, ai: 0 }])
  expect(before.activity).toBeUndefined()
  const ai = recordWriting(
    manual,
    { ...manual, chapters: [{ ...chapter, content: 'abcdefghij' }] },
    'ai',
    now,
  )
  expect(ai.activity).toEqual([{ date: '2026-10-14', manual: 6, ai: 4 }])
  const deleted = { ...ai, chapters: [{ ...chapter, content: 'a' }] }
  expect(recordWriting(ai, deleted, 'manual', now).activity).toEqual(ai.activity)
  const metadata = { ...ai, idea: 'A longer story idea that is not manuscript text.' }
  expect(recordWriting(ai, metadata, 'manual', now).activity).toEqual(ai.activity)
  expect(() => validateNovel(ai)).not.toThrow()
  expect(() => validateNovel({ ...ai, activity: [{ date: '2026-10-14', manual: -1, ai: 0 }] })).toThrow()
})

it('uses local calendar days and combines books without inventing historical writing', () => {
  const now = new Date(2026, 0, 2, 0, 1)
  expect(localDay(now)).toBe('2026-01-02')
  const series = writingSeries(
    [
      { date: '2026-01-02', manual: 10, ai: 3 },
      { date: '2026-01-02', manual: 20, ai: 7 },
      { date: '2025-12-31', manual: 5, ai: 0 },
      { date: '2025-01-02', manual: 999, ai: 999 },
    ],
    now,
  )
  expect(series).toHaveLength(14)
  expect(series[0]).toEqual({ date: '2025-12-20', manual: 0, ai: 0 })
  expect(series[13]).toEqual({ date: '2026-01-02', manual: 30, ai: 10 })
  expect(series.reduce((sum, d) => sum + d.manual + d.ai, 0)).toBe(45)
  expect(writingSeries([], now).every((d) => d.manual === 0 && d.ai === 0)).toBe(true)
})
