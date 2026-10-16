import { describe, it, expect } from 'vitest'
import { emptyNovel, newChapter, validateNovel } from '@/features/novel/model'
import { emptyWorkbench, applyPolish, workPrompt, type WorkResult } from '@/features/novel/workbench'
import { Database } from '@/lib/storage/database'
import { buildPrompt } from '@/features/novel/prompts'

describe('novel writing desk data', () => {
  it('exports, imports and reopens all workbench data without affecting older novels', async () => {
    const db = new Database()
    await db.open()
    const project = await db.createProject('Book', '', 'novel')
    const doc = emptyNovel('Idea')
    doc.activity = [{ date: '2026-10-14', manual: 300, ai: 100 }]
    doc.workbench = emptyWorkbench()
    doc.workbench.authorMemory = 'PRIVATE_AUTHOR_STYLE'
    doc.workbench.resources = [{ id: 'r1', title: 'Reference', kind: 'excerpt', content: 'SOURCE_TEXT' }]
    doc.workbench.panels = [{ id: 'p1', title: 'Notes', kind: 'note', content: 'CUSTOM_PANEL' }]
    db.saveNovel(project.id, doc)
    const other = new Database()
    await other.open()
    const imported = await other.importProjectJSON(await db.exportProjectJSON(project.id))
    expect(other.getNovel(imported.id).workbench).toEqual(doc.workbench)
    expect(other.getNovel(imported.id).activity).toEqual(doc.activity)
    expect(() => validateNovel(emptyNovel())).not.toThrow()
    const invalid = structuredClone(doc)
    invalid.workbench!.resources[0].content = 123 as any
    expect(() => validateNovel(invalid)).toThrow()
    db.close()
    other.close()
  })
  it('keeps polishing provisional and refuses stale chapter replacement', () => {
    const doc = emptyNovel()
    const chapter = newChapter('One')
    chapter.content = '<p>Original.</p>'
    doc.chapters = [chapter]
    doc.selectedChapterId = chapter.id
    const result: WorkResult = {
      id: 'r',
      kind: 'polish',
      title: 'Polish',
      text: 'Revised <script>.',
      chapterId: chapter.id,
      baseContent: chapter.content,
      createdAt: '',
      applied: false,
    }
    doc.workbench = emptyWorkbench()
    doc.workbench.results = [result]
    expect(doc.chapters[0].content).toBe('<p>Original.</p>')
    const next = applyPolish(doc, result)
    expect(next.chapters[0].content).toContain('&lt;script&gt;')
    expect(next.snapshots[0].data.chapters[0].content).toBe(chapter.content)
    expect(next.workbench.results[0].applied).toBe(true)
    doc.chapters[0].content = 'Author changed this'
    expect(() => applyPolish(doc, result)).toThrow()
  })
  it('isolates book analysis from project secrets and respects staged author memory', () => {
    const doc = emptyNovel('PRIVATE_IDEA')
    doc.workbench = emptyWorkbench()
    doc.workbench.authorMemory = 'PRIVATE_PREFERENCE'
    const analysis = workPrompt('analysis', doc, [], 'Structure', 'SELECTED_EXCERPT')
    expect(analysis[1].content).toContain('SELECTED_EXCERPT')
    expect(analysis[1].content).not.toContain('PRIVATE')
    expect(buildPrompt('idea', doc, [], '').messages[1].content).not.toContain('PRIVATE_PREFERENCE')
    expect(buildPrompt('write', doc, [], '').messages[1].content).toContain('PRIVATE_PREFERENCE')
  })
})
