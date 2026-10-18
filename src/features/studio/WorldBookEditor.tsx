import { useEffect, useRef, useState } from 'react'
import { Download, Plus, Search } from 'lucide-react'
import { t } from '@/lib/i18n'
import { generateId } from '@/lib/utils'
import { plainText } from '@/features/novel/model'
import type { Entry } from '@/types'
import type { BookEntry, StudioDocument } from './model'
import { st } from './homeModel'

type Filter = 'all' | 'enabled' | 'disabled' | 'constant'

export function WorldBookEditor({
  doc,
  change,
  sources,
  disabled,
  selectedId,
  select,
  onExport,
}: {
  doc: StudioDocument
  change: (update: (doc: StudioDocument) => StudioDocument) => void
  sources: Entry[]
  disabled: boolean
  selectedId?: string
  select: (id: string) => void
  onExport: () => void
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const directory = useRef<HTMLElement>(null)
  const matches = (entry: BookEntry, search: string, kind: Filter) =>
    (kind === 'all' ||
      (kind === 'enabled' && entry.enabled) ||
      (kind === 'disabled' && !entry.enabled) ||
      (kind === 'constant' && entry.constant)) &&
    `${entry.title}\n${entry.keys}\n${entry.content}`
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase())
  const visible = doc.book.filter((entry) => matches(entry, query, filter))
  const active = doc.book.find((entry) => entry.id === selectedId) || visible[0]
  const index = active ? doc.book.findIndex((entry) => entry.id === active.id) + 1 : 0
  useEffect(() => {
    directory.current?.querySelector('[aria-current]')?.scrollIntoView({ block: 'nearest' })
  }, [active?.id])
  const search = (value: string, kind = filter) => {
    setQuery(value)
    setFilter(kind)
    select(doc.book.find((entry) => matches(entry, value, kind))?.id || '')
  }
  const update = (patch: Partial<BookEntry>) => {
    if (!active) return
    select(active.id)
    change((d) => ({
      ...d,
      book: d.book.map((entry) => (entry.id === active.id ? { ...entry, ...patch } : entry)),
    }))
  }
  const reveal = (id: string) => {
    setQuery('')
    setFilter('all')
    select(id)
  }
  return (
    <section className="studio-card worldbook-workspace">
      <header className="worldbook-heading">
        <div>
          <h2>{t('世界书制作')}</h2>
          <p className="studio-muted">
            {st(
              '搜索标题、触发词或正文，选择条目后编辑。',
              'Search titles, keywords or content, then select an entry to edit.',
            )}
          </p>
        </div>
        <div className="studio-actions">
          <button
            disabled={disabled}
            onClick={() => {
              const id = generateId('book')
              change((d) => ({
                ...d,
                book: [
                  ...d.book,
                  { id, title: '', keys: '', content: '', enabled: true, constant: false, order: 100 },
                ],
              }))
              reveal(id)
            }}
          >
            <Plus size={15} />
            {t('新建世界书条目')}
          </button>
          <button
            disabled={disabled || !sources.some((e) => !doc.book.some((b) => b.id === 'book_' + e.id))}
            onClick={() => {
              const additions = sources
                .filter((e) => !doc.book.some((b) => b.id === 'book_' + e.id))
                .map((e) => ({
                  id: 'book_' + e.id,
                  title: e.title,
                  keys: e.title,
                  content: plainText(e.content) || e.summary,
                  enabled: true,
                  constant: false,
                  order: 100,
                }))
              change((d) => ({ ...d, book: [...d.book, ...additions] }))
              if (additions[0]) reveal(additions[0].id)
            }}
          >
            {t('从所选世界设定添加')}
          </button>
          <button disabled={disabled} onClick={onExport}>
            <Download size={15} />
            {t('导出世界书 JSON')}
          </button>
        </div>
      </header>
      <div className="worldbook-columns">
        <aside className="worldbook-directory" aria-label={st('世界书目录', 'World book directory')}>
          <label className="collection-search">
            <Search size={15} />
            <input
              type="search"
              aria-label={st('搜索世界书条目', 'Search world book entries')}
              placeholder={st('标题、触发词、正文', 'Title, keywords, content')}
              value={query}
              onChange={(e) => search(e.target.value)}
            />
          </label>
          <select
            aria-label={st('筛选世界书条目', 'Filter world book entries')}
            value={filter}
            onChange={(e) => search(query, e.target.value as Filter)}
          >
            <option value="all">{st('全部条目', 'All entries')}</option>
            <option value="enabled">{st('已启用', 'Enabled')}</option>
            <option value="disabled">{st('已停用', 'Disabled')}</option>
            <option value="constant">{t('常驻')}</option>
          </select>
          <small role="status">
            {st(
              `显示 ${visible.length} / ${doc.book.length} 条`,
              `Showing ${visible.length} / ${doc.book.length} entries`,
            )}
          </small>
          <nav
            ref={directory}
            className="worldbook-list"
            aria-label={st('选择世界书条目', 'Select world book entry')}
          >
            {visible.map((entry) => (
              <button
                key={entry.id}
                aria-current={active?.id === entry.id ? 'true' : undefined}
                onClick={() => select(entry.id)}
              >
                <strong>{entry.title || t('未命名条目')}</strong>
                <span>{entry.keys || st('未设置触发词', 'No keywords')}</span>
                <small>
                  {entry.enabled ? st('已启用', 'Enabled') : st('已停用', 'Disabled')}
                  {entry.constant ? ` · ${t('常驻')}` : ''} · {entry.order}
                </small>
              </button>
            ))}
            {!visible.length && (
              <p className="studio-muted">
                {doc.book.length
                  ? st('没有匹配的条目。', 'No matching entries.')
                  : st(
                      '世界书还是空的，先新建一个条目。',
                      'Your world book is empty. Create an entry to begin.',
                    )}
              </p>
            )}
          </nav>
          {(query || filter !== 'all') && (
            <button onClick={() => search('', 'all')}>{st('清除筛选', 'Clear filters')}</button>
          )}
        </aside>
        {active ? (
          <fieldset className="worldbook-detail" disabled={disabled}>
            <div className="worldbook-form">
              <h3 className="sr-only">{active.title || t('未命名条目')}</h3>
              {!visible.some((entry) => entry.id === active.id) && (
                <p className="studio-muted">
                  {st(
                    '当前编辑的条目不符合筛选条件，仍可继续编辑。',
                    'This entry no longer matches the filter. You can keep editing it.',
                  )}
                </p>
              )}
              <div className="studio-fields">
                <label>
                  {t('世界书标题')}
                  <input
                    aria-label={t('世界书标题 {0}', { 0: index })}
                    value={active.title}
                    onChange={(e) => update({ title: e.target.value })}
                  />
                </label>
                <label>
                  {t('触发词')}
                  <input
                    aria-label={t('触发词 {0}', { 0: index })}
                    value={active.keys}
                    onChange={(e) => update({ keys: e.target.value })}
                  />
                </label>
              </div>
              <label className="worldbook-content">
                {t('条目正文')}
                <textarea
                  aria-label={t('世界书正文 {0}', { 0: index })}
                  value={active.content}
                  rows={6}
                  onChange={(e) => update({ content: e.target.value })}
                />
              </label>
            </div>
            <div className="worldbook-options">
              <label className="studio-check">
                <input
                  type="checkbox"
                  checked={active.enabled}
                  onChange={(e) => update({ enabled: e.target.checked })}
                />
                {t('启用')}
              </label>
              <label className="studio-check">
                <input
                  type="checkbox"
                  checked={active.constant}
                  onChange={(e) => update({ constant: e.target.checked })}
                />
                {t('常驻')}
              </label>
              <label className="worldbook-order">
                {t('插入顺序')}
                <input
                  type="number"
                  aria-label={t('插入顺序 {0}', { 0: index })}
                  value={active.order}
                  onChange={(e) => update({ order: Number(e.target.value) })}
                />
              </label>
              <button
                className="worldbook-remove"
                onClick={() => {
                  const position = visible.findIndex((entry) => entry.id === active.id)
                  const next = visible[position + 1] || visible[position - 1]
                  change((d) => ({ ...d, book: d.book.filter((entry) => entry.id !== active.id) }))
                  select(next?.id || '')
                }}
              >
                {t('移除此世界书条目')}
              </button>
            </div>
            <details className="studio-muted worldbook-help">
              <summary>{st('触发与导出说明', 'Trigger and export help')}</summary>
              <p>{t('触发词用逗号分隔；常驻条目无需触发词。导出文件为明文，不包含 API 配置。')}</p>
            </details>
          </fieldset>
        ) : (
          <div className="worldbook-empty">
            <Search size={28} />
            <p>
              {st('从左侧选择条目，或新建一个条目。', 'Select an entry on the left, or create a new one.')}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
