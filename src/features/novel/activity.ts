import { plainText, type NovelDocument } from './model'
export interface WritingDay {
  date: string
  manual: number
  ai: number
}
export const localDay = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
export const manuscriptWords = (doc: NovelDocument) =>
  doc.chapters.reduce((sum, c) => sum + plainText(c.content).replace(/\s/g, '').length, 0)
export function recordWriting(
  before: NovelDocument,
  after: NovelDocument,
  origin: 'manual' | 'ai',
  now = new Date(),
): NovelDocument {
  const added = Math.max(0, manuscriptWords(after) - manuscriptWords(before))
  if (!added) return after
  const date = localDay(now),
    days = (before.activity || []).map((d) => ({ ...d }))
  let day = days.find((d) => d.date === date)
  if (!day) {
    day = { date, manual: 0, ai: 0 }
    days.push(day)
  }
  day[origin] += added
  return { ...after, activity: days.sort((a, b) => a.date.localeCompare(b.date)).slice(-366) }
}
export function writingSeries(days: WritingDay[], now = new Date()) {
  return Array.from({ length: 14 }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13 + i),
      key = localDay(date)
    return days
      .filter((d) => d.date === key)
      .reduce((sum, d) => ({ ...sum, manual: sum.manual + d.manual, ai: sum.ai + d.ai }), {
        date: key,
        manual: 0,
        ai: 0,
      })
  })
}
