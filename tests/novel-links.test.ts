import { expect, it } from 'vitest'
import { Database } from '@/lib/storage/database'
import { emptyNovel, newChapter, textToHtml } from '@/features/novel/model'
import { emptyWorkbench, applyAgentDraft, workPrompt } from '@/features/novel/workbench'
it('syncs into the same project, avoids duplicates, protects manual edits and remaps links on backup import', async () => {
  const db = new Database()
  await db.open()
  try {
    const p = await db.createProject('Linked book', '', 'novel'),
      other = await db.createProject('Other', '', 'novel')
    db.saveNovel(p.id, emptyNovel('Original idea'))
    let doc = await db.syncNovelSource(p.id, 'idea', 'Original idea', {
      title: 'Idea reference',
      type: 'note',
      confirmed: true,
    })
    const id = doc.worldLinks!.idea.entryId
    await db.syncNovelSource(p.id, 'idea', 'Original idea', {
      title: 'Idea reference',
      type: 'note',
      confirmed: true,
    })
    expect((await db.listEntries(p.id)).length).toBe(1)
    expect(await db.listEntries(other.id)).toHaveLength(0)
    doc.idea = 'New idea'
    db.saveNovel(p.id, doc)
    await expect(
      db.syncNovelSource(p.id, 'idea', 'Original idea', {
        title: 'Idea reference',
        type: 'note',
        confirmed: true,
      }),
    ).rejects.toThrow('Source changed')
    doc = await db.syncNovelSource(p.id, 'idea', 'New idea', {
      title: 'Idea reference',
      type: 'note',
      confirmed: true,
    })
    expect((await db.getEntry(id))?.content).toBe(textToHtml('New idea'))
    await db.updateEntry(id, { content: 'MANUAL_WORLD_EDIT' })
    await expect(
      db.syncNovelSource(p.id, 'idea', 'New idea', {
        title: 'Idea reference',
        type: 'note',
        confirmed: true,
      }),
    ).rejects.toThrow('World entry changed')
    expect((await db.getEntry(id))?.content).toBe('MANUAL_WORLD_EDIT')
    const imported = await db.importProjectJSON(await db.exportProjectJSON(p.id))
    const link = db.getNovel(imported.id).worldLinks!.idea
    expect(link.entryId).not.toBe(id)
    expect((await db.getEntry(link.entryId))?.projectId).toBe(imported.id)
  } finally {
    db.close()
  }
})
it('keeps AI tool reports proposed and excludes linked reference notes from later tool canon', async () => {
  const db = new Database()
  await db.open()
  try {
    const p = await db.createProject('Book', '', 'novel'),
      doc = emptyNovel()
    doc.workbench = emptyWorkbench()
    doc.workbench.results = [
      {
        id: 'r',
        kind: 'analysis',
        title: 'External book analysis',
        text: 'REFERENCE_ONLY',
        chapterId: null,
        baseContent: '',
        createdAt: '',
        applied: false,
      },
    ]
    db.saveNovel(p.id, doc)
    let linked = await db.syncNovelSource(p.id, 'result:r', 'REFERENCE_ONLY', {
      title: 'Analysis',
      type: 'note',
      confirmed: false,
    })
    expect((await db.getEntry(linked.worldLinks!['result:r'].entryId))?.status).toBe('proposed')
    linked = await db.syncNovelSource(p.id, 'result:r', 'REFERENCE_ONLY', {
      title: 'Analysis',
      type: 'note',
      confirmed: true,
    })
    expect(JSON.stringify(workPrompt('health', linked, await db.listEntries(p.id), '', ''))).not.toContain(
      'REFERENCE_ONLY',
    )
  } finally {
    db.close()
  }
})
it('applies agent prose with a snapshot and rejects duplicate or stale applications', () => {
  const doc = emptyNovel(),
    chapter = newChapter('One')
  chapter.content = textToHtml('Original')
  doc.chapters = [chapter]
  doc.workbench = emptyWorkbench()
  const r = {
    id: 'r',
    kind: 'agent' as const,
    title: 'Writer',
    text: 'Next scene',
    chapterId: chapter.id,
    baseContent: chapter.content,
    createdAt: '',
    applied: false,
  }
  doc.workbench.results = [r]
  const next = applyAgentDraft(doc, r)
  expect(next.chapters[0].content).toContain('Next scene')
  expect(next.snapshots[0].data.chapters[0].content).toBe(chapter.content)
  expect(() => applyAgentDraft(next, next.workbench.results[0])).toThrow()
  doc.chapters[0].content = 'Manual edit'
  expect(() => applyAgentDraft(doc, r)).toThrow()
})
