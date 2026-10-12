import { describe, expect, it } from 'vitest'
import { Database } from '@/lib/storage/database'
import { emptyStudio, studioSources } from '@/features/studio/model'
import { parseTavernWorld, tavernWorldPrompt } from '@/features/studio/tavernWorld'
import { draftWorldSettings } from '@/features/studio/worldSettings'
import { applyGeneration, emptyNovel, textToHtml, type Generation } from '@/features/novel/model'
import { stageBlock } from '@/features/novel/journey'
import fixture from './fixtures/tavern-world.json'

describe('automatic generated settings', () => {
  it('publishes pending entries atomically without overwriting existing content', async () => {
    const db = new Database()
    await db.open()
    try {
      const project = await db.createProject('World')
      const old = await db.createEntry(project.id, 'lore', 'Rule', '', textToHtml('Original'))
      const items = [{ type: 'lore' as const, title: 'Rule', content: 'New candidate' }]
      const [id] = await db.publishGeneratedSettings(project.id, items)
      expect((await db.getEntry(old.id))?.content).toBe(textToHtml('Original'))
      expect((await db.getEntry(id))?.status).toBe('proposed')
      expect(await db.publishGeneratedSettings(project.id, items)).toEqual([id])
      await db.updateEntry(id, { title: 'Rule' })
      const other = await db.createEntry(project.id, 'lore', 'Other')
      await db.updateEntry(other.id, { title: 'Rule' })
      expect(new Set((await db.listEntries(project.id)).map((e) => e.slug)).size).toBe(3)
      await expect(
        db.publishGeneratedSettings(project.id, [{ ...items[0], title: 'Rollback' }], () => {
          throw new Error('save failed')
        }),
      ).rejects.toThrow('save failed')
      expect((await db.listEntries(project.id)).some((e) => e.title === 'Rollback')).toBe(false)
      await expect(
        db.confirmGeneratedSettings(project.id, [id], () => {
          throw new Error('save failed')
        }),
      ).rejects.toThrow()
      expect((await db.getEntry(id))?.status).toBe('proposed')
      await db.confirmGeneratedSettings(project.id, [id])
      expect((await db.getEntry(id))?.status).toBe('active')
    } finally {
      await db.close()
    }
  })
  it('links novel suggestions to visible entries and confirms without duplicates', async () => {
    const db = new Database()
    await db.open()
    try {
      const project = await db.createProject('Novel')
      const doc = emptyNovel('Idea')
      const proposal = { type: 'character' as const, title: 'Guide', content: 'A guide' }
      const ids = await db.publishGeneratedSettings(project.id, [proposal])
      const entries = await db.listEntries(project.id)
      expect(stageBlock(doc, entries, 'outline')).not.toBe('')
      expect(studioSources(emptyStudio(), 'oc', entries)).toEqual([])
      const generation: Generation = {
        id: 'g',
        task: 'world',
        chapterId: null,
        instruction: '',
        createdAt: new Date().toISOString(),
        status: 'ready',
        text: JSON.stringify({ proposals: [proposal] }),
        worldEntryIds: ids,
      }
      doc.generations = [generation]
      const candidate = applyGeneration(doc, generation, entries)
      candidate.proposals[0].content = 'Author edited guide'
      const accepted = await db.confirmNovelProposal(project.id, candidate, candidate.proposals[0].id)
      expect(accepted.proposals[0].appliedEntryId).toBe(ids[0])
      expect(await db.listEntries(project.id)).toHaveLength(1)
      expect((await db.getEntry(ids[0]))?.content).toBe(textToHtml('Author edited guide'))
      expect(stageBlock(doc, await db.listEntries(project.id), 'outline')).toBe('')
      const copy = await db.importProjectJSON(await db.exportProjectJSON(project.id))
      expect(db.getNovel(copy.id).proposals[0].pendingEntryId).not.toBe(ids[0])
      expect((await db.getEntry(db.getNovel(copy.id).proposals[0].pendingEntryId!))?.projectId).toBe(copy.id)
    } finally {
      await db.close()
    }
  })
  it('validates complete tavern worlds before publishing any settings', () => {
    const result = parseTavernWorld(JSON.stringify(fixture))
    expect(result.cards).toHaveLength(2)
    expect(result.book).toHaveLength(6)
    expect(result.settings.map((s) => s.type)).toContain('faction')
    expect(() => parseTavernWorld(JSON.stringify({ ...fixture, cards: [fixture.cards[0]] }))).toThrow()
    expect(() => parseTavernWorld(JSON.stringify({ ...fixture, book: [{ content: 'broken' }] }))).toThrow()
    const doc = emptyStudio()
    doc.seeds = { tavern: 'whole-world' }
    expect(tavernWorldPrompt(doc, [], [])[1].content).toContain('whole-world')
  })
  it('separates TRPG planning from actual session history and creator notes', () => {
    const doc = emptyStudio()
    doc.drafts.trpg = {
      ...doc.drafts.trpg,
      name: 'Adventure',
      premise: 'Village',
      sessionLog: 'ACTUAL HISTORY',
      secrets: 'Private GM clue',
    }
    const result = draftWorldSettings('trpg', doc.drafts.trpg, JSON.stringify(doc.drafts.trpg), [])
    expect(JSON.stringify(result)).not.toContain('ACTUAL HISTORY')
    expect(JSON.stringify(result)).toContain('Private GM clue')
    const tavern = {
      ...doc.drafts.tavern,
      name: 'Role',
      description: 'Public description',
      creator_notes: 'CREATOR NOTE',
    }
    expect(JSON.stringify(draftWorldSettings('tavern', tavern, JSON.stringify(tavern), []))).not.toContain(
      'CREATOR NOTE',
    )
  })
})
