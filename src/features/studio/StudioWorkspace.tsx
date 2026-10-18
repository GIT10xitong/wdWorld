import { t, message } from '@/lib/i18n'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { WorldBookEditor } from './WorldBookEditor'
import { saveAs } from 'file-saver'
import { Save, Sparkles, Settings2, Square, Download } from 'lucide-react'
import { useStore } from '@/store'
import type { Database } from '@/lib/storage/database'
import type { Project } from '@/types'
import { plainText, textToHtml } from '@/features/novel/model'
import { AISettingsModal } from '@/features/novel/AISettingsModal'
import { FIELDS, MODES, parseDraft, studioPrompt, studioSources, type StudioMode } from './model'
import { characterCard, worldBook } from './tavern'
import { useStudioSession } from './useStudioSession'
import { SeedControls } from './seed'
import { TavernWorkshop } from './TavernWorkshop'
import { ScenarioWorkshop } from './ScenarioWorkshop'
import { TrpgWorkshop } from './TrpgWorkshop'
import { parseTavernWorld } from './tavernWorld'
import { StudioHome, type StudioTarget, type StudioPage } from './StudioHome'
import { st } from './homeModel'
import '@/features/novel/novel.css'

export type StudioLocation = { home: boolean; target: StudioTarget; bookId?: string }

export function StudioWorkspace({
  mode,
  database,
  project,
  onBusyChange,
  onNavigate,
  toolbarHost,
  initialLocation,
  onLocationChange,
}: {
  mode: StudioMode
  database: Database
  project: Project
  onBusyChange: (busy: boolean) => void
  onNavigate: (page: StudioPage) => void
  toolbarHost: HTMLDivElement | null
  initialLocation?: StudioLocation
  onLocationChange: (location: StudioLocation) => void
}) {
  const session = useStudioSession(database, project.id, mode)
  const { doc, change, dirty, error, setError, busy, stream, progress, flush } = session
  const entries = useStore((s) => s.entries)
  const relations = useStore((s) => s.relations)
  const saveStatus = useStore((s) => s.saveStatus)
  const saveError = useStore((s) => s.saveError)
  const [settings, setSettings] = useState(false)
  const [model, setModel] = useState('')
  const [notice, setNotice] = useState('')
  const [working, setWorking] = useState(false)
  const [location, setLocation] = useState<StudioLocation>(
    initialLocation || { home: mode !== 'simulation', target: 'draft' },
  )
  const { home, target } = location
  const workspace = useRef<HTMLElement>(null)
  const navigate = (next: Partial<StudioLocation>) => {
    const value = { ...location, ...next }
    setLocation(value)
    onLocationChange(value)
  }
  const edit = (next: StudioTarget) => navigate({ target: next, home: false })
  useEffect(() => {
    workspace.current?.querySelector('.studio-editor')?.scrollTo({ top: 0 })
  }, [home, target])
  const lock = useRef(false)
  const draft = doc.drafts[mode]
  const candidate = doc.candidates[mode]
  let candidateFields: Record<string, string> | null = null
  let candidateWorld: ReturnType<typeof parseTavernWorld> | null = null
  if (candidate?.kind === 'world') {
    try {
      candidateWorld = parseTavernWorld(candidate.text)
    } catch {
      /* Raw result remains visible. */
    }
  }
  if (
    candidate &&
    candidate.kind !== 'world' &&
    mode !== 'simulation' &&
    candidate.status !== 'interrupted'
  ) {
    try {
      candidateFields = parseDraft(mode, candidate.text)
    } catch {
      /* Keep invalid output available for review. */
    }
  }
  const sources = studioSources(doc, mode, entries)
  const title = mode === 'simulation' ? t('AI 辅助推演世界变更') : MODES.find((m) => m.id === mode)!.label
  const description = {
    get oc() {
      return t('塑造角色的外在特征、动机与关系。档案确认后可加入世界观人物库。')
    },
    get trpg() {
      return t('准备场景、线索与分支，主持人秘密和实际跑团记录分别管理。')
    },
    get tavern() {
      return t('制作可导出的角色卡与世界书。世界书是设定副本，可独立编辑触发词与正文。')
    },
    get simulation() {
      return t('提出变化，观察因果链与分支，再逐条决定是否更新世界设定。')
    },
  }[mode]
  useEffect(() => {
    onBusyChange(busy || working)
    return () => onBusyChange(false)
  }, [busy, working, onBusyChange])
  useEffect(() => {
    let alive = true
    window.novelAI
      ?.getSettings()
      .then((s) => {
        if (alive) setModel(s.model)
      })
      .catch((e) => {
        if (alive) setError(e.message)
      })
    return () => {
      alive = false
    }
  }, [settings])
  const field = (key: string, value: string) =>
    change((d) => ({ ...d, drafts: { ...d.drafts, [mode]: { ...d.drafts[mode], [key]: value } } }))
  const action = async (execute: () => void | Promise<void>) => {
    if (lock.current) return
    lock.current = true
    setWorking(true)
    setError('')
    setNotice('')
    try {
      await execute()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('操作失败'))
    } finally {
      lock.current = false
      setWorking(false)
    }
  }
  const download = (value: unknown, name: string) =>
    saveAs(
      new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' }),
      name.replace(/[<>:"/\\|?*]/g, '_') + '.json',
    )
  const confirmImpact = (simulationId: string, impactId: string, revert = false) =>
    action(async () => {
      const next = await database.applyWorldImpact(project.id, simulationId, impactId, revert)
      change(() => next)
      await useStore.getState().fetchEntries()
      await flush()
      if (useStore.getState().saveStatus === 'error')
        throw new Error(t('设定已在当前会话更新，但磁盘保存失败，请立即重试保存。'))
      setNotice(revert ? t('已恢复变更前的正文') : t('已确认并更新世界设定'))
    })
  const toolbar = (
    <div className="studio-toolbar">
      {mode !== 'simulation' && (
        <nav className="studio-home-nav" aria-label={st('模式工作台导航', 'Mode workspace navigation')}>
          <button
            disabled={busy || working}
            aria-current={home ? 'page' : undefined}
            onClick={() => navigate({ home: true })}
          >
            {st('创作主页', 'Creative home')}
          </button>
          <button
            disabled={busy || working}
            aria-current={!home ? 'page' : undefined}
            onClick={() => edit(target)}
          >
            {st('编辑工作台', 'Editing workbench')}
          </button>
        </nav>
      )}
      <div className="studio-actions">
        <button onClick={() => void action(flush)} disabled={working}>
          <Save size={16} />
          {t('保存本页')}
        </button>
        <button onClick={() => setSettings(true)} disabled={busy}>
          <Settings2 size={16} />
          {t('AI 设置')}
        </button>
      </div>
    </div>
  )
  return (
    <section
      ref={workspace}
      className={`studio-shell ${mode !== 'simulation' ? `home-theme-${mode} studio-themed` : ''}`}
    >
      {toolbarHost ? createPortal(toolbar, toolbarHost) : toolbar}
      <header className={`studio-heading ${home ? '' : 'studio-heading-compact'}`}>
        <div>
          <small>
            {project.name}
            {t(' / 独立创作模式')}
          </small>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <span role="status">
          {saveStatus === 'error'
            ? t('保存失败，请重试')
            : saveStatus === 'saving'
              ? t('正在保存')
              : dirty
                ? t('待保存 · 每 10 秒自动保存')
                : t('已保存到本机')}
        </span>
      </header>
      {(error || saveError) && (
        <p role="alert" className="mode-error">
          {message(error || saveError || '')}
        </p>
      )}
      {notice && (
        <p role="status" className="studio-notice">
          {notice}
        </p>
      )}
      {home && mode !== 'simulation' && (
        <StudioHome
          mode={mode}
          doc={doc}
          project={project}
          entries={entries}
          relations={relations}
          disabled={busy || working}
          edit={edit}
          navigate={onNavigate}
          openEntry={(id) => {
            useStore.getState().selectEntry(id)
            onNavigate('world')
          }}
        />
      )}
      {!home && mode !== 'simulation' && (
        <nav className="studio-sections" aria-label={st('编辑分区', 'Editor sections')}>
          {(
            [
              [
                'draft',
                mode === 'oc'
                  ? st('人物档案', 'Character profile')
                  : mode === 'trpg'
                    ? st('备团草稿', 'Session draft')
                    : st('角色草稿', 'Character draft'),
              ],
              ...(mode === 'trpg' ? [['modules', st('副本库', 'Module library')]] : []),
              ...(mode === 'tavern'
                ? [
                    ['book', st('世界书', 'World book')],
                    ['cards', st('角色卡工坊', 'Character workshop')],
                    ['scenarios', st('场景卡', 'Scenario cards')],
                  ]
                : []),
              ['assistant', t('AI 创作助手')],
            ] as [StudioTarget, string][]
          ).map(([id, label]) => (
            <button key={id} aria-current={target === id ? 'page' : undefined} onClick={() => edit(id)}>
              {label}
            </button>
          ))}
        </nav>
      )}
      <div
        className={`studio-layout ${target !== 'draft' && mode !== 'simulation' ? 'studio-layout-single' : ''}`}
        hidden={home}
      >
        <main className="studio-editor" hidden={target === 'assistant'}>
          {mode === 'trpg' && (
            <div data-studio-section="modules" hidden={target !== 'modules'}>
              <TrpgWorkshop
                doc={doc}
                change={change}
                disabled={busy || working}
                database={database}
                projectId={project.id}
                onError={setError}
                flush={flush}
                onLoaded={() => edit('draft')}
                random={() => {
                  edit('assistant')
                  void session.run('trpg-world')
                }}
              />
            </div>
          )}
          {mode === 'tavern' && (
            <div data-studio-section="scenarios" hidden={target !== 'scenarios'}>
              <ScenarioWorkshop
                doc={doc}
                change={change}
                disabled={busy || working}
                onError={setError}
                onLoaded={() => edit('draft')}
              />
            </div>
          )}
          <section
            className="studio-card"
            data-studio-section="draft"
            hidden={target !== 'draft' && mode !== 'simulation'}
          >
            <h2>{mode === 'simulation' ? t('变更条件') : t('创作草稿')}</h2>
            <div className="studio-fields">
              {Object.entries(FIELDS[mode]).map(([key, label]) => (
                <label key={key}>
                  {label}
                  {key === 'name' || key === 'system' || key === 'horizon' ? (
                    <input
                      aria-label={label}
                      value={draft[key]}
                      onChange={(e) => field(key, e.target.value)}
                    />
                  ) : (
                    <textarea
                      aria-label={label}
                      rows={key === 'description' || key === 'change' ? 5 : 3}
                      value={draft[key]}
                      onChange={(e) => field(key, e.target.value)}
                    />
                  )}
                </label>
              ))}
            </div>
            {mode === 'oc' && (
              <div className="studio-actions">
                <button
                  disabled={
                    working ||
                    !draft.name.trim() ||
                    (candidate?.status === 'applied' && !!candidate.worldEntryIds?.length)
                  }
                  onClick={() =>
                    void action(async () => {
                      if (entries.some((e) => e.type === 'character' && e.title === draft.name.trim()))
                        throw new Error(t('已有同名人物，请在世界观设定中编辑，避免重复创建。'))
                      const content = Object.entries(FIELDS.oc)
                        .filter(([k]) => k !== 'name')
                        .map(([k, label]) => `${label}\n${draft[k]}`)
                        .join('\n\n')
                      await useStore
                        .getState()
                        .createEntry('character', draft.name.trim(), draft.concept, textToHtml(content))
                      await flush()
                      setNotice(t('已加入世界观人物库'))
                    })
                  }
                >
                  {candidate?.status === 'applied' && candidate.worldEntryIds?.length
                    ? t('已同步到世界观')
                    : t('确认新建人物条目')}
                </button>
              </div>
            )}
            {mode === 'trpg' && (
              <div className="studio-actions">
                <button
                  onClick={() =>
                    saveAs(
                      new Blob(
                        [
                          Object.entries(FIELDS.trpg)
                            .map(([key, label]) => `## ${label}\n\n${draft[key]}`)
                            .join('\n\n'),
                        ],
                        { type: 'text/markdown;charset=utf-8' },
                      ),
                      t('主持人备团记录.md'),
                    )
                  }
                >
                  <Download size={16} />
                  {t('导出主持人备团记录')}
                </button>
                <button
                  onClick={() =>
                    saveAs(new Blob([draft.premise], { type: 'text/plain;charset=utf-8' }), t('玩家背景.txt'))
                  }
                >
                  {t('导出玩家背景')}
                </button>
              </div>
            )}
            {mode === 'tavern' && (
              <div className="studio-actions">
                <button
                  onClick={() =>
                    change((d) => ({
                      ...d,
                      drafts: {
                        ...d.drafts,
                        tavern: {
                          ...d.drafts.tavern,
                          name: d.drafts.tavern.name || d.drafts.oc.name,
                          description:
                            d.drafts.tavern.description ||
                            [d.drafts.oc.appearance, d.drafts.oc.background, d.drafts.oc.motivation]
                              .filter(Boolean)
                              .join('\n\n'),
                          personality: d.drafts.tavern.personality || d.drafts.oc.personality,
                        },
                      },
                    }))
                  }
                >
                  {t('从 OC 填充空白字段')}
                </button>
                <button
                  onClick={() =>
                    void action(() => download(characterCard(draft, doc.book), draft.name || t('角色卡')))
                  }
                >
                  <Download size={16} />
                  {t('导出角色卡 V2 JSON')}
                </button>
              </div>
            )}
          </section>
          {mode === 'tavern' && (
            <div data-studio-section="cards" hidden={target !== 'cards'}>
              <TavernWorkshop
                doc={doc}
                change={change}
                disabled={busy || working}
                onError={setError}
                onLoaded={edit}
              />
            </div>
          )}
          {mode === 'tavern' && (
            <div data-studio-section="book" hidden={target !== 'book'}>
              <WorldBookEditor
                doc={doc}
                change={change}
                sources={sources}
                disabled={busy || working}
                selectedId={location.bookId}
                select={(bookId) => navigate({ bookId })}
                onExport={() => void action(() => download(worldBook(doc.book), project.name + t('世界书')))}
              />
            </div>
          )}
          {mode === 'simulation' && (
            <section className="studio-card">
              <h2>{t('推演记录与待确认变更')}</h2>
              <p className="studio-muted">
                {t(
                  '只更新逐条确认的正文；关系、标题与其他条目保持原样。推演不是既定事实，请核对因果与约束。',
                )}
              </p>
              {doc.simulations.length === 0 && <p>{t('填写变更条件后，点击“推演世界变更”。')}</p>}
              {doc.simulations.map((s) => (
                <article key={s.id} className="studio-simulation">
                  <h3>{s.change}</h3>
                  <small>{new Date(s.createdAt).toLocaleString()}</small>
                  <pre>{s.analysis}</pre>
                  {s.contextDigest && (
                    <details>
                      <summary>{t('查看分段整理资料')}</summary>
                      <pre>{s.contextDigest}</pre>
                    </details>
                  )}
                  {s.impacts.map((p) => (
                    <article className="studio-impact" key={p.id}>
                      <h3>
                        {p.title} ·{' '}
                        {
                          {
                            get pending() {
                              return t('待确认')
                            },
                            get accepted() {
                              return t('已更新')
                            },
                            get rejected() {
                              return t('已拒绝')
                            },
                            get reverted() {
                              return t('已撤销')
                            },
                          }[p.status]
                        }
                      </h3>
                      <p>{p.reason}</p>
                      <div className="studio-diff">
                        <div>
                          <strong>{t('变更前')}</strong>
                          <pre>{plainText(p.before)}</pre>
                        </div>
                        <label>
                          {t('建议的完整正文')}
                          <textarea
                            aria-label={t('建议正文 {0}', { 0: p.title })}
                            rows={6}
                            disabled={p.status !== 'pending' || working}
                            value={p.content}
                            onChange={(e) =>
                              change((d) => ({
                                ...d,
                                simulations: d.simulations.map((x) =>
                                  x.id === s.id
                                    ? {
                                        ...x,
                                        impacts: x.impacts.map((y) =>
                                          y.id === p.id ? { ...y, content: e.target.value } : y,
                                        ),
                                      }
                                    : x,
                                ),
                              }))
                            }
                          />
                        </label>
                      </div>
                      <div className="studio-actions">
                        {p.status === 'pending' && (
                          <>
                            <button disabled={working || busy} onClick={() => void confirmImpact(s.id, p.id)}>
                              {t('确认这条变更')}
                            </button>
                            <button
                              disabled={working || busy}
                              onClick={() =>
                                change((d) => ({
                                  ...d,
                                  simulations: d.simulations.map((x) =>
                                    x.id === s.id
                                      ? {
                                          ...x,
                                          impacts: x.impacts.map((y) =>
                                            y.id === p.id ? { ...y, status: 'rejected' } : y,
                                          ),
                                        }
                                      : x,
                                  ),
                                }))
                              }
                            >
                              {t('拒绝这条建议')}
                            </button>
                          </>
                        )}
                        {p.status === 'accepted' && (
                          <button
                            disabled={working || busy}
                            onClick={() => void confirmImpact(s.id, p.id, true)}
                          >
                            {t('撤销这条变更')}
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </article>
              ))}
            </section>
          )}
        </main>
        <aside
          className="studio-assistant"
          data-studio-section="assistant"
          hidden={mode !== 'simulation' && target !== 'draft' && target !== 'assistant'}
        >
          <h2>{t('AI 创作助手')}</h2>
          <p className="studio-muted">
            {t('当前模型：')}
            {model || t('尚未配置')}
          </p>
          <details>
            <summary>
              {t('参考世界设定（')}
              {sources.length}
              {t(' 条）')}
            </summary>
            <p className="studio-muted">{t('只发送勾选的非归档条目与相互关系，可在发送前查看全文。')}</p>
            <div className="studio-actions">
              <button
                onClick={() =>
                  change((d) => ({
                    ...d,
                    sourceIds: {
                      ...d.sourceIds,
                      [mode]: entries.filter((e) => e.status !== 'archived').map((e) => e.id),
                    },
                  }))
                }
              >
                {t('全选')}
              </button>
              <button onClick={() => change((d) => ({ ...d, sourceIds: { ...d.sourceIds, [mode]: [] } }))}>
                {t('清空')}
              </button>
            </div>
            {entries
              .filter((e) => e.status !== 'archived' && e.status !== 'proposed')
              .map((e) => (
                <label className="studio-check" key={e.id}>
                  <input
                    type="checkbox"
                    checked={sources.some((s) => s.id === e.id)}
                    onChange={(event) =>
                      change((d) => ({
                        ...d,
                        sourceIds: {
                          ...d.sourceIds,
                          [mode]: event.target.checked
                            ? [...sources.map((s) => s.id), e.id]
                            : sources.filter((s) => s.id !== e.id).map((s) => s.id),
                        },
                      }))
                    }
                  />
                  {e.title || t('未命名条目')}
                </label>
              ))}
          </details>
          <details>
            <summary>{t('查看将发送的资料')}</summary>
            <pre>{studioPrompt(mode, doc, entries, relations)[1].content}</pre>
          </details>
          <p className="studio-muted">
            {t('长资料沿用自动分段整理，摘要可能遗漏细节。AI 候选需确认后采纳。')}
          </p>
          <SeedControls
            value={doc.seeds?.[mode] || ''}
            disabled={busy || working}
            onChange={(value) => change((d) => ({ ...d, seeds: { ...d.seeds, [mode]: value } }))}
          />
          {mode === 'tavern' && !busy && (
            <button className="studio-primary" disabled={working} onClick={() => void session.run('world')}>
              {t('随机生成整套酒馆世界')}
            </button>
          )}
          <p className="studio-muted">
            {t('生成的设定自动显示在世界观中，标记为 AI 待确认；采纳后转为正式设定。')}
          </p>
          {busy ? (
            <>
              <p role="status">
                {progress?.phase === 'preparing'
                  ? t('分段整理 {0}/{1}', { 0: progress.part, 1: progress.total })
                  : progress?.phase === 'thinking'
                    ? t('模型正在思考')
                    : stream
                      ? t('正在生成候选')
                      : t('正在连接模型')}
              </p>
              <button onClick={session.stop}>
                <Square size={16} />
                {t('停止生成')}
              </button>
              <pre>{stream}</pre>
            </>
          ) : (
            <button className="studio-primary" disabled={working} onClick={() => void session.run()}>
              <Sparkles size={16} />
              {mode === 'simulation' ? t('推演世界变更') : t('生成辅助草稿')}
            </button>
          )}
          {candidate && !busy && (
            <section>
              <h3>
                {candidate.status === 'interrupted'
                  ? t('未完成的回复（仅供参考）')
                  : mode === 'simulation'
                    ? t('推演原始回复')
                    : candidate.status === 'applied'
                      ? t('已采纳的候选')
                      : t('候选草稿')}
              </h3>
              {candidateWorld ? (
                <div>
                  <h3>{candidateWorld.title}</h3>
                  <p>{candidateWorld.premise}</p>
                  <h4>{t('世界设定')}</h4>
                  {candidateWorld.settings.map((s, i) => (
                    <details key={i}>
                      <summary>{s.title}</summary>
                      <pre>{s.content}</pre>
                    </details>
                  ))}
                  <h4>{t('角色卡')}</h4>
                  {candidateWorld.cards.map((c, i) => (
                    <details key={i}>
                      <summary>{c.name}</summary>
                      <pre>
                        {Object.entries(c)
                          .map(([k, v]) => `${FIELDS.tavern[k as keyof typeof FIELDS.tavern] || k}\n${v}`)
                          .join('\n\n')}
                      </pre>
                    </details>
                  ))}
                  <h4>{t('世界书条目')}</h4>
                  {candidateWorld.book.map((b, i) => (
                    <details key={i}>
                      <summary>{b.title}</summary>
                      <pre>{b.content}</pre>
                    </details>
                  ))}
                </div>
              ) : candidateFields ? (
                <dl className="studio-candidate-fields">
                  {Object.entries(FIELDS[mode]).map(([key, label]) => (
                    <div key={key}>
                      <dt>{label}</dt>
                      <dd>{candidateFields![key] || t('未填写')}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <details>
                  <summary>{t('查看原始回复')}</summary>
                  <pre>{candidate.text}</pre>
                </details>
              )}
              {candidate.contextDigest && (
                <details>
                  <summary>{t('查看分段整理资料')}</summary>
                  <pre>{candidate.contextDigest}</pre>
                </details>
              )}
              {mode !== 'simulation' && candidate.status === 'ready' && (
                <button onClick={() => void session.accept()}>
                  {candidate.kind === 'world' ? t('采纳整套世界与角色卡') : t('采纳到本模式草稿')}
                </button>
              )}
            </section>
          )}
        </aside>
      </div>
      {settings && (
        <div className="novel-shell studio-modal-host">
          <AISettingsModal onClose={() => setSettings(false)} />
        </div>
      )}
    </section>
  )
}
