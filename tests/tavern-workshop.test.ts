import { beforeEach, describe, expect, it } from 'vitest'
import { enableTestModes } from './plugin-fixtures'
beforeEach(enableTestModes)
import { characterCard, worldBook, importCard, importBook, activatedBook } from '@/features/studio/tavern'
import { emptyStudio, studioPrompt, validateStudio } from '@/features/studio/model'
import { seedInstruction } from '@/features/studio/seed'
import { Database } from '@/lib/storage/database'

describe('creative seeds and tavern workshop', () => {
  it('reuses mode-specific inspiration and leaves the original context intact', () => {
    expect(seedInstruction('tavern', 'repeat')).toBe(seedInstruction('tavern', 'repeat'))
    expect(seedInstruction('oc', 'repeat')).not.toBe(seedInstruction('tavern', 'repeat'))
    expect(seedInstruction('oc', ' ')).toBe('')
    const doc = emptyStudio()
    doc.seeds = { tavern: 'blank-world' }
    const context = JSON.parse(studioPrompt('tavern', doc, [], [])[1].content)
    expect(context.创作随机种子).toContain('blank-world')
    expect(context.创作随机种子).toContain('when empty')
    expect(context.当前草稿.name).toBe('')
    expect(context.已确认世界资料).toEqual([])
    expect(studioPrompt('oc', doc, [], [])[1].content).not.toContain('blank-world')
  })
  it('round-trips V2 fields, alternate greetings, extensions, and attached lore', () => {
    const imported = importCard({
      spec: 'chara_card_v2',
      data: {
        name: 'Guide',
        description: 'Knows the city',
        alternate_greetings: ['One', 'Two\nThree'],
        tags: ['guide', 'city'],
        creator: 'Author',
        system_prompt: 'Stay in character',
        extensions: { custom: { keep: true } },
        character_book: {
          entries: [
            {
              keys: ['harbor'],
              secondary_keys: ['night'],
              selective: true,
              content: 'The harbor closes.',
              name: 'Harbor',
              enabled: true,
              constant: false,
              insertion_order: 42,
              extensions: { custom: 3 },
            },
          ],
        },
      },
    })
    const result = characterCard(imported.draft, imported.book)
    expect(result.data.alternate_greetings).toEqual(['One', 'Two\nThree'])
    expect(result.data.extensions.custom.keep).toBe(true)
    expect(result.data.character_book.entries[0].secondary_keys).toEqual(['night'])
    expect(result.data.character_book.entries[0].extensions).toEqual({ custom: 3 })
    expect(result.data.creator).toBe('Author')
  })
  it('imports legacy cards and standalone books without activating disabled entries', () => {
    expect(importCard({ name: 'Legacy', description: 'Text' }).draft.first_mes).toBe('')
    const book = importBook({
      entries: {
        a: { key: ['City'], content: 'City lore', comment: 'City', order: 9, probability: 33 },
        b: { content: 'Hidden', constant: true, disable: true },
      },
    })
    expect(activatedBook(book, 'CITY')).toHaveLength(1)
    expect(activatedBook(book, '')).toHaveLength(0)
    expect(worldBook(book).entries[0].probability).toBe(33)
    expect(() => importCard({ spec: 'chara_card_v3', data: {} })).toThrow()
    expect(() => importCard({ entries: [] })).toThrow()
    expect(() => importBook({ entries: { a: { content: 42 } } })).toThrow()
  })
  it('persists card libraries and seeds through project backups and rejects malformed additions', async () => {
    const db = new Database()
    await db.open()
    try {
      const project = await db.createProject('Cards')
      const doc = emptyStudio()
      doc.cards = [{ id: 'card-1', ...importCard({ name: 'Stored', description: 'Saved' }) }]
      doc.seeds = { tavern: 'keep-seed' }
      db.saveStudio(project.id, doc)
      expect(db.getStudio(project.id).cards?.[0].draft.name).toBe('Stored')
      const restored = new Database()
      await restored.open()
      try {
        const copy = await restored.importProjectJSON(await db.exportProjectJSON(project.id))
        expect(restored.getStudio(copy.id).cards).toEqual(doc.cards)
        expect(restored.getStudio(copy.id).seeds).toEqual(doc.seeds)
      } finally {
        await restored.close()
      }
      const invalid = structuredClone(doc)
      invalid.cards![0].book = null as any
      expect(() => validateStudio(invalid)).toThrow()
      expect(() => validateStudio({ ...doc, seeds: [] })).toThrow()
    } finally {
      await db.close()
    }
  })
})
