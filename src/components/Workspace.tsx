import { useState, useEffect, useRef } from 'react'
import { useStore } from '@/store'
import { Entry, EntryType, EntryStatus, Tag } from '@/types'
import { debounce } from '@/lib/utils'
import { MarkdownEditor } from './MarkdownEditor'
import { MapView } from './MapView'
import { TimelineView } from './TimelineView'
import { WikiView } from './WikiView'
import { GraphView } from './GraphView'
import { TemplateManager } from './TemplateManager'
import { ExportView } from './ExportView'
import { CollabView } from './CollabView'
import {
  Plus,
  Search,
  X,
  FileText,
  Users,
  Map,
  Building,
  Sword,
  Scroll,
  BookOpen,
  Folder,
  ChevronLeft,
  ChevronRight,
  Save,
  Trash2,
  Clock,
  Eye,
  EyeOff,
  Tag as TagIcon,
  XCircle,
  Image,
  Upload,
  Star,
  GitBranch,
  ArrowRightLeft,
  Link,
  Sparkles,
  Download,
  ExternalLink,
  Edit3,
  Clock as ClockIcon,
} from 'lucide-react'

const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  character: '人物',
  location: '地点',
  faction: '组织',
  item: '物品',
  event: '事件',
  lore: '设定',
  region: '区域',
  note: '笔记',
}

const ENTRY_TYPE_ICONS: Record<EntryType, typeof FileText> = {
  character: Users,
  location: Map,
  faction: Building,
  item: Sword,
  event: Scroll,
  lore: BookOpen,
  region: Folder,
  note: FileText,
}

const STATUS_COLORS: Record<EntryStatus, string> = {
  draft: 'bg-slate-500',
  active: 'bg-green-500',
  complete: 'bg-blue-500',
  archived: 'bg-purple-500',
}

const COLOR_PALETTE = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6',
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
]

const RELATION_TYPES = [
  '隶属',
  '对抗',
  '合作',
  '亲属',
  '师徒',
  '朋友',
  '敌人',
  '同事',
  '创造者',
  '使用者',
  '位于',
  '拥有',
  '参与',
  '导致',
  '相关',
]

export function Workspace() {
  const {
    currentProject,
    entries,
    tags,
    selectedEntryId,
    entryTags,
    entryAliases,
    projectAssets,
    entryRelations,
    backlinks,
    selectEntry,
    createEntry,
    updateEntry,
    deleteEntry,
    toggleCreateEntryModal,
    showCreateEntryModal,
    closeProject,
    saveProject,
    lastSaveTime,
    createTag,
    addTagToEntry,
    removeTagFromEntry,
    createAlias,
    deleteAlias,
    createAsset,
    setEntryCoverAsset,
    fetchProjectAssets,
    createRelation,
    deleteRelation,
  } = useStore()

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<EntryType | 'all'>('all')
  const [entryTitle, setEntryTitle] = useState('')
  const [entrySummary, setEntrySummary] = useState('')
  const [entryContent, setEntryContent] = useState('')
  const [newTagColor, setNewTagColor] = useState('')
  const [newTagInput, setNewTagInput] = useState('')
  const [newAliasInput, setNewAliasInput] = useState('')
  const [showTagModal, setShowTagModal] = useState(false)
  const [showImageUploadModal, setShowImageUploadModal] = useState(false)
  const [selectedCoverAssetId, setSelectedCoverAssetId] = useState<string | null>(null)
  const [showRelationModal, setShowRelationModal] = useState(false)
  const [newRelationTargetId, setNewRelationTargetId] = useState<string>('')
  const [newRelationType, setNewRelationType] = useState<string>('')
  const [newRelationNote, setNewRelationNote] = useState('')
  const [activeView, setActiveView] = useState<'editor' | 'wiki' | 'map' | 'graph' | 'timeline' | 'template' | 'export' | 'collab'>('editor')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selectedEntry = entries.find((entry) => entry.id === selectedEntryId)

  useEffect(() => {
    if (selectedEntry) {
      setEntryTitle(selectedEntry.title)
      setEntrySummary(selectedEntry.summary)
      setEntryContent(selectedEntry.content)
      setSelectedCoverAssetId(selectedEntry.coverAssetId)
    } else {
      setEntryTitle('')
      setEntrySummary('')
      setEntryContent('')
      setSelectedCoverAssetId(null)
    }
  }, [selectedEntryId, selectedEntry])

  const debouncedSave = debounce(async () => {
    if (selectedEntryId && selectedEntry) {
      const updates: Partial<Pick<Entry, 'title' | 'summary' | 'content'>> = {}
      if (entryTitle !== selectedEntry.title) updates.title = entryTitle
      if (entrySummary !== selectedEntry.summary) updates.summary = entrySummary
      if (entryContent !== selectedEntry.content) updates.content = entryContent
      if (Object.keys(updates).length > 0) {
        await updateEntry(selectedEntryId, updates)
      }
    }
  }, 1000)

  useEffect(() => {
    debouncedSave()
    return () => debouncedSave.cancel()
  }, [entryTitle, entrySummary, entryContent])

  useEffect(() => {
    fetchProjectAssets()
  }, [])

  const filteredEntries = entries.filter((entry) => {
    const matchesType = selectedType === 'all' || entry.type === selectedType
    const matchesSearch =
      !searchQuery ||
      entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.summary.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesType && matchesSearch
  })

  const [newEntryType, setNewEntryType] = useState<EntryType>('character')
  const [newEntryTitle, setNewEntryTitle] = useState('')

  const handleCreateEntry = async () => {
    if (!newEntryTitle.trim()) return
    await createEntry(newEntryType, newEntryTitle.trim())
    setNewEntryTitle('')
    setNewEntryType('character')
  }

  const handleDeleteEntry = async () => {
    if (!selectedEntryId) return
    if (window.confirm('确定要删除这个条目吗？')) {
      await deleteEntry(selectedEntryId)
    }
  }

  const handleCreateTag = async () => {
    if (!newTagInput.trim()) return
    await createTag(newTagInput.trim(), newTagColor || undefined)
    setNewTagInput('')
    setNewTagColor('')
  }

  const handleAddTagToEntry = async (tag: Tag) => {
    if (!selectedEntryId) return
    await addTagToEntry(selectedEntryId, tag.id)
  }

  const handleRemoveTagFromEntry = async (tagId: string) => {
    if (!selectedEntryId) return
    await removeTagFromEntry(selectedEntryId, tagId)
  }

  const handleCreateAlias = async () => {
    if (!selectedEntryId || !newAliasInput.trim()) return
    await createAlias(selectedEntryId, newAliasInput.trim())
    setNewAliasInput('')
  }

  const handleDeleteAlias = async (aliasId: string) => {
    await deleteAlias(aliasId)
  }

  const handleCreateRelation = async () => {
    if (!selectedEntryId || !newRelationTargetId || !newRelationType) return
    await createRelation(selectedEntryId, newRelationTargetId, newRelationType, newRelationNote)
    setShowRelationModal(false)
    setNewRelationTargetId('')
    setNewRelationType('')
    setNewRelationNote('')
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const file = files[0]
    const reader = new FileReader()

    reader.onload = async (event) => {
      const result = event.target?.result as string
      const relativePath = `assets/${Date.now()}-${file.name}`
      localStorage.setItem(`wdworld_asset_${relativePath}`, result)

      await createAsset('image', file.name, relativePath, file.type, file.size)
      setShowImageUploadModal(false)
    }

    reader.readAsDataURL(file)
  }

  const handleSetCoverImage = async (assetId: string) => {
    if (!selectedEntryId) return
    await setEntryCoverAsset(selectedEntryId, assetId)
    setSelectedCoverAssetId(assetId)
    setShowImageUploadModal(false)
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getAssetUrl = (relativePath: string) => {
    return localStorage.getItem(`wdworld_asset_${relativePath}`) || ''
  }

  const availableTags = tags.filter((tag) => !entryTags.find((et) => et.id === tag.id))

  return (
    <div className="h-screen flex bg-slate-900">
      <aside
        className={`${sidebarCollapsed ? 'w-16' : 'w-72'} flex flex-col bg-slate-800 border-r border-white/10 transition-all duration-300`}
      >
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <h1 className="text-white font-bold truncate">{currentProject?.name}</h1>
                <p className="text-slate-500 text-xs truncate">{currentProject?.description}</p>
              </div>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              {sidebarCollapsed ? (
                <ChevronRight className="w-5 h-5 text-slate-400" />
              ) : (
                <ChevronLeft className="w-5 h-5 text-slate-400" />
              )}
            </button>
          </div>
        </div>

        {!sidebarCollapsed && (
          <>
            <div className="p-3">
              <button
                onClick={toggleCreateEntryModal}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium hover:opacity-90 transition-opacity"
              >
                <Plus className="w-5 h-5" />
                <span>新建条目</span>
              </button>
            </div>

            <div className="px-3 pb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索条目..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-purple-500/50 transition-colors"
                />
              </div>
            </div>

            <div className="px-3 pb-3">
              <div className="flex gap-2 overflow-x-auto pb-1">
                <button
                  onClick={() => setSelectedType('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    selectedType === 'all'
                      ? 'bg-purple-500 text-white'
                      : 'bg-white/5 text-slate-400 hover:bg-white/10'
                  }`}
                >
                  全部
                </button>
                {(Object.entries(ENTRY_TYPE_LABELS) as [EntryType, string][]).map(([type, label]) => (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                      selectedType === type
                        ? 'bg-purple-500 text-white'
                        : 'bg-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {tags.length > 0 && (
              <div className="px-3 pb-3">
                <p className="text-xs text-slate-500 mb-2">标签</p>
                <div className="flex flex-wrap gap-1">
                  {tags.slice(0, 8).map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => setSearchQuery(tag.name)}
                      className="px-2 py-1 rounded text-xs text-slate-400 bg-white/5 hover:bg-white/10 transition-colors"
                      style={{ backgroundColor: tag.color ? `${tag.color}20` : undefined, color: tag.color || undefined }}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div className="flex-1 overflow-y-auto px-2">
          {filteredEntries.map((entry) => {
            const Icon = ENTRY_TYPE_ICONS[entry.type]
            const isSelected = entry.id === selectedEntryId
            return (
              <div
                key={entry.id}
                onClick={() => selectEntry(entry.id)}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-purple-500/20 border border-purple-500/50'
                    : 'hover:bg-white/5 border border-transparent'
                }`}
              >
                <div className="relative">
                  <div className={`w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center ${isSelected ? 'ring-2 ring-purple-500' : ''}`}>
                    <Icon className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${STATUS_COLORS[entry.status]} border-2 border-slate-800`} />
                </div>
                {!sidebarCollapsed && (
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{entry.title}</p>
                    <p className="text-slate-500 text-xs">{ENTRY_TYPE_LABELS[entry.type]}</p>
                  </div>
                )}
              </div>
            )
          })}

          {filteredEntries.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <FileText className="w-8 h-8 mb-2" />
              {!sidebarCollapsed && <p className="text-sm">暂无条目</p>}
            </div>
          )}
        </div>

        {!sidebarCollapsed && (
          <div className="p-3 border-t border-white/10">
            <button
              onClick={closeProject}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white/5 text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
            >
              <X className="w-4 h-4" />
              <span>关闭项目</span>
            </button>
          </div>
        )}
      </aside>

      <main className="flex-1 flex flex-col">
        <header className="h-14 flex items-center justify-between px-6 bg-slate-800/50 border-b border-white/10">
          <div className="flex items-center gap-4">
            <h2 className="text-white font-semibold">
              {selectedEntry ? selectedEntry.title : '选择一个条目'}
            </h2>
            {selectedEntry && (
              <span className="px-2 py-1 rounded-full bg-white/5 text-slate-400 text-xs">
                {ENTRY_TYPE_LABELS[selectedEntry.type]}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center bg-white/10 rounded-lg p-1">
              <button
                onClick={() => setActiveView('editor')}
                className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors ${
                  activeView === 'editor' ? 'bg-purple-500 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Edit3 className="w-4 h-4" />
                编辑器
              </button>
              <button
                onClick={() => setActiveView('wiki')}
                className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors ${
                  activeView === 'wiki' ? 'bg-purple-500 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                百科
              </button>
              <button
                onClick={() => setActiveView('map')}
                className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors ${
                  activeView === 'map' ? 'bg-purple-500 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Map className="w-4 h-4" />
                地图
              </button>
              <button
                onClick={() => setActiveView('graph')}
                className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors ${
                  activeView === 'graph' ? 'bg-purple-500 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                <GitBranch className="w-4 h-4" />
                图谱
              </button>
              <button
                onClick={() => setActiveView('timeline')}
                className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors ${
                  activeView === 'timeline' ? 'bg-purple-500 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                <ClockIcon className="w-4 h-4" />
                时间轴
              </button>
              <button
                onClick={() => setActiveView('template')}
                className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors ${
                  activeView === 'template' ? 'bg-purple-500 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                模板
              </button>
              <button
                onClick={() => setActiveView('export')}
                className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors ${
                  activeView === 'export' ? 'bg-purple-500 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Download className="w-4 h-4" />
                导出
              </button>
              <button
                onClick={() => setActiveView('collab')}
                className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors ${
                  activeView === 'collab' ? 'bg-purple-500 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Users className="w-4 h-4" />
                协作
              </button>
            </div>

            {lastSaveTime && (
              <div className="flex items-center gap-2 text-slate-500 text-sm">
                <Clock className="w-4 h-4" />
                <span>自动保存于 {formatDate(lastSaveTime)}</span>
              </div>
            )}
            <button
              onClick={saveProject}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>保存</span>
            </button>
            {selectedEntry && (
              <button
                onClick={handleDeleteEntry}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>删除</span>
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-hidden">
          {activeView === 'editor' ? (
            <div className="h-full overflow-y-auto p-6">
              {selectedEntry ? (
                <div className="max-w-4xl mx-auto space-y-6">
              {selectedCoverAssetId && (
                <div className="relative rounded-xl overflow-hidden border border-white/10">
                  <img
                    src={getAssetUrl(projectAssets.find(a => a.id === selectedCoverAssetId)?.relativePath || '')}
                    alt="封面图"
                    className="w-full h-48 object-cover"
                  />
                  <button
                    onClick={() => setEntryCoverAsset(selectedEntryId!, null)}
                    className="absolute top-2 right-2 p-2 rounded-lg bg-black/50 hover:bg-black/70 text-white transition-colors"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
              )}

              <div className="bg-slate-800/50 rounded-xl border border-white/10 p-6">
                <label className="block text-sm font-medium text-slate-400 mb-2">标题</label>
                <input
                  type="text"
                  value={entryTitle}
                  onChange={(e) => setEntryTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white text-lg font-semibold focus:outline-none focus:border-purple-500/50 transition-colors"
                />
              </div>

              <div className="bg-slate-800/50 rounded-xl border border-white/10 p-6">
                <label className="block text-sm font-medium text-slate-400 mb-2">摘要</label>
                <textarea
                  value={entrySummary}
                  onChange={(e) => setEntrySummary(e.target.value)}
                  placeholder="输入条目摘要..."
                  rows={2}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 transition-colors resize-none"
                />
              </div>

              <div className="bg-slate-800/50 rounded-xl border border-white/10 p-6">
                <label className="block text-sm font-medium text-slate-400 mb-2">内容</label>
                <MarkdownEditor content={entryContent} onChange={setEntryContent} placeholder="输入条目详细内容..." />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-800/50 rounded-xl border border-white/10 p-4">
                  <p className="text-slate-500 text-sm mb-1">状态</p>
                  <select
                    value={selectedEntry.status}
                    onChange={(e) => updateEntry(selectedEntry.id, { status: e.target.value as EntryStatus })}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500/50 text-sm"
                  >
                    <option value="draft" className="bg-slate-800">草稿</option>
                    <option value="active" className="bg-slate-800">活跃</option>
                    <option value="complete" className="bg-slate-800">完成</option>
                    <option value="archived" className="bg-slate-800">已归档</option>
                  </select>
                </div>

                <div className="bg-slate-800/50 rounded-xl border border-white/10 p-4">
                  <p className="text-slate-500 text-sm mb-1">可见性</p>
                  <button
                    onClick={() =>
                      updateEntry(selectedEntry.id, {
                        visibility: selectedEntry.visibility === 'private' ? 'internal' : 'private',
                      })
                    }
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors"
                  >
                    {selectedEntry.visibility === 'private' ? (
                      <><EyeOff className="w-4 h-4" /><span>私密</span></>
                    ) : (
                      <><Eye className="w-4 h-4" /><span>内部</span></>
                    )}
                  </button>
                </div>

                <div className="bg-slate-800/50 rounded-xl border border-white/10 p-4">
                  <p className="text-slate-500 text-sm mb-1">封面图</p>
                  <button
                    onClick={() => setShowImageUploadModal(true)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    <Image className="w-4 h-4" />
                    <span>{selectedCoverAssetId ? '更换' : '设置'}</span>
                  </button>
                </div>
              </div>

              <div className="bg-slate-800/50 rounded-xl border border-white/10 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <TagIcon className="w-5 h-5 text-purple-400" />
                    <h3 className="text-white font-medium">标签</h3>
                  </div>
                  <button
                    onClick={() => setShowTagModal(true)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 text-sm transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>添加标签</span>
                  </button>
                </div>

                {entryTags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {entryTags.map((tag) => (
                      <span
                        key={tag.id}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm transition-colors cursor-pointer"
                        style={{ backgroundColor: tag.color ? `${tag.color}20` : 'bg-white/10', color: tag.color || 'text-slate-300' }}
                        onClick={() => handleRemoveTagFromEntry(tag.id)}
                      >
                        {tag.name}
                        <XCircle className="w-3.5 h-3.5" />
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm">暂无标签，点击上方按钮添加</p>
                )}
              </div>

              <div className="bg-slate-800/50 rounded-xl border border-white/10 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Star className="w-5 h-5 text-yellow-400" />
                  <h3 className="text-white font-medium">别名</h3>
                </div>

                <div className="space-y-2">
                  {entryAliases.map((alias) => (
                    <div key={alias.id} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                      <span className="text-white text-sm">{alias.value}</span>
                      <button
                        onClick={() => handleDeleteAlias(alias.id)}
                        className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-red-400 transition-colors"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newAliasInput}
                      onChange={(e) => setNewAliasInput(e.target.value)}
                      placeholder="输入别名..."
                      className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-purple-500/50 transition-colors"
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleCreateAlias())}
                    />
                    <button
                      onClick={handleCreateAlias}
                      disabled={!newAliasInput.trim()}
                      className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/50 rounded-xl border border-white/10 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <GitBranch className="w-4 h-4" />
                    关系
                  </h4>
                  <button
                    onClick={() => setShowRelationModal(true)}
                    className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-2">
                  {entryRelations.map((relation) => {
                    const targetEntry = entries.find((e) => e.id === relation.targetEntryId)
                    return (
                      <div
                        key={relation.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group cursor-pointer"
                        onClick={() => targetEntry && selectEntry(targetEntry.id)}
                      >
                        <div className="flex items-center gap-2">
                          <ArrowRightLeft className="w-3 h-3 text-purple-400" />
                          <span className="text-sm text-white">{targetEntry?.title || '未知'}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
                            {relation.type}
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteRelation(relation.id)
                          }}
                          className="p-1 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <XCircle className="w-3 h-3" />
                        </button>
                      </div>
                    )
                  })}
                  {entryRelations.length === 0 && (
                    <p className="text-xs text-slate-500 py-2">暂无关系，点击 + 添加</p>
                  )}
                </div>
              </div>

              <div className="bg-slate-800/50 rounded-xl border border-white/10 p-4">
                <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2 mb-3">
                  <Link className="w-4 h-4" />
                  反向引用
                </h4>
                <div className="space-y-2">
                  {backlinks.map((backlink, index) => {
                    return (
                      <div
                        key={`${backlink.entry.id}-${index}`}
                        className="flex items-center gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                        onClick={() => selectEntry(backlink.entry.id)}
                      >
                        <ExternalLink className="w-3 h-3 text-blue-400" />
                        <span className="text-sm text-white">{backlink.entry.title}</span>
                        {backlink.linkText && (
                          <span className="text-xs text-slate-400 truncate">引用: {backlink.linkText}</span>
                        )}
                      </div>
                    )
                  })}
                  {backlinks.length === 0 && (
                    <p className="text-xs text-slate-500 py-2">暂无反向引用</p>
                  )}
                </div>
              </div>

              <div className="bg-slate-800/50 rounded-xl border border-white/10 p-4">
                <p className="text-slate-500 text-sm">创建时间：{formatDate(selectedEntry.createdAt)}</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <FileText className="w-16 h-16 mb-4" />
              <h3 className="text-xl font-medium mb-2">选择或创建一个条目</h3>
              <p className="text-center max-w-md">
                在左侧面板中选择一个条目开始编辑，或者点击"新建条目"创建一个新的设定。
              </p>
            </div>
          )}
            </div>
          ) : activeView === 'wiki' ? (
            <WikiView />
          ) : activeView === 'map' ? (
            <MapView />
          ) : activeView === 'graph' ? (
            <GraphView />
          ) : activeView === 'timeline' ? (
            <TimelineView />
          ) : activeView === 'template' ? (
            <TemplateManager />
          ) : activeView === 'export' ? (
            <ExportView />
          ) : (
            <CollabView />
          )}
        </div>
      </main>

      {showCreateEntryModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-slate-800 rounded-xl border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-xl font-bold text-white">新建条目</h2>
              <button
                onClick={toggleCreateEntryModal}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">条目类型</label>
                <div className="grid grid-cols-4 gap-2">
                  {(Object.entries(ENTRY_TYPE_LABELS) as [EntryType, string][]).map(([type, label]) => {
                    const Icon = ENTRY_TYPE_ICONS[type]
                    return (
                      <button
                        key={type}
                        onClick={() => setNewEntryType(type)}
                        className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-colors ${
                          newEntryType === type
                            ? 'bg-purple-500/20 border-purple-500/50 text-white'
                            : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-xs">{label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">标题</label>
                <input
                  type="text"
                  value={newEntryTitle}
                  onChange={(e) => setNewEntryTitle(e.target.value)}
                  placeholder="输入条目标题..."
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 transition-colors"
                  autoFocus
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={toggleCreateEntryModal}
                  className="flex-1 px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleCreateEntry}
                  disabled={!newEntryTitle.trim()}
                  className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                >
                  创建
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showTagModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-slate-800 rounded-xl border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-xl font-bold text-white">添加标签</h2>
              <button
                onClick={() => setShowTagModal(false)}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">创建新标签</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    placeholder="标签名称..."
                    className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 transition-colors"
                  />
                  <button
                    onClick={handleCreateTag}
                    disabled={!newTagInput.trim()}
                    className="px-4 py-2 rounded-lg bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
                {newTagInput && (
                  <div className="mt-2">
                    <p className="text-xs text-slate-500 mb-2">选择颜色</p>
                    <div className="flex flex-wrap gap-2">
                      {COLOR_PALETTE.map((color) => (
                        <button
                          key={color}
                          onClick={() => setNewTagColor(color)}
                          className={`w-6 h-6 rounded-full transition-transform ${newTagColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800 scale-110' : 'hover:scale-110'}`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {availableTags.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-slate-300 mb-2">添加已有标签</p>
                  <div className="flex flex-wrap gap-2">
                    {availableTags.map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => {
                          handleAddTagToEntry(tag)
                          setShowTagModal(false)
                        }}
                        className="px-3 py-1.5 rounded-full text-sm transition-colors"
                        style={{ backgroundColor: tag.color ? `${tag.color}20` : 'bg-white/10', color: tag.color || 'text-slate-300' }}
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showImageUploadModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-slate-800 rounded-xl border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-xl font-bold text-white">选择图片</h2>
              <button
                onClick={() => setShowImageUploadModal(false)}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-3 p-8 rounded-lg border-2 border-dashed border-white/20 hover:border-purple-500/50 transition-colors"
              >
                <Upload className="w-10 h-10 text-slate-400" />
                <span className="text-slate-300">点击上传图片</span>
                <span className="text-slate-500 text-sm">支持 JPG, PNG, GIF</span>
              </button>

              {projectAssets.filter(a => a.kind === 'image').length > 0 && (
                <div>
                  <p className="text-sm font-medium text-slate-300 mb-2">已上传的图片</p>
                  <div className="grid grid-cols-3 gap-2">
                    {projectAssets.filter(a => a.kind === 'image').map((asset) => (
                      <div
                        key={asset.id}
                        className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-colors ${
                          selectedCoverAssetId === asset.id ? 'border-purple-500' : 'border-transparent hover:border-white/20'
                        }`}
                        onClick={() => handleSetCoverImage(asset.id)}
                      >
                        <img
                          src={getAssetUrl(asset.relativePath)}
                          alt={asset.filename}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-white text-xs">{formatFileSize(asset.size)}</span>
                        </div>
                        {selectedCoverAssetId === asset.id && (
                          <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center">
                            <X className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showRelationModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-slate-800 rounded-xl border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-xl font-bold text-white">添加关系</h2>
              <button
                onClick={() => setShowRelationModal(false)}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">选择目标条目</label>
                <select
                  value={newRelationTargetId}
                  onChange={(e) => setNewRelationTargetId(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500/50 transition-colors"
                >
                  <option value="">请选择条目...</option>
                  {entries
                    .filter((e) => e.id !== selectedEntryId)
                    .map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.title} ({ENTRY_TYPE_LABELS[entry.type]})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">关系类型</label>
                <div className="grid grid-cols-3 gap-2">
                  {RELATION_TYPES.map((type) => (
                    <button
                      key={type}
                      onClick={() => setNewRelationType(type)}
                      className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                        newRelationType === type
                          ? 'bg-purple-500/20 border border-purple-500/50 text-white'
                          : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">备注</label>
                <input
                  type="text"
                  value={newRelationNote}
                  onChange={(e) => setNewRelationNote(e.target.value)}
                  placeholder="添加备注（可选）..."
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 transition-colors"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowRelationModal(false)}
                  className="flex-1 px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleCreateRelation}
                  disabled={!newRelationTargetId || !newRelationType}
                  className="flex-1 px-4 py-3 rounded-lg bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  添加关系
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}