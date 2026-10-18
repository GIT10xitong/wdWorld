import { FilePicker } from '@/components/FilePicker'
import { useEffect, useRef, useState } from 'react'
import {
  BookOpen,
  Feather,
  Save,
  Plus,
  ArrowLeft,
  PanelRightClose,
  Sparkles,
  Settings2,
  Square,
  PanelRightOpen,
} from 'lucide-react'
import { useStore } from '@/store'
import type { Database } from '@/lib/storage/database'
import type { Project } from '@/types'
import { generateId } from '@/lib/utils'
import { message } from '@/lib/i18n'
import { MarkdownEditor } from '@/components/MarkdownEditor'
import { NovelWorkspace } from './NovelWorkspace'
import { useNovelSession } from './useNovelSession'
import { plainText, snapshot } from './model'
import { AISettingsModal } from './AISettingsModal'
import { GenerationPreview } from './GenerationPreview'
import {
  nt,
  emptyWorkbench,
  newCard,
  applyPolish,
  applyAgentDraft,
  workPrompt,
  type Workbench,
  type WorkResult,
  type NovelAgent,
} from './workbench'
import './desk.css'
import { getNovelDestination, setNovelDestination, type NovelSection } from './navigation'
import { LoreLinks } from './NovelLorePanel'

type Props = {
  database: Database
  project: Project
  onWorld: () => void
  onBusyChange?: (busy: boolean) => void
}
export function NovelStudio(props: Props) {
  const [destination] = useState(getNovelDestination)
  const [journey, setJourney] = useState(destination === 'journey')
  useEffect(() => {
    setNovelDestination('write')
  }, [])
  return journey ? (
    <NovelWorkspace {...props} onDesk={() => setJourney(false)} />
  ) : (
    <WritingDesk
      {...props}
      initialSection={destination === 'journey' ? 'write' : destination}
      onJourney={() => setJourney(true)}
    />
  )
}
type Section = NovelSection
function WritingDesk({
  database,
  project,
  onWorld,
  onBusyChange,
  onJourney,
  initialSection,
}: Props & { onJourney: () => void; initialSection: Section }) {
  const session = useNovelSession(database, project)
  const { doc, change, flush, updateChapter } = session
  const [defaults] = useState(emptyWorkbench)
  const wb = doc.workbench || defaults
  const [section, setSection] = useState<Section>(initialSection)
  const [focus, setFocus] = useState(false)
  const [showContext, setShowContext] = useState(true)
  const [settings, setSettings] = useState(false)
  const [instruction, setInstruction] = useState('')
  const [sourceId, setSourceId] = useState('')
  const [working, setWorking] = useState(false)
  const [stream, setStream] = useState('')
  const [activeResult, setActiveResult] = useState('')
  const [notice, setNotice] = useState('')
  const request = useRef<string | null>(null)
  const cancelled = useRef(false)
  const alive = useRef(true)
  const mainPane = useRef<HTMLElement>(null)
  useEffect(() => {
    mainPane.current?.scrollTo({ top: 0 })
  }, [section, doc.selectedChapterId])
  const entries = useStore((s) => s.entries)
  const saveStatus = useStore((s) => s.saveStatus)
  const saveError = useStore((s) => s.saveError)
  const busy = session.busy || working
  const chapter = doc.chapters.find((c) => c.id === doc.selectedChapterId)
  const wordCount = doc.chapters.reduce((sum, c) => sum + plainText(c.content).replace(/\s/g, '').length, 0)
  const chapterWords = plainText(chapter?.content || '').replace(/\s/g, '').length
  const patch = (update: (w: Workbench) => Workbench) =>
    change((d) => ({ ...d, workbench: update(d.workbench || defaults) }))
  useEffect(() => {
    onBusyChange?.(busy)
    return () => onBusyChange?.(false)
  }, [busy, onBusyChange])
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      cancelled.current = true
      if (request.current) void window.novelAI?.cancel(request.current)
    }
  }, [])
  const leave = async (fn: () => void) => {
    await flush()
    if (useStore.getState().saveStatus !== 'error') fn()
  }
  const stop = () => {
    cancelled.current = true
    if (request.current) void window.novelAI?.cancel(request.current)
    session.cancel()
  }
  const runTool = async (kind: WorkResult['kind'], agent?: NovelAgent) => {
    if (busy || request.current) return
    session.setError('')
    setNotice('')
    setStream('')
    setWorking(true)
    cancelled.current = false
    const initial = doc,
      baseChapter = chapter
    const source = wb.resources.find((r) => r.id === sourceId)?.content || ''
    try {
      const api = window.novelAI
      if (!api) throw new Error(nt('请在桌面版配置 AI 服务', 'Configure an AI service in the desktop app'))
      if (kind === 'polish' && !plainText(baseChapter?.content || ''))
        throw new Error(nt('请先写入章节正文', 'Write a chapter first'))
      if (kind === 'analysis' && !source.trim())
        throw new Error(nt('请先选择有内容的资源', 'Select a resource with text first'))
      if (kind === 'health' && !entries.length)
        throw new Error(nt('请先建立世界观设定', 'Create world lore first'))
      const agents = kind === 'agent' ? (agent ? [agent] : wb.agents.filter((a) => a.enabled)) : [null]
      if (!agents.length) throw new Error(nt('请至少启用一个智能体', 'Enable at least one agent'))
      let previous = ''
      for (const role of agents) {
        if (cancelled.current || !alive.current) break
        const id = generateId('desk-ai')
        request.current = id
        setStream('')
        const dispose = api.onDelta((d) => {
          if (d.id === id && alive.current) setStream((s) => s + d.delta)
        })
        try {
          const prompt = workPrompt(
            kind,
            initial,
            entries,
            [
              instruction,
              role?.instruction,
              previous ? `Previous candidate (reference only):\n${previous}` : '',
            ]
              .filter(Boolean)
              .join('\n\n'),
            source,
          )
          const result = await api.generate({ id, messages: prompt })
          if (cancelled.current || !alive.current) break
          if (!result.ok || !result.text?.trim())
            throw new Error(result.error || nt('模型未返回内容', 'The model returned no text'))
          const record: WorkResult = {
            id,
            kind,
            title: role?.name || labels[kind],
            text: result.text,
            chapterId: baseChapter?.id || null,
            baseContent: baseChapter?.content || '',
            createdAt: new Date().toISOString(),
            applied: false,
          }
          patch((w) => ({ ...w, results: [record, ...w.results].slice(0, 30) }))
          const linked = await database.syncNovelSource(project.id, 'result:' + record.id, record.text, {
            title: record.title.slice(0, 200),
            type: 'note',
            confirmed: false,
          })
          change(() => linked)
          await useStore.getState().fetchEntries()
          setActiveResult(id)
          previous = result.text
        } finally {
          dispose()
          request.current = null
        }
      }
      if (alive.current) await flush()
    } catch (e) {
      if (alive.current) session.setError(e instanceof Error ? e.message : String(e))
    } finally {
      request.current = null
      if (alive.current) {
        setWorking(false)
        setStream('')
      }
    }
  }
  const labels = {
    lore: nt('世界观联动', 'World lore links'),
    write: nt('写作台', 'Writing desk'),
    board: nt('结构化板块', 'Story board'),
    resources: nt('资源库', 'Resource library'),
    agents: nt('智能体系统', 'Agents'),
    polish: nt('去 AI 味', 'Style revision'),
    analysis: nt('拆书', 'Book analysis'),
    memory: nt('作者记忆', 'Author memory'),
    panels: nt('自定义面板', 'Custom panels'),
    health: nt('设定体检', 'Lore health check'),
    agent: nt('智能体候选', 'Agent candidate'),
  }
  const groups: { title: string; sections: Section[] }[] = [
    { title: nt('创作', 'WRITE'), sections: ['write', 'board'] },
    { title: nt('本书资料', 'BOOK MATERIAL'), sections: ['resources', 'lore', 'memory', 'panels'] },
    { title: nt('AI 辅助', 'AI TOOLS'), sections: ['agents', 'polish', 'analysis', 'health'] },
  ]
  const sectionResults = wb.results.filter((r) => r.kind === (section === 'agents' ? 'agent' : section))
  const selectedResult = sectionResults.find((r) => r.id === activeResult) || sectionResults[0]
  const generation = doc.generations.find((g) => g.id === session.selectedGenerationId)
  const localIssues = entries
    .filter((e) => e.status !== 'archived')
    .flatMap((e) => [
      ...(!plainText(e.content).trim() ? [nt('内容为空：', 'Empty content: ') + e.title] : []),
      ...(entries.some(
        (other) => other.id !== e.id && other.status !== 'archived' && other.title.trim() === e.title.trim(),
      )
        ? [nt('名称重复：', 'Duplicate name: ') + e.title]
        : []),
    ])
  const cards = (key: 'board' | 'resources' | 'panels') => (
    <>
      <div className="desk-row">
        <button disabled={busy} onClick={() => setSection('lore')}>
          {nt('同步资料到世界观', 'Connect material to world')}
        </button>
        <p>
          {key === 'board'
            ? nt('把情节、伏笔与人物弧光拆成可编辑卡片。', 'Organize plot, foreshadowing and character arcs.')
            : key === 'resources'
              ? nt(
                  '保留参考资料与原创素材；拆书只发送选中的资源。',
                  'Keep references and original material; analysis sends only the selected resource.',
                )
              : nt(
                  '创建自己的笔记面板，不执行脚本。',
                  'Create personal note panels; no scripts are executed.',
                )}
        </p>
        <button
          disabled={busy || wb[key].length >= 100}
          onClick={() =>
            patch((w) => ({
              ...w,
              [key]: [...w[key], newCard(key === 'board' ? nt('待构思', 'Idea') : nt('笔记', 'Note'))],
            }))
          }
        >
          <Plus size={16} />
          {nt('新增卡片', 'Add card')}
        </button>
      </div>
      {key === 'resources' && (
        <FilePicker
          label={nt('导入 TXT / Markdown（最多 1 MB）', 'Import TXT / Markdown (up to 1 MB)')}
          accept=".txt,.md,.markdown"
          disabled={busy || wb.resources.length >= 100}
          onChange={async (e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (!file) return
            try {
              if (!/\.(txt|md|markdown)$/i.test(file.name) || file.size > 1000000)
                throw new Error(nt('请选择不超过 1 MB 的文本文件', 'Choose a text file no larger than 1 MB'))
              const content = await file.text()
              if (!alive.current) return
              if (content.includes('\u0000')) throw new Error(nt('文件不是有效文本', 'Invalid text file'))
              patch((w) => ({
                ...w,
                resources: [
                  ...w.resources,
                  { ...newCard('reference'), title: file.name.slice(0, 200), content },
                ].slice(0, 100),
              }))
            } catch (err) {
              session.setError(String(err))
            }
          }}
        />
      )}
      <div className="desk-note-grid">
        {wb[key].map((card) => (
          <article key={card.id}>
            <label>
              {nt('标题', 'Title')}
              <input
                maxLength={200}
                value={card.title}
                onChange={(e) =>
                  patch((w) => ({
                    ...w,
                    [key]: w[key].map((c) => (c.id === card.id ? { ...c, title: e.target.value } : c)),
                  }))
                }
              />
            </label>
            <label>
              {nt('分类 / 状态', 'Category / status')}
              <input
                maxLength={100}
                value={card.kind}
                onChange={(e) =>
                  patch((w) => ({
                    ...w,
                    [key]: w[key].map((c) => (c.id === card.id ? { ...c, kind: e.target.value } : c)),
                  }))
                }
              />
            </label>
            <label>
              {nt('内容', 'Content')}
              <textarea
                maxLength={1000000}
                value={card.content}
                onChange={(e) =>
                  patch((w) => ({
                    ...w,
                    [key]: w[key].map((c) => (c.id === card.id ? { ...c, content: e.target.value } : c)),
                  }))
                }
              />
            </label>
            <button
              onClick={() => {
                if (window.confirm(nt('删除这张卡片？', 'Delete this card?')))
                  patch((w) => ({ ...w, [key]: w[key].filter((c) => c.id !== card.id) }))
              }}
            >
              {nt('删除卡片', 'Delete card')}
            </button>
          </article>
        ))}
      </div>
      {!wb[key].length && (
        <div className="desk-empty">
          {nt('这里还没有卡片，添加第一条内容。', 'No cards yet. Add your first note.')}
        </div>
      )}
    </>
  )
  return (
    <div className={'desk-shell' + (focus && section === 'write' ? ' desk-focus' : '')}>
      <aside className="desk-rail">
        <button
          className="desk-back"
          disabled={busy}
          onClick={() => void leave(() => useStore.getState().closeProject())}
        >
          <ArrowLeft size={16} />
          {nt('返回书架', 'Bookshelf')}
        </button>
        <div className="desk-project">
          <Feather size={23} />
          <h2>{project.name}</h2>
          <span>
            {wordCount.toLocaleString()} {nt('字', 'characters')}
          </span>
        </div>
        <nav aria-label={nt('小说工作区', 'Novel workspace')}>
          {groups.map((group) => (
            <div className="desk-nav-group" key={group.title}>
              <span className="desk-kicker">{group.title}</span>
              {group.sections.map((s) => (
                <button
                  key={s}
                  aria-current={section === s ? 'page' : undefined}
                  disabled={busy}
                  onClick={() => {
                    setSection(s)
                    setNotice('')
                  }}
                >
                  {labels[s]}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <button disabled={busy} onClick={() => void leave(onJourney)}>
          {nt('创作旅程 · 从想法到定稿', 'Creation journey')}
        </button>
        <button disabled={busy} onClick={() => void leave(onWorld)}>
          {nt('世界观设定', 'Worldbuilding')}
        </button>
      </aside>
      <div className="desk-body">
        <header className="desk-top">
          <div>
            <span className="desk-kicker">{project.name}</span>
            <h1>{labels[section]}</h1>
          </div>
          <div className="desk-row">
            <span role="status">
              {saveStatus === 'error'
                ? nt('保存失败', 'Save failed')
                : session.dirty
                  ? nt('待保存 · 每 10 秒自动保存', 'Unsaved · Autosaves every 10s')
                  : nt('已保存到本机', 'Saved locally')}
            </span>
            <button onClick={() => void flush()}>
              <Save size={16} />
              {nt('保存本页', 'Save this page')}
            </button>
            <button disabled={busy} onClick={() => setSettings(true)}>
              <Settings2 size={16} />
              {nt('AI 设置', 'AI settings')}
            </button>
            {section === 'write' && (
              <button
                aria-pressed={showContext}
                aria-controls="chapter-context"
                disabled={focus}
                onClick={() => setShowContext(!showContext)}
              >
                {showContext ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
                {nt('本章资料', 'Chapter notes')}
              </button>
            )}
            {section === 'write' && (
              <button aria-pressed={focus} onClick={() => setFocus(!focus)}>
                <PanelRightClose size={16} />
                {focus ? nt('退出专注', 'Exit focus') : nt('专注', 'Focus')}
              </button>
            )}
          </div>
        </header>
        {(session.error || saveError) && (
          <p className="desk-error" role="alert">
            {message(session.error || saveError || '')}
          </p>
        )}
        {notice && <p role="status">{notice}</p>}
        <main ref={mainPane} className="desk-main">
          {section === 'write' ? (
            <div className={'desk-writing' + (!showContext ? ' desk-context-hidden' : '')}>
              <aside className="desk-chapters">
                <div className="desk-row">
                  <h3>{nt('章节目录', 'Chapters')}</h3>
                  <button
                    aria-label={nt('新建章节', 'New chapter')}
                    disabled={busy}
                    onClick={session.addChapter}
                  >
                    <Plus size={18} />
                  </button>
                </div>
                {doc.chapters.map((c, i) => (
                  <button
                    key={c.id}
                    aria-current={c.id === chapter?.id ? 'page' : undefined}
                    disabled={busy}
                    onClick={() => change((d) => ({ ...d, selectedChapterId: c.id }))}
                  >
                    <small>
                      {String(i + 1).padStart(2, '0')} · {c.volume}
                    </small>
                    <strong>{c.title}</strong>
                    <span>
                      {plainText(c.content).replace(/\s/g, '').length} {nt('字', 'characters')}{' '}
                      {c.status === 'complete' ? '✓' : ''}
                    </span>
                  </button>
                ))}
                {!doc.chapters.length && (
                  <p>
                    {nt(
                      '新建第一章，开始自由写作。也可以先完成创作旅程。',
                      'Add a chapter to write freely, or start with the creation journey.',
                    )}
                  </p>
                )}
              </aside>
              <section className="desk-manuscript">
                {chapter ? (
                  <>
                    <div className="desk-row">
                      <label>
                        {nt('卷名', 'Volume')}
                        <input
                          value={chapter.volume}
                          onChange={(e) => updateChapter(chapter.id, { volume: e.target.value })}
                        />
                      </label>
                      <label>
                        {nt('章节状态', 'Chapter status')}
                        <select
                          value={chapter.status}
                          onChange={(e) =>
                            updateChapter(chapter.id, { status: e.target.value as 'draft' | 'complete' })
                          }
                        >
                          <option value="draft">{nt('草稿', 'Draft')}</option>
                          <option value="complete">{nt('完成', 'Complete')}</option>
                        </select>
                      </label>
                    </div>
                    <input
                      className="desk-chapter-title"
                      aria-label={nt('章节标题', 'Chapter title')}
                      value={chapter.title}
                      onChange={(e) => updateChapter(chapter.id, { title: e.target.value })}
                    />
                    <MarkdownEditor
                      key={chapter.id}
                      content={chapter.content}
                      onChange={(content) => updateChapter(chapter.id, { content })}
                      placeholder={nt('写下这一章的第一句话……', 'Write the first sentence of this chapter…')}
                    />
                    <footer>
                      {chapterWords.toLocaleString()} {nt('字', 'characters')} ·{' '}
                      {nt('章节目标', 'Chapter target')}{' '}
                      <input
                        type="number"
                        min={1}
                        max={100000}
                        aria-label={nt('章节字数目标', 'Chapter character target')}
                        value={wb.dailyGoal}
                        onChange={(e) =>
                          patch((w) => ({
                            ...w,
                            dailyGoal: Math.max(1, Math.min(100000, Number(e.target.value) || 1)),
                          }))
                        }
                      />
                      <progress max={wb.dailyGoal} value={chapterWords} />
                    </footer>
                  </>
                ) : (
                  <div className="desk-empty">
                    <BookOpen size={42} />
                    <h2>{nt('故事等待落笔', 'Your story is waiting')}</h2>
                    <button className="desk-primary" onClick={session.addChapter}>
                      {nt('新建章节', 'New chapter')}
                    </button>
                  </div>
                )}
              </section>
              <aside id="chapter-context" className="desk-context" hidden={!showContext}>
                <h3>{nt('本章资料', 'Chapter notes')}</h3>
                {chapter && (
                  <>
                    <label>
                      {nt('章节大纲', 'Chapter outline')}
                      <textarea
                        aria-label={nt('章节大纲', 'Chapter outline')}
                        value={chapter.outline}
                        onChange={(e) => updateChapter(chapter.id, { outline: e.target.value })}
                      />
                    </label>
                    <label>
                      {nt('已发生事实摘要', 'Established facts summary')}
                      <textarea
                        aria-label={nt('已发生事实摘要', 'Established facts summary')}
                        value={chapter.summary}
                        onChange={(e) => updateChapter(chapter.id, { summary: e.target.value })}
                      />
                    </label>
                  </>
                )}
                <details>
                  <summary>{nt('引用设定', 'Referenced lore')}</summary>
                  {entries
                    .filter((e) => !['archived', 'proposed'].includes(e.status))
                    .map((e) => (
                      <label key={e.id}>
                        <input
                          type="checkbox"
                          checked={chapter?.entryIds.includes(e.id) || false}
                          disabled={!chapter}
                          onChange={(event) =>
                            chapter &&
                            updateChapter(chapter.id, {
                              entryIds: event.target.checked
                                ? [...chapter.entryIds, e.id]
                                : chapter.entryIds.filter((id) => id !== e.id),
                            })
                          }
                        />
                        {e.title}
                      </label>
                    ))}
                </details>
                <label>
                  {nt('写作要求', 'Writing request')}
                  <textarea value={instruction} onChange={(e) => setInstruction(e.target.value)} />
                </label>
                <button
                  className="desk-primary"
                  disabled={busy || !chapter}
                  onClick={() => void session.run('write', instruction)}
                >
                  <Sparkles size={16} />
                  {nt('续写候选', 'Draft continuation')}
                </button>
                <button
                  disabled={busy || !chapter?.content}
                  onClick={() => void session.run('summary', instruction)}
                >
                  {nt('生成事实摘要', 'Summarize facts')}
                </button>
                <button disabled={busy} onClick={() => setSection('polish')}>
                  {nt('去 AI 味 · 文风修订', 'Style revision')}
                </button>
              </aside>
            </div>
          ) : (
            <div className="desk-tools">
              {(['board', 'resources', 'panels'] as Section[]).includes(section) &&
                cards(section as 'board' | 'resources' | 'panels')}
              {section === 'memory' && (
                <section className="desk-paper">
                  <h2>{nt('记住你的写作习惯', 'Remember your writing preferences')}</h2>
                  <p>
                    {nt(
                      '保存叙事视角、用词偏好、禁用套路与作者要求。用于本书后续 AI 创作，不替代正式世界设定；不跨作品共享。',
                      'Keep viewpoint, wording preferences and author instructions for this book. Used by later AI writing; separate from canon and other books.',
                    )}
                  </p>
                  <label>
                    {nt('作者偏好与记忆', 'Author preferences and memory')}
                    <textarea
                      maxLength={20000}
                      value={wb.authorMemory}
                      aria-label={nt('作者偏好与记忆', 'Author preferences and memory')}
                      onChange={(e) => patch((w) => ({ ...w, authorMemory: e.target.value }))}
                    />
                  </label>
                  <button onClick={() => void flush()}>{nt('保存作者记忆', 'Save author memory')}</button>
                </section>
              )}
              {section === 'agents' && (
                <>
                  <p>
                    {nt(
                      '使用当前 AI 配置，按启用顺序执行。每一步单独调用模型，结果保留为候选，不自动修改正文。',
                      'Uses the current AI configuration in enabled order. Each step calls the model; results remain candidates and never overwrite your manuscript.',
                    )}
                  </p>
                  <div className="desk-note-grid">
                    {wb.agents.map((agent, i) => (
                      <article key={agent.id}>
                        <label>
                          {nt('角色名称', 'Role name')}
                          <input
                            maxLength={200}
                            value={agent.name}
                            onChange={(e) =>
                              patch((w) => ({
                                ...w,
                                agents: w.agents.map((a) =>
                                  a.id === agent.id ? { ...a, name: e.target.value } : a,
                                ),
                              }))
                            }
                          />
                        </label>
                        <label>
                          {nt('角色任务', 'Role instructions')}
                          <textarea
                            maxLength={20000}
                            value={agent.instruction}
                            onChange={(e) =>
                              patch((w) => ({
                                ...w,
                                agents: w.agents.map((a) =>
                                  a.id === agent.id ? { ...a, instruction: e.target.value } : a,
                                ),
                              }))
                            }
                          />
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={agent.enabled}
                            onChange={(e) =>
                              patch((w) => ({
                                ...w,
                                agents: w.agents.map((a) =>
                                  a.id === agent.id ? { ...a, enabled: e.target.checked } : a,
                                ),
                              }))
                            }
                          />
                          {nt('加入工作流', 'Include in workflow')}
                        </label>
                        <button disabled={busy} onClick={() => void runTool('agent', agent)}>
                          {nt('单独运行', 'Run this role')}
                        </button>
                        <button
                          disabled={busy || i === 0}
                          onClick={() =>
                            patch((w) => {
                              const agents = [...w.agents]
                              ;[agents[i - 1], agents[i]] = [agents[i], agents[i - 1]]
                              return { ...w, agents }
                            })
                          }
                        >
                          {nt('上移', 'Move up')}
                        </button>
                        <button
                          disabled={busy}
                          onClick={() =>
                            patch((w) => ({ ...w, agents: w.agents.filter((a) => a.id !== agent.id) }))
                          }
                        >
                          {nt('移除', 'Remove')}
                        </button>
                      </article>
                    ))}
                  </div>
                  <button
                    disabled={busy || wb.agents.length >= 12}
                    onClick={() =>
                      patch((w) => ({
                        ...w,
                        agents: [
                          ...w.agents,
                          {
                            id: generateId('agent'),
                            name: nt('新智能体', 'New agent'),
                            instruction: '',
                            enabled: true,
                          },
                        ],
                      }))
                    }
                  >
                    {nt('新增智能体', 'Add agent')}
                  </button>
                </>
              )}
              {section === 'polish' && (
                <section className="desk-paper">
                  <h2>{nt('让文字更具体，也更像你', 'Make the prose more specific, and more yours')}</h2>
                  <p>
                    {nt(
                      '减少套话、重复过渡和空泛总结，保留事实与人物声音。这是文风修订，不提供 AI 检测分数或规避保证。',
                      'Reduce stock phrases, repetition and vague summaries while preserving facts and voice. This is prose editing, with no AI-detection score or evasion guarantee.',
                    )}
                  </p>
                  <p>
                    {nt('当前章节：', 'Current chapter: ')}
                    {chapter?.title || nt('尚未选择', 'None selected')}
                  </p>
                  <pre>{plainText(chapter?.content || '')}</pre>
                </section>
              )}
              {section === 'analysis' && (
                <section className="desk-paper">
                  <h2>{nt('从文本中学习叙事方法', 'Learn narrative craft from text')}</h2>
                  <p>
                    {nt(
                      '先在资源库导入你有权使用的 TXT / Markdown。只分析选中内容；长文通过现有分段机制整理，不视为读过整本书。',
                      'Import TXT / Markdown you have permission to use. Only the selected text is analyzed; long inputs use staged context preparation, without claiming to read the entire book.',
                    )}
                  </p>
                  <label>
                    {nt('拆书来源', 'Analysis source')}
                    <select
                      aria-label={nt('拆书来源', 'Analysis source')}
                      value={sourceId}
                      onChange={(e) => setSourceId(e.target.value)}
                    >
                      <option value="">{nt('选择资源', 'Select a resource')}</option>
                      {wb.resources.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.title || nt('未命名', 'Untitled')}
                        </option>
                      ))}
                    </select>
                  </label>
                </section>
              )}
              {section === 'lore' && (
                <LoreLinks
                  doc={doc}
                  database={database}
                  projectId={project.id}
                  change={change}
                  flush={flush}
                  onWorld={onWorld}
                  onBusy={setWorking}
                />
              )}
              {section === 'health' && (
                <section className="desk-paper">
                  <h2>{nt('本地检查', 'Local checks')}</h2>
                  <p>
                    {nt(
                      '扫描重复名称与空设定；AI 进一步核对已确认设定、章节摘要和当前正文。报告不会自动改写设定。',
                      'Scans duplicate names and empty entries; AI can review confirmed lore, chapter summaries and the current chapter. Reports never modify lore automatically.',
                    )}
                  </p>
                  {localIssues.length ? (
                    <ul>
                      {localIssues.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>{nt('未发现重复名称或空内容。', 'No duplicate names or empty entries found.')}</p>
                  )}
                  <button disabled={busy} onClick={() => void leave(onWorld)}>
                    {nt('打开世界观修订', 'Edit world lore')}
                  </button>
                </section>
              )}
              {['agents', 'polish', 'analysis', 'health'].includes(section) && (
                <section className="desk-paper">
                  <label>
                    {nt('本次要求', 'Request for this run')}
                    <textarea
                      value={instruction}
                      onChange={(e) => setInstruction(e.target.value)}
                      maxLength={20000}
                    />
                  </label>
                  <p>
                    {nt(
                      '点击后发送当前任务所需资料到已配置的 AI 服务；输出需作者审核。',
                      'Sends the task context to your configured AI service. Review the output before applying it.',
                    )}
                  </p>
                  <button
                    className="desk-primary"
                    disabled={busy}
                    onClick={() =>
                      void runTool(section === 'agents' ? 'agent' : (section as WorkResult['kind']))
                    }
                  >
                    <Sparkles size={16} />
                    {section === 'agents'
                      ? nt('运行启用的工作流', 'Run enabled workflow')
                      : nt('生成候选', 'Generate candidate')}
                  </button>
                </section>
              )}
              {selectedResult && ['agents', 'polish', 'analysis', 'health'].includes(section) && (
                <section className="desk-paper">
                  <div className="desk-row">
                    <h2>{nt('候选结果', 'Candidate result')}</h2>
                    <select
                      aria-label={nt('历史结果', 'Result history')}
                      value={selectedResult.id}
                      onChange={(e) => setActiveResult(e.target.value)}
                    >
                      {sectionResults.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.title} · {new Date(r.createdAt).toLocaleString()}
                        </option>
                      ))}
                    </select>
                  </div>
                  <pre>{selectedResult.text}</pre>
                  <button disabled={busy} onClick={() => setSection('lore')}>
                    {nt('查看世界观关联与确认', 'Review world link')}
                  </button>
                  {selectedResult.kind === 'agent' && !selectedResult.applied && selectedResult.chapterId && (
                    <button
                      disabled={busy}
                      onClick={() => {
                        try {
                          change((d) => applyAgentDraft(d, selectedResult), 'ai')
                          void flush()
                        } catch (e) {
                          session.setError(String(e))
                        }
                      }}
                    >
                      {nt('确认追加到对应章节（保留版本）', 'Append to linked chapter (keep snapshot)')}
                    </button>
                  )}
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (wb.resources.length >= 100) {
                        session.setError(nt('资源库已达到 100 条上限', 'Resource limit of 100 reached'))
                        return
                      }
                      patch((w) => ({
                        ...w,
                        resources: [
                          ...w.resources,
                          {
                            ...newCard('analysis'),
                            title: selectedResult.title,
                            content: selectedResult.text,
                          },
                        ],
                      }))
                      setNotice(nt('已保存到资源库', 'Saved to resource library'))
                    }}
                  >
                    {nt('保存为资源', 'Save as resource')}
                  </button>
                  {selectedResult.kind === 'polish' && !selectedResult.applied && (
                    <button
                      disabled={busy}
                      onClick={() => {
                        try {
                          change((d) => applyPolish(d, selectedResult), 'ai')
                          void flush()
                        } catch (e) {
                          session.setError(String(e))
                        }
                      }}
                    >
                      {nt('确认替换原章节（保留版本）', 'Replace original chapter (keep snapshot)')}
                    </button>
                  )}
                </section>
              )}
            </div>
          )}
          {busy && (
            <section className="desk-paper desk-output" role="status">
              <button onClick={stop}>
                <Square size={15} />
                {nt('停止生成', 'Stop generation')}
              </button>
              <p>{nt('正在处理，可随时停止…', 'Working; you can stop at any time…')}</p>
              <pre>{working ? stream : session.stream}</pre>
            </section>
          )}
          {generation && section === 'write' && (
            <section className="desk-paper desk-output">
              <h2>{nt('AI 候选 · 作者确认后应用', 'AI candidate · Review before applying')}</h2>
              <GenerationPreview generation={generation} />
              <button
                disabled={busy || generation.status !== 'ready'}
                onClick={() => session.acceptGeneration(generation)}
              >
                {nt('确认采纳', 'Apply candidate')}
              </button>
            </section>
          )}
          {section === 'write' && doc.snapshots.length > 0 && (
            <details className="desk-history">
              <summary>
                {nt('最近版本 · 可在创作旅程中恢复', 'Recent snapshots · Restore in creation journey')}
              </summary>
              {doc.snapshots.slice(0, 5).map((s) => (
                <p key={s.id}>
                  {s.label} · {new Date(s.createdAt).toLocaleString()}
                </p>
              ))}
            </details>
          )}
          {section === 'write' && chapter && (
            <button
              className="desk-checkpoint"
              onClick={() => {
                change((d) => snapshot(d, nt('写作台手动版本', 'Writing desk snapshot')))
                setNotice(nt('已保存版本', 'Snapshot saved'))
              }}
            >
              {nt('保存正文版本', 'Save manuscript snapshot')}
            </button>
          )}
        </main>
      </div>
      {settings && (
        <AISettingsModal
          onClose={() => {
            setSettings(false)
            void session.refreshSettings()
          }}
        />
      )}
    </div>
  )
}
