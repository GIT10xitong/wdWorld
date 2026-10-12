import { describe, expect, it } from 'vitest'
import {
  applyGeneration,
  emptyNovel,
  newChapter,
  restoreSnapshot,
  snapshot,
  validateNovel,
  type Generation,
} from '@/features/novel/model'
import { buildPrompt } from '@/features/novel/prompts'
import { enqueueSave } from '@/lib/storage/saveQueue'
import { stageBlock } from '@/features/novel/journey'
import type { Entry } from '@/types'

const candidate = (task: Generation['task'], text: string): Generation => ({
  id: 'gen',
  task,
  text,
  chapterId: null,
  instruction: '',
  createdAt: '',
  status: 'ready',
})

describe('author-controlled novel workflow', () => {
  it('keeps generated settings pending until separately confirmed', () => {
    const doc = emptyNovel('失忆的调查员')
    const g = candidate(
      'world',
      JSON.stringify({ proposals: [{ type: 'character', title: '林', content: '不能记住前天' }] }),
    )
    doc.generations = [g]
    const next = applyGeneration(doc, g, [])
    expect(next.proposals[0].status).toBe('pending')
    expect(next.generations[0].status).toBe('applied')
    expect(doc.proposals).toEqual([])
    expect(() => applyGeneration(next, next.generations[0], [])).toThrow()
  })

  it('appends chapter plans and restores versions without discarding accepted settings', () => {
    const doc = emptyNovel()
    doc.chapters = [newChapter('已有章节')]
    const g = candidate('chapters', '```json\n{"chapters":[{"title":"新章节","outline":"冲突"}]}\n```')
    doc.generations = [g]
    const next = applyGeneration(doc, g, [])
    expect(next.chapters.map((c) => c.title)).toEqual(['已有章节', '新章节'])
    next.proposals = [
      { id: 'p', type: 'lore', title: '规则', content: '内容', evidence: '', status: 'accepted' },
    ]
    const restored = restoreSnapshot(next, next.snapshots[0].id)
    expect(restored.chapters).toHaveLength(1)
    expect(restored.proposals[0].status).toBe('accepted')
  })

  it('protects edits made after a request started, and never inserts model HTML', () => {
    const doc = emptyNovel()
    const chapter = newChapter()
    chapter.content = '<p>原文</p>'
    doc.chapters = [chapter]
    const g = {
      ...candidate('rewrite', '<img src=x onerror=alert(1)>'),
      chapterId: chapter.id,
      baseContent: '<p>旧文</p>',
    }
    expect(() => applyGeneration(doc, g, [])).toThrow('正文在生成后已修改')
    g.baseContent = chapter.content
    const next = applyGeneration(doc, g, [])
    expect(next.chapters[0].content).toContain('&lt;img')
    expect(next.chapters[0].content).not.toContain('<img')
  })

  it('rejects malformed check results without partial mutations', () => {
    const doc = emptyNovel()
    const g = candidate('review', '{"issues":[],"proposals":[{"type":"character"}]}')
    doc.chapters = [newChapter()]
    g.chapterId = doc.chapters[0].id
    expect(() => applyGeneration(doc, g, [])).toThrow()
    expect(doc.snapshots).toHaveLength(0)
    expect(doc.proposals).toHaveLength(0)
  })

  it('rejects a canon suggestion based on facts edited after generation', () => {
    const doc = emptyNovel()
    doc.chapters = [newChapter()]
    const g = candidate(
      'review',
      JSON.stringify({
        issues: [],
        proposals: [{ type: 'lore', title: '规则', content: '模型建议', targetEntryId: 'rule' }],
      }),
    )
    g.entryContents = { rule: '生成时的内容' }
    g.chapterId = doc.chapters[0].id
    expect(() => applyGeneration(doc, g, [{ id: 'rule', content: '作者后来修改的内容' }])).toThrow(
      '设定在生成后已修改',
    )
  })

  it('only sends selected canon and earlier chapter summaries', () => {
    const doc = emptyNovel('想法')
    const first = newChapter('前章')
    first.summary = '此前的事件'
    const current = newChapter('本章')
    current.entryIds = ['chosen']
    const future = newChapter('后章')
    future.summary = '不能提前泄漏'
    doc.chapters = [first, current, future]
    doc.selectedChapterId = current.id
    const entries = [
      { id: 'chosen', title: '参考人物', content: '<p>已确认内容</p>' },
      { id: 'excluded', title: '排除人物', content: '秘密' },
    ] as Entry[]
    const prompt = buildPrompt('write', doc, entries, '克制')
    expect(prompt.sources).toEqual(['参考人物'])
    expect(prompt.messages[1].content).toContain('此前的事件')
    expect(prompt.messages[1].content).not.toContain('不能提前泄漏')
    expect(prompt.messages[1].content).not.toContain('秘密')
    doc.idea = '字'.repeat(91000)
    expect(buildPrompt('write', doc, entries, '').characters).toBeGreaterThan(91000)
  })

  it('only accumulates earlier stages and does not leak later manuscript into idea, world or outline', () => {
    const doc = emptyNovel('最初灵感')
    doc.outline = '完整大纲'
    const c = newChapter('章名')
    c.outline = '章节计划'
    c.content = '<p>后期正文</p>'
    doc.chapters = [c]
    doc.selectedChapterId = c.id
    const entries = [
      { id: 'p', type: 'character', title: '人物', content: '已确认人物' },
      { id: 'a', type: 'lore', title: '归档', content: '归档秘密', status: 'archived' },
    ] as Entry[]
    for (const task of ['idea', 'world'] as const) {
      const prompt = buildPrompt(task, doc, entries, '作者要求')
      expect(prompt.messages[1].content).toContain('最初灵感')
      for (const text of ['已确认人物', '完整大纲', '章节计划', '后期正文', '归档秘密'])
        expect(prompt.messages[1].content).not.toContain(text)
    }
    const outline = buildPrompt('outline', doc, entries, '').messages[1].content
    expect(outline).toContain('已确认人物')
    expect(outline).not.toContain('完整大纲')
    const chapters = buildPrompt('chapters', doc, entries, '').messages[1].content
    expect(chapters).toContain('完整大纲')
    expect(chapters).not.toContain('后期正文')
    expect(buildPrompt('write', doc, entries, '').messages[1].content).toContain('后期正文')
  })

  it('unlocks the journey in order and keeps early setting confirmation on page 02', () => {
    const doc = emptyNovel()
    expect(stageBlock(doc, [], 'world')).toContain('01')
    doc.idea = '想法'
    expect(stageBlock(doc, [], 'world')).toBe('')
    expect(stageBlock(doc, [], 'chapters')).toContain('02')
    const entries = [{ id: 'p', type: 'character', content: '', title: '人物' }] as Entry[]
    expect(stageBlock(doc, entries, 'outline')).toBe('')
    expect(stageBlock(doc, entries, 'chapters')).toContain('03')
    doc.outline = '大纲'
    expect(stageBlock(doc, entries, 'chapters')).toBe('')
    expect(stageBlock(doc, entries, 'write')).toContain('04')
    doc.chapters = [newChapter()]
    expect(stageBlock(doc, entries, 'review')).toContain('05')
    doc.chapters[0].content = '<p>正文</p>'
    expect(stageBlock(doc, entries, 'review')).toBe('')
    expect(stageBlock(doc, entries, 'canon')).toContain('06')
    doc.issues = [{ title: '手动问题', evidence: '', suggestion: '', resolved: false }]
    expect(stageBlock(doc, entries, 'canon')).toBe('')
    const next = applyGeneration(doc, candidate('world', '{"proposals":[]}'), entries)
    expect(next.step).toBe('world')
  })

  it('applies a summary to its original chapter and protects both manual summary and body edits', () => {
    const doc = emptyNovel()
    const chapter = newChapter('第一章')
    chapter.content = '<p>林获得线索</p>'
    chapter.summary = '手写摘要'
    doc.chapters = [chapter, newChapter('第二章')]
    doc.selectedChapterId = doc.chapters[1].id
    const g = {
      ...candidate('summary', '林获得新的线索。'),
      chapterId: chapter.id,
      baseContent: chapter.content,
      baseSummary: chapter.summary,
    }
    const next = applyGeneration(doc, g, [])
    expect(next.chapters[0].summary).toBe(g.text)
    expect(next.chapters[0].content).toBe(chapter.content)
    expect(next.chapters[1].summary).toBe('')
    expect(next.selectedChapterId).toBe(chapter.id)
    expect(restoreSnapshot(next, next.snapshots[0].id).chapters[0].summary).toBe('手写摘要')
    chapter.summary = '新的手写摘要'
    expect(() => applyGeneration(doc, g, [])).toThrow('正文或摘要')
    chapter.summary = g.baseSummary
    chapter.content = '<p>改过正文</p>'
    expect(() => applyGeneration(doc, g, [])).toThrow('正文或摘要')
  })

  it('keeps chapter-specific checks and legacy records, and rejects checks on changed or deleted chapters', () => {
    const doc = emptyNovel()
    doc.chapters = [newChapter('第一章'), newChapter('第二章')]
    doc.issues = [{ title: '旧版记录', evidence: '', suggestion: '', resolved: true }]
    const g = {
      ...candidate(
        'review',
        JSON.stringify({ issues: [{ title: '问题', evidence: '正文', suggestion: '核对' }], proposals: [] }),
      ),
      chapterId: doc.chapters[0].id,
      baseContent: '',
    }
    let next = applyGeneration(doc, g, [])
    next = applyGeneration(next, { ...g, id: 'second', chapterId: doc.chapters[1].id }, [])
    expect(next.issues.map((i) => i.chapterId)).toEqual([undefined, doc.chapters[0].id, doc.chapters[1].id])
    expect(next.issues[0].resolved).toBe(true)
    expect(next.selectedChapterId).toBe(doc.chapters[1].id)
    expect(() => validateNovel(next)).not.toThrow()
    doc.chapters[0].content = '<p>修改后</p>'
    expect(() => applyGeneration(doc, g, [])).toThrow('正文在检查后已修改')
    doc.chapters = []
    expect(() => applyGeneration(doc, g, [])).toThrow('原章节已删除')
  })

  it('caps snapshots while retaining the latest content', () => {
    let doc = emptyNovel()
    for (let i = 0; i < 25; i++) {
      doc.idea = String(i)
      doc = snapshot(doc, String(i))
    }
    expect(doc.snapshots).toHaveLength(20)
    expect(doc.snapshots[0].data.idea).toBe('24')
  })

  it('serializes saves and recovers the queue after a failed write', async () => {
    const events: string[] = []
    let release!: () => void
    const gate = new Promise<void>((r) => {
      release = r
    })
    const first = enqueueSave(async () => {
      events.push('first')
      await gate
      throw new Error('disk')
    })
    const failure = expect(first).rejects.toThrow('disk')
    const second = enqueueSave(async () => {
      events.push('second')
      return true
    })
    await Promise.resolve()
    expect(events).toEqual(['first'])
    release()
    await failure
    expect(await second).toBe(true)
    expect(events).toEqual(['first', 'second'])
  })
})
