import { t, useLanguage, getLanguage, message } from '@/lib/i18n'
import { useState, useEffect, useRef, useMemo } from 'react'
import { useStore } from '@/store'
import { PROFILES } from '@/features/studio/profiles'
import type { CreationMode } from '@/types'
import { cacheAssetData, getEntryPlaceholderSource, resolveAssetSource } from '@/lib/assetSources'
import {
  Entry,
  EntryType,
  EntryStatus,
  Tag,
  ENTRY_TYPE_LABELS,
  RELATION_TYPE_LABELS,
  RELATION_TYPE_KEYS,
  CustomFieldSchema,
  BUILTIN_FIELD_SCHEMAS,
} from '@/types'
import { debounce } from '@/lib/utils'
import { registerDraftFlusher } from '@/lib/storage/saveQueue'
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
  proposed: 'bg-amber-400',
  active: 'bg-green-500',
  complete: 'bg-blue-500',
  archived: 'bg-ui-accent',
}

const VIEW_LABELS = {
  get editor() {
    return t('编辑器')
  },
  get wiki() {
    return t('百科')
  },
  get map() {
    return t('地图')
  },
  get graph() {
    return t('图谱')
  },
  get timeline() {
    return t('时间轴')
  },
  get template() {
    return t('模板')
  },
  get export() {
    return t('导出')
  },
  get collab() {
    return t('协作')
  },
  get card() {
    return t('卡片')
  },
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

export function Workspace({
  onOpenNovel,
  profile = 'free',
  onExit,
}: {
  onOpenNovel?: () => void
  profile?: CreationMode
  onExit?: () => void
}) {
  const language = useLanguage()
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
  const [showArchived, setShowArchived] = useState(false)
  const [selectedType, setSelectedType] = useState<EntryType | 'all'>('all')
  const [expandedEditorTypes, setExpandedEditorTypes] = useState<Set<EntryType>>(
    new Set(['character', 'location']),
  )
  const [entryTitle, setEntryTitle] = useState('')
  const [entrySummary, setEntrySummary] = useState('')
  const [entryContent, setEntryContent] = useState('')
  const draftRevision = useRef(0)
  const pendingDraft = useRef(false)
  const draftWrite = useRef<Promise<void>>(Promise.resolve())
  const draftValues = useRef({ title: '', summary: '', content: '' })
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
    // Store acknowledgements must not replace newer typing awaiting its save.
    if (pendingDraft.current) return
    if (selectedEntry) {
      draftValues.current = selectedEntry
      setEntryTitle(selectedEntry.title)
      setEntrySummary(selectedEntry.summary)
      setEntryContent(selectedEntry.content)
      setSelectedCoverAssetId(selectedEntry.coverAssetId)
    } else {
      draftValues.current = { title: '', summary: '', content: '' }
      setEntryTitle('')
      setEntrySummary('')
      setEntryContent('')
      setSelectedCoverAssetId(null)
    }
  }, [selectedEntryId, selectedEntry])

  const debouncedSave = useMemo(
    () =>
      debounce(
        async (entryId: string, updates: Pick<Entry, 'title' | 'summary' | 'content'>, revision: number) => {
          draftWrite.current = draftWrite.current.then(
            () => updateEntry(entryId, updates),
            () => updateEntry(entryId, updates),
          )
          await draftWrite.current
          if (revision === draftRevision.current) pendingDraft.current = false
        },
        1000,
      ),
    [updateEntry],
  )

  const editDraft = (field: 'title' | 'summary' | 'content', value: string) => {
    if (!selectedEntryId) return
    const next = { ...draftValues.current, [field]: value }
    draftValues.current = next
    pendingDraft.current = true
    setEntryTitle(next.title)
    setEntrySummary(next.summary)
    setEntryContent(next.content)
    // Only user edits enter the write queue. Loading a selection is read-only.
    debouncedSave(
      selectedEntryId,
      { title: next.title, summary: next.summary, content: next.content },
      ++draftRevision.current,
    )
  }

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
    await draftWrite.current
  }

  useEffect(
    () =>
      registerDraftFlusher(async () => {
        await debouncedSave.flush()
        await draftWrite.current
      }),
    [debouncedSave],
  )

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
    if (useStore.getState().saveStatus !== 'error') {
      if (onExit) onExit()
      else closeProject()
    }
  }

  useEffect(() => {
    fetchProjectAssets()
  }, [])

  const searchFilteredEntries = entries.filter((entry) => {
    if (entry.status === 'archived' && !showArchived) return false
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
    await flushDraft()
    await createEntry(newEntryType, newEntryTitle.trim())
    setNewEntryTitle('')
    setNewEntryType('character')
  }

  const handleDeleteEntry = async () => {
    if (!selectedEntryId) return
    if (window.confirm(t('确定要删除这个条目吗？'))) {
      await flushDraft()
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
      cacheAssetData(relativePath, result)

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
    return date.toLocaleDateString(getLanguage(), {
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
      const groupName =
        BUILTIN_FIELD_SCHEMAS.find((s) => s.id === schema.id)?.group || schema.group || t('其他')
      if (!groups[groupName]) groups[groupName] = []
      groups[groupName].push(schema)
    }
    return groups
  }, [applicableSchemas, language])

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
      'w-full px-3 py-2 rounded-lg bg-ui-soft border border-ui-line text-ui-text text-sm focus:outline-none focus:border-ui-accent transition-colors'

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
            <option value="" className="bg-ui-panel">
              {t('请选择...')}
            </option>
            {schema.options?.map((opt) => (
              <option key={opt} value={opt} className="bg-ui-panel">
                {BUILTIN_FIELD_SCHEMAS.some((s) => s.id === schema.id) ? t(opt) : opt}
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
                      ? 'bg-ui-soft border-ui-accent text-ui-accent'
                      : 'bg-ui-soft border-ui-line text-ui-muted hover:bg-ui-hover'
                  }`}
                >
                  {BUILTIN_FIELD_SCHEMAS.some((s) => s.id === schema.id) ? t(opt) : opt}
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
              className="w-4 h-4 rounded border-ui-line bg-ui-soft text-ui-accent focus:ring-ui-accent"
            />
            <span className="text-sm text-ui-text">{Boolean(value) ? t('是') : t('否')}</span>
          </label>
        )
      case 'color':
        return (
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={(value as string) || '#6366f1'}
              onChange={(e) => handleFieldChange(schema.id, e.target.value)}
              className="w-10 h-10 rounded-lg bg-ui-soft border border-ui-line cursor-pointer p-1"
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
              <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-ui-line">
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
              placeholder={t('输入图片 URL...')}
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
          <div key={groupName} className="bg-ui-panel rounded-xl border border-ui-line p-6">
            <h3 className="text-ui-text font-medium mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-ui-accent" />
              {groupName}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {groupSchemas.map((schema) => (
                <div key={schema.id} className="space-y-1.5">
                  <label className="block text-sm font-medium text-ui-muted">
                    {BUILTIN_FIELD_SCHEMAS.find((s) => s.id === schema.id)?.label || schema.label}
                    {schema.required && <span className="text-ui-danger ml-1">*</span>}
                  </label>
                  {renderFieldControl(schema)}
                </div>
              ))}
            </div>
          </div>
        ))
      : null

  return (
    <div
      data-profile={profile}
      className="workspace-shell grid h-screen grid-cols-[auto_minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] bg-ui-canvas"
    >
      {(activeView === 'editor' || activeView === 'card') && (
        <aside
          className={`workspace-sidebar col-start-1 row-start-2 min-h-0 ${
            sidebarCollapsed ? 'w-[72px] is-collapsed' : activeView === 'editor' ? 'w-72' : 'w-80'
          } flex flex-col bg-gradient-to-b from-ui-panel to-ui-panel border-r border-ui-line transition-all duration-300`}
        >
          <div className="p-4 border-b border-ui-line">
            <div className="flex items-center justify-between">
              {!sidebarCollapsed && (
                <div className="flex-1 min-w-0">
                  <span className="workspace-kicker">
                    {activeView === 'editor' ? 'EDITOR INDEX' : 'CARD ARCHIVE'}
                  </span>
                  <h1 className="truncate font-bold text-ui-text">
                    {activeView === 'editor' ? t('编辑目录') : t('条目卡片库')}
                  </h1>
                  <p className="truncate text-xs text-ui-muted">
                    {activeView === 'editor' ? t('按类型展开并选择条目') : t('通过封面、摘要和状态浏览条目')}
                  </p>
                </div>
              )}
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-2 rounded-lg hover:bg-ui-hover transition-colors"
              >
                {sidebarCollapsed ? (
                  <ChevronRight className="w-5 h-5 text-ui-muted" />
                ) : (
                  <ChevronLeft className="w-5 h-5 text-ui-muted" />
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
                    className="flex flex-1 items-center gap-3 rounded-lg bg-ui-accent px-4 py-3 font-medium text-ui-on-accent transition-opacity hover:opacity-90"
                  >
                    <Plus className="h-5 w-5" />
                    <span>{t('新建条目')}</span>
                  </button>
                  {activeView === 'editor' && (
                    <button
                      onClick={handleDeleteEntry}
                      disabled={!selectedEntry}
                      title={
                        selectedEntry ? t('删除“{0}”', { 0: selectedEntry.title }) : t('请先选择要删除的条目')
                      }
                      className="flex w-12 shrink-0 items-center justify-center rounded-lg border border-ui-danger bg-ui-danger-soft text-ui-danger transition-colors hover:border-ui-danger hover:bg-ui-danger-soft disabled:cursor-not-allowed disabled:border-ui-line disabled:bg-ui-soft disabled:text-ui-muted"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="px-3 pb-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ui-muted" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('搜索条目...')}
                    className="w-full pl-10 pr-4 py-2 rounded-lg bg-ui-soft border border-ui-line text-ui-text placeholder-ui-muted text-sm focus:outline-none focus:border-ui-accent transition-colors"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 px-3 pb-3 text-xs text-ui-muted">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                />
                {t('显示已归档条目')}
              </label>
              {activeView === 'card' && (
                <div className="px-3 pb-3">
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    <button
                      onClick={() => setSelectedType('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                        selectedType === 'all'
                          ? 'bg-ui-accent text-ui-on-accent'
                          : 'bg-ui-soft text-ui-muted hover:bg-ui-hover'
                      }`}
                    >
                      {t('全部')}
                    </button>
                    {(Object.entries(ENTRY_TYPE_LABELS) as [EntryType, string][]).map(([type, label]) => (
                      <button
                        key={type}
                        onClick={() => setSelectedType(type)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                          selectedType === type
                            ? 'bg-ui-accent text-ui-on-accent'
                            : 'bg-ui-soft text-ui-muted hover:bg-ui-hover'
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
                  <p className="text-xs text-ui-muted mb-2">{t('标签')}</p>
                  <div className="flex flex-wrap gap-1">
                    {tags.slice(0, 8).map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => setSearchQuery(tag.name)}
                        className="px-2 py-1 rounded text-xs text-ui-muted bg-ui-soft hover:bg-ui-hover transition-colors"
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
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ui-muted">
                  {t('条目导航')}
                </span>
                <span className="rounded-full bg-ui-soft px-2 py-0.5 text-[11px] text-ui-muted">
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
                          className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-ui-hover"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <TypeIcon className="h-4 w-4 shrink-0 text-ui-muted" />
                            {!sidebarCollapsed && (
                              <>
                                <span className="text-sm text-ui-text">{ENTRY_TYPE_LABELS[type]}</span>
                                <span className="text-xs text-ui-muted">({typeEntries.length})</span>
                              </>
                            )}
                          </div>
                          {!sidebarCollapsed && (
                            <ChevronRight
                              className={`h-4 w-4 text-ui-muted transition-transform ${expanded ? 'rotate-90' : ''}`}
                            />
                          )}
                        </button>
                        {expanded && !sidebarCollapsed && (
                          <div className="ml-4 border-l border-ui-line pl-2">
                            {typeEntries.map((entry) => {
                              const isSelected = entry.id === selectedEntryId
                              return (
                                <button
                                  key={entry.id}
                                  data-entry-id={entry.id}
                                  onClick={() => void handleSelectEntry(entry.id)}
                                  className={`mb-0.5 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                                    isSelected
                                      ? 'bg-ui-warning-soft text-ui-warning'
                                      : 'text-ui-muted hover:bg-ui-hover hover:text-ui-text'
                                  }`}
                                >
                                  <span
                                    title={entry.status === 'proposed' ? t('AI 待确认') : undefined}
                                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_COLORS[entry.status]}`}
                                  />
                                  <span className="truncate">{entry.title.trim() || t('未命名条目')}</span>
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
                  <div className="flex flex-col items-center justify-center py-12 text-ui-muted">
                    <FileText className="mb-2 h-8 w-8" />
                    {!sidebarCollapsed && <p className="text-sm">{t('暂无条目')}</p>}
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
                          ? 'border-ui-warning bg-ui-warning-soft shadow-[0_8px_24px_rgba(245,158,11,0.08)]'
                          : 'border-transparent hover:border-ui-line hover:bg-ui-hover'
                      }`}
                    >
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-ui-panel">
                        <img
                          src={getEntryCoverSource(entry)}
                          alt=""
                          className="h-full w-full object-cover opacity-75 transition duration-300 group-hover:scale-105 group-hover:opacity-100"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 to-transparent" />
                        <Icon className="absolute bottom-1.5 left-1.5 h-3.5 w-3.5 text-ui-muted" />
                        <div
                          className={`absolute right-1.5 top-1.5 h-2 w-2 rounded-full ${STATUS_COLORS[entry.status]} ring-2 ring-ui-line`}
                        />
                      </div>
                      {!sidebarCollapsed && (
                        <div className="flex-1 min-w-0">
                          <p
                            className={`truncate text-sm font-semibold ${isSelected ? 'text-ui-text' : 'text-ui-text'}`}
                          >
                            {entry.title.trim() || t('未命名条目')}
                          </p>
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className="text-[11px] text-ui-muted">{ENTRY_TYPE_LABELS[entry.type]}</span>
                            {entry.summary && <span className="text-ui-muted">·</span>}
                            {entry.summary && (
                              <span className="min-w-0 truncate text-[11px] text-ui-muted">
                                {entry.summary}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      {!sidebarCollapsed && (
                        <ChevronRight className="h-4 w-4 text-ui-muted group-hover:text-ui-muted" />
                      )}
                    </button>
                  )
                })}

                {filteredEntries.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-ui-muted">
                    <FileText className="w-8 h-8 mb-2" />
                    {!sidebarCollapsed && <p className="text-sm">{t('暂无条目')}</p>}
                  </div>
                )}
              </>
            )}
          </div>
        </aside>
      )}

      <main className="contents">
        <header className="workspace-topbar col-span-2 row-start-1 flex items-center justify-between px-6 bg-ui-panel border-b border-ui-line">
          <div className="flex w-56 shrink-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-ui-warning bg-ui-warning-soft">
              <BookOpen className="h-4 w-4 text-ui-warning" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ui-muted">
                <span className="max-w-32 truncate">{currentProject?.name}</span>
                <ChevronRight className="h-3 w-3" />
                <span className="shrink-0 whitespace-nowrap text-ui-warning">{VIEW_LABELS[activeView]}</span>
              </div>
              <h2 className="truncate text-sm font-semibold text-ui-text">
                {selectedEntry ? selectedEntry.title : PROFILES[profile].label}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {onOpenNovel && (
              <button
                className="rounded-lg bg-ui-warning-soft px-3 py-2 text-sm text-ui-warning"
                onClick={async () => {
                  await flushDraft()
                  onOpenNovel()
                }}
              >
                {t('小说创作')}
              </button>
            )}
            <div
              title={PROFILES[profile].description}
              className="view-switcher flex items-center bg-ui-soft rounded-lg p-1"
            >
              {PROFILES[profile].views.includes('editor') && (
                <button
                  onClick={() => void handleViewChange('editor')}
                  className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors ${
                    activeView === 'editor'
                      ? 'bg-ui-accent text-ui-on-accent'
                      : 'text-ui-text hover:text-ui-text'
                  }`}
                >
                  <Edit3 className="w-4 h-4" />
                  {t('编辑器')}
                </button>
              )}

              {PROFILES[profile].views.includes('wiki') && (
                <button
                  onClick={() => void handleViewChange('wiki')}
                  className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors ${
                    activeView === 'wiki'
                      ? 'bg-ui-accent text-ui-on-accent'
                      : 'text-ui-text hover:text-ui-text'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  {t('百科')}
                </button>
              )}

              {PROFILES[profile].views.includes('map') && (
                <button
                  onClick={() => void handleViewChange('map')}
                  className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors ${
                    activeView === 'map'
                      ? 'bg-ui-accent text-ui-on-accent'
                      : 'text-ui-text hover:text-ui-text'
                  }`}
                >
                  <Map className="w-4 h-4" />
                  {t('地图')}
                </button>
              )}

              {PROFILES[profile].views.includes('graph') && (
                <button
                  onClick={() => void handleViewChange('graph')}
                  className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors ${
                    activeView === 'graph'
                      ? 'bg-ui-accent text-ui-on-accent'
                      : 'text-ui-text hover:text-ui-text'
                  }`}
                >
                  <GitBranch className="w-4 h-4" />
                  {t('图谱')}
                </button>
              )}

              {PROFILES[profile].views.includes('timeline') && (
                <button
                  onClick={() => void handleViewChange('timeline')}
                  className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors ${
                    activeView === 'timeline'
                      ? 'bg-ui-accent text-ui-on-accent'
                      : 'text-ui-text hover:text-ui-text'
                  }`}
                >
                  <ClockIcon className="w-4 h-4" />
                  {t('时间轴')}
                </button>
              )}

              {PROFILES[profile].views.includes('template') && (
                <button
                  onClick={() => void handleViewChange('template')}
                  className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors ${
                    activeView === 'template'
                      ? 'bg-ui-accent text-ui-on-accent'
                      : 'text-ui-text hover:text-ui-text'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  {t('模板')}
                </button>
              )}

              {PROFILES[profile].views.includes('export') && (
                <button
                  onClick={() => void handleViewChange('export')}
                  className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors ${
                    activeView === 'export'
                      ? 'bg-ui-accent text-ui-on-accent'
                      : 'text-ui-text hover:text-ui-text'
                  }`}
                >
                  <Download className="w-4 h-4" />
                  {t('导出')}
                </button>
              )}

              {PROFILES[profile].views.includes('collab') && (
                <button
                  onClick={() => void handleViewChange('collab')}
                  className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors ${
                    activeView === 'collab'
                      ? 'bg-ui-accent text-ui-on-accent'
                      : 'text-ui-text hover:text-ui-text'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  {t('协作')}
                </button>
              )}

              {PROFILES[profile].views.includes('card') && (
                <button
                  onClick={() => void handleViewChange('card')}
                  className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors ${
                    activeView === 'card'
                      ? 'bg-ui-accent text-ui-on-accent'
                      : 'text-ui-text hover:text-ui-text'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  {t('卡片')}
                </button>
              )}
            </div>

            <div
              className={`flex items-center gap-2 text-sm ${saveStatus === 'error' ? 'text-ui-danger' : 'text-ui-muted'}`}
              title={saveStatus === 'error' ? message(saveError || t('保存失败')) : undefined}
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
                  ? t('正在保存')
                  : saveStatus === 'error'
                    ? t('保存失败，请重试')
                    : lastSaveTime
                      ? t('已保存于 {0}', { 0: formatDate(lastSaveTime) })
                      : t('尚未保存')}
              </span>
            </div>
            <button
              onClick={() => void handleSave()}
              disabled={saveStatus === 'saving'}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ui-success-soft text-ui-success hover:bg-ui-success-soft transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>{t('保存')}</span>
            </button>
            <button
              onClick={() => void handleCloseProject()}
              title={t('关闭项目')}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-ui-line text-ui-muted transition-colors hover:border-ui-danger hover:bg-ui-danger-soft hover:text-ui-danger"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="workspace-main col-start-2 row-start-2 min-h-0 overflow-hidden">
          {activeView === 'editor' ? (
            <div className="editor-scroll h-full overflow-y-auto p-6">
              {selectedEntry && profile !== 'free' && (
                <section className="world-profile">
                  <strong>{PROFILES[profile].label}</strong>
                  <p>{PROFILES[profile].description}</p>
                  <div>
                    {PROFILES[profile].focus.map((type) => (
                      <button
                        key={type}
                        onClick={() => {
                          setNewEntryType(type)
                          toggleCreateEntryModal()
                        }}
                      >
                        {ENTRY_TYPE_LABELS[type]} +
                      </button>
                    ))}
                  </div>
                </section>
              )}
              {selectedEntry ? (
                <div className="editor-canvas max-w-4xl mx-auto space-y-6">
                  {selectedCoverAssetId && selectedCoverSource && (
                    <div className="relative overflow-hidden rounded-xl border border-ui-line bg-ui-canvas">
                      <img
                        src={selectedCoverSource}
                        alt={t('封面图')}
                        className="h-[clamp(160px,20vw,260px)] w-full object-contain"
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

                  <div className="bg-ui-panel rounded-xl border border-ui-line p-6">
                    <label className="block text-sm font-medium text-ui-muted mb-2">{t('标题')}</label>
                    <input
                      type="text"
                      value={entryTitle}
                      aria-label={t('条目标题')}
                      onChange={(e) => editDraft('title', e.target.value)}
                      className="w-full px-4 py-3 rounded-lg bg-ui-soft border border-ui-line text-ui-text text-lg font-semibold focus:outline-none focus:border-ui-accent transition-colors"
                    />
                  </div>

                  <div className="bg-ui-panel rounded-xl border border-ui-line p-6">
                    <label className="block text-sm font-medium text-ui-muted mb-2">{t('摘要')}</label>
                    <textarea
                      value={entrySummary}
                      aria-label={t('条目摘要')}
                      onChange={(e) => editDraft('summary', e.target.value)}
                      placeholder={t('输入条目摘要...')}
                      rows={2}
                      className="w-full px-4 py-3 rounded-lg bg-ui-soft border border-ui-line text-ui-text placeholder-ui-muted focus:outline-none focus:border-ui-accent transition-colors resize-none"
                    />
                  </div>

                  <div className="bg-ui-panel rounded-xl border border-ui-line p-6">
                    <label className="block text-sm font-medium text-ui-muted mb-2">{t('内容')}</label>
                    <MarkdownEditor
                      content={entryContent}
                      onChange={(value) => editDraft('content', value)}
                      placeholder={t('输入条目详细内容...')}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-ui-panel rounded-xl border border-ui-line p-4">
                      <p className="text-ui-muted text-sm mb-1">{t('状态')}</p>
                      <select
                        value={selectedEntry.status}
                        onChange={(e) =>
                          updateEntry(selectedEntry.id, { status: e.target.value as EntryStatus })
                        }
                        className="w-full px-3 py-2 rounded-lg bg-ui-soft border border-ui-line text-ui-text focus:outline-none focus:border-ui-accent text-sm"
                      >
                        <option value="draft" className="bg-ui-panel">
                          {t('草稿')}
                        </option>
                        <option value="proposed" className="bg-ui-panel">
                          {t('AI 待确认')}
                        </option>
                        <option value="active" className="bg-ui-panel">
                          {t('活跃')}
                        </option>
                        <option value="complete" className="bg-ui-panel">
                          {t('完成')}
                        </option>
                        <option value="archived" className="bg-ui-panel">
                          {t('已归档')}
                        </option>
                      </select>
                    </div>

                    <div className="bg-ui-panel rounded-xl border border-ui-line p-4">
                      <p className="text-ui-muted text-sm mb-1">{t('可见性')}</p>
                      <button
                        onClick={() =>
                          updateEntry(selectedEntry.id, {
                            visibility: selectedEntry.visibility === 'private' ? 'internal' : 'private',
                          })
                        }
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-ui-soft border border-ui-line text-ui-text hover:bg-ui-hover transition-colors"
                      >
                        {selectedEntry.visibility === 'private' ? (
                          <>
                            <EyeOff className="w-4 h-4" />
                            <span>{t('私密')}</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-4 h-4" />
                            <span>{t('内部')}</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="bg-ui-panel rounded-xl border border-ui-line p-4">
                      <p className="text-ui-muted text-sm mb-1">{t('封面图')}</p>
                      <button
                        onClick={() => setShowImageUploadModal(true)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-ui-soft border border-ui-line text-ui-muted hover:bg-ui-hover hover:text-ui-text transition-colors"
                      >
                        <Image className="w-4 h-4" />
                        <span>{selectedCoverAssetId ? t('更换') : t('设置')}</span>
                      </button>
                    </div>
                  </div>

                  <div className="bg-ui-panel rounded-xl border border-ui-line p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <TagIcon className="w-5 h-5 text-ui-accent" />
                        <h3 className="text-ui-text font-medium">{t('标签')}</h3>
                      </div>
                      <button
                        onClick={() => setShowTagModal(true)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-ui-soft text-ui-accent hover:bg-ui-hover text-sm transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        <span>{t('添加标签')}</span>
                      </button>
                    </div>

                    {entryTags.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {entryTags.map((tag) => (
                          <span
                            key={tag.id}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm transition-colors cursor-pointer"
                            style={{
                              backgroundColor: tag.color ? `${tag.color}20` : 'var(--ui-soft)',
                              color: tag.color || 'var(--ui-text)',
                            }}
                            onClick={() => handleRemoveTagFromEntry(tag.id)}
                          >
                            {tag.name}
                            <XCircle className="w-3.5 h-3.5" />
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-ui-muted text-sm">{t('暂无标签，点击上方按钮添加')}</p>
                    )}
                  </div>

                  <div className="bg-ui-panel rounded-xl border border-ui-line p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Star className="w-5 h-5 text-ui-warning" />
                      <h3 className="text-ui-text font-medium">{t('别名')}</h3>
                    </div>

                    <div className="space-y-2">
                      {entryAliases.map((alias) => (
                        <div
                          key={alias.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-ui-soft"
                        >
                          <span className="text-ui-text text-sm">{alias.value}</span>
                          <button
                            onClick={() => handleDeleteAlias(alias.id)}
                            className="p-1 rounded hover:bg-ui-hover text-ui-muted hover:text-ui-danger transition-colors"
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
                          placeholder={t('输入别名...')}
                          className="flex-1 px-3 py-2 rounded-lg bg-ui-soft border border-ui-line text-ui-text text-sm placeholder-ui-muted focus:outline-none focus:border-ui-accent transition-colors"
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleCreateAlias())}
                        />
                        <button
                          onClick={handleCreateAlias}
                          disabled={!newAliasInput.trim()}
                          className="px-4 py-2 rounded-lg bg-ui-soft border border-ui-line text-ui-muted hover:bg-ui-hover hover:text-ui-text disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {customFieldsSection}

                  <div className="bg-ui-panel rounded-xl border border-ui-line p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-ui-text flex items-center gap-2">
                        <GitBranch className="w-4 h-4" />
                        {t('关系')}
                      </h4>
                      <button
                        onClick={() => setShowRelationModal(true)}
                        className="p-1 rounded hover:bg-ui-hover text-ui-muted hover:text-ui-text transition-colors"
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
                            className="flex items-center justify-between p-2 rounded-lg bg-ui-soft hover:bg-ui-hover transition-colors group cursor-pointer"
                            onClick={() => targetEntry && void handleSelectEntry(targetEntry.id)}
                          >
                            <div className="flex items-center gap-2">
                              <ArrowRightLeft className="w-3 h-3 text-ui-accent" />
                              <span className="text-sm text-ui-text">{targetEntry?.title || t('未知')}</span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-ui-soft text-ui-accent">
                                {RELATION_TYPE_LABELS[relation.type] || relation.type}
                              </span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteRelation(relation.id)
                              }}
                              className="p-1 rounded hover:bg-ui-danger-soft text-ui-muted hover:text-ui-danger opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <XCircle className="w-3 h-3" />
                            </button>
                          </div>
                        )
                      })}
                      {entryRelations.length === 0 && (
                        <p className="text-xs text-ui-muted py-2">{t('暂无关系，点击 + 添加')}</p>
                      )}
                    </div>
                  </div>

                  <div className="bg-ui-panel rounded-xl border border-ui-line p-4">
                    <h4 className="text-sm font-medium text-ui-text flex items-center gap-2 mb-3">
                      <Link className="w-4 h-4" />
                      {t('反向引用')}
                    </h4>
                    <div className="space-y-2">
                      {backlinks.map((backlink, index) => {
                        return (
                          <div
                            key={`${backlink.entry.id}-${index}`}
                            className="flex items-center gap-2 p-2 rounded-lg bg-ui-soft hover:bg-ui-hover transition-colors cursor-pointer"
                            onClick={() => void handleSelectEntry(backlink.entry.id)}
                          >
                            <ExternalLink className="w-3 h-3 text-blue-400" />
                            <span className="text-sm text-ui-text">{backlink.entry.title}</span>
                            {backlink.linkText && (
                              <span className="text-xs text-ui-muted truncate">
                                {t('引用: ')}
                                {backlink.linkText}
                              </span>
                            )}
                          </div>
                        )
                      })}
                      {backlinks.length === 0 && (
                        <p className="text-xs text-ui-muted py-2">{t('暂无反向引用')}</p>
                      )}
                    </div>
                  </div>

                  <div className="bg-ui-panel rounded-xl border border-ui-line p-4">
                    <p className="text-ui-muted text-sm">
                      {t('创建时间：')}
                      {formatDate(selectedEntry.createdAt)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-ui-muted">
                  <FileText className="w-16 h-16 mb-4" />
                  <h3 className="text-xl font-medium mb-2">{PROFILES[profile].label}</h3>
                  <p className="text-center max-w-xl mb-6">{PROFILES[profile].description}</p>
                  <div className="flex gap-3 mb-6">
                    {PROFILES[profile].focus.map((type) => (
                      <button
                        className="button-secondary"
                        key={type}
                        onClick={() => {
                          setNewEntryType(type)
                          toggleCreateEntryModal()
                        }}
                      >
                        {ENTRY_TYPE_LABELS[type]} +
                      </button>
                    ))}
                  </div>
                  <p className="text-center max-w-md">
                    {t('在左侧面板中选择一个条目开始编辑，或者点击"新建条目"创建一个新的设定。')}
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
          <div className="w-full max-w-md bg-ui-panel rounded-xl border border-ui-line shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-ui-line">
              <h2 className="text-xl font-bold text-ui-text">{t('新建条目')}</h2>
              <button
                onClick={toggleCreateEntryModal}
                className="p-2 rounded-lg hover:bg-ui-hover transition-colors"
              >
                <X className="w-5 h-5 text-ui-muted" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-ui-text mb-2">{t('条目类型')}</label>
                <div className="grid grid-cols-4 gap-2">
                  {(Object.entries(ENTRY_TYPE_LABELS) as [EntryType, string][]).map(([type, label]) => {
                    const Icon = ENTRY_TYPE_ICONS[type]
                    return (
                      <button
                        key={type}
                        onClick={() => setNewEntryType(type)}
                        className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-colors ${
                          newEntryType === type
                            ? 'bg-ui-soft border-ui-accent text-ui-text'
                            : 'bg-ui-soft border-ui-line text-ui-muted hover:bg-ui-hover'
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
                <label className="block text-sm font-medium text-ui-text mb-2">{t('标题')}</label>
                <input
                  type="text"
                  value={newEntryTitle}
                  onChange={(e) => setNewEntryTitle(e.target.value)}
                  placeholder={t('输入条目标题...')}
                  className="w-full px-4 py-3 rounded-lg bg-ui-soft border border-ui-line text-ui-text placeholder-ui-muted focus:outline-none focus:border-ui-accent transition-colors"
                  autoFocus
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={toggleCreateEntryModal}
                  className="flex-1 px-4 py-3 rounded-lg bg-ui-soft border border-ui-line text-ui-text hover:bg-ui-hover transition-colors"
                >
                  {t('取消')}
                </button>
                <button
                  onClick={handleCreateEntry}
                  disabled={!newEntryTitle.trim()}
                  className="flex-1 px-4 py-3 rounded-lg bg-ui-accent text-ui-on-accent font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                >
                  {t('创建')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showTagModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-ui-panel rounded-xl border border-ui-line shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-ui-line">
              <h2 className="text-xl font-bold text-ui-text">{t('添加标签')}</h2>
              <button
                onClick={() => setShowTagModal(false)}
                className="p-2 rounded-lg hover:bg-ui-hover transition-colors"
              >
                <X className="w-5 h-5 text-ui-muted" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-ui-text mb-2">{t('创建新标签')}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    placeholder={t('标签名称...')}
                    className="flex-1 px-4 py-2 rounded-lg bg-ui-soft border border-ui-line text-ui-text placeholder-ui-muted focus:outline-none focus:border-ui-accent transition-colors"
                  />
                  <button
                    onClick={handleCreateTag}
                    disabled={!newTagInput.trim()}
                    className="px-4 py-2 rounded-lg bg-ui-accent text-ui-on-accent hover:bg-ui-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
                {newTagInput && (
                  <div className="mt-2">
                    <p className="text-xs text-ui-muted mb-2">{t('选择颜色')}</p>
                    <div className="flex flex-wrap gap-2">
                      {COLOR_PALETTE.map((color) => (
                        <button
                          key={color}
                          onClick={() => setNewTagColor(color)}
                          className={`w-6 h-6 rounded-full transition-transform ${newTagColor === color ? 'ring-2 ring-ui-line ring-offset-2 ring-offset-slate-800 scale-110' : 'hover:scale-110'}`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {availableTags.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-ui-text mb-2">{t('添加已有标签')}</p>
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
                          backgroundColor: tag.color ? `${tag.color}20` : 'var(--ui-soft)',
                          color: tag.color || 'var(--ui-text)',
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
          <div className="w-full max-w-md bg-ui-panel rounded-xl border border-ui-line shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-ui-line">
              <h2 className="text-xl font-bold text-ui-text">{t('选择图片')}</h2>
              <button
                onClick={() => setShowImageUploadModal(false)}
                className="p-2 rounded-lg hover:bg-ui-hover transition-colors"
              >
                <X className="w-5 h-5 text-ui-muted" />
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
                className="w-full flex flex-col items-center justify-center gap-3 p-8 rounded-lg border-2 border-dashed border-ui-line hover:border-ui-accent transition-colors"
              >
                <Upload className="w-10 h-10 text-ui-muted" />
                <span className="text-ui-text">{t('点击上传图片')}</span>
                <span className="text-ui-muted text-sm">{t('支持 JPG, PNG, GIF')}</span>
              </button>

              {projectAssets.filter((a) => a.kind === 'image' || a.kind === 'cover').length > 0 && (
                <div>
                  <p className="text-sm font-medium text-ui-text mb-2">{t('已上传的图片')}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {projectAssets
                      .filter((a) => a.kind === 'image' || a.kind === 'cover')
                      .map((asset) => (
                        <div
                          key={asset.id}
                          className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-colors ${
                            selectedCoverAssetId === asset.id
                              ? 'border-ui-accent'
                              : 'border-transparent hover:border-ui-line'
                          }`}
                          onClick={() => handleSetCoverImage(asset.id)}
                        >
                          <img
                            src={getAssetUrl(asset.relativePath)}
                            alt={asset.filename}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-ui-text text-xs">{formatFileSize(asset.size)}</span>
                          </div>
                          {selectedCoverAssetId === asset.id && (
                            <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-ui-accent flex items-center justify-center">
                              <X className="w-3 h-3 text-ui-text" />
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
          <div className="w-full max-w-md bg-ui-panel rounded-xl border border-ui-line shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-ui-line">
              <h2 className="text-xl font-bold text-ui-text">{t('添加关系')}</h2>
              <button
                onClick={() => setShowRelationModal(false)}
                className="p-2 rounded-lg hover:bg-ui-hover transition-colors"
              >
                <X className="w-5 h-5 text-ui-muted" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-ui-text mb-2">{t('选择目标条目')}</label>
                <select
                  value={newRelationTargetId}
                  onChange={(e) => setNewRelationTargetId(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-ui-soft border border-ui-line text-ui-text focus:outline-none focus:border-ui-accent transition-colors"
                >
                  <option value="">{t('请选择条目...')}</option>
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
                <label className="block text-sm font-medium text-ui-text mb-2">{t('关系类型')}</label>
                <div className="grid grid-cols-3 gap-2">
                  {RELATION_TYPE_KEYS.map((type) => (
                    <button
                      key={type}
                      onClick={() => setNewRelationType(type)}
                      className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                        newRelationType === type
                          ? 'bg-ui-soft border border-ui-accent text-ui-text'
                          : 'bg-ui-soft border border-ui-line text-ui-muted hover:bg-ui-hover'
                      }`}
                    >
                      {RELATION_TYPE_LABELS[type]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-ui-text mb-2">{t('备注')}</label>
                <input
                  type="text"
                  value={newRelationNote}
                  onChange={(e) => setNewRelationNote(e.target.value)}
                  placeholder={t('添加备注（可选）...')}
                  className="w-full px-4 py-3 rounded-lg bg-ui-soft border border-ui-line text-ui-text placeholder-ui-muted focus:outline-none focus:border-ui-accent transition-colors"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowRelationModal(false)}
                  className="flex-1 px-4 py-3 rounded-lg bg-ui-soft border border-ui-line text-ui-text hover:bg-ui-hover transition-colors"
                >
                  {t('取消')}
                </button>
                <button
                  onClick={handleCreateRelation}
                  disabled={!newRelationTargetId || !newRelationType}
                  className="flex-1 px-4 py-3 rounded-lg bg-ui-accent text-ui-on-accent hover:bg-ui-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {t('添加关系')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
