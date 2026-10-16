import { emptyStudio, parseDraft, type Draft } from './model'
import { readWorldSettings, type WorldSetting } from './worldSettings'
import { plainText } from '@/features/novel/model'
import { generateId } from '@/lib/utils'
import { t, getLanguage } from '@/lib/i18n'
import { modeResources } from '@/features/plugins/store'

export interface TrpgModule {
  id: string
  draft: Draft
  settings: WorldSetting[]
}
export function moduleFile(draft: Draft, settings: WorldSetting[]) {
  return { spec: 'wdworld_trpg', version: 1, draft: { ...draft, sessionLog: '' }, settings }
}
export function importModule(text: string, filename: string): TrpgModule {
  if (text.length > 2 * 1024 * 1024) throw new Error(t('跑团资料不能超过 2 MB'))
  let draft: Draft = { ...emptyStudio().drafts.trpg, name: filename.replace(/\.[^.]+$/, '') }
  let settings: WorldSetting[] = []
  if (/\.json$/i.test(filename)) {
    const data = JSON.parse(text)
    if (data?.spec === 'wdworld_trpg' && data.version === 1) {
      draft = parseDraft('trpg', JSON.stringify(data.draft))
      settings = readWorldSettings(data.settings)
    } else if (Array.isArray(data?.entries)) {
      settings = readWorldSettings(
        data.entries
          .filter((e: { status?: string }) => e.status !== 'archived')
          .map((e: { type: string; title: string; content: string }) => ({
            type: e.type,
            title: e.title,
            content: plainText(e.content),
          })),
      )
      draft.name = typeof data.project?.name === 'string' ? data.project.name : draft.name
      draft.scenes = settings.map((s) => `${s.title}\n${s.content}`).join('\n\n')
    } else throw new Error(t('请选择 TRPG 副本 JSON 或世界观导出 JSON'))
  } else if (/\.(txt|md|markdown)$/i.test(filename)) {
    draft.scenes = text
  } else throw new Error(t('支持 JSON、TXT 和 Markdown 文件'))
  draft.sessionLog = ''
  return { id: generateId('module'), draft, settings }
}
// Adventure resources are installed with the mode package, not bundled in the app.
export function trpgPresets(): TrpgModule[] {
  const presets = modeResources('trpg')?.presets || []
  return presets.map((p, i) => ({
    id: 'preset-' + i,
    draft: { ...emptyStudio().drafts.trpg, ...p[getLanguage() === 'en' ? 'en' : 'zh'] },
    settings: [],
  }))
}
