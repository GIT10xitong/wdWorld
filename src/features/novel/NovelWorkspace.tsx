import { t, message } from '@/lib/i18n'
import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  Download,
  FileText,
  History,
  Lightbulb,
  Loader2,
  Plus,
  Save,
  Settings2,
  Sparkles,
  Square,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { saveAs } from 'file-saver'
import { useStore } from '@/store'
import { MarkdownEditor } from '@/components/MarkdownEditor'
import type { Database } from '@/lib/storage/database'
import type { Project } from '@/types'
import { AISettingsModal } from './AISettingsModal'
import { GenerationPreview } from './GenerationPreview'
import { useNovelSession } from './useNovelSession'
import { STEPS, plainText, restoreSnapshot, snapshot, type AITask } from './model'
import { buildPrompt } from './prompts'
import { stageBlock } from './journey'
import { nt } from './workbench'
import limits from '../../../electron/ai-limits.json'
import { SeedControls, seedInstruction } from '@/features/studio/seed'
import './novel.css'

const taskLabels: Record<AITask, string> = {
  get idea() {
    return t('完善故事想法')
  },
  get world() {
    return t('构思人物与规则')
  },
  get outline() {
    return t('生成故事大纲')
  },
  get chapters() {
    return t('拆分章节')
  },
  get write() {
    return t('续写本章')
  },
  get rewrite() {
    return t('改写本章')
  },
  get summary() {
    return t('生成本章摘要')
  },
  get review() {
    return t('检查本章矛盾')
  },
}
const defaultTasks: Record<string, AITask> = {
  idea: 'idea',
  world: 'world',
  outline: 'outline',
  chapters: 'chapters',
  write: 'write',
  review: 'review',
  canon: 'review',
}

export function NovelWorkspace({
  database,
  project,
  onWorld,
  onBusyChange,
  onDesk,
}: {
  database: Database
  project: Project
  onWorld: () => void
  onBusyChange?: (busy: boolean) => void
  onDesk?: () => void
}) {
  const session = useNovelSession(database, project)
  const { doc, change, error, busy, stream, flush, updateChapter } = session
  useEffect(() => {
    onBusyChange?.(busy)
    return () => onBusyChange?.(false)
  }, [busy, onBusyChange])
  const entries = useStore((s) => s.entries)
  const saveStatus = useStore((s) => s.saveStatus)
  const saveError = useStore((s) => s.saveError)
  const [settings, setSettings] = useState(false)
  const [history, setHistory] = useState(false)
  const instruction = doc.instructions?.[doc.step] || ''
  const setInstruction = (value: string) =>
    change((d) => ({ ...d, instructions: { ...d.instructions, [d.step]: value } }))
  const [writingTask, setWritingTask] = useState<'write' | 'rewrite' | 'summary'>('write')
  const [allIssues, setAllIssues] = useState(false)
  const draft = doc.worldDraft || { type: 'character' as const, title: '', content: '' }
  const manualType = draft.type
  const manualTitle = draft.title
  const manualContent = draft.content
  const setDraft = (update: Partial<typeof draft>) =>
    change((d) => ({ ...d, worldDraft: { ...(d.worldDraft || draft), ...update } }))
  const [confirming, setConfirming] = useState<string | null>(null)
  const confirmLock = useRef(false)
  const mainPane = useRef<HTMLElement>(null)
  useEffect(() => {
    mainPane.current?.scrollTo({ top: 0 })
  }, [doc.step])
  const chapter = doc.chapters.find((c) => c.id === doc.selectedChapterId)
  const step = STEPS.find((s) => s.id === doc.step) || STEPS[0]
  const stepIndex = STEPS.indexOf(step)
  const nextBlock = STEPS[stepIndex + 1] ? stageBlock(doc, entries, STEPS[stepIndex + 1].id) : ''
  const currentBlock = stageBlock(doc, entries, doc.step)
  const progressText =
    session.progress?.phase === 'preparing'
      ? t('分段整理资料 · 第 {0} 轮 {1}/{2} 段', {
          0: session.progress.round,
          1: session.progress.part,
          2: session.progress.total,
        })
      : session.progress?.phase === 'thinking'
        ? t('模型正在思考…')
        : session.progress?.phase === 'connected'
          ? t('已连接，等待模型回复…')
          : session.progress?.phase === 'generating'
            ? t('正在接收生成内容…')
            : t('正在连接模型…')
  const pending = doc.proposals.filter((p) => p.status === 'pending')
  const wordCount = doc.chapters.reduce((n, c) => n + plainText(c.content).replace(/\s/g, '').length, 0)
  const generation = doc.generations.find((g) => g.id === session.selectedGenerationId)
  const task = doc.step === 'write' ? writingTask : defaultTasks[doc.step]
  const allowSeed = !['summary', 'review'].includes(task) && doc.step !== 'canon'
  const aiInstruction = [instruction, allowSeed ? seedInstruction('novel', doc.seeds?.[doc.step] || '') : '']
    .filter(Boolean)
    .join('\n\n')
  const visibleIssues = doc.issues
    .map((issue, index) => ({ issue, index }))
    .filter(({ issue }) => allIssues || issue.chapterId === chapter?.id)
  let context: ReturnType<typeof buildPrompt> | null = null
  let contextError = ''
  try {
    context = buildPrompt(task, doc, entries, aiInstruction)
  } catch (e) {
    contextError = e instanceof Error ? e.message : t('资料过长')
  }
  const goWorld = async () => {
    await flush()
    if (useStore.getState().saveStatus !== 'error') onWorld()
  }
  const close = async () => {
    await flush()
    if (useStore.getState().saveStatus !== 'error') useStore.getState().closeProject()
  }
  const exportNovel = () => {
    const text =
      '# ' +
      project.name +
      '\n\n' +
      doc.chapters.map((c) => `## ${c.volume} · ${c.title}\n\n${plainText(c.content)}`).join('\n\n')
    saveAs(new Blob([text], { type: 'text/markdown;charset=utf-8' }), project.name + '.md')
  }
  const moveChapter = (id: string, offset: number) =>
    change((d) => {
      const chapters = [...d.chapters]
      const i = chapters.findIndex((c) => c.id === id)
      const j = i + offset
      if (j < 0 || j >= chapters.length) return d
      ;[chapters[i], chapters[j]] = [chapters[j], chapters[i]]
      return { ...d, chapters }
    })

  return (
    <div className="novel-shell">
      <header className="novel-topbar">
        <button
          className="novel-brand"
          onClick={() => void close()}
          disabled={busy}
          title={t('保存并返回作品列表')}
        >
          <BookOpen size={21} />
          <span>
            WD WORLD<small>{t('小说创作工作台')}</small>
          </span>
        </button>
        <div className="novel-project-name">
          {project.name}
          <span className="novel-local-dot" />
          {t('本地项目')}
        </div>
        <div className="novel-actions">
          {onDesk && (
            <button
              disabled={busy}
              onClick={async () => {
                await flush()
                if (useStore.getState().saveStatus !== 'error') onDesk()
              }}
            >
              {nt('写作台', 'Writing desk')}
            </button>
          )}
          <span role="status" className={saveStatus === 'error' ? 'novel-error' : 'novel-muted'}>
            {saveStatus === 'saving'
              ? t('正在保存…')
              : saveStatus === 'error'
                ? t('保存失败')
                : session.dirty
                  ? t('待保存 · 每 10 秒自动保存')
                  : t('已保存到本机')}
          </span>
          <button onClick={() => void flush()} title={t('保存')} aria-label={t('保存')}>
            <Save size={17} />
          </button>
          <button onClick={() => setHistory(true)} title={t('版本历史')} aria-label={t('版本历史')}>
            <History size={17} />
          </button>
          <button onClick={() => setSettings(true)} disabled={busy}>
            <Settings2 size={16} />
            {t('AI 设置')}
          </button>
          <button className="novel-secondary" onClick={() => void goWorld()} disabled={busy}>
            {t('世界资料库')}
            <ArrowRight size={15} />
          </button>
        </div>
      </header>

      <aside className="novel-sidebar">
        <div className="novel-sidebar-label">
          {t('创作旅程 ')}
          <span>{t('由你掌舵')}</span>
        </div>
        <nav aria-label={t('创作步骤')}>
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              aria-current={doc.step === s.id ? 'step' : undefined}
              className={doc.step === s.id ? 'active' : ''}
              disabled={s.id !== doc.step && !!stageBlock(doc, entries, s.id)}
              title={stageBlock(doc, entries, s.id) || s.hint}
              onClick={() => change((d) => ({ ...d, step: s.id }))}
            >
              <span className="novel-step-number">{String(i + 1).padStart(2, '0')}</span>
              <span>
                {s.label}
                <small>{s.hint}</small>
              </span>
              {s.id === 'canon' && pending.length > 0 && <b>{pending.length}</b>}
            </button>
          ))}
        </nav>
        <div className="novel-sidebar-bottom">
          <div>
            <strong>{doc.chapters.length}</strong>
            <span>{t('章节')}</span>
            <strong>{wordCount.toLocaleString()}</strong>
            <span>{t('字')}</span>
          </div>
          <p>
            {t('按顺序完成，可返回修改。')}
            <br />
            {t('可以独立创作，也可以邀请 AI 帮忙。')}
          </p>
          <button onClick={() => void close()} disabled={busy}>
            <ArrowLeft size={15} />
            {t('返回作品列表')}
          </button>
        </div>
      </aside>

      <main ref={mainPane} className="novel-main">
        <div className="novel-page-heading">
          <div className="novel-eyebrow">CHAPTER OF CREATION / {String(stepIndex + 1).padStart(2, '0')}</div>
          <div className="novel-row">
            <h1>{step.label}</h1>
            <button onClick={() => void flush()}>
              <Save size={16} />
              {t('保存本页')}
            </button>
          </div>
          <p>
            {step.hint}
            {t('。每 10 秒自动保存修改；AI 内容需确认后采纳。')}
          </p>
        </div>
        {(error || saveError) && (
          <div role="alert" className="novel-error-box">
            {message(error || saveError || '')}
            <button aria-label={t('关闭提示')} onClick={() => session.setError('')}>
              <X size={16} />
            </button>
          </div>
        )}

        {doc.step === 'idea' && (
          <>
            <section className="novel-card novel-idea-card">
              <div className="novel-card-title">
                <Lightbulb size={20} />
                <h2>{t('你想讲一个怎样的故事？')}</h2>
              </div>
              <p className="novel-muted">{t('写下一句话、一个人物，或一个“如果……会怎样”的问题。')}</p>
              <label className="novel-sr-only" htmlFor="story-idea">
                {t('故事想法')}
              </label>
              <textarea
                id="story-idea"
                className="novel-idea-input"
                value={doc.idea}
                onChange={(e) => change((d) => ({ ...d, idea: e.target.value }))}
                placeholder={t(
                  '例如：一个只能记住昨天的调查员，发现全城的人都在为同一场尚未发生的谋杀作证……',
                )}
              />
              <div className="novel-row novel-muted">
                <span>{t('灵感不必完整，现在就可以开始。')}</span>
                <span>
                  {doc.idea.length}
                  {t(' 字符')}
                </span>
              </div>
            </section>
            <div className="novel-two-columns">
              <section className="novel-card">
                <label>
                  {t('故事类型')}
                  <input
                    value={doc.genre}
                    onChange={(e) => change((d) => ({ ...d, genre: e.target.value }))}
                    placeholder={t('悬疑 / 奇幻 / 科幻 / 都市……')}
                  />
                </label>
              </section>
              <section className="novel-card">
                <label>
                  {t('叙事与文风')}
                  <input
                    value={doc.style}
                    onChange={(e) => change((d) => ({ ...d, style: e.target.value }))}
                    placeholder={t('第三人称，克制、细腻，逐步揭示谜底')}
                  />
                </label>
              </section>
            </div>
            <div className="novel-path-note">
              <Sparkles size={20} />
              <div>
                <strong>{t('从想法走向完整故事')}</strong>
                <p>{t('先建立人物和世界规则，再安排大纲与章节。右侧助手可以帮你构思第一批设定。')}</p>
              </div>
            </div>
          </>
        )}

        {doc.step === 'world' && (
          <>
            <section className="novel-card">
              <div className="novel-card-title">
                <Users size={19} />
                <h2>{t('手动建立设定')}</h2>
              </div>
              <div className="novel-two-columns">
                <label>
                  {t('类型')}
                  <select
                    value={manualType}
                    onChange={(e) => setDraft({ type: e.target.value as 'character' | 'lore' })}
                  >
                    <option value="character">{t('人物')}</option>
                    <option value="lore">{t('世界规则')}</option>
                  </select>
                </label>
                <label>
                  {t('名称')}
                  <input
                    value={manualTitle}
                    onChange={(e) => setDraft({ title: e.target.value })}
                    placeholder={t('人物名字或规则名称')}
                  />
                </label>
              </div>
              <label>
                {t('设定内容')}
                <textarea
                  value={manualContent}
                  onChange={(e) => setDraft({ content: e.target.value })}
                  placeholder={t('人物的目标、秘密、弱点；或者这个世界的规则与代价……')}
                />
              </label>
              <button
                className="novel-primary"
                onClick={async () => {
                  if (await session.manualSetting(manualType, manualTitle, manualContent)) {
                    setDraft({ title: '', content: '' })
                  }
                }}
              >
                <Plus size={16} />
                {t('加入设定库')}
              </button>
            </section>
            <div className="novel-row">
              <h2>
                {t('已有设定')}{' '}
                <span className="novel-muted">
                  {
                    entries.filter((e) => e.status !== 'archived' && ['character', 'lore'].includes(e.type))
                      .length
                  }
                </span>
              </h2>
              <button onClick={() => void goWorld()} disabled={busy}>
                {t('编辑完整资料库')}
                <ArrowRight size={15} />
              </button>
            </div>
            <div className="novel-two-columns">
              {entries
                .filter((e) => e.status !== 'archived' && ['character', 'lore'].includes(e.type))
                .map((e) => (
                  <article key={e.id} className="novel-card">
                    <span className="novel-eyebrow">
                      {e.type === 'character' ? t('人物') : t('世界规则')}
                      {e.status === 'proposed' ? ` · ${t('AI 待确认')}` : ''}
                    </span>
                    <h3>{e.title}</h3>
                    <p className="novel-setting-excerpt">
                      {plainText(e.content) || e.summary || t('尚未填写内容')}
                    </p>
                  </article>
                ))}
            </div>
            {pending.length > 0 && (
              <p className="novel-notice">
                {t('有')}
                {pending.length}
                {t(' 条 AI 设定建议，请在本页下方逐条确认后继续。')}
              </p>
            )}
          </>
        )}

        {doc.step === 'outline' && (
          <section className="novel-card">
            <div className="novel-row">
              <h2>{t('故事的大方向')}</h2>
              <button onClick={() => session.checkpoint(t('编辑大纲前'))}>
                <History size={15} />
                {t('保存版本')}
              </button>
            </div>
            <p className="novel-muted">
              {t('梗概、主线冲突、人物弧光、关键转折与结局。你可以自己写，也可以采纳右侧生成的大纲。')}
            </p>
            <label className="novel-sr-only" htmlFor="story-outline">
              {t('故事大纲')}
            </label>
            <textarea
              id="story-outline"
              className="novel-outline-input"
              value={doc.outline}
              onChange={(e) => change((d) => ({ ...d, outline: e.target.value }))}
              placeholder={t('第一幕：日常被打破……\\n第二幕：选择的代价……\\n第三幕：最终的冲突与改变……')}
            />
          </section>
        )}

        {(doc.step === 'chapters' || doc.step === 'write' || doc.step === 'review') && (
          <>
            <div className="novel-row">
              <label className="novel-chapter-select">
                {t('当前章节')}
                <select
                  value={chapter?.id || ''}
                  onChange={(e) => change((d) => ({ ...d, selectedChapterId: e.target.value }))}
                >
                  <option value="" disabled>
                    {t('请选择章节')}
                  </option>
                  {doc.chapters.map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.volume} · {c.title}
                    </option>
                  ))}
                </select>
              </label>
              <button className="novel-secondary" onClick={session.addChapter}>
                <Plus size={16} />
                {t('手动新建章节')}
              </button>
            </div>
            {doc.step === 'chapters' && (
              <div className="novel-chapter-list">
                {doc.chapters.map((c, i) => (
                  <article className={`novel-card ${chapter?.id === c.id ? 'selected' : ''}`} key={c.id}>
                    <div className="novel-row">
                      <button
                        className="novel-chapter-name"
                        onClick={() => change((d) => ({ ...d, selectedChapterId: c.id }))}
                      >
                        <span>{String(i + 1).padStart(2, '0')}</span>
                        {c.title}
                      </button>
                      <div className="novel-actions">
                        <button
                          aria-label={t('上移 {0}', { 0: c.title })}
                          disabled={i === 0}
                          onClick={() => moveChapter(c.id, -1)}
                        >
                          ↑
                        </button>
                        <button
                          aria-label={t('下移 {0}', { 0: c.title })}
                          disabled={i === doc.chapters.length - 1}
                          onClick={() => moveChapter(c.id, 1)}
                        >
                          ↓
                        </button>
                        <button
                          title={t('删除章节并保留恢复版本')}
                          aria-label={t('删除 {0}', { 0: c.title })}
                          onClick={() => {
                            if (window.confirm(t('删除“{0}”？会自动保留删除前的版本。', { 0: c.title })))
                              change((d) => ({
                                ...snapshot(d, t('删除章节前')),
                                chapters: d.chapters.filter((x) => x.id !== c.id),
                                selectedChapterId: d.chapters.find((x) => x.id !== c.id)?.id ?? null,
                              }))
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                    {chapter?.id === c.id ? (
                      <>
                        <div className="novel-two-columns">
                          <label>
                            {t('卷名')}
                            <input
                              value={c.volume}
                              onChange={(e) => updateChapter(c.id, { volume: e.target.value })}
                            />
                          </label>
                          <label>
                            {t('章节标题')}
                            <input
                              value={c.title}
                              onChange={(e) => updateChapter(c.id, { title: e.target.value })}
                            />
                          </label>
                        </div>
                        <label>
                          {t('本章大纲')}
                          <textarea
                            value={c.outline}
                            onChange={(e) => updateChapter(c.id, { outline: e.target.value })}
                            placeholder={t('本章目标、冲突、转折、结尾悬念')}
                          />
                        </label>
                        <button onClick={() => change((d) => ({ ...d, step: 'write' }))}>
                          {t('开始写这一章')}
                          <ArrowRight size={15} />
                        </button>
                      </>
                    ) : (
                      <p className="novel-setting-excerpt">{c.outline || t('还没有章节大纲')}</p>
                    )}
                  </article>
                ))}
              </div>
            )}
            {chapter && doc.step === 'write' && (
              <>
                <section className="novel-card">
                  <div className="novel-row">
                    <h2>{chapter.title}</h2>
                    <div className="novel-actions">
                      <span className="novel-muted">
                        {plainText(chapter.content).replace(/\s/g, '').length}
                        {t(' 字')}
                      </span>
                      <select
                        aria-label={t('章节状态')}
                        value={chapter.status}
                        onChange={(e) =>
                          updateChapter(chapter.id, { status: e.target.value as 'draft' | 'complete' })
                        }
                      >
                        <option value="draft">{t('草稿')}</option>
                        <option value="complete">{t('已完成')}</option>
                      </select>
                    </div>
                  </div>
                  <details>
                    <summary>
                      {t('本章大纲')}
                      <ChevronDown size={14} />
                    </summary>
                    <textarea
                      aria-label={t('本章大纲')}
                      value={chapter.outline}
                      onChange={(e) => updateChapter(chapter.id, { outline: e.target.value })}
                    />
                  </details>
                  <MarkdownEditor
                    key={chapter.id}
                    content={chapter.content}
                    onChange={(content) => updateChapter(chapter.id, { content })}
                    placeholder={t('故事从这里继续……')}
                  />
                </section>
                <section className="novel-card">
                  <label>
                    {t('本章摘要 ')}
                    <span className="novel-muted">{t('供后续章节参考')}</span>
                    <textarea
                      value={chapter.summary}
                      onChange={(e) => updateChapter(chapter.id, { summary: e.target.value })}
                      placeholder={t('记录已发生的事件、人物状态变化和尚未解决的伏笔。')}
                    />
                  </label>
                  <button
                    disabled={busy || !plainText(chapter.content)}
                    onClick={() => {
                      setWritingTask('summary')
                      void session.run('summary', instruction)
                    }}
                  >
                    <Sparkles size={16} />
                    {t('生成摘要候选')}
                  </button>
                  <p className="novel-muted">
                    {t('根据当前正文总结，采纳后才会更新摘要；仍可直接手动编辑。')}
                  </p>
                </section>
                <button onClick={exportNovel}>
                  <Download size={16} />
                  {t('导出小说 Markdown')}
                </button>
              </>
            )}
            {chapter && doc.step === 'review' && (
              <>
                <section className="novel-card">
                  <h2>{t('本次检查范围')}</h2>
                  <p>
                    {t('当前章节「')}
                    {chapter.title}
                    {t('」、已勾选设定、故事大纲和前文摘要。')}
                  </p>
                  <p className="novel-muted">
                    {t('这是辅助核对，不代表全文无矛盾。检查建议需要你结合原文判断。你也可以手动记录问题。')}
                  </p>
                  <button
                    onClick={() =>
                      change((d) => ({
                        ...d,
                        issues: [
                          ...d.issues,
                          {
                            chapterId: chapter.id,
                            createdAt: new Date().toISOString(),
                            get title() {
                              return t('待核对的问题')
                            },
                            evidence: '',
                            suggestion: '',
                            resolved: false,
                          },
                        ],
                      }))
                    }
                  >
                    <Plus size={16} />
                    {t('手动记录问题')}
                  </button>
                </section>
                <div className="novel-row">
                  <h2>{allIssues ? t('全部检查记录') : t('本章检查记录')}</h2>
                  <span className="novel-muted">
                    {visibleIssues.filter(({ issue }) => !issue.resolved).length}
                    {t(' 项待处理')}
                  </span>
                </div>
                <label className="novel-check">
                  <input
                    type="checkbox"
                    checked={allIssues}
                    onChange={(e) => setAllIssues(e.target.checked)}
                  />
                  {t('显示全部章节与旧版记录（共 ')}
                  {doc.issues.length}
                  {t(' 项）')}
                </label>
                {!visibleIssues.length && (
                  <p className="novel-muted">{t('暂无保留的问题。每次检查的结果会追加保存。')}</p>
                )}
                {visibleIssues.map(({ issue, index: i }) => (
                  <section key={i} className="novel-card">
                    <p className="novel-muted">
                      {issue.chapterId
                        ? doc.chapters.find((c) => c.id === issue.chapterId)?.title || t('原章节已删除')
                        : t('旧版记录 · 未关联章节')}
                      {issue.createdAt && ` · ${new Date(issue.createdAt).toLocaleString()}`}
                    </p>
                    <label className="novel-check">
                      <input
                        type="checkbox"
                        checked={issue.resolved}
                        onChange={(e) =>
                          change((d) => ({
                            ...d,
                            issues: d.issues.map((x, n) =>
                              n === i ? { ...x, resolved: e.target.checked } : x,
                            ),
                          }))
                        }
                      />
                      {t('已处理')}
                    </label>
                    {(['title', 'evidence', 'suggestion'] as const).map((field, n) => (
                      <label key={field}>
                        {[t('问题'), t('原文与出处'), t('修改建议')][n]}
                        <textarea
                          aria-label={[t('问题'), t('原文与出处'), t('修改建议')][n]}
                          value={issue[field]}
                          onChange={(e) =>
                            change((d) => ({
                              ...d,
                              issues: d.issues.map((x, j) =>
                                i === j ? { ...x, [field]: e.target.value } : x,
                              ),
                            }))
                          }
                        />
                      </label>
                    ))}
                  </section>
                ))}
              </>
            )}
            {!chapter && (
              <div className="novel-empty">
                <FileText size={36} />
                <h2>{t('故事还没有章节')}</h2>
                <p>{t('手动新建第一章，或在右侧选择“拆分章节”。')}</p>
                <button onClick={session.addChapter} className="novel-primary">
                  <Plus size={16} />
                  {t('新建第一章')}
                </button>
              </div>
            )}
          </>
        )}

        {(doc.step === 'canon' || (doc.step === 'world' && doc.proposals.length > 0)) && (
          <>
            <div className="novel-notice">
              {t('每条建议都可以编辑、拒绝或确认。更新已有设定时会保留原文；新设定会加入世界资料库。')}
            </div>
            {doc.proposals.length === 0 && (
              <div className="novel-empty">
                <Check size={36} />
                <h2>{t('暂无待确认的设定')}</h2>
                <p>{t('先构思人物与规则，或检查章节中的新事实。也可以直接手动建立设定。')}</p>
                <button onClick={() => change((d) => ({ ...d, step: 'world' }))}>
                  {t('手动建立设定')}
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
            {doc.proposals.map((p) => (
              <section key={p.id} className="novel-card">
                <div className="novel-row">
                  <span className="novel-pill">
                    {p.type === 'character' ? t('人物') : t('世界规则')} ·{' '}
                    {p.targetEntryId ? t('更新现有设定') : t('新增设定')}
                  </span>
                  <span className="novel-muted">
                    {p.status === 'pending'
                      ? t('等待作者确认')
                      : p.status === 'accepted'
                        ? t('已确认')
                        : p.status === 'reverted'
                          ? t('已撤销更新')
                          : t('已拒绝')}
                  </span>
                </div>
                <label>
                  {t('名称')}
                  <input
                    disabled={p.status !== 'pending' || !!p.targetEntryId}
                    value={p.title}
                    onChange={(e) =>
                      change((d) => ({
                        ...d,
                        proposals: d.proposals.map((x) =>
                          x.id === p.id ? { ...x, title: e.target.value } : x,
                        ),
                      }))
                    }
                  />
                </label>
                {p.targetEntryId && (
                  <details>
                    <summary>{t('查看原设定')}</summary>
                    <p className="novel-prewrap">{plainText(p.baseContent || p.previousContent || '')}</p>
                  </details>
                )}
                <label>
                  {t('建议内容')}
                  <textarea
                    disabled={p.status !== 'pending'}
                    value={p.content}
                    onChange={(e) =>
                      change((d) => ({
                        ...d,
                        proposals: d.proposals.map((x) =>
                          x.id === p.id ? { ...x, content: e.target.value } : x,
                        ),
                      }))
                    }
                  />
                </label>
                <p className="novel-muted novel-prewrap">
                  {t('依据：')}
                  {p.evidence || t('未提供出处，请人工核对')}
                </p>
                {p.status === 'accepted' && p.targetEntryId && typeof p.previousContent === 'string' && (
                  <div>
                    <button
                      disabled={!!confirming}
                      onClick={async () => {
                        if (confirmLock.current) return
                        confirmLock.current = true
                        setConfirming(p.id)
                        try {
                          await session.confirmSetting(p.id, true)
                        } finally {
                          confirmLock.current = false
                          setConfirming(null)
                        }
                      }}
                    >
                      {t('撤销这次设定更新')}
                    </button>
                    <p className="novel-muted">
                      {t('恢复更新前的正文。若设定已有后续修改，请在资料库中手动调整。')}
                    </p>
                  </div>
                )}
                {p.status === 'pending' && (
                  <div className="novel-actions">
                    <button
                      className="novel-primary"
                      disabled={!!confirming}
                      onClick={async () => {
                        if (confirmLock.current) return
                        confirmLock.current = true
                        setConfirming(p.id)
                        try {
                          await session.confirmSetting(p.id)
                        } finally {
                          confirmLock.current = false
                          setConfirming(null)
                        }
                      }}
                    >
                      <Check size={16} />
                      {confirming === p.id ? t('保存中…') : t('确认并更新设定库')}
                    </button>
                    <button
                      onClick={() =>
                        change((d) => ({
                          ...d,
                          proposals: d.proposals.map((x) =>
                            x.id === p.id ? { ...x, status: 'rejected' } : x,
                          ),
                        }))
                      }
                    >
                      {t('拒绝建议')}
                    </button>
                  </div>
                )}
              </section>
            ))}
          </>
        )}

        {nextBlock && <p className="novel-notice">{nextBlock}</p>}
        <footer className="novel-step-footer">
          <button
            disabled={stepIndex === 0}
            onClick={() => change((d) => ({ ...d, step: STEPS[stepIndex - 1].id }))}
          >
            <ArrowLeft size={16} />
            {t('上一步')}
          </button>
          <button
            disabled={stepIndex === STEPS.length - 1 || !!nextBlock}
            title={nextBlock}
            className="novel-secondary"
            onClick={() => change((d) => ({ ...d, step: STEPS[stepIndex + 1].id }))}
          >
            {t('下一步：')}
            {STEPS[stepIndex + 1]?.label || t('完成')}
            <ArrowRight size={16} />
          </button>
        </footer>
      </main>

      <aside className="novel-assistant">
        <div className="novel-assistant-heading">
          <div>
            <Sparkles size={19} />
            <h2>{t('创作助手')}</h2>
          </div>
          <span className="novel-pill">AI</span>
        </div>
        <p className="novel-muted">{t('提供灵感与草稿，最终决定属于你。')}</p>
        <p className="novel-muted">
          {t('当前模型：')}
          {session.progress && busy
            ? session.progress.model
            : session.activeSettings?.model || t('尚未配置，请打开 AI 设置')}
        </p>
        {chapter && ['write', 'review', 'canon'].includes(doc.step) && (
          <details className="novel-context" open>
            <summary>
              {t('本章补充资料 ·')}
              {chapter.entryIds.length}
            </summary>
            <p className="novel-muted">
              {t('02 中已确认的人物与规则自动包含。可补充选择地点、物品等资料。')}
            </p>
            <div className="novel-context-list">
              {entries
                .filter((e) => e.status !== 'archived' && !['character', 'lore'].includes(e.type))
                .map((e) => (
                  <label className="novel-check" key={e.id}>
                    <input
                      type="checkbox"
                      checked={chapter.entryIds.includes(e.id)}
                      onChange={(ev) =>
                        updateChapter(chapter.id, {
                          entryIds: ev.target.checked
                            ? [...chapter.entryIds, e.id]
                            : chapter.entryIds.filter((id) => id !== e.id),
                        })
                      }
                    />
                    {e.title}
                  </label>
                ))}
              {entries.length === 0 && <p className="novel-muted">{t('先手动建立设定，或采纳设定建议。')}</p>}
            </div>
          </details>
        )}
        <details className="novel-context">
          <summary>
            {t('查看将发送的资料 ·')}
            {context?.characters.toLocaleString() || 0}
            {t(' 字符')}
          </summary>
          <p className="novel-muted">
            {t('按阶段发送：')}
            {context?.stages.join(' → ')}。
            {context?.sources.length ? t('已确认设定：{0}', { 0: context.sources.join('、') }) : ''}
          </p>
          <pre>{context?.messages[1].content || contextError}</pre>
        </details>
        {!!context && context.characters > limits.inputChars && (
          <p className="novel-notice">
            {t('长资料将按约 ')}
            {limits.chunkChars.toLocaleString()}
            {t(
              ' 字符分段发送，逐段整理后再生成。 摘要可能遗漏细节，完成后可查看实际使用的资料；原稿保持完整。',
            )}
          </p>
        )}
        <label>
          {t('给助手的要求')}
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder={t('例如：保留悬念，不要在本章揭示凶手；重点描写人物的犹豫。')}
          />
        </label>
        {doc.step === 'write' && (
          <label>
            {t('写作任务')}
            <select
              value={writingTask}
              disabled={busy}
              onChange={(e) => setWritingTask(e.target.value as typeof writingTask)}
            >
              <option value="write">{t('续写本章（追加正文）')}</option>
              <option value="rewrite">{t('改写本章（替换全文）')}</option>
              <option value="summary">{t('总结本章（更新摘要）')}</option>
            </select>
          </label>
        )}
        {contextError && <p className="novel-error">{contextError}</p>}
        {allowSeed && (
          <SeedControls
            value={doc.seeds?.[doc.step] || ''}
            disabled={busy}
            onChange={(value) => change((d) => ({ ...d, seeds: { ...d.seeds, [d.step]: value } }))}
          />
        )}
        {currentBlock && <p className="novel-notice">{currentBlock}</p>}
        {busy ? (
          <button className="novel-secondary novel-full" onClick={session.cancel}>
            <Square size={15} />
            {t('停止生成')}
          </button>
        ) : doc.step === 'canon' ? (
          <p className="novel-notice">{t('请逐条确认本页建议。需要新的检查时，返回 06 检查矛盾。')}</p>
        ) : (
          <button
            className="novel-primary novel-full"
            disabled={
              !!currentBlock || !!contextError || (['write', 'review'].includes(doc.step) && !chapter)
            }
            onClick={() => void session.run(task, aiInstruction)}
          >
            <Sparkles size={16} />
            {taskLabels[task]}
          </button>
        )}
        <div className="novel-result">
          <div className="novel-row">
            <h3>{busy ? t('正在生成…') : t('候选结果')}</h3>
            {busy && <Loader2 size={16} className="animate-spin" />}
          </div>
          {busy ? (
            <>
              <p role="status" className="novel-muted">
                {progressText}
                {t(' · 已用')}
                {session.elapsed}
                {t(' 秒')}
              </p>
              <pre>
                {['world', 'chapters', 'review'].includes(task)
                  ? stream
                    ? t('正在整理建议，完成后会显示在这里…')
                    : progressText
                  : stream || progressText}
              </pre>
            </>
          ) : generation ? (
            <>
              <p className="novel-muted">
                {taskLabels[generation.task]} · {new Date(generation.createdAt).toLocaleString()}
              </p>
              <GenerationPreview generation={generation} />
              {generation.contextDigest && (
                <details className="novel-context">
                  <summary>{t('查看本次分段整理资料')}</summary>
                  <pre>{generation.contextDigest}</pre>
                </details>
              )}
              <div className="novel-actions">
                {generation.status === 'ready' && (
                  <>
                    <button className="novel-primary" onClick={() => session.acceptGeneration(generation)}>
                      <Check size={15} />
                      {generation.task === 'world' || generation.task === 'review'
                        ? t('保留为待确认建议')
                        : generation.task === 'chapters'
                          ? t('追加这些章节')
                          : t('采纳结果')}
                    </button>
                    <button
                      onClick={() =>
                        change((d) => ({
                          ...d,
                          generations: d.generations.map((g) =>
                            g.id === generation.id ? { ...g, status: 'discarded' } : g,
                          ),
                        }))
                      }
                    >
                      {t('舍弃')}
                    </button>
                  </>
                )}
                {generation.status !== 'ready' && (
                  <span className="novel-muted">
                    {generation.status === 'applied'
                      ? t('已采纳，可在版本历史恢复正文或大纲')
                      : generation.status === 'interrupted'
                        ? t('未完整生成，仅供手动参考')
                        : t('已舍弃')}
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="novel-result-empty">
              <Sparkles size={27} />
              <p>
                {t('生成的内容会先出现在这里，')}
                <br />
                {t('不会直接覆盖你的创作。')}
              </p>
            </div>
          )}
        </div>
        <details className="novel-context">
          <summary>
            {t('生成记录 ·')}
            {doc.generations.length}
          </summary>
          {doc.generations.map((g) => (
            <button
              className="novel-history-item"
              key={g.id}
              onClick={() => session.setSelectedGenerationId(g.id)}
            >
              {taskLabels[g.task]}
              <small>{new Date(g.createdAt).toLocaleString()}</small>
            </button>
          ))}
        </details>
        <div className="novel-assistant-footnote">{t('未配置 AI 时，所有手动创作功能仍可使用。')}</div>
      </aside>

      {settings && (
        <AISettingsModal
          onClose={() => {
            setSettings(false)
            void session.refreshSettings()
          }}
        />
      )}
      {history && (
        <div className="novel-modal-backdrop">
          <section role="dialog" aria-modal="true" aria-label={t('版本历史')} className="novel-modal">
            <div className="novel-row">
              <h2>
                <History size={20} />
                {t('版本历史')}
              </h2>
              <button aria-label={t('关闭版本历史')} onClick={() => setHistory(false)}>
                <X size={20} />
              </button>
            </div>
            <p className="novel-muted">
              {t(
                '保留最近 20 个版本。恢复故事想法、大纲、章节和检查记录；已确认的资料库设定不受影响。恢复前会自动保存当前版本。',
              )}
            </p>
            <button className="novel-primary" onClick={() => session.checkpoint()}>
              <Plus size={16} />
              {t('保存当前版本')}
            </button>
            <div className="novel-version-list">
              {doc.snapshots.map((s) => (
                <div className="novel-row" key={s.id}>
                  <div>
                    {message(s.label)}
                    <small>{new Date(s.createdAt).toLocaleString()}</small>
                  </div>
                  <button
                    onClick={() => {
                      change((d) => restoreSnapshot(d, s.id))
                      setHistory(false)
                    }}
                  >
                    {t('恢复')}
                  </button>
                </div>
              ))}
              {doc.snapshots.length === 0 && <p>{t('还没有版本。采纳 AI 结果、删除章节时会自动保存。')}</p>}
            </div>
            <button
              onClick={async () => {
                await flush()
                await useStore.getState().exportProjectJSON()
              }}
            >
              <Download size={16} />
              {t('导出完整项目备份')}
            </button>
            <p className="novel-muted">{t('导出的是明文 JSON，便于跨电脑恢复，请妥善保管。')}</p>
          </section>
        </div>
      )}
    </div>
  )
}
