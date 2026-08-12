import { useState, useEffect, useRef, useMemo } from 'react'
import { useStore } from '@/store'
import { getEntryPlaceholderSource, resolveAssetSource } from '@/lib/assetSources'
import {
  Entry,
  EntryType,
  EntryStatus,
  Tag,
  ENTRY_TYPE_LABELS,
  RELATION_TYPE_LABELS,
  RELATION_TYPE_KEYS,
  CustomFieldSchema,
} from '@/types'
import { debounce } from '@/lib/utils'
import { MarkdownEditor } from './MarkdownEditor'
import { MapView } from './MapView'
import { TimelineView } from './TimelineView'
import { WikiView } from './WikiView'
import { GraphView } from './GraphView'
import { TemplateManager } from './TemplateManager'
import { ExportView } from './ExportView'
import { CollabView } from './CollabView'
import { EntryCardView } from './EntryCardView'
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
  CreditCard,
  Loader2,
  AlertTriangle,
} from 'lucide-react'

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

const VIEW_LABELS = {
  editor: '编辑器',
  wiki: '百科',
  map: '地图',
  graph: '图谱',
  timeline: '时间轴',
  template: '模板',
  export: '导出',
  collab: '协作',
  card: '卡片',
} as const

const COLOR_PALETTE = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#84cc16',
  '#22c55e',
  '#10b981',
  '#14b8a6',
  '#06b6d4',
  '#0ea5e9',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#d946ef',
  '#ec4899',
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
    fieldSchemas,
    entryFieldValues,
    selectEntry,
    createEntry,
    updateEntry,
    deleteEntry,
    toggleCreateEntryModal,
    showCreateEntryModal,
    closeProject,
    saveProject,
    lastSaveTime,
    saveStatus,
    saveError,
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
    saveFieldValue,
  } = useStore()

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<EntryType | 'all'>('all')
  const [expandedEditorTypes, setExpandedEditorTypes] = useState<Set<EntryType>>(
    new Set(['character', 'location']),
  )
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
  const [activeView, setActiveView] = useState<
    'editor' | 'wiki' | 'map' | 'graph' | 'timeline' | 'template' | 'export' | 'collab' | 'card'
  >('editor')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selectedEntry = entries.find((entry) => entry.id === selectedEntryId)
  const selectedCoverAsset = projectAssets.find((asset) => asset.id === selectedCoverAssetId)
  const selectedCoverSource = selectedEntry
    ? resolveAssetSource(selectedCoverAsset, getEntryPlaceholderSource(selectedEntry.type))
    : ''

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

  const debouncedSave = useMemo(
    () =>
      debounce(
        async (entryId: string, updates: Partial<Pick<Entry, 'title' | 'summary' | 'content'>>) =>
          updateEntry(entryId, updates),
        1000,
      ),
    [updateEntry],
  )

  useEffect(() => {
    if (!selectedEntryId || !selectedEntry) return
    const updates: Partial<Pick<Entry, 'title' | 'summary' | 'content'>> = {}
    if (entryTitle !== selectedEntry.title) updates.title = entryTitle
    if (entrySummary !== selectedEntry.summary) updates.summary = entrySummary
    if (entryContent !== selectedEntry.content) updates.content = entryContent
    if (Object.keys(updates).length > 0) debouncedSave(selectedEntryId, updates)
  }, [debouncedSave, entryContent, entrySummary, entryTitle, selectedEntry, selectedEntryId])

  useEffect(
    () => () => {
      void debouncedSave.flush()
    },
    [debouncedSave],
  )

  useEffect(() => {
    const flushBeforeUnload = () => {
      void debouncedSave.flush()
    }
    window.addEventListener('beforeunload', flushBeforeUnload)
    return () => window.removeEventListener('beforeunload', flushBeforeUnload)
  }, [debouncedSave])

  const flushDraft = async () => {
    await debouncedSave.flush()
  }

  const handleSelectEntry = async (id: string | null) => {
    await flushDraft()
    selectEntry(id)
  }

  const handleViewChange = async (view: typeof activeView) => {
    await flushDraft()
    setActiveView(view)
  }

  const handleSave = async () => {
    await flushDraft()
    await saveProject()
  }

  const handleCloseProject = async () => {
    await flushDraft()
    await saveProject()
    if (useStore.getState().saveStatus !== 'error') closeProject()
  }

  useEffect(() => {
    fetchProjectAssets()
  }, [])

  const searchFilteredEntries = entries.filter((entry) => {
    const matchesSearch =
      !searchQuery ||
      entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.summary.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesSearch
  })

  const filteredEntries = searchFilteredEntries.filter(
    (entry) => selectedType === 'all' || entry.type === selectedType,
  )

  const editorGroupedEntries = searchFilteredEntries.reduce(
    (groups, entry) => {
      ;(groups[entry.type] ??= []).push(entry)
      return groups
    },
    {} as Partial<Record<EntryType, Entry[]>>,
  )

  const toggleEditorType = (type: EntryType) => {
    setExpandedEditorTypes((current) => {
      const next = new Set(current)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

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
    return resolveAssetSource(projectAssets.find((asset) => asset.relativePath === relativePath))
  }

  const getEntryCoverSource = (entry: Entry) =>
    resolveAssetSource(
      projectAssets.find((asset) => asset.id === entry.coverAssetId),
      getEntryPlaceholderSource(entry.type),
    )

  const availableTags = tags.filter((tag) => !entryTags.find((et) => et.id === tag.id))

  const applicableSchemas = useMemo(() => {
    if (!selectedEntry) return []
    return fieldSchemas
      .filter((schema) => !schema.entryType || schema.entryType === selectedEntry.type)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }, [fieldSchemas, selectedEntry])

  const groupedSchemas = useMemo(() => {
    const groups: Record<string, CustomFieldSchema[]> = {}
    for (const schema of applicableSchemas) {
      const groupName = schema.group || '其他'
      if (!groups[groupName]) groups[groupName] = []
      groups[groupName].push(schema)
    }
    return groups
  }, [applicableSchemas])

  const getFieldValue = (fieldId: string): unknown => {
    const found = entryFieldValues.find((v) => v.fieldId === fieldId)
    return found ? found.value : null
  }

  const debouncedSaveFieldValue = useMemo(
    () =>
      debounce((...args: unknown[]) => {
        const [entryId, fieldId, value] = args as [string, string, unknown]
        saveFieldValue(entryId, fieldId, value)
      }, 500),
    [saveFieldValue],
  )

  const handleFieldChange = (fieldId: string, value: unknown) => {
    if (!selectedEntryId) return
    debouncedSaveFieldValue(selectedEntryId, fieldId, value)
  }

  const renderFieldControl = (schema: CustomFieldSchema) => {
    const value = getFieldValue(schema.id)
    const commonInputClass =
      'w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500/50 transition-colors'

    switch (schema.type) {
      case 'text':
        return (
          <input
            type="text"
            value={(value as string) || ''}
            onChange={(e) => handleFieldChange(schema.id, e.target.value)}
            placeholder={schema.placeholder}
            className={commonInputClass}
          />
        )
      case 'text_long':
        return (
          <textarea
            value={(value as string) || ''}
            onChange={(e) => handleFieldChange(schema.id, e.target.value)}
            placeholder={schema.placeholder}
            rows={3}
            className={`${commonInputClass} resize-none`}
          />
        )
      case 'number':
        return (
          <input
            type="number"
            value={value !== null && value !== undefined ? String(value) : ''}
            onChange={(e) =>
              handleFieldChange(schema.id, e.target.value === '' ? null : Number(e.target.value))
            }
            placeholder={schema.placeholder}
            className={commonInputClass}
          />
        )
      case 'date':
        return (
          <input
            type="date"
            value={(value as string) || ''}
            onChange={(e) => handleFieldChange(schema.id, e.target.value)}
            className={commonInputClass}
          />
        )
      case 'select':
        return (
          <select
            value={(value as string) || ''}
            onChange={(e) => handleFieldChange(schema.id, e.target.value)}
            className={commonInputClass}
          >
            <option value="" className="bg-slate-800">
              请选择...
            </option>
            {schema.options?.map((opt) => (
              <option key={opt} value={opt} className="bg-slate-800">
                {opt}
              </option>
            ))}
          </select>
        )
      case 'multiselect': {
        const selectedValues = Array.isArray(value) ? value : []
        return (
          <div className="flex flex-wrap gap-2">
            {schema.options?.map((opt) => {
              const checked = selectedValues.includes(opt)
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    const newValues = checked
                      ? selectedValues.filter((v) => v !== opt)
                      : [...selectedValues, opt]
                    handleFieldChange(schema.id, newValues)
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs transition-colors border ${
                    checked
                      ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                  }`}
                >
                  {opt}
                </button>
              )
            })}
          </div>
        )
      }
      case 'boolean':
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => handleFieldChange(schema.id, e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-white/5 text-purple-500 focus:ring-purple-500/50"
            />
            <span className="text-sm text-slate-300">{Boolean(value) ? '是' : '否'}</span>
          </label>
        )
      case 'color':
        return (
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={(value as string) || '#6366f1'}
              onChange={(e) => handleFieldChange(schema.id, e.target.value)}
              className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 cursor-pointer p-1"
            />
            <input
              type="text"
              value={(value as string) || ''}
              onChange={(e) => handleFieldChange(schema.id, e.target.value)}
              placeholder="#RRGGBB"
              className={commonInputClass}
            />
          </div>
        )
      case 'image':
        return (
          <div className="space-y-2">
            {typeof value === 'string' && value && (
              <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-white/10">
                <img src={value} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => handleFieldChange(schema.id, '')}
                  className="absolute top-1 right-1 p-1 rounded bg-black/50 hover:bg-black/70 text-white"
                >
                  <XCircle className="w-3 h-3" />
                </button>
              </div>
            )}
            <input
              type="text"
              value={(value as string) || ''}
              onChange={(e) => handleFieldChange(schema.id, e.target.value)}
              placeholder="输入图片 URL..."
              className={commonInputClass}
            />
          </div>
        )
      default:
        return (
          <input
            type="text"
            value={(value as string) || ''}
            onChange={(e) => handleFieldChange(schema.id, e.target.value)}
            className={commonInputClass}
          />
        )
    }
  }

  const customFieldsSection =
    applicableSchemas.length > 0
      ? Object.entries(groupedSchemas).map(([groupName, groupSchemas]) => (
          <div key={groupName} className="bg-slate-800/50 rounded-xl border border-white/10 p-6">
            <h3 className="text-white font-medium mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              {groupName}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {groupSchemas.map((schema) => (
                <div key={schema.id} className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-400">
                    {schema.label}
                    {schema.required && <span className="text-red-400 ml-1">*</span>}
                  </label>
                  {renderFieldControl(schema)}
                </div>
              ))}
            </div>
          </div>
        ))
      : null

  return (
    <div className="workspace-shell grid h-screen grid-cols-[auto_minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] bg-slate-900">
      {(activeView === 'editor' || activeView === 'card') && (
        <aside
          className={`workspace-sidebar col-start-1 row-start-2 min-h-0 ${
            sidebarCollapsed ? 'w-[72px] is-collapsed' : activeView === 'editor' ? 'w-72' : 'w-80'
          } flex flex-col bg-gradient-to-b from-slate-800 to-slate-900 border-r border-white/10 transition-all duration-300`}
        >
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center justify-between">
              {!sidebarCollapsed && (
                <div className="flex-1 min-w-0">
                  <span className="workspace-kicker">
                    {activeView === 'editor' ? 'EDITOR INDEX' : 'CARD ARCHIVE'}
                  </span>
                  <h1 className="truncate font-bold text-white">
                    {activeView === 'editor' ? '编辑目录' : '条目卡片库'}
                  </h1>
                  <p className="truncate text-xs text-slate-500">
                    {activeView === 'editor' ? '按类型展开并选择条目' : '通过封面、摘要和状态浏览条目'}
                  </p>
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
                <div className="flex gap-2">
                  <button
                    onClick={toggleCreateEntryModal}
                    className="flex flex-1 items-center gap-3 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-3 font-medium text-white transition-opacity hover:opacity-90"
                  >
                    <Plus className="h-5 w-5" />
                    <span>新建条目</span>
                  </button>
                  {activeView === 'editor' && (
                    <button
                      onClick={handleDeleteEntry}
                      disabled={!selectedEntry}
                      title={selectedEntry ? `删除“${selectedEntry.title}”` : '请先选择要删除的条目'}
                      className="flex w-12 shrink-0 items-center justify-center rounded-lg border border-red-400/20 bg-red-500/10 text-red-400 transition-colors hover:border-red-400/40 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:border-white/5 disabled:bg-white/[0.03] disabled:text-slate-700"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  )}
                </div>
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

              {activeView === 'card' && (
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
              )}

              {tags.length > 0 && (
                <div className="px-3 pb-3">
                  <p className="text-xs text-slate-500 mb-2">标签</p>
                  <div className="flex flex-wrap gap-1">
                    {tags.slice(0, 8).map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => setSearchQuery(tag.name)}
                        className="px-2 py-1 rounded text-xs text-slate-400 bg-white/5 hover:bg-white/10 transition-colors"
                        style={{
                          backgroundColor: tag.color ? `${tag.color}20` : undefined,
                          color: tag.color || undefined,
                        }}
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="flex-1 overflow-y-auto px-3 pb-3">
            {!sidebarCollapsed && (
              <div className="flex items-center justify-between px-1 pb-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  条目导航
                </span>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-slate-500">
                  {activeView === 'editor' ? searchFilteredEntries.length : filteredEntries.length}/
                  {entries.length}
                </span>
              </div>
            )}
            {activeView === 'editor' ? (
              <div className="space-y-1">
                {(Object.entries(editorGroupedEntries) as [EntryType, Entry[]][]).map(
                  ([type, typeEntries]) => {
                    const TypeIcon = ENTRY_TYPE_ICONS[type]
                    const expanded = expandedEditorTypes.has(type)
                    return (
                      <div key={type}>
                        <button
                          onClick={() => toggleEditorType(type)}
                          className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/5"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <TypeIcon className="h-4 w-4 shrink-0 text-slate-400" />
                            {!sidebarCollapsed && (
                              <>
                                <span className="text-sm text-slate-300">{ENTRY_TYPE_LABELS[type]}</span>
                                <span className="text-xs text-slate-600">({typeEntries.length})</span>
                              </>
                            )}
                          </div>
                          {!sidebarCollapsed && (
                            <ChevronRight
                              className={`h-4 w-4 text-slate-600 transition-transform ${expanded ? 'rotate-90' : ''}`}
                            />
                          )}
                        </button>
                        {expanded && !sidebarCollapsed && (
                          <div className="ml-4 border-l border-white/5 pl-2">
                            {typeEntries.map((entry) => {
                              const isSelected = entry.id === selectedEntryId
                              return (
                                <button
                                  key={entry.id}
                                  onClick={() => void handleSelectEntry(entry.id)}
                                  className={`mb-0.5 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                                    isSelected
                                      ? 'bg-amber-400/10 text-amber-100'
                                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                  }`}
                                >
                                  <span
                                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_COLORS[entry.status]}`}
                                  />
                                  <span className="truncate">{entry.title}</span>
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  },
                )}
                {searchFilteredEntries.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                    <FileText className="mb-2 h-8 w-8" />
                    {!sidebarCollapsed && <p className="text-sm">暂无条目</p>}
                  </div>
                )}
              </div>
            ) : (
              <>
                {filteredEntries.map((entry) => {
                  const Icon = ENTRY_TYPE_ICONS[entry.type]
                  const isSelected = entry.id === selectedEntryId
                  return (
                    <button
                      key={entry.id}
                      onClick={() => void handleSelectEntry(entry.id)}
                      className={`group mb-1.5 flex w-full items-center gap-3 rounded-xl border p-2 text-left transition-all ${
                        isSelected
                          ? 'border-amber-400/50 bg-amber-400/10 shadow-[0_8px_24px_rgba(245,158,11,0.08)]'
                          : 'border-transparent hover:border-white/10 hover:bg-white/5'
                      }`}
                    >
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-700">
                        <img
                          src={getEntryCoverSource(entry)}
                          alt=""
                          className="h-full w-full object-cover opacity-75 transition duration-300 group-hover:scale-105 group-hover:opacity-100"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 to-transparent" />
                        <Icon className="absolute bottom-1.5 left-1.5 h-3.5 w-3.5 text-white/90" />
                        <div
                          className={`absolute right-1.5 top-1.5 h-2 w-2 rounded-full ${STATUS_COLORS[entry.status]} ring-2 ring-slate-900/80`}
                        />
                      </div>
                      {!sidebarCollapsed && (
                        <div className="flex-1 min-w-0">
                          <p
                            className={`truncate text-sm font-semibold ${isSelected ? 'text-amber-50' : 'text-slate-100'}`}
                          >
                            {entry.title}
                          </p>
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className="text-[11px] text-slate-500">
                              {ENTRY_TYPE_LABELS[entry.type]}
                            </span>
                            {entry.summary && <span className="text-slate-700">·</span>}
                            {entry.summary && (
                              <span className="min-w-0 truncate text-[11px] text-slate-500">
                                {entry.summary}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      {!sidebarCollapsed && (
                        <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-slate-400" />
                      )}
                    </button>
                  )
                })}

                {filteredEntries.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                    <FileText className="w-8 h-8 mb-2" />
                    {!sidebarCollapsed && <p className="text-sm">暂无条目</p>}
                  </div>
                )}
              </>
            )}
          </div>
        </aside>
      )}

      <main className="contents">
        <header className="workspace-topbar col-span-2 row-start-1 flex items-center justify-between px-6 bg-slate-800/50 border-b border-white/10">
          <div className="flex w-56 shrink-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/10">
              <BookOpen className="h-4 w-4 text-amber-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                <span className="max-w-32 truncate">{currentProject?.name}</span>
                <ChevronRight className="h-3 w-3" />
                <span className="shrink-0 whitespace-nowrap text-amber-400/80">
                  {VIEW_LABELS[activeView]}
                </span>
              </div>
              <h2 className="truncate text-sm font-semibold text-white">
                {selectedEntry ? selectedEntry.title : '世界总览'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="view-switcher flex items-center bg-white/10 rounded-lg p-1">
              <button
                onClick={() => void handleViewChange('editor')}
                className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors ${
                  activeView === 'editor' ? 'bg-purple-500 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Edit3 className="w-4 h-4" />
                编辑器
              </button>
              <button
                onClick={() => void handleViewChange('wiki')}
                className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors ${
                  activeView === 'wiki' ? 'bg-purple-500 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                百科
              </button>
              <button
                onClick={() => void handleViewChange('map')}
                className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors ${
                  activeView === 'map' ? 'bg-purple-500 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Map className="w-4 h-4" />
                地图
              </button>
              <button
                onClick={() => void handleViewChange('graph')}
                className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors ${
                  activeView === 'graph' ? 'bg-purple-500 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                <GitBranch className="w-4 h-4" />
                图谱
              </button>
              <button
                onClick={() => void handleViewChange('timeline')}
                className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors ${
                  activeView === 'timeline' ? 'bg-purple-500 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                <ClockIcon className="w-4 h-4" />
                时间轴
              </button>
              <button
                onClick={() => void handleViewChange('template')}
                className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors ${
                  activeView === 'template' ? 'bg-purple-500 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                模板
              </button>
              <button
                onClick={() => void handleViewChange('export')}
                className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors ${
                  activeView === 'export' ? 'bg-purple-500 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Download className="w-4 h-4" />
                导出
              </button>
              <button
                onClick={() => void handleViewChange('collab')}
                className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors ${
                  activeView === 'collab' ? 'bg-purple-500 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Users className="w-4 h-4" />
                协作
              </button>
              <button
                onClick={() => void handleViewChange('card')}
                className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors ${
                  activeView === 'card' ? 'bg-purple-500 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                卡片
              </button>
            </div>

            <div
              className={`flex items-center gap-2 text-sm ${saveStatus === 'error' ? 'text-red-400' : 'text-slate-500'}`}
              title={saveStatus === 'error' ? saveError || '保存失败' : undefined}
              role="status"
            >
              {saveStatus === 'saving' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : saveStatus === 'error' ? (
                <AlertTriangle className="w-4 h-4" />
              ) : (
                <Clock className="w-4 h-4" />
              )}
              <span>
                {saveStatus === 'saving'
                  ? '正在保存'
                  : saveStatus === 'error'
                    ? '保存失败，请重试'
                    : lastSaveTime
                      ? `已保存于 ${formatDate(lastSaveTime)}`
                      : '尚未保存'}
              </span>
            </div>
            <button
              onClick={() => void handleSave()}
              disabled={saveStatus === 'saving'}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>保存</span>
            </button>
            <button
              onClick={() => void handleCloseProject()}
              title="关闭项目"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-slate-500 transition-colors hover:border-red-400/30 hover:bg-red-500/10 hover:text-red-400"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="workspace-main col-start-2 row-start-2 min-h-0 overflow-hidden">
          {activeView === 'editor' ? (
            <div className="editor-scroll h-full overflow-y-auto p-6">
              {selectedEntry ? (
                <div className="editor-canvas max-w-4xl mx-auto space-y-6">
                  {selectedCoverSource && (
                    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-slate-950/60">
                      <img
                        src={selectedCoverSource}
                        alt="封面图"
                        className="h-[clamp(320px,38vw,520px)] w-full object-contain"
                      />
                      {selectedCoverAssetId && (
                        <button
                          onClick={() => setEntryCoverAsset(selectedEntryId!, null)}
                          className="absolute top-2 right-2 p-2 rounded-lg bg-black/50 hover:bg-black/70 text-white transition-colors"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                      )}
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
                    <MarkdownEditor
                      content={entryContent}
                      onChange={setEntryContent}
                      placeholder="输入条目详细内容..."
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-slate-800/50 rounded-xl border border-white/10 p-4">
                      <p className="text-slate-500 text-sm mb-1">状态</p>
                      <select
                        value={selectedEntry.status}
                        onChange={(e) =>
                          updateEntry(selectedEntry.id, { status: e.target.value as EntryStatus })
                        }
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500/50 text-sm"
                      >
                        <option value="draft" className="bg-slate-800">
                          草稿
                        </option>
                        <option value="active" className="bg-slate-800">
                          活跃
                        </option>
                        <option value="complete" className="bg-slate-800">
                          完成
                        </option>
                        <option value="archived" className="bg-slate-800">
                          已归档
                        </option>
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
                          <>
                            <EyeOff className="w-4 h-4" />
                            <span>私密</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-4 h-4" />
                            <span>内部</span>
                          </>
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
                            style={{
                              backgroundColor: tag.color ? `${tag.color}20` : 'bg-white/10',
                              color: tag.color || 'text-slate-300',
                            }}
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
                        <div
                          key={alias.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-white/5"
                        >
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

                  {customFieldsSection}

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
                            onClick={() => targetEntry && void handleSelectEntry(targetEntry.id)}
                          >
                            <div className="flex items-center gap-2">
                              <ArrowRightLeft className="w-3 h-3 text-purple-400" />
                              <span className="text-sm text-white">{targetEntry?.title || '未知'}</span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
                                {RELATION_TYPE_LABELS[relation.type] || relation.type}
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
                            onClick={() => void handleSelectEntry(backlink.entry.id)}
                          >
                            <ExternalLink className="w-3 h-3 text-blue-400" />
                            <span className="text-sm text-white">{backlink.entry.title}</span>
                            {backlink.linkText && (
                              <span className="text-xs text-slate-400 truncate">
                                引用: {backlink.linkText}
                              </span>
                            )}
                          </div>
                        )
                      })}
                      {backlinks.length === 0 && <p className="text-xs text-slate-500 py-2">暂无反向引用</p>}
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
          ) : activeView === 'card' ? (
            <EntryCardView />
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
                        style={{
                          backgroundColor: tag.color ? `${tag.color}20` : 'bg-white/10',
                          color: tag.color || 'text-slate-300',
                        }}
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

              {projectAssets.filter((a) => a.kind === 'image' || a.kind === 'cover').length > 0 && (
                <div>
                  <p className="text-sm font-medium text-slate-300 mb-2">已上传的图片</p>
                  <div className="grid grid-cols-3 gap-2">
                    {projectAssets
                      .filter((a) => a.kind === 'image' || a.kind === 'cover')
                      .map((asset) => (
                        <div
                          key={asset.id}
                          className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-colors ${
                            selectedCoverAssetId === asset.id
                              ? 'border-purple-500'
                              : 'border-transparent hover:border-white/20'
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
                  {RELATION_TYPE_KEYS.map((type) => (
                    <button
                      key={type}
                      onClick={() => setNewRelationType(type)}
                      className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                        newRelationType === type
                          ? 'bg-purple-500/20 border border-purple-500/50 text-white'
                          : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10'
                      }`}
                    >
                      {RELATION_TYPE_LABELS[type]}
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
