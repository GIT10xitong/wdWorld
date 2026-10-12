import { FIELDS, type BookEntry, type Draft } from './model'
import { generateId } from '@/lib/utils'
export function keywords(value: string) {
  return value
    .split(/[,，\n]/)
    .map((k) => k.trim())
    .filter(Boolean)
}
function validateBook(book: BookEntry[]) {
  if (book.some((e) => !e.content.trim() || (!e.constant && e.enabled && !keywords(e.keys).length)))
    throw new Error('世界书条目需要正文；启用的关键词条目还需要触发词。')
}
export function characterCard(draft: Draft, book: BookEntry[]) {
  if (!draft.name.trim() || !draft.description.trim()) throw new Error('请填写角色卡名称与角色描述')
  validateBook(book)
  return {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: draft.name,
      description: draft.description,
      personality: draft.personality,
      scenario: draft.scenario,
      first_mes: draft.first_mes,
      mes_example: draft.mes_example,
      creator_notes: draft.creator_notes,
      system_prompt: draft.system_prompt || '',
      post_history_instructions: draft.post_history_instructions || '',
      alternate_greetings: (draft.alternate_greetings || '')
        .split(/\n---\n/)
        .map((s) => s.trim())
        .filter(Boolean),
      tags: keywords(draft.tags || ''),
      creator: draft.creator || '',
      character_version: draft.character_version || '1.0',
      extensions: draft.extensions ? JSON.parse(draft.extensions) : {},
      character_book: {
        name: draft.name + ' · 世界书',
        extensions: {},
        entries: book.map((e, i) => ({
          ...e.source,
          id: i,
          keys: keywords(e.keys),
          content: e.content,
          name: e.title,
          comment: e.title,
          enabled: e.enabled,
          constant: e.constant,
          insertion_order: e.order,
          position:
            e.source?.position === 'after_char' || e.source?.position === 1 ? 'after_char' : 'before_char',
          selective: e.source?.selective === true,
          secondary_keys: e.source?.secondary_keys ?? e.source?.keysecondary ?? [],
          extensions: e.source?.extensions ?? {},
        })),
      },
    },
  }
}

const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback)
const list = (v: unknown) => (Array.isArray(v) && v.every((k) => typeof k === 'string') ? v : [])

export function importBook(value: unknown): BookEntry[] {
  if (!object(value) || !value.entries || typeof value.entries !== 'object')
    throw new Error('世界书 JSON 格式无效')
  const entries = Object.values(value.entries)
  if (entries.length > 500) throw new Error('世界书最多导入 500 条')
  return entries.map((v) => {
    if (!object(v) || typeof v.content !== 'string') throw new Error('世界书 JSON 格式无效')
    return {
      id: generateId('book'),
      title: text(v.name, text(v.comment)),
      keys: list(v.keys ?? v.key).join(', '),
      content: v.content,
      enabled: typeof v.enabled === 'boolean' ? v.enabled : v.disable !== true,
      constant: v.constant === true,
      order: Number.isFinite(v.insertion_order ?? v.order) ? (v.insertion_order ?? v.order) : 100,
      source: v,
    }
  })
}

export function importCard(value: unknown): { draft: Draft; book: BookEntry[] } {
  if (!object(value)) throw new Error('角色卡 JSON 格式无效')
  if (value.spec && value.spec !== 'chara_card_v2') throw new Error('仅支持 V2 或旧版角色卡 JSON')
  const data = value.spec === 'chara_card_v2' ? value.data : value
  if (!object(data) || typeof data.name !== 'string' || typeof data.description !== 'string')
    throw new Error('角色卡 JSON 格式无效')
  const draft: Draft = Object.fromEntries(Object.keys(FIELDS.tavern).map((k) => [k, text(data[k])]))
  for (const key of ['system_prompt', 'post_history_instructions', 'creator', 'character_version'])
    draft[key] = text(data[key])
  draft.alternate_greetings = list(data.alternate_greetings).join('\n---\n')
  draft.tags = list(data.tags).join(', ')
  draft.extensions = JSON.stringify(object(data.extensions) ? data.extensions : {})
  return { draft, book: data.character_book ? importBook(data.character_book) : [] }
}

export function activatedBook(book: BookEntry[], input: string) {
  return book
    .filter(
      (b) =>
        b.enabled &&
        (b.constant || keywords(b.keys).some((k) => input.toLowerCase().includes(k.toLowerCase()))),
    )
    .sort((a, b) => a.order - b.order)
}
export function worldBook(book: BookEntry[]) {
  if (!book.length) throw new Error('请先添加世界书条目')
  validateBook(book)
  return {
    entries: Object.fromEntries(
      book.map((e, i) => [
        i,
        {
          ...e.source,
          uid: i,
          key: keywords(e.keys),
          keysecondary: e.source?.keysecondary ?? e.source?.secondary_keys ?? [],
          comment: e.title,
          content: e.content,
          constant: e.constant,
          selective: e.source?.selective === true,
          order: e.order,
          position:
            typeof e.source?.position === 'number'
              ? e.source.position
              : e.source?.position === 'after_char'
                ? 1
                : 0,
          disable: !e.enabled,
          probability: e.source?.probability ?? 100,
          useProbability: e.source?.useProbability ?? true,
          excludeRecursion: e.source?.excludeRecursion ?? false,
          preventRecursion: e.source?.preventRecursion ?? false,
          delayUntilRecursion: e.source?.delayUntilRecursion ?? false,
        },
      ]),
    ),
  }
}
