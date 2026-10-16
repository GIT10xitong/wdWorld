import { useEffect, useState } from 'react'
import { BookOpen, Feather, Lightbulb, TrendingUp, BarChart3, ArrowUpRight, Check } from 'lucide-react'
import { Database, loadProjectData } from '@/lib/storage/database'
import { manuscriptWords, writingSeries, type WritingDay } from './activity'
import { nt } from './workbench'
import type { useNotebook } from './useNotebook'
export interface HomeBook {
  id: string
  name: string
  updatedAt: string
}
type Summary = { words: number; genre: string; description: string; activity: WritingDay[] }
export function Dashboard({
  books,
  openBook,
  newBook,
  allBooks,
  openNotes,
  notebook,
  notesOnly,
  busy,
  error,
}: {
  books: HomeBook[]
  openBook: (id: string) => void
  newBook: () => void
  allBooks: () => void
  openNotes: () => void
  notebook: ReturnType<typeof useNotebook>
  notesOnly: boolean
  busy: boolean
  error: string
}) {
  const [stats, setStats] = useState<Record<string, Summary>>({}),
    [loading, setLoading] = useState(true),
    [readError, setReadError] = useState(false)
  useEffect(() => {
    let alive = true
    setLoading(true)
    setReadError(false)
    setStats({})
    void (async () => {
      for (const book of books) {
        if (!alive) break
        const db = new Database()
        try {
          const saved = await loadProjectData(book.id)
          if (!saved) throw new Error('missing')
          await db.importDatabase(saved.dbData)
          const doc = db.getNovel(book.id)
          if (alive)
            setStats((s) => ({
              ...s,
              [book.id]: {
                words: manuscriptWords(doc),
                genre: doc.genre,
                description: doc.idea,
                activity: doc.activity || [],
              },
            }))
        } catch {
          if (alive) setReadError(true)
        } finally {
          db.close()
        }
      }
      if (alive) setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [books])
  const series = writingSeries(Object.values(stats).flatMap((s) => s.activity)),
    today = series[13],
    total = series.reduce((n, d) => n + d.manual + d.ai, 0),
    max = Math.max(1, ...series.map((d) => d.manual + d.ai)),
    goal = notebook.data.goal
  let streak = 0
  for (let i = 13; i >= 0; i--) {
    if (!series[i].manual && !series[i].ai) break
    streak++
  }
  const ranked = books
    .filter((b) => stats[b.id])
    .sort((a, b) => stats[b.id].words - stats[a.id].words)
    .slice(0, 5)
  const hour = new Date().getHours()
  const jot = (
    <>
      <textarea
        aria-label={nt('灵感速记', 'Quick idea')}
        placeholder={nt('点滴灵感，先记在这里……', 'A line, a scene, a what-if…')}
        maxLength={5000}
        disabled={!notebook.ready || busy}
        value={notebook.data.draft}
        onChange={(e) => notebook.change((d) => ({ ...d, draft: e.target.value }))}
      />
      <button
        className="dash-note-save"
        disabled={!notebook.ready || !notebook.data.draft.trim() || notebook.data.notes.length >= 200}
        onClick={() => void notebook.add().catch(() => {})}
      >
        {nt('记下来', 'Keep this idea')}
      </button>
      <small role="status">
        {notebook.dirty
          ? nt('待保存 · 每 10 秒自动保存', 'Unsaved · Autosaves every 10s')
          : nt('灵感保存在本机', 'Ideas saved locally')}
      </small>
    </>
  )
  return (
    <section className="dash-main">
      <header className="dash-welcome">
        <div>
          <span className="dash-eyebrow">WD WORLD / NOVEL STUDIO</span>
          <h1>
            {notesOnly
              ? nt('每一个好故事，都始于一闪念。', 'Every story begins with a spark.')
              : nt(
                  `${hour < 11 ? '上午好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好'}，写一点什么再忙别的。`,
                  'Make a little room for your story.',
                )}
          </h1>
          <p>
            {notesOnly
              ? nt('跨作品收集灵感，随时记下新的想法。', 'A notebook for ideas across all your books.')
              : nt(
                  '选择一本作品继续写作，或记录今天的新灵感。',
                  'Pick a book to continue writing, or capture a new idea.',
                )}
          </p>
        </div>
        <button onClick={allBooks}>
          {nt('全部作品', 'All books')} <ArrowUpRight size={14} />
        </button>
      </header>
      {notebook.error && (
        <p className="dash-error" role="alert">
          {notebook.error}
        </p>
      )}
      {error && (
        <p className="dash-error" role="alert">
          {error}
        </p>
      )}
      {notesOnly ? (
        <>
          <section className="dash-card dash-notebook">
            <h2>
              <Lightbulb size={16} />
              {nt('灵感便笺', 'Idea notebook')}
              <small>{notebook.data.notes.length}/200</small>
            </h2>
            {jot}
            <button
              onClick={() => {
                const blob = new Blob([JSON.stringify(notebook.data, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob),
                  a = document.createElement('a')
                a.href = url
                a.download = 'wdworld-ideas.json'
                a.click()
                setTimeout(() => URL.revokeObjectURL(url), 1000)
              }}
            >
              {nt('导出便笺备份（明文）', 'Export notes (plaintext)')}
            </button>
          </section>
          <div className="dash-notes-grid">
            {notebook.data.notes.map((n) => (
              <article className="dash-card" key={n.id}>
                <small>{new Date(n.createdAt).toLocaleString()}</small>
                <p>{n.text}</p>
                <button
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(nt('删除这条便笺？', 'Delete this note?'))) {
                      notebook.change((d) => ({ ...d, notes: d.notes.filter((x) => x.id !== n.id) }))
                      void notebook.flush().catch(() => {})
                    }
                  }}
                >
                  {nt('删除', 'Delete')}
                </button>
              </article>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="dash-top-grid">
            <section className="dash-card dash-recent">
              <h2>
                <BookOpen size={16} />
                {nt('我的书架', 'My bookshelf')}
                <span />
                <small>{nt('最近 2 本', 'Latest 2 books')}</small>
              </h2>
              {books.slice(0, 2).map((b, i) => (
                <button
                  key={b.id}
                  className="dash-book"
                  disabled={busy}
                  aria-label={nt('打开 ', 'Open ') + b.name}
                  onClick={() => openBook(b.id)}
                >
                  <span className={'dash-mini-cover cover-' + i}>{b.name.slice(0, 9)}</span>
                  <span>
                    <strong>{b.name}</strong>
                    <small className="dash-resume">{nt('继续写作 →', 'Continue writing →')}</small>
                    <small>
                      {stats[b.id]?.genre || nt('未分类', 'Uncategorized')} ·{' '}
                      {stats[b.id] ? stats[b.id].words.toLocaleString() : '—'} {nt('字', 'characters')}
                    </small>
                    <p>
                      {stats[b.id]?.description ||
                        nt('给这个故事一点时间。', 'Give this story a little time.')}
                    </p>
                  </span>
                </button>
              ))}
              {!books.length && (
                <div className="dash-empty">
                  {nt('书架还是空的，先种下一个故事。', 'Your bookshelf is empty. Plant the first seed.')}
                </div>
              )}
              <button className="dash-new" disabled={busy} onClick={newBook}>
                ＋ {nt('创建新作品', 'Create a new book')}
              </button>
            </section>
            <section className="dash-card dash-progress">
              <h2>
                <Feather size={16} />
                {nt('码字进度', 'Writing progress')}
                <span />
                <label>
                  {nt('日目标', 'Daily goal')}
                  <input
                    aria-label={nt('每日字数目标', 'Daily character goal')}
                    type="number"
                    min={1}
                    max={100000}
                    disabled={!notebook.ready}
                    value={goal}
                    onChange={(e) =>
                      notebook.change((d) => ({
                        ...d,
                        goal: Math.max(1, Math.min(100000, Math.floor(Number(e.target.value) || 1))),
                      }))
                    }
                  />
                </label>
              </h2>
              {(['manual', 'ai'] as const).map((origin) => (
                <div className="dash-meter" key={origin}>
                  <div>
                    <strong>{loading ? '—' : today[origin].toLocaleString()}</strong>
                    <small>
                      {origin === 'manual'
                        ? nt('字 · 手动新增', 'chars · Manual additions')
                        : nt('字 · AI 采纳新增', 'chars · Accepted AI additions')}
                    </small>
                    <span>{Math.round((today[origin] / goal) * 100)}%</span>
                  </div>
                  <progress max={goal} value={today[origin]} />
                </div>
              ))}
              <span className="dash-streak">
                <Check size={12} />
                {nt('连续创作 ', 'Writing streak: ')}
                {streak === 14 ? '14+' : streak}
                {nt(' 天', ' days')}
              </span>
            </section>
            <section className="dash-card dash-jot">
              <h2>
                <Lightbulb size={16} />
                {nt('灵感速记', 'Quick ideas')}
                <span />
                <button onClick={openNotes}>{nt('便笺库', 'Notebook')}</button>
              </h2>
              {jot}
            </section>
          </div>
          <div className="dash-middle-grid">
            <section className="dash-card dash-chart">
              <h2>
                <TrendingUp size={16} />
                {nt('最近 14 天', 'Last 14 days')}
                <span />
                <small>
                  {nt('合计 ', 'Total ')}
                  {loading ? '—' : total.toLocaleString()}
                  {nt(' 字', ' chars')}
                </small>
              </h2>
              <div
                className="dash-bars"
                role="img"
                aria-label={nt('近 14 天正文新增字数', 'Manuscript additions over the last 14 days')}
              >
                {series.map((d) => (
                  <div key={d.date} title={`${d.date}: ${d.manual + d.ai}`}>
                    <span style={{ height: `${((d.manual + d.ai) / max) * 84}px` }} />
                    <small>{d.date.slice(5).replace('-', '/')}</small>
                  </div>
                ))}
              </div>
              <p>
                {nt(
                  '从本版开始记录正文增量；粘贴计手动，删除不扣减。旧作品不会补造历史。',
                  'Tracking starts with this version. Paste counts as manual; deletions do not subtract. No invented history for older books.',
                )}
              </p>
            </section>
            <section className="dash-card dash-ranking">
              <h2>
                <BarChart3 size={16} />
                {nt('作品字数排行', 'Manuscript ranking')}
                <span />
              </h2>
              {ranked.map((b, i) => (
                <button key={b.id} disabled={busy} onClick={() => openBook(b.id)}>
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <p>
                      {b.name}
                      <small>
                        {stats[b.id].words.toLocaleString()}
                        {nt(' 字', ' chars')}
                      </small>
                    </p>
                    <progress max={Math.max(1, stats[ranked[0].id].words)} value={stats[b.id].words} />
                  </div>
                </button>
              ))}
              {!ranked.length && (
                <div className="dash-empty">
                  {loading
                    ? nt('正在读取作品…', 'Reading manuscripts…')
                    : nt('写下第一章，这里将显示作品字数。', 'Your manuscript totals will appear here.')}
                </div>
              )}
            </section>
          </div>
          {readError && (
            <p role="alert" className="dash-error">
              {nt(
                '部分作品无法读取，统计暂未包含这些作品。',
                'Some books could not be read and are excluded from the totals.',
              )}
            </p>
          )}
        </>
      )}
    </section>
  )
}
