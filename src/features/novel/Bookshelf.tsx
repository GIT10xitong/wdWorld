import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Plus, Search, Upload, Feather, Trash2, Home, Lightbulb } from 'lucide-react'
import { useStore } from '@/store'
import { listStoredProjects } from '@/lib/storage/database'
import { message } from '@/lib/i18n'
import { nt } from './workbench'
import './desk.css'
import './dashboard.css'
import { Dashboard } from './Dashboard'
import { useNotebook } from './useNotebook'
import { setNovelDestination } from './navigation'

export function Bookshelf() {
  const [view, setView] = useState<'home' | 'shelf' | 'notes'>('home')
  const notebook = useNotebook()
  const recent = useStore((s) => s.recentProjects)
  const [books, setBooks] = useState<Awaited<ReturnType<typeof listStoredProjects>>>([])
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('recent')
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [idea, setIdea] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState('')
  const refresh = async () => setBooks((await listStoredProjects()).filter((p) => p.mode === 'novel'))
  useEffect(() => {
    void refresh().catch((e) => setError(String(e)))
    void useStore.getState().loadRecentProjects()
  }, [])
  const act = async (fn: () => Promise<unknown>) => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await notebook.flush()
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }
  const visible = [...books]
    .filter((b) => b.name.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name)
        : (recent.find((r) => r.id === b.id)?.lastOpened || b.updatedAt).localeCompare(
            recent.find((r) => r.id === a.id)?.lastOpened || a.updatedAt,
          ),
    )
  const orderedBooks = useMemo(
    () =>
      [...books].sort((a, b) =>
        (recent.find((r) => r.id === b.id)?.lastOpened || b.updatedAt).localeCompare(
          recent.find((r) => r.id === a.id)?.lastOpened || a.updatedAt,
        ),
      ),
    [books, recent],
  )
  const newBook = () => {
    setCreating(true)
  }
  const openBook = (id: string) =>
    void act(async () => {
      setNovelDestination('write')
      await useStore.getState().openProject(id)
    })
  return (
    <main className="book-home novel-home-light">
      <aside className="book-rail">
        <button
          className="book-logo"
          aria-label={nt('WD WORLD · 小说主页', 'WD WORLD · Novel home')}
          onClick={() => setView('home')}
        >
          <Feather size={26} />
          <strong>
            WD WORLD<small>{nt('小说创作空间', 'NOVEL STUDIO')}</small>
          </strong>
        </button>
        <button className={view === 'home' ? 'active' : ''} onClick={() => setView('home')}>
          <Home size={17} />
          {nt('首页', 'Home')}
        </button>
        <span className="desk-kicker">{nt('作品管理', 'LIBRARY')}</span>
        <button className={view === 'shelf' ? 'active' : ''} onClick={() => setView('shelf')}>
          <BookOpen size={18} />
          {nt('作品书架', 'Bookshelf')}
          <b>{books.length}</b>
        </button>
        <button className={view === 'notes' ? 'active' : ''} onClick={() => setView('notes')}>
          <Lightbulb size={17} />
          {nt('灵感便笺', 'Idea notebook')}
        </button>
        <button disabled={busy} onClick={newBook}>
          <Plus size={18} />
          {nt('新建小说', 'New novel')}
        </button>
        <label className="book-import">
          <Upload size={18} />
          {nt('导入作品备份', 'Import book backup')}
          <input
            type="file"
            accept=".json"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) void act(() => useStore.getState().importProjectJSON(file))
            }}
          />
        </label>
        <div className="book-rail-note">
          <span className="book-dot" />
          {nt('本地创作 · 自动保存', 'Local writing · Autosave')}
          <p>
            {nt(
              '打开一本作品，在写作台管理章节、素材与 AI 工具。',
              'Open a book to work with chapters, references and AI tools.',
            )}
          </p>
        </div>
      </aside>
      {view !== 'shelf' ? (
        <Dashboard
          books={orderedBooks}
          openBook={openBook}
          newBook={newBook}
          allBooks={() => setView('shelf')}
          openNotes={() => setView('notes')}
          notebook={notebook}
          notesOnly={view === 'notes'}
          busy={busy}
          error={message(error)}
        />
      ) : (
        <section className="book-library">
          <header>
            <div>
              <span className="desk-kicker">{nt('写下下一种可能', 'WRITE WHAT COMES NEXT')}</span>
              <h1>{nt('你的故事，从这里继续。', 'Your next chapter starts here.')}</h1>
              <p>
                {nt(
                  '管理作品、构思情节，在安静的写作台里专注表达。',
                  'Organize your books, shape your story and settle into writing.',
                )}
              </p>
            </div>
            <button className="desk-primary" disabled={busy} onClick={newBook}>
              <Plus size={18} />
              {nt('新建小说', 'New novel')}
            </button>
          </header>
          {error && (
            <p role="alert" className="desk-error">
              {message(error)}
            </p>
          )}
          <div className="book-filter">
            <h2>
              {nt('全部作品', 'All books')} <small>{books.length}</small>
            </h2>
            <label>
              <Search size={17} />
              <input
                aria-label={nt('搜索作品', 'Search books')}
                placeholder={nt('搜索书名…', 'Search titles…')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <select
              aria-label={nt('作品排序', 'Book order')}
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="recent">{nt('最近编辑', 'Recently edited')}</option>
              <option value="name">{nt('按书名', 'By title')}</option>
            </select>
          </div>
          <div className="book-grid">
            {visible.map((book, i) => (
              <article className="book-card" key={book.id}>
                <button
                  className="book-cover"
                  style={{ '--cover-hue': String((i * 47 + 180) % 360) } as React.CSSProperties}
                  disabled={busy}
                  onClick={() => openBook(book.id)}
                  aria-label={nt('打开 ', 'Open ') + book.name}
                >
                  <span>WD · NOVEL</span>
                  <strong>{book.name}</strong>
                  <BookOpen size={28} strokeWidth={1} />
                </button>
                <div className="book-caption">
                  <h3>{book.name}</h3>
                  <button
                    aria-label={nt('删除 ', 'Delete ') + book.name}
                    onClick={() => setDeleting(book.id)}
                    disabled={busy}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <small>
                  {nt('本地作品', 'Local manuscript')} ·{' '}
                  {new Date(
                    recent.find((r) => r.id === book.id)?.lastOpened || book.updatedAt,
                  ).toLocaleDateString()}
                </small>
                {deleting === book.id && (
                  <div className="desk-confirm">
                    <p>
                      {nt(
                        '确认删除整部作品？此操作不能撤销。',
                        'Delete this entire book? This cannot be undone.',
                      )}
                    </p>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void act(async () => {
                          await useStore.getState().deleteProject(book.id)
                          setDeleting('')
                          await refresh()
                        })
                      }
                    >
                      {nt('确认删除', 'Delete book')}
                    </button>
                    <button onClick={() => setDeleting('')}>{nt('取消', 'Cancel')}</button>
                  </div>
                )}
              </article>
            ))}
            <button className="book-add" disabled={busy} onClick={newBook}>
              <Plus size={30} />
              <strong>{nt('新故事，新的可能', 'A new story awaits')}</strong>
              <span>{nt('创建小说作品', 'Create a novel')}</span>
            </button>
          </div>
          {query && !visible.length && <p>{nt('没有找到匹配的作品。', 'No matching books.')}</p>}
        </section>
      )}
      {creating && (
        <div className="desk-overlay">
          <form
            role="dialog"
            aria-modal="true"
            aria-label={nt('新建小说', 'New novel')}
            className="desk-modal"
            onSubmit={(e) => {
              e.preventDefault()
              void act(async () => {
                setNovelDestination('write')
                await useStore.getState().createProject(name.trim(), idea.trim(), 'novel')
              })
            }}
          >
            <h2>{nt('为故事起个名字', 'Name your story')}</h2>
            <label>
              {nt('书名', 'Book title')}
              <input
                required
                maxLength={200}
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              {nt('故事想法', 'Story idea')}
              <textarea maxLength={20000} value={idea} onChange={(e) => setIdea(e.target.value)} />
            </label>
            {error && <p role="alert">{message(error)}</p>}
            <button type="button" disabled={busy} onClick={() => setCreating(false)}>
              {nt('取消', 'Cancel')}
            </button>
            <button className="desk-primary" disabled={busy || !name.trim()}>
              {nt('创建并写作', 'Create and write')}
            </button>
          </form>
        </div>
      )}
    </main>
  )
}
