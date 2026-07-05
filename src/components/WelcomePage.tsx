import { useState } from 'react'
import { useStore } from '@/store'
import { FolderPlus, FolderOpen, X } from 'lucide-react'

export function WelcomePage() {
  const { createProject, toggleCreateProjectModal, toggleOpenProjectModal, showCreateProjectModal, showOpenProjectModal } = useStore()
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')

  const handleCreateProject = async () => {
    if (!projectName.trim()) return
    await createProject(projectName.trim(), projectDescription.trim())
    setProjectName('')
    setProjectDescription('')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 mb-6">
            <span className="text-4xl font-bold text-white">W</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">wdworld</h1>
          <p className="text-slate-400 text-lg">本地优先的 OC 设定工具</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <button
            onClick={toggleCreateProjectModal}
            className="flex flex-col items-center justify-center p-6 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-purple-500/50 transition-all duration-300 group"
          >
            <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center mb-4 group-hover:bg-purple-500/30 transition-colors">
              <FolderPlus className="w-6 h-6 text-purple-400" />
            </div>
            <span className="text-white font-medium">新建项目</span>
            <span className="text-slate-500 text-sm mt-1">开始一个新的设定世界</span>
          </button>

          <button
            onClick={toggleOpenProjectModal}
            className="flex flex-col items-center justify-center p-6 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-blue-500/50 transition-all duration-300 group"
          >
            <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center mb-4 group-hover:bg-blue-500/30 transition-colors">
              <FolderOpen className="w-6 h-6 text-blue-400" />
            </div>
            <span className="text-white font-medium">打开项目</span>
            <span className="text-slate-500 text-sm mt-1">继续编辑已有世界</span>
          </button>
        </div>
      </div>

      {showCreateProjectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-slate-800 rounded-xl border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-xl font-bold text-white">新建项目</h2>
              <button
                onClick={toggleCreateProjectModal}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">项目名称</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="输入项目名称..."
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 transition-colors"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">项目描述</label>
                <textarea
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder="输入项目描述（可选）..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 transition-colors resize-none"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={toggleCreateProjectModal}
                  className="flex-1 px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleCreateProject}
                  disabled={!projectName.trim()}
                  className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                >
                  创建
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showOpenProjectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-slate-800 rounded-xl border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-xl font-bold text-white">打开项目</h2>
              <button
                onClick={toggleOpenProjectModal}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-6">
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-xl bg-blue-500/20 flex items-center justify-center mx-auto mb-4">
                  <FolderOpen className="w-8 h-8 text-blue-400" />
                </div>
                <p className="text-slate-400">选择要打开的项目</p>
                <button
                  onClick={toggleOpenProjectModal}
                  className="mt-4 px-6 py-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                >
                  浏览文件
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}