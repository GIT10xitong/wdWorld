import { useState } from 'react'
import { useStore } from '@/store'
import type { Database } from '@/lib/storage/database'
import type { EntryType } from '@/types'
import { ENTRY_TYPE_LABELS } from '@/types'
import type { NovelDocument } from './model'
import { novelSources } from './loreLinks'
import { nt } from './workbench'

export function LoreLinks({
  doc,
  database,
  projectId,
  change,
  flush,
  onWorld,
  onBusy,
}: {
  doc: NovelDocument
  database: Database
  projectId: string
  change: (fn: (d: NovelDocument) => NovelDocument) => void
  flush: () => Promise<void>
  onWorld: () => void
  onBusy: (value: boolean) => void
}) {
  const [selected, setSelected] = useState(''),
    [query, setQuery] = useState(''),
    [title, setTitle] = useState(''),
    [type, setType] = useState<EntryType>('note'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const sources = novelSources(doc),
    source = sources.find((s) => s.key === selected) || sources[0]
  const link = source && doc.worldLinks?.[source.key]
  const entries = useStore((s) => s.entries),
    entry = entries.find((e) => e.id === link?.entryId)
  const act = async (fn: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    onBusy(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e)
      setError(
        detail === 'Source changed; preview again'
          ? nt('资料已变化，请重新预览后同步。', detail)
          : detail === 'World entry changed or removed; preserve edits and unlink before creating a new copy'
            ? nt('世界观条目已被修改、归档或删除。已保留原有修改，可解除关联后新建副本。', detail)
            : detail === 'Invalid lore link'
              ? nt('请检查条目名称、类型及资料长度。资料上限为 100 万字符。', detail)
              : detail,
      )
    } finally {
      setBusy(false)
      onBusy(false)
    }
  }
  return (
    <section className="desk-paper">
      <h2>{nt('本书资料与世界观联动', 'Connect book material to world lore')}</h2>
      <p>
        {nt(
          '故事规划、章节、卡片、作者记忆和工具结果均可同步到本书世界观。默认作为资料笔记；人物和规则请核对后选择对应类型。同步不会覆盖已被手动修改的条目。',
          'Sync plans, chapters, cards, author memory and tool results into this book’s world. Reference notes are the default; choose a lore type after review. Manual edits are protected.',
        )}
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="lore-link-grid">
        <aside>
          <input
            aria-label={nt('搜索关联资料', 'Search linked material')}
            placeholder={nt('搜索资料…', 'Search material…')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="lore-link-list">
            {sources
              .filter((s) => s.title.toLowerCase().includes(query.toLowerCase()))
              .map((s) => (
                <button
                  key={s.key}
                  disabled={busy}
                  aria-pressed={s.key === source?.key}
                  onClick={() => {
                    setSelected(s.key)
                    setTitle('')
                    setType('note')
                    setError('')
                  }}
                >
                  {s.title}
                  <small>{doc.worldLinks?.[s.key] ? nt(' · 已关联', ' · Linked') : ''}</small>
                </button>
              ))}
          </div>
        </aside>
        {source ? (
          <div className="lore-link-preview">
            <h3>{source.title}</h3>
            <pre>{source.content}</pre>
            <label>
              {nt('世界观条目名称', 'World entry title')}
              <input
                aria-label={nt('世界观条目名称', 'World entry title')}
                maxLength={200}
                disabled={busy}
                value={title || link?.entryTitle || source.title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label>
              {nt('条目类型', 'Entry type')}
              <select
                aria-label={nt('同步条目类型', 'Linked entry type')}
                value={entry?.type || type}
                disabled={busy || !!link}
                onChange={(e) => setType(e.target.value as EntryType)}
              >
                {(['note', 'character', 'lore', 'event', 'location', 'faction', 'item'] as const).map(
                  (key) => (
                    <option value={key} key={key}>
                      {ENTRY_TYPE_LABELS[key]}
                    </option>
                  ),
                )}
              </select>
            </label>
            {link && (
              <p>
                {link.sourceText === source.content
                  ? nt('资料与上次同步内容一致。', 'Material matches the last sync.')
                  : nt('资料已更新，可以预览后同步。', 'Material has changed; review and sync again.')}{' '}
                {entry?.status === 'proposed' &&
                  nt('世界观条目仍待作者确认。', 'The world entry awaits author confirmation.')}
              </p>
            )}
            <button
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  const next = await database.syncNovelSource(projectId, source.key, source.content, {
                    title: (title || link?.entryTitle || source.title).slice(0, 200),
                    type,
                    confirmed: true,
                  })
                  change(() => next)
                  await useStore.getState().fetchEntries()
                  await flush()
                  if (useStore.getState().saveStatus === 'error')
                    throw new Error(
                      nt('同步已保留在当前会话，请重试保存', 'Sync is in this session; retry saving'),
                    )
                })
              }
            >
              {nt('确认同步到世界观', 'Confirm sync to world')}
            </button>
            {entry && (
              <button
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    await flush()
                    if (useStore.getState().saveStatus === 'error') return
                    useStore.getState().selectEntry(entry.id)
                    onWorld()
                  })
                }
              >
                {nt('打开关联设定', 'Open linked lore')}
              </button>
            )}
            {link && (
              <button
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      nt('解除关联会保留世界观条目。继续？', 'Unlink while keeping the world entry?'),
                    )
                  )
                    change((d) => {
                      const worldLinks = { ...d.worldLinks }
                      delete worldLinks[source.key]
                      return { ...d, worldLinks }
                    })
                }}
              >
                {nt('解除关联，保留条目', 'Unlink and keep entry')}
              </button>
            )}
          </div>
        ) : (
          <p>{nt('先填写故事想法或建立创作资料。', 'Write a story idea or add creative material first.')}</p>
        )}
      </div>
    </section>
  )
}
