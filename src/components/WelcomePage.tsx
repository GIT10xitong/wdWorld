import { useState } from 'react'
import { useStore } from '@/store'
import { ArrowRight, BookOpen, FolderOpen, FolderPlus, Orbit, Sparkles, X } from 'lucide-react'

export function WelcomePage() {
  const {
    createProject,
    toggleCreateProjectModal,
    toggleOpenProjectModal,
    showCreateProjectModal,
    showOpenProjectModal,
  } = useStore()
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')

  const handleCreateProject = async () => {
    if (!projectName.trim()) return
    await createProject(projectName.trim(), projectDescription.trim())
    setProjectName('')
    setProjectDescription('')
  }

  return (
    <main className="welcome-shell">
      <div className="welcome-orbit welcome-orbit-one" aria-hidden="true" />
      <div className="welcome-orbit welcome-orbit-two" aria-hidden="true" />

      <section className="welcome-panel">
        <div className="welcome-copy">
          <div className="brand-lockup">
            <div className="brand-mark"><Orbit /></div>
            <div>
              <span className="brand-name">VVD WORLD</span>
              <span className="brand-edition">WORLD BUILDER</span>
            </div>
          </div>

          <div className="welcome-hero">
            <div className="eyebrow"><Sparkles size={14} /> 本地优先 · 灵感永存</div>
            <h1>让散落的灵感，<br /><span>生长为一个世界。</span></h1>
            <p>在同一处编织人物、地点、事件与关系。你的设定保存在本地，随时可以继续书写。</p>
          </div>

          <div className="welcome-stats" aria-label="产品特点">
            <div><strong>08</strong><span>类设定条目</span></div>
            <div><strong>∞</strong><span>关系与分支</span></div>
            <div><strong>01</strong><span>完整世界</span></div>
          </div>
        </div>

        <div className="welcome-actions">
          <div className="action-heading">
            <span>开始创作</span>
            <p>建立新宇宙，或回到正在生长的世界。</p>
          </div>

          <button className="project-action project-action-primary" onClick={toggleCreateProjectModal}>
            <span className="project-action-icon"><FolderPlus /></span>
            <span className="project-action-copy">
              <strong>新建世界</strong>
              <small>从一个名字开始你的设定</small>
            </span>
            <ArrowRight className="project-action-arrow" />
          </button>

          <button className="project-action" onClick={toggleOpenProjectModal}>
            <span className="project-action-icon"><FolderOpen /></span>
            <span className="project-action-copy">
              <strong>打开已有项目</strong>
              <small>继续编辑本地保存的世界</small>
            </span>
            <ArrowRight className="project-action-arrow" />
          </button>

          <div className="welcome-tip"><BookOpen size={15} /> 所有内容仅存储在你的设备中</div>
        </div>
      </section>

      {showCreateProjectModal && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && toggleCreateProjectModal()}>
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="create-project-title">
            <header className="modal-header">
              <div><span className="modal-kicker">NEW WORLD</span><h2 id="create-project-title">创建新世界</h2></div>
              <button className="icon-button" onClick={toggleCreateProjectModal} aria-label="关闭"><X /></button>
            </header>
            <div className="modal-body">
              <label className="field-label">世界名称
                <input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="例如：雾海纪元" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()} />
              </label>
              <label className="field-label">一句话简介 <span>可选</span>
                <textarea value={projectDescription} onChange={(e) => setProjectDescription(e.target.value)} placeholder="这个世界最独特的规则是什么？" rows={4} />
              </label>
              <div className="modal-actions">
                <button className="button-secondary" onClick={toggleCreateProjectModal}>取消</button>
                <button className="button-primary" onClick={handleCreateProject} disabled={!projectName.trim()}>创建并进入 <ArrowRight size={17} /></button>
              </div>
            </div>
          </section>
        </div>
      )}

      {showOpenProjectModal && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && toggleOpenProjectModal()}>
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="open-project-title">
            <header className="modal-header">
              <div><span className="modal-kicker">OPEN ARCHIVE</span><h2 id="open-project-title">打开已有项目</h2></div>
              <button className="icon-button" onClick={toggleOpenProjectModal} aria-label="关闭"><X /></button>
            </header>
            <div className="modal-body open-project-empty">
              <span className="empty-folder"><FolderOpen /></span>
              <h3>选择世界档案</h3>
              <p>从本地选择一个已有项目，继续你的创作。</p>
              <button className="button-primary" onClick={toggleOpenProjectModal}>浏览本地文件 <ArrowRight size={17} /></button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}
