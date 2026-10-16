import { t } from '@/lib/i18n'
import { generateId } from '@/lib/utils'
import { validWorkbench, type Workbench } from './workbench'

export type NovelStep = 'idea' | 'world' | 'outline' | 'chapters' | 'write' | 'review' | 'canon'
export type AITask = 'idea' | 'world' | 'outline' | 'chapters' | 'write' | 'rewrite' | 'summary' | 'review'
export interface Chapter {
  id: string
  title: string
  volume: string
  outline: string
  content: string
  summary: string
  entryIds: string[]
  status: 'draft' | 'complete'
}
export interface SettingProposal {
  pendingEntryId?: string
  pendingBaseContent?: string
  id: string
  type: 'character' | 'lore'
  title: string
  content: string
  targetEntryId?: string
  baseContent?: string
  appliedEntryId?: string
  previousContent?: string
  appliedContent?: string
  evidence: string
  status: 'pending' | 'accepted' | 'rejected' | 'reverted'
}
export interface ReviewIssue {
  chapterId?: string
  createdAt?: string
  title: string
  evidence: string
  suggestion: string
  resolved: boolean
}
export interface Generation {
  worldEntryIds?: string[]
  id: string
  task: AITask
  chapterId: string | null
  instruction: string
  text: string
  createdAt: string
  status: 'ready' | 'applied' | 'discarded' | 'interrupted'
  baseContent?: string
  baseSummary?: string
  entryContents?: Record<string, string>
  contextDigest?: string
}
export interface NovelContent {
  workbench?: Workbench
  instructions?: Partial<Record<NovelStep, string>>
  seeds?: Partial<Record<NovelStep, string>>
  worldDraft?: { type: 'character' | 'lore'; title: string; content: string }
  idea: string
  genre: string
  style: string
  outline: string
  chapters: Chapter[]
  proposals: SettingProposal[]
  issues: ReviewIssue[]
}
export interface NovelDocument extends NovelContent {
  worldLinks?: Record<string, import('./loreLinks').NovelWorldLink>
  activity?: import('./activity').WritingDay[]
  version: 1
  step: NovelStep
  selectedChapterId: string | null
  generations: Generation[]
  snapshots: { id: string; label: string; createdAt: string; data: NovelContent }[]
}
export const STEPS: { id: NovelStep; label: string; hint: string }[] = [
  {
    id: 'idea',
    get label() {
      return t('故事想法')
    },
    get hint() {
      return t('从一句话开始')
    },
  },
  {
    id: 'world',
    get label() {
      return t('人物与规则')
    },
    get hint() {
      return t('建立故事的根基')
    },
  },
  {
    id: 'outline',
    get label() {
      return t('故事大纲')
    },
    get hint() {
      return t('安排冲突与转折')
    },
  },
  {
    id: 'chapters',
    get label() {
      return t('拆分章节')
    },
    get hint() {
      return t('让情节逐章展开')
    },
  },
  {
    id: 'write',
    get label() {
      return t('辅助写作')
    },
    get hint() {
      return t('写下你的故事')
    },
  },
  {
    id: 'review',
    get label() {
      return t('检查矛盾')
    },
    get hint() {
      return t('核对已选设定与正文')
    },
  },
  {
    id: 'canon',
    get label() {
      return t('确认设定')
    },
    get hint() {
      return t('由你决定故事事实')
    },
  },
]
export function emptyNovel(idea = ''): NovelDocument {
  return {
    version: 1,
    step: 'idea',
    idea,
    genre: '',
    style: '',
    outline: '',
    chapters: [],
    proposals: [],
    issues: [],
    selectedChapterId: null,
    generations: [],
    snapshots: [],
  }
}

export function validateNovel(value: unknown): asserts value is NovelDocument {
  const fail = () => {
    throw new Error('小说备份格式无效')
  }
  const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v)
  const strings = (v: Record<string, any>, keys: string[]) => keys.every((key) => typeof v[key] === 'string')
  if (
    object(value) &&
    value.worldLinks !== undefined &&
    (!object(value.worldLinks) ||
      Object.keys(value.worldLinks).length > 2000 ||
      !Object.entries(value.worldLinks).every(
        ([key, link]) =>
          key.length <= 250 &&
          object(link) &&
          strings(link, ['entryId', 'sourceText', 'entryContent', 'entryTitle']) &&
          link.entryId.length <= 200 &&
          link.sourceText.length <= 1000000 &&
          link.entryContent.length <= 2000000 &&
          link.entryTitle.length <= 200,
      ))
  )
    fail()
  if (
    object(value) &&
    value.activity !== undefined &&
    (!Array.isArray(value.activity) ||
      value.activity.length > 366 ||
      !value.activity.every(
        (d: any) =>
          object(d) &&
          /^\d{4}-\d{2}-\d{2}$/.test(d.date) &&
          ['manual', 'ai'].every((k) => Number.isSafeInteger(d[k]) && d[k] >= 0),
      ))
  )
    fail()
  const content = (v: unknown): boolean => {
    if (!object(v) || !strings(v, ['idea', 'genre', 'style', 'outline'])) return false
    if (v.workbench !== undefined && !validWorkbench(v.workbench)) return false
    if (
      v.seeds !== undefined &&
      (!object(v.seeds) || !Object.values(v.seeds).every((s) => typeof s === 'string' && s.length <= 80))
    )
      return false
    if (
      v.instructions !== undefined &&
      (!object(v.instructions) || !Object.values(v.instructions).every((s) => typeof s === 'string'))
    )
      return false
    if (
      v.worldDraft !== undefined &&
      (!object(v.worldDraft) ||
        !strings(v.worldDraft, ['title', 'content']) ||
        !['character', 'lore'].includes(v.worldDraft.type))
    )
      return false
    if (!Array.isArray(v.chapters) || !Array.isArray(v.proposals) || !Array.isArray(v.issues)) return false
    const ids = new Set()
    if (
      !v.chapters.every((c: unknown) => {
        if (
          !object(c) ||
          !strings(c, ['id', 'title', 'volume', 'outline', 'content', 'summary']) ||
          !Array.isArray(c.entryIds) ||
          !c.entryIds.every((id: unknown) => typeof id === 'string') ||
          !['draft', 'complete'].includes(c.status) ||
          ids.has(c.id)
        )
          return false
        ids.add(c.id)
        return true
      })
    )
      return false
    return (
      v.proposals.every(
        (p: unknown) =>
          object(p) &&
          strings(p, ['id', 'title', 'content', 'evidence']) &&
          ['character', 'lore'].includes(p.type) &&
          ['pending', 'accepted', 'rejected', 'reverted'].includes(p.status),
      ) &&
      v.issues.every(
        (i: unknown) =>
          object(i) &&
          strings(i, ['title', 'evidence', 'suggestion']) &&
          typeof i.resolved === 'boolean' &&
          (i.chapterId === undefined || typeof i.chapterId === 'string') &&
          (i.createdAt === undefined || typeof i.createdAt === 'string'),
      )
    )
  }
  if (!object(value) || value.version !== 1 || !content(value)) return fail()
  if (
    !STEPS.some((s) => s.id === value.step) ||
    !(value.selectedChapterId === null || typeof value.selectedChapterId === 'string')
  )
    return fail()
  if (
    !Array.isArray(value.snapshots) ||
    !value.snapshots.every(
      (s: unknown) => object(s) && strings(s, ['id', 'label', 'createdAt']) && content(s.data),
    )
  )
    return fail()
  if (
    !Array.isArray(value.generations) ||
    !value.generations.every(
      (g: unknown) =>
        object(g) &&
        strings(g, ['id', 'instruction', 'text', 'createdAt']) &&
        (g.worldEntryIds === undefined ||
          (Array.isArray(g.worldEntryIds) &&
            g.worldEntryIds.every((id: unknown) => typeof id === 'string'))) &&
        ['idea', 'world', 'outline', 'chapters', 'write', 'rewrite', 'summary', 'review'].includes(g.task) &&
        ['ready', 'applied', 'discarded', 'interrupted'].includes(g.status),
    )
  )
    return fail()
}
export function newChapter(title = '未命名章节'): Chapter {
  return {
    id: generateId('chapter'),
    title,
    get volume() {
      return t('第一卷')
    },
    outline: '',
    content: '',
    summary: '',
    entryIds: [],
    status: 'draft',
  }
}
export function snapshot(doc: NovelDocument, label: string): NovelDocument {
  const { idea, genre, style, outline, chapters, proposals, issues, instructions, worldDraft, seeds } = doc
  return {
    ...doc,
    snapshots: [
      {
        id: generateId('version'),
        label,
        createdAt: new Date().toISOString(),
        data: structuredClone({
          idea,
          genre,
          style,
          outline,
          chapters,
          proposals,
          issues,
          instructions,
          seeds,
          worldDraft,
        }),
      },
      ...doc.snapshots,
    ].slice(0, 20),
  }
}
export function restoreSnapshot(doc: NovelDocument, id: string): NovelDocument {
  const found = doc.snapshots.find((s) => s.id === id)
  if (!found) throw new Error('版本不存在')
  return {
    ...snapshot(doc, '恢复前的内容'),
    ...structuredClone(found.data),
    proposals: doc.proposals,
    selectedChapterId: found.data.chapters[0]?.id ?? null,
  }
}
export function textToHtml(text: string): string {
  return text
    .split(/\n+/)
    .filter(Boolean)
    .map(
      (line) =>
        `<p>${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')}</p>`,
    )
    .join('')
}
export function plainText(html: string): string {
  return html
    .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .trim()
}
export function parseResult(text: string): Record<string, unknown> {
  const raw = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
  const result: unknown = JSON.parse(raw)
  if (!result || typeof result !== 'object' || Array.isArray(result))
    throw new Error('AI 返回的内容不是有效对象，请重新生成。')
  return result as Record<string, unknown>
}
export function readProposals(value: unknown): SettingProposal[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error('设定建议格式不正确')
  return value.map((item) => {
    if (
      !item ||
      typeof item !== 'object' ||
      !['character', 'lore'].includes(item.type) ||
      typeof item.title !== 'string' ||
      !item.title.trim() ||
      typeof item.content !== 'string' ||
      !item.content.trim()
    )
      throw new Error('每条设定必须包含类型、名称和内容')
    return {
      id: generateId('proposal'),
      type: item.type,
      title: item.title,
      content: item.content,
      targetEntryId: typeof item.targetEntryId === 'string' ? item.targetEntryId : undefined,
      evidence: typeof item.evidence === 'string' ? item.evidence : '',
      status: 'pending',
    }
  })
}
export function readChapters(value: unknown): Chapter[] {
  if (!Array.isArray(value) || !value.length || value.length > 100)
    throw new Error('章节列表格式不正确（应为 1–100 章）')
  return value.map((item) => {
    if (!item || typeof item.title !== 'string' || !item.title.trim() || typeof item.outline !== 'string')
      throw new Error('章节必须包含标题与大纲')
    return {
      ...newChapter(item.title),
      outline: item.outline,
      volume: typeof item.volume === 'string' ? item.volume : '第一卷',
    }
  })
}
export function readIssues(value: unknown): ReviewIssue[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error('检查结果格式不正确')
  return value.map((item) => {
    if (
      !item ||
      typeof item.title !== 'string' ||
      typeof item.evidence !== 'string' ||
      typeof item.suggestion !== 'string'
    )
      throw new Error('矛盾检查缺少出处或建议')
    return { title: item.title, evidence: item.evidence, suggestion: item.suggestion, resolved: false }
  })
}

export function applyGeneration(
  doc: NovelDocument,
  generation: Generation,
  entries: { id: string; content: string }[],
): NovelDocument {
  if (generation.status !== 'ready') throw new Error('该结果已处理或未完整生成')
  let next = snapshot(doc, '采纳 AI 结果前')
  const addProposals = (value: unknown) =>
    readProposals(value).map((p, i) => {
      const target = p.targetEntryId ? entries.find((e) => e.id === p.targetEntryId) : undefined
      if (p.targetEntryId && !target) throw new Error('建议引用了不存在的设定，请重新生成')
      const baseContent = target ? (generation.entryContents?.[target.id] ?? target.content) : undefined
      if (target && baseContent !== target.content)
        throw new Error('设定在生成后已修改，请重新检查后再采纳建议')
      return {
        ...p,
        baseContent,
        pendingEntryId: generation.worldEntryIds?.[i],
        pendingBaseContent: generation.worldEntryIds?.[i]
          ? entries.find((e) => e.id === generation.worldEntryIds![i])?.content
          : undefined,
      }
    })
  switch (generation.task) {
    case 'idea':
      if (generation.baseContent !== undefined && doc.idea !== generation.baseContent)
        throw new Error('故事想法在生成后已修改，请重新生成或手动复制候选内容')
      next = { ...next, idea: generation.text, step: 'idea' }
      break
    case 'world':
      next = {
        ...next,
        proposals: [...next.proposals, ...addProposals(parseResult(generation.text).proposals)],
        step: 'world',
      }
      break
    case 'outline':
      if (generation.baseContent !== undefined && doc.outline !== generation.baseContent)
        throw new Error('大纲在生成后已修改，请复制候选内容或重新生成，避免覆盖你的修改')
      next = { ...next, outline: generation.text }
      break
    case 'chapters': {
      const chapters = readChapters(parseResult(generation.text).chapters)
      next = {
        ...next,
        chapters: [...next.chapters, ...chapters],
        selectedChapterId: chapters[0].id,
        step: 'chapters',
      }
      break
    }
    case 'write':
    case 'rewrite': {
      const chapter = doc.chapters.find((c) => c.id === generation.chapterId)
      if (!chapter) throw new Error('原章节已删除，无法采纳')
      if (generation.baseContent !== undefined && chapter.content !== generation.baseContent)
        throw new Error('正文在生成后已修改，请复制候选内容或重新生成，避免覆盖你的修改')
      next = {
        ...next,
        chapters: next.chapters.map((c) =>
          c.id === chapter.id
            ? { ...c, content: (generation.task === 'write' ? c.content : '') + textToHtml(generation.text) }
            : c,
        ),
        selectedChapterId: chapter.id,
        step: 'write',
      }
      break
    }
    case 'summary': {
      const chapter = doc.chapters.find((c) => c.id === generation.chapterId)
      if (!chapter) throw new Error('原章节已删除，无法采纳摘要')
      if (chapter.content !== generation.baseContent || chapter.summary !== generation.baseSummary)
        throw new Error('正文或摘要在生成后已修改，请重新生成，避免覆盖你的修改')
      next = {
        ...next,
        chapters: next.chapters.map((c) => (c.id === chapter.id ? { ...c, summary: generation.text } : c)),
        selectedChapterId: chapter.id,
        step: 'write',
      }
      break
    }
    case 'review': {
      const chapter = doc.chapters.find((c) => c.id === generation.chapterId)
      if (!chapter) throw new Error('原章节已删除，无法保留检查结果')
      if (generation.baseContent !== undefined && chapter.content !== generation.baseContent)
        throw new Error('正文在检查后已修改，请重新检查当前内容')
      const result = parseResult(generation.text)
      next = {
        ...next,
        issues: [
          ...next.issues,
          ...readIssues(result.issues).map((issue) => ({
            ...issue,
            chapterId: chapter.id,
            createdAt: generation.createdAt,
          })),
        ],
        proposals: [...next.proposals, ...addProposals(result.proposals)],
        step: 'review',
        selectedChapterId: chapter.id,
      }
      break
    }
  }
  return {
    ...next,
    generations: next.generations.map((g) => (g.id === generation.id ? { ...g, status: 'applied' } : g)),
  }
}
