import { useEffect, useState } from 'react'
import { ArrowUpRight, Plus, Upload, Search, Users, Compass, BookOpen, Trash2 } from 'lucide-react'
import { useStore } from '@/store'
import { listStoredProjects } from '@/lib/storage/database'
import { message } from '@/lib/i18n'
import { homeProfile, st, type HomeMode } from './homeModel'
import './home.css'

export function ModeLanding({
  mode,
  create,
  importProject,
}: {
  mode: HomeMode
  create: () => void
  importProject: () => void
}) {
  const p = homeProfile(mode),
    Icon = { oc: Users, trpg: Compass, tavern: BookOpen }[mode]
  const [projects, setProjects] = useState<Awaited<ReturnType<typeof listStoredProjects>>>([])
  const [query, setQuery] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true),
    [deleting, setDeleting] = useState('')
  const refresh = async () =>
    setProjects(
      (await listStoredProjects())
        .filter((p) => p.mode === mode)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    )
  useEffect(() => {
    let alive = true
    void listStoredProjects()
      .then((data) => {
        if (alive)
          setProjects(
            data.filter((p) => p.mode === mode).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
          )
      })
      .catch((e) => {
        if (alive) setError(String(e))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [mode])
  const act = async (fn: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }
  const open = (id: string) => void act(() => useStore.getState().openProject(id))
  const visible = projects.filter((p) => p.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
  return (
    <section className={`mode-landing home-theme-${mode}`}>
      <header className="home-banner">
        <div>
          <span className="home-eyebrow">WD WORLD / {p.code}</span>
          <h1>{p.headline}</h1>
          <p>{p.description}</p>
          <div className="home-actions">
            <button className="home-primary" disabled={busy} onClick={create}>
              <Plus size={16} />
              {st('新建世界', 'New world')}
            </button>
            <button disabled={busy} onClick={importProject}>
              <Upload size={16} />
              {st('打开已有项目', 'Open existing project')}
            </button>
          </div>
        </div>
        <Icon className="home-banner-icon" size={100} strokeWidth={1} />
      </header>
      <div className="home-feature-strip">
        {p.features.map((text, i) => (
          <div key={text}>
            <span>0{i + 1}</span>
            <strong>{text}</strong>
          </div>
        ))}
      </div>
      {error && (
        <p role="alert" className="mode-error">
          {message(error)}
        </p>
      )}
      <div className="home-library-heading">
        <h2>
          {p.collection}
          <small>{projects.length}</small>
        </h2>
        <label>
          <Search size={16} />
          <input
            aria-label={st('搜索本模式项目', 'Search mode projects')}
            placeholder={st('搜索项目名称…', 'Search project names…')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      <div className="home-project-grid">
        {visible.map((project, i) => (
          <article className="home-project" key={project.id}>
            <button
              className="home-project-open"
              disabled={busy}
              aria-label={st('打开 ', 'Open ') + project.name}
              title={st('打开 ', 'Open ') + project.name}
              onClick={() => open(project.id)}
            >
              <span className="home-project-symbol">
                <Icon size={30} strokeWidth={1.2} />
                <small>{String(i + 1).padStart(2, '0')}</small>
              </span>
              <strong>{project.name}</strong>
              <small>
                {st('更新于 ', 'Updated ')}
                {new Date(project.updatedAt).toLocaleDateString()}
              </small>
              <span className="home-project-link">
                {st('进入创作空间', 'Open creative space')}
                <ArrowUpRight size={16} />
              </span>
            </button>
            {deleting === project.id ? (
              <div className="home-delete">
                <p>
                  {st('删除整个项目？此操作不可撤销。', 'Delete the entire project? This cannot be undone.')}
                </p>
                <button
                  disabled={busy}
                  onClick={() =>
                    void act(async () => {
                      await useStore.getState().deleteProject(project.id)
                      setDeleting('')
                      await refresh()
                    })
                  }
                >
                  {st('确认删除', 'Confirm delete')}
                </button>
                <button disabled={busy} onClick={() => setDeleting('')}>
                  {st('取消', 'Cancel')}
                </button>
              </div>
            ) : (
              <button
                className="home-delete-trigger"
                aria-label={st('删除 ', 'Delete ') + project.name}
                disabled={busy}
                onClick={() => setDeleting(project.id)}
              >
                <Trash2 size={15} />
              </button>
            )}
          </article>
        ))}
        <button className="home-new-project" disabled={busy} onClick={create}>
          <Plus size={26} />
          <strong>{st('新的创作，从这里开始', 'Start something new')}</strong>
          <span>{p.title}</span>
        </button>
      </div>
      {!visible.length && (
        <p className="home-empty">
          {loading
            ? st('正在读取本地项目…', 'Reading local projects…')
            : query
              ? st('没有找到匹配项目。', 'No matching projects.')
              : st(
                  '还没有项目。建立新世界，或导入已有项目备份。',
                  'No projects yet. Create a world or import a project backup.',
                )}
        </p>
      )}
      <footer className="home-footnote">
        {st(
          '作品保存在本机 · 编辑页每 10 秒自动保存 · 导出备份可迁移作品',
          'Stored on this device · Editors autosave every 10 seconds · Export backups to move projects',
        )}
      </footer>
    </section>
  )
}
