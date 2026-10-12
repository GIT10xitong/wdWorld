import type { EntryType } from '@/types'
import { t } from '@/lib/i18n'
import { FIELDS, jsonResult, type Draft, type StudioMode, type BookEntry } from './model'

export interface WorldSetting {
  type: EntryType
  title: string
  content: string
}
export function readWorldSettings(value: unknown): WorldSetting[] {
  if (!Array.isArray(value) || value.length > 60) throw new Error('世界设定列表格式无效')
  return value.map((v) => {
    if (
      !v ||
      !['character', 'location', 'faction', 'item', 'event', 'lore'].includes(v.type) ||
      typeof v.title !== 'string' ||
      !v.title.trim() ||
      typeof v.content !== 'string' ||
      !v.content.trim()
    )
      throw new Error('世界设定必须包含类型、名称和正文')
    return { type: v.type, title: v.title.trim(), content: v.content }
  })
}
export function draftWorldSettings(
  mode: Exclude<StudioMode, 'simulation'>,
  draft: Draft,
  text: string,
  book: BookEntry[],
): WorldSetting[] {
  const supplied = jsonResult(text).world_settings
  const result: WorldSetting[] = supplied === undefined ? [] : readWorldSettings(supplied)
  if (mode === 'oc' || mode === 'tavern') {
    const content = Object.entries(FIELDS[mode])
      .filter(([k]) => k !== 'name' && k !== 'creator_notes')
      .map(([k, label]) => (draft[k]?.trim() ? `${label}\n${draft[k]}` : ''))
      .filter(Boolean)
      .join('\n\n')
    if (content) result.push({ type: 'character', title: draft.name.trim() || t('未命名角色'), content })
  } else {
    const groups: [string, EntryType][] = [
      ['premise', 'lore'],
      ['system', 'lore'],
      ['hooks', 'event'],
      ['scenes', 'location'],
      ['npcs', 'character'],
      ['clues', 'lore'],
      ['encounters', 'event'],
      ['secrets', 'lore'],
    ]
    for (const [key, type] of groups)
      if (draft[key]?.trim())
        result.push({
          type,
          title: `${draft.name || t('TRPG 团务')} · ${FIELDS.trpg[key as keyof typeof FIELDS.trpg]}`,
          content: draft[key],
        })
  }
  if (mode === 'tavern')
    for (const b of book)
      if (b.content.trim())
        result.push({ type: 'lore', title: b.title || b.keys || t('世界书条目'), content: b.content })
  return result
}
