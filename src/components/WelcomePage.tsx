import { t, message } from '@/lib/i18n'
import { useState, useEffect, useRef } from 'react'
import { useStore } from '@/store'
import {
  ArrowRight,
  BookOpen,
  FolderOpen,
  FolderPlus,
  Orbit,
  Sparkles,
  X,
  Trash2,
  Clock,
  FileText,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { CreationMode } from '@/types'
import { PROFILES } from '@/features/studio/profiles'
import { ModeLanding } from '@/features/studio/ModeLanding'

export function WelcomePage({ mode = 'free' }: { mode?: CreationMode }) {
  const themedMode = mode === 'oc' || mode === 'trpg' || mode === 'tavern' ? mode : null
  const {
    createProject,
    openExampleProject,
    toggleCreateProjectModal,
    toggleOpenProjectModal,
    showCreateProjectModal,
    showOpenProjectModal,
    recentProjects: allRecentProjects,
    openProject,
    deleteProject,
    importProjectJSON,
  } = useStore()
  const recentProjects = allRecentProjects.filter((p) => (p.mode || 'free') === mode)
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [isOpeningExample, setIsOpeningExample] = useState(false)
  const [createProjectError, setCreateProjectError] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [isImportingProject, setIsImportingProject] = useState(false)
  const openProjectInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    useStore.getState().loadRecentProjects()
  }, [])

  const handleDeleteProject = async (projectId: string) => {
    await deleteProject(projectId)
    setConfirmDeleteId(null)
  }

  const handleCreateProject = async () => {
    if (!projectName.trim() || isCreatingProject) return

    setIsCreatingProject(true)
    setCreateProjectError('')
    try {
      await createProject(projectName.trim(), projectDescription.trim(), mode)
      setProjectName('')
      setProjectDescription('')
    } catch (error) {
      console.error('Create project failed:', error)
      setCreateProjectError(error instanceof Error ? error.message : t('创建失败，请稍后重试。'))
    } finally {
      setIsCreatingProject(false)
    }
  }

  const handleOpenExample = async () => {
    if (isOpeningExample) return
    setIsOpeningExample(true)
    setCreateProjectError('')
    try {
      await openExampleProject()
    } catch (error) {
      console.error('Open example failed:', error)
      setCreateProjectError(error instanceof Error ? error.message : t('示例世界打开失败，请稍后重试。'))
    } finally {
      setIsOpeningExample(false)
    }
  }

  const handleOpenProjectFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsImportingProject(true)
    try {
      await importProjectJSON(file)
    } catch (error) {
      setCreateProjectError(error instanceof Error ? error.message : t('导入失败'))
    } finally {
      setIsImportingProject(false)
      event.target.value = ''
    }
  }

  return (
    <main className={themedMode ? `mode-landing-shell home-theme-${themedMode}` : 'welcome-shell'}>
      {themedMode ? (
        <ModeLanding
          mode={themedMode}
          create={toggleCreateProjectModal}
          importProject={toggleOpenProjectModal}
        />
      ) : (
        <>
          <div className="welcome-orbit welcome-orbit-one" aria-hidden="true" />
          <div className="welcome-orbit welcome-orbit-two" aria-hidden="true" />

          <section className="welcome-panel">
            <div className="welcome-copy">
              <div className="brand-lockup">
                <div className="brand-mark">
                  <Orbit />
                </div>
                <div>
                  <span className="brand-name">WD WORLD</span>
                  <span className="brand-edition">WORLD & CHARACTER STUDIO</span>
                </div>
              </div>

              <div className="welcome-hero">
                <h2>{PROFILES[mode].label}</h2>
                <p>{PROFILES[mode].description}</p>
                <div className="eyebrow">
                  <Sparkles size={14} />
                  {t(' 本地优先 · 灵感永存')}
                </div>
                <h1>
                  {t('让散落的灵感，')}
                  <br />
                  <span>{t('生长为一个世界。')}</span>
                </h1>
                <p>
                  {t(
                    '先建立世界与角色，再选择小说、OC、TRPG 或酒馆制作模式。可以独立创作，也可以让 AI 推演变化；每一条设定都由你决定。',
                  )}
                </p>
              </div>

              <div className="welcome-stats" aria-label={t('产品特点')}>
                <div>
                  <strong>08</strong>
                  <span>{t('类设定条目')}</span>
                </div>
                <div>
                  <strong>∞</strong>
                  <span>{t('关系与分支')}</span>
                </div>
                <div>
                  <strong>01</strong>
                  <span>{t('完整世界')}</span>
                </div>
              </div>
            </div>

            <div className="welcome-actions">
              <div className="action-heading">
                <span>{t('开始创作')}</span>
                <p>{t('建立新宇宙，或回到正在生长的世界。')}</p>
              </div>

              <button className="project-action project-action-primary" onClick={toggleCreateProjectModal}>
                <span className="project-action-icon">
                  <FolderPlus />
                </span>
                <span className="project-action-copy">
                  <strong>{t('新建世界')}</strong>
                  <small>{t('从一个名字开始你的设定')}</small>
                </span>
                <ArrowRight className="project-action-arrow" />
              </button>

              <button className="project-action" onClick={toggleOpenProjectModal}>
                <span className="project-action-icon">
                  <FolderOpen />
                </span>
                <span className="project-action-copy">
                  <strong>{t('打开已有项目')}</strong>
                  <small>{t('继续编辑本地保存的世界')}</small>
                </span>
                <ArrowRight className="project-action-arrow" />
              </button>

              {mode === 'free' && (
                <button
                  className="project-action project-action-example"
                  onClick={handleOpenExample}
                  disabled={isOpeningExample}
                >
                  <span className="project-action-icon">
                    <Sparkles />
                  </span>
                  <span className="project-action-copy">
                    <strong>{isOpeningExample ? t('正在准备示例…') : t('打开示例世界')}</strong>
                    <small>{t('探索“神秘复苏：雾港档案”的完整设定')}</small>
                  </span>
                  <ArrowRight className="project-action-arrow" />
                </button>
              )}

              {createProjectError && !showCreateProjectModal && (
                <p className="form-error" role="alert">
                  {message(createProjectError)}
                </p>
              )}

              <div className="welcome-tip">
                <BookOpen size={15} />
                {t(' 所有内容仅存储在你的设备中')}
              </div>
            </div>

            {recentProjects.length > 0 && (
              <div className="welcome-recent">
                <div className="action-heading">
                  <span>
                    <Clock size={14} />
                    {t(' 最近项目')}
                  </span>
                  <p>{t('点击直接打开，或删除不再需要的项目。')}</p>
                </div>
                <div className="recent-list">
                  {recentProjects.map((rp) => (
                    <div key={rp.id} className="recent-item">
                      <button
                        className="recent-item-main"
                        onClick={() => openProject(rp.id)}
                        title={t('打开 {0}', { 0: rp.name })}
                        aria-label={t('打开 {0}', { 0: rp.name })}
                      >
                        <span className="recent-item-icon">
                          <FileText size={18} />
                        </span>
                        <span className="recent-item-copy">
                          <strong>{rp.name}</strong>
                          <small>{formatDate(rp.lastOpened)}</small>
                        </span>
                        <ArrowRight className="project-action-arrow" size={17} />
                      </button>
                      {confirmDeleteId === rp.id ? (
                        <div className="recent-item-confirm">
                          <span>{t('确定删除？')}</span>
                          <button className="button-danger-small" onClick={() => handleDeleteProject(rp.id)}>
                            {t('删除')}
                          </button>
                          <button className="button-ghost-small" onClick={() => setConfirmDeleteId(null)}>
                            {t('取消')}
                          </button>
                        </div>
                      ) : (
                        <button
                          className="recent-item-delete"
                          onClick={(e) => {
                            e.stopPropagation()
                            setConfirmDeleteId(rp.id)
                          }}
                          title={t('删除 {0}', { 0: rp.name })}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {showCreateProjectModal && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => e.target === e.currentTarget && toggleCreateProjectModal()}
        >
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-project-title"
          >
            <header className="modal-header">
              <div>
                <span className="modal-kicker">NEW WORLD</span>
                <h2 id="create-project-title">{t('创建新世界')}</h2>
              </div>
              <button className="icon-button" onClick={toggleCreateProjectModal} aria-label={t('关闭')}>
                <X />
              </button>
            </header>
            <div className="modal-body">
              <label className="field-label">
                {t('世界名称')}
                <input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder={t('例如：雾海纪元')}
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                />
              </label>
              <label className="field-label">
                {t('一句话简介 ')}
                <span>{t('可选')}</span>
                <textarea
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder={t('这个世界最独特的规则是什么？')}
                  rows={4}
                />
              </label>
              {createProjectError && (
                <p className="form-error" role="alert">
                  {t('创建失败：')}
                  {message(createProjectError)}
                </p>
              )}
              <div className="modal-actions">
                <button
                  className="button-secondary"
                  onClick={toggleCreateProjectModal}
                  disabled={isCreatingProject}
                >
                  {t('取消')}
                </button>
                <button
                  className="button-primary"
                  onClick={handleCreateProject}
                  disabled={!projectName.trim() || isCreatingProject}
                >
                  {isCreatingProject ? t('正在生成设定…') : t('创建并进入')} <ArrowRight size={17} />
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {showOpenProjectModal && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => e.target === e.currentTarget && toggleOpenProjectModal()}
        >
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="open-project-title"
          >
            <header className="modal-header">
              <div>
                <span className="modal-kicker">OPEN ARCHIVE</span>
                <h2 id="open-project-title">{t('打开已有项目')}</h2>
              </div>
              <button className="icon-button" onClick={toggleOpenProjectModal} aria-label={t('关闭')}>
                <X />
              </button>
            </header>
            <div className="modal-body open-project-empty">
              <span className="empty-folder">
                <FolderOpen />
              </span>
              <h3>{t('选择世界档案')}</h3>
              <p>{t('从本地选择一个已有项目，继续你的创作。')}</p>
              {createProjectError && (
                <p role="alert" className="form-error">
                  {message(createProjectError)}
                </p>
              )}
              <input
                ref={openProjectInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleOpenProjectFile}
                className="hidden"
              />
              <button
                className="button-primary"
                onClick={() => openProjectInputRef.current?.click()}
                disabled={isImportingProject}
              >
                {isImportingProject ? t('正在打开…') : t('浏览本地文件')} <ArrowRight size={17} />
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}
