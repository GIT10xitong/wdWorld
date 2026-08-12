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

export function WelcomePage() {
  const {
    createProject,
    openExampleProject,
    toggleCreateProjectModal,
    toggleOpenProjectModal,
    showCreateProjectModal,
    showOpenProjectModal,
    recentProjects,
    openProject,
    deleteProject,
    importProjectJSON,
  } = useStore()
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
      await createProject(projectName.trim(), projectDescription.trim())
      setProjectName('')
      setProjectDescription('')
    } catch (error) {
      console.error('Create project failed:', error)
      setCreateProjectError(error instanceof Error ? error.message : '创建失败，请稍后重试。')
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
      setCreateProjectError(error instanceof Error ? error.message : '示例世界打开失败，请稍后重试。')
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
    } finally {
      setIsImportingProject(false)
      event.target.value = ''
    }
  }

  return (
    <main className="welcome-shell">
      <div className="welcome-orbit welcome-orbit-one" aria-hidden="true" />
      <div className="welcome-orbit welcome-orbit-two" aria-hidden="true" />

      <section className="welcome-panel">
        <div className="welcome-copy">
          <div className="brand-lockup">
            <div className="brand-mark">
              <Orbit />
            </div>
            <div>
              <span className="brand-name">VVD WORLD</span>
              <span className="brand-edition">WORLD BUILDER</span>
            </div>
          </div>

          <div className="welcome-hero">
            <div className="eyebrow">
              <Sparkles size={14} /> 本地优先 · 灵感永存
            </div>
            <h1>
              让散落的灵感，
              <br />
              <span>生长为一个世界。</span>
            </h1>
            <p>在同一处编织人物、地点、事件与关系。你的设定保存在本地，随时可以继续书写。</p>
          </div>

          <div className="welcome-stats" aria-label="产品特点">
            <div>
              <strong>08</strong>
              <span>类设定条目</span>
            </div>
            <div>
              <strong>∞</strong>
              <span>关系与分支</span>
            </div>
            <div>
              <strong>01</strong>
              <span>完整世界</span>
            </div>
          </div>
        </div>

        <div className="welcome-actions">
          <div className="action-heading">
            <span>开始创作</span>
            <p>建立新宇宙，或回到正在生长的世界。</p>
          </div>

          <button className="project-action project-action-primary" onClick={toggleCreateProjectModal}>
            <span className="project-action-icon">
              <FolderPlus />
            </span>
            <span className="project-action-copy">
              <strong>新建世界</strong>
              <small>从一个名字开始你的设定</small>
            </span>
            <ArrowRight className="project-action-arrow" />
          </button>

          <button className="project-action" onClick={toggleOpenProjectModal}>
            <span className="project-action-icon">
              <FolderOpen />
            </span>
            <span className="project-action-copy">
              <strong>打开已有项目</strong>
              <small>继续编辑本地保存的世界</small>
            </span>
            <ArrowRight className="project-action-arrow" />
          </button>

          <button
            className="project-action project-action-example"
            onClick={handleOpenExample}
            disabled={isOpeningExample}
          >
            <span className="project-action-icon">
              <Sparkles />
            </span>
            <span className="project-action-copy">
              <strong>{isOpeningExample ? '正在准备示例…' : '打开示例世界'}</strong>
              <small>探索“神秘复苏：雾港档案”的完整设定</small>
            </span>
            <ArrowRight className="project-action-arrow" />
          </button>

          {createProjectError && !showCreateProjectModal && (
            <p className="form-error" role="alert">
              {createProjectError}
            </p>
          )}

          <div className="welcome-tip">
            <BookOpen size={15} /> 所有内容仅存储在你的设备中
          </div>
        </div>

        {recentProjects.length > 0 && (
          <div className="welcome-recent">
            <div className="action-heading">
              <span>
                <Clock size={14} /> 最近项目
              </span>
              <p>点击直接打开，或删除不再需要的项目。</p>
            </div>
            <div className="recent-list">
              {recentProjects.map((rp) => (
                <div key={rp.id} className="recent-item">
                  <button
                    className="recent-item-main"
                    onClick={() => openProject(rp.id)}
                    title={`打开 ${rp.name}`}
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
                      <span>确定删除？</span>
                      <button className="button-danger-small" onClick={() => handleDeleteProject(rp.id)}>
                        删除
                      </button>
                      <button className="button-ghost-small" onClick={() => setConfirmDeleteId(null)}>
                        取消
                      </button>
                    </div>
                  ) : (
                    <button
                      className="recent-item-delete"
                      onClick={(e) => {
                        e.stopPropagation()
                        setConfirmDeleteId(rp.id)
                      }}
                      title={`删除 ${rp.name}`}
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
                <h2 id="create-project-title">创建新世界</h2>
              </div>
              <button className="icon-button" onClick={toggleCreateProjectModal} aria-label="关闭">
                <X />
              </button>
            </header>
            <div className="modal-body">
              <label className="field-label">
                世界名称
                <input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="例如：雾海纪元"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                />
              </label>
              <label className="field-label">
                一句话简介 <span>可选</span>
                <textarea
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder="这个世界最独特的规则是什么？"
                  rows={4}
                />
              </label>
              {createProjectError && (
                <p className="form-error" role="alert">
                  创建失败：{createProjectError}
                </p>
              )}
              <div className="modal-actions">
                <button
                  className="button-secondary"
                  onClick={toggleCreateProjectModal}
                  disabled={isCreatingProject}
                >
                  取消
                </button>
                <button
                  className="button-primary"
                  onClick={handleCreateProject}
                  disabled={!projectName.trim() || isCreatingProject}
                >
                  {isCreatingProject ? '正在生成设定…' : '创建并进入'} <ArrowRight size={17} />
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
                <h2 id="open-project-title">打开已有项目</h2>
              </div>
              <button className="icon-button" onClick={toggleOpenProjectModal} aria-label="关闭">
                <X />
              </button>
            </header>
            <div className="modal-body open-project-empty">
              <span className="empty-folder">
                <FolderOpen />
              </span>
              <h3>选择世界档案</h3>
              <p>从本地选择一个已有项目，继续你的创作。</p>
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
                {isImportingProject ? '正在打开…' : '浏览本地文件'} <ArrowRight size={17} />
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}
