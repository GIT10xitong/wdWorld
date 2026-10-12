import { t, getLanguage } from '@/lib/i18n'
import { useState, useEffect } from 'react'
import { useStore } from '@/store'
import { getEntryPlaceholderSource, resolveAssetSource } from '@/lib/assetSources'
import { contentToSafeHtml } from '@/lib/markdown'
import { Entry, EntryType, Relation } from '@/types'
import {
  BookOpen,
  Search,
  ChevronRight,
  Clock,
  MapPin,
  Users,
  Building,
  Sword,
  Scroll,
  Folder,
  FileText,
  ExternalLink,
} from 'lucide-react'

const ENTRY_TYPE_ICONS: Record<EntryType, typeof BookOpen> = {
  character: Users,
  location: MapPin,
  faction: Building,
  item: Sword,
  event: Clock,
  lore: Scroll,
  region: Folder,
  note: FileText,
}

export function WikiView() {
  const {
    entries,
    tags,
    relations,
    projectAssets,
    selectedEntryId,
    selectEntry,
    fetchEntries,
    fetchTags,
    fetchRelations,
    searchByTag,
  } = useStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null)
  const [tagFilteredEntryIds, setTagFilteredEntryIds] = useState<Set<string> | null>(null)
  const [expandedTypes, setExpandedTypes] = useState<Set<EntryType>>(new Set(['character', 'location']))

  useEffect(() => {
    fetchEntries()
    fetchTags()
    fetchRelations()
  }, [fetchEntries, fetchRelations, fetchTags])

  useEffect(() => {
    let cancelled = false

    if (!selectedTagId) {
      setTagFilteredEntryIds(null)
      return () => {
        cancelled = true
      }
    }

    setTagFilteredEntryIds(new Set())
    void searchByTag(selectedTagId).then((matchedEntries) => {
      if (!cancelled) setTagFilteredEntryIds(new Set(matchedEntries.map((entry) => entry.id)))
    })

    return () => {
      cancelled = true
    }
  }, [searchByTag, selectedTagId])

  const filteredEntries = entries.filter((entry) => {
    if (searchQuery && !entry.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false
    }
    if (selectedTagId && tagFilteredEntryIds) {
      return tagFilteredEntryIds.has(entry.id)
    }
    return true
  })

  const groupedEntries = filteredEntries.reduce(
    (acc, entry) => {
      if (!acc[entry.type]) {
        acc[entry.type] = []
      }
      acc[entry.type].push(entry)
      return acc
    },
    {} as Record<EntryType, Entry[]>,
  )

  const selectedEntry = entries.find((e) => e.id === selectedEntryId)

  const getEntryCoverSource = (entry: Entry) =>
    resolveAssetSource(
      projectAssets.find((asset) => asset.id === entry.coverAssetId),
      getEntryPlaceholderSource(entry.type),
    )

  const getEntryRelations = (entryId: string): { targetEntry: Entry | undefined; relation: Relation }[] => {
    return relations
      .filter((r) => r.sourceEntryId === entryId)
      .map((r) => ({
        targetEntry: entries.find((e) => e.id === r.targetEntryId),
        relation: r,
      }))
      .filter((r) => r.targetEntry)
  }

  const getRelatedEntries = (entryId: string): Entry[] => {
    const relatedIds = new Set<string>()
    relations.forEach((r) => {
      if (r.sourceEntryId === entryId) {
        relatedIds.add(r.targetEntryId)
      }
      if (r.targetEntryId === entryId) {
        relatedIds.add(r.sourceEntryId)
      }
    })
    return entries.filter((e) => relatedIds.has(e.id)).slice(0, 5)
  }

  const getSameTypeEntries = (entry: Entry): Entry[] => {
    return entries.filter((e) => e.type === entry.type && e.id !== entry.id).slice(0, 5)
  }

  const handleTypeToggle = (type: EntryType) => {
    setExpandedTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) {
        next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }

  return (
    <div className="h-full flex flex-col bg-slate-900">
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-purple-400" />
          <h2 className="text-lg font-semibold text-white">{t('百科视图')}</h2>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-72 border-r border-white/10 flex flex-col">
          <div className="p-4 border-b border-white/10">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('搜索条目...')}
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-purple-500/50 transition-colors"
              />
            </div>
          </div>

          <div className="p-4 border-b border-white/10">
            <p className="text-xs text-slate-500 mb-2">{t('按标签筛选')}</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedTagId(null)}
                className={`px-2 py-1 rounded-full text-xs transition-colors ${
                  !selectedTagId ? 'bg-purple-500 text-white' : 'bg-white/10 text-slate-400 hover:bg-white/20'
                }`}
              >
                {t('全部')}
              </button>
              {tags.slice(0, 10).map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => setSelectedTagId(tag.id)}
                  className={`px-2 py-1 rounded-full text-xs transition-colors ${
                    selectedTagId === tag.id
                      ? 'bg-purple-500 text-white'
                      : 'bg-white/10 text-slate-400 hover:bg-white/20'
                  }`}
                  style={tag.color ? { backgroundColor: `${tag.color}20`, color: tag.color } : {}}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {(Object.entries(groupedEntries) as [EntryType, Entry[]][]).map(([type, typeEntries]) => {
              const Icon = ENTRY_TYPE_ICONS[type]
              return (
                <div key={type} className="mb-2">
                  <button
                    onClick={() => handleTypeToggle(type)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-300">{ENTRY_TYPE_LABELS[type]}</span>
                      <span className="text-xs text-slate-500">({typeEntries.length})</span>
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 text-slate-500 transition-transform ${expandedTypes.has(type) ? 'rotate-90' : ''}`}
                    />
                  </button>

                  {expandedTypes.has(type) && (
                    <div className="ml-4 mt-1 space-y-1">
                      {typeEntries.map((entry) => (
                        <button
                          key={entry.id}
                          onClick={() => selectEntry(entry.id)}
                          className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                            selectedEntryId === entry.id
                              ? 'bg-purple-500/20 text-white'
                              : 'text-slate-400 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <img
                            src={getEntryCoverSource(entry)}
                            alt=""
                            className="h-8 w-8 shrink-0 rounded-md object-cover opacity-80"
                          />
                          <span className="truncate">{entry.title}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {filteredEntries.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                <FileText className="w-8 h-8 mb-2" />
                <p className="text-sm">{t('暂无条目')}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {selectedEntry ? (
            <div className="max-w-3xl mx-auto p-8">
              <div className="relative mb-7 h-56 overflow-hidden rounded-2xl border border-white/10">
                <img
                  src={getEntryCoverSource(selectedEntry)}
                  alt={t('{0}封面', { 0: ENTRY_TYPE_LABELS[selectedEntry.type] })}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <span className="rounded-full bg-black/35 px-2.5 py-1 text-xs text-slate-200 backdrop-blur">
                    {ENTRY_TYPE_LABELS[selectedEntry.type]}
                  </span>
                  <h1 className="mt-2 text-3xl font-bold text-white">{selectedEntry.title}</h1>
                </div>
              </div>
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  {(() => {
                    const Icon = ENTRY_TYPE_ICONS[selectedEntry.type]
                    return <Icon className="w-5 h-5 text-slate-400" />
                  })()}
                  <span className="text-sm text-slate-400">{ENTRY_TYPE_LABELS[selectedEntry.type]}</span>
                </div>
                {selectedEntry.summary && <p className="text-slate-400 mt-2">{selectedEntry.summary}</p>}
              </div>

              {selectedEntry.content && (
                <div className="prose prose-invert max-w-none mb-8">
                  <div
                    dangerouslySetInnerHTML={{
                      __html: contentToSafeHtml(selectedEntry.content),
                    }}
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-800/50 rounded-xl border border-white/10 p-4">
                  <h3 className="text-sm font-medium text-slate-300 mb-3">{t('相关条目')}</h3>
                  <div className="space-y-2">
                    {getRelatedEntries(selectedEntry.id).map((entry) => (
                      <div
                        key={entry.id}
                        onClick={() => selectEntry(entry.id)}
                        className="flex items-center gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition-colors"
                      >
                        {(() => {
                          const Icon = ENTRY_TYPE_ICONS[entry.type]
                          return <Icon className="w-4 h-4 text-slate-400" />
                        })()}
                        <span className="text-sm text-white">{entry.title}</span>
                      </div>
                    ))}
                    {getRelatedEntries(selectedEntry.id).length === 0 && (
                      <p className="text-xs text-slate-500">{t('暂无相关条目')}</p>
                    )}
                  </div>
                </div>

                <div className="bg-slate-800/50 rounded-xl border border-white/10 p-4">
                  <h3 className="text-sm font-medium text-slate-300 mb-3">{t('同类型条目')}</h3>
                  <div className="space-y-2">
                    {getSameTypeEntries(selectedEntry).map((entry) => (
                      <div
                        key={entry.id}
                        onClick={() => selectEntry(entry.id)}
                        className="flex items-center gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition-colors"
                      >
                        {(() => {
                          const Icon = ENTRY_TYPE_ICONS[entry.type]
                          return <Icon className="w-4 h-4 text-slate-400" />
                        })()}
                        <span className="text-sm text-white">{entry.title}</span>
                      </div>
                    ))}
                    {getSameTypeEntries(selectedEntry).length === 0 && (
                      <p className="text-xs text-slate-500">{t('暂无同类型条目')}</p>
                    )}
                  </div>
                </div>

                <div className="bg-slate-800/50 rounded-xl border border-white/10 p-4">
                  <h3 className="text-sm font-medium text-slate-300 mb-3">{t('关系')}</h3>
                  <div className="space-y-2">
                    {getEntryRelations(selectedEntry.id).map(({ targetEntry, relation }) => (
                      <div
                        key={relation.id}
                        onClick={() => targetEntry && selectEntry(targetEntry.id)}
                        className="flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <ExternalLink className="w-4 h-4 text-purple-400" />
                          <span className="text-sm text-white">{targetEntry?.title}</span>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
                          {relation.type}
                        </span>
                      </div>
                    ))}
                    {getEntryRelations(selectedEntry.id).length === 0 && (
                      <p className="text-xs text-slate-500">{t('暂无关系')}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-8 text-xs text-slate-500">
                {t('更新于')}
                {formatDate(selectedEntry.updatedAt)}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <BookOpen className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg">{t('选择一个条目开始阅读')}</p>
              <p className="text-sm mt-2">{t('在左侧目录中选择条目，或使用搜索功能')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  get character() {
    return t('人物')
  },
  get location() {
    return t('地点')
  },
  get faction() {
    return t('组织')
  },
  get item() {
    return t('物品')
  },
  get event() {
    return t('事件')
  },
  get lore() {
    return t('设定')
  },
  get region() {
    return t('区域')
  },
  get note() {
    return t('笔记')
  },
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString(getLanguage(), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
