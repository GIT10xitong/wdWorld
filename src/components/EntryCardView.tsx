import { t, useLanguage } from '@/lib/i18n'
import { useState, useMemo } from 'react'
import { useStore } from '@/store'
import { getEntryPlaceholderSource, resolveAssetSource } from '@/lib/assetSources'
import {
  EntryType,
  EntryStatus,
  Tag,
  CustomFieldSchema,
  ENTRY_TYPE_LABELS,
  ENTRY_STATUS_LABELS,
  RELATION_TYPE_META,
  BUILTIN_FIELD_SCHEMAS,
} from '@/types'
import {
  CreditCard,
  LayoutGrid,
  LayoutList,
  Copy,
  Share2,
  FileText,
  Users,
  Map,
  Building,
  Sword,
  Scroll,
  BookOpen,
  Folder,
  ArrowRight,
  Link,
  Check,
  Sparkles,
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

const STATUS_BADGE_STYLES: Record<EntryStatus, string> = {
  proposed: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  draft: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  active: 'bg-green-500/20 text-green-300 border-green-500/30',
  complete: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  archived: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
}

type LayoutMode = 'horizontal' | 'vertical'

export function EntryCardView() {
  const language = useLanguage()
  const {
    entries,
    entryTags,
    entryAliases,
    entryRelations,
    backlinks,
    fieldSchemas,
    entryFieldValues,
    projectAssets,
    selectedEntryId,
    selectEntry,
  } = useStore()

  const [layout, setLayout] = useState<LayoutMode>('vertical')
  const [copied, setCopied] = useState<'md' | 'text' | null>(null)

  const selectedEntry = entries.find((entry) => entry.id === selectedEntryId)
  const coverAsset = projectAssets.find((asset) => asset.id === selectedEntry?.coverAssetId)
  const coverSource = selectedEntry
    ? resolveAssetSource(coverAsset, getEntryPlaceholderSource(selectedEntry.type))
    : ''

  const applicableSchemas = useMemo(() => {
    if (!selectedEntry) return []
    return fieldSchemas
      .filter((schema) => !schema.entryType || schema.entryType === selectedEntry.type)
      .map((schema) => {
        const builtin = BUILTIN_FIELD_SCHEMAS.find((s) => s.id === schema.id)
        return builtin ? { ...schema, label: builtin.label, group: builtin.group } : schema
      })
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }, [fieldSchemas, selectedEntry, language])

  const groupedSchemas = useMemo(() => {
    const groups: Record<string, CustomFieldSchema[]> = {}
    for (const schema of applicableSchemas) {
      if (schema.key === 'theme_color') continue
      const groupName = schema.group || t('其他')
      if (!groups[groupName]) groups[groupName] = []
      groups[groupName].push(schema)
    }
    return groups
  }, [applicableSchemas])

  const getFieldValue = (fieldId: string): unknown => {
    const found = entryFieldValues.find((v) => v.fieldId === fieldId)
    return found ? found.value : null
  }

  const themeColor = useMemo(() => {
    const colorField = applicableSchemas.find((s) => s.key === 'theme_color')
    if (!colorField) return '#6366f1'
    const val = getFieldValue(colorField.id) as string | null
    return val || '#6366f1'
  }, [applicableSchemas, entryFieldValues])

  const formatFieldValue = (schema: CustomFieldSchema, value: unknown): string => {
    if (value === null || value === undefined || value === '') return '—'
    if (schema.type === 'multiselect' && Array.isArray(value)) {
      return value.join('、')
    }
    if (schema.type === 'boolean') {
      return value ? t('是') : t('否')
    }
    return BUILTIN_FIELD_SCHEMAS.some((s) => s.id === schema.id) && schema.type === 'select'
      ? t(String(value))
      : String(value)
  }

  const generateMarkdown = (): string => {
    if (!selectedEntry) return ''
    const lines: string[] = []

    lines.push(`# ${selectedEntry.title}`)
    lines.push('')
    lines.push(
      t('> **类型**: {0} | **状态**: {1}', {
        0: ENTRY_TYPE_LABELS[selectedEntry.type],
        1: ENTRY_STATUS_LABELS[selectedEntry.status],
      }),
    )
    lines.push('')

    if (selectedEntry.summary) {
      lines.push(`> ${selectedEntry.summary}`)
      lines.push('')
    }

    if (Object.keys(groupedSchemas).length > 0) {
      for (const [groupName, schemas] of Object.entries(groupedSchemas)) {
        lines.push(`## ${groupName}`)
        lines.push('')
        lines.push(t('| 字段 | 值 |'))
        lines.push('| --- | --- |')
        for (const schema of schemas) {
          const val = formatFieldValue(schema, getFieldValue(schema.id))
          lines.push(`| ${schema.label} | ${val} |`)
        }
        lines.push('')
      }
    }

    if (entryAliases.length > 0) {
      lines.push(t('## 别名'))
      lines.push('')
      lines.push(entryAliases.map((a) => `- ${a.value}`).join('\n'))
      lines.push('')
    }

    if (entryTags.length > 0) {
      lines.push(t('## 标签'))
      lines.push('')
      lines.push(entryTags.map((t) => `\`${t.name}\``).join(' '))
      lines.push('')
    }

    if (entryRelations.length > 0) {
      lines.push(t('## 关系'))
      lines.push('')
      for (const rel of entryRelations) {
        const target = entries.find((e) => e.id === rel.targetEntryId)
        const relMeta = RELATION_TYPE_META[rel.type]
        const relLabel = relMeta?.label || rel.type
        lines.push(t('- [{0}] → {1}', { 0: relLabel, 1: target?.title || '未知' }))
      }
      lines.push('')
    }

    if (selectedEntry.content) {
      lines.push(t('## 简介'))
      lines.push('')
      const contentPreview = selectedEntry.content.slice(0, 500)
      lines.push(contentPreview)
      if (selectedEntry.content.length > 500) lines.push('...')
      lines.push('')
    }

    if (backlinks.length > 0) {
      lines.push(t('## 引用'))
      lines.push('')
      for (const bl of backlinks) {
        lines.push(`- [[${bl.entry.title}]]${bl.linkText ? ` — ${bl.linkText}` : ''}`)
      }
      lines.push('')
    }

    return lines.join('\n')
  }

  const generateShareText = (): string => {
    if (!selectedEntry) return ''
    const parts: string[] = []
    parts.push(`【${ENTRY_TYPE_LABELS[selectedEntry.type]}】${selectedEntry.title}`)
    if (selectedEntry.summary) parts.push(selectedEntry.summary)
    if (entryTags.length > 0) parts.push(t('标签: {0}', { 0: entryTags.map((t) => `#${t.name}`).join(' ') }))
    if (entryRelations.length > 0) {
      const relStr = entryRelations
        .slice(0, 5)
        .map((r) => {
          const target = entries.find((e) => e.id === r.targetEntryId)
          const meta = RELATION_TYPE_META[r.type]
          return `${meta?.label || r.type}→${target?.title || '?'}`
        })
        .join(' | ')
      parts.push(t('关系: {0}', { 0: relStr }))
    }
    return parts.join('\n')
  }

  const handleCopyMarkdown = async () => {
    const md = generateMarkdown()
    try {
      await navigator.clipboard.writeText(md)
      setCopied('md')
      setTimeout(() => setCopied(null), 2000)
    } catch {
      alert(t('复制失败，请手动选择复制'))
    }
  }

  const handleShareText = async () => {
    const text = generateShareText()
    try {
      await navigator.clipboard.writeText(text)
      setCopied('text')
      setTimeout(() => setCopied(null), 2000)
    } catch {
      alert(t('复制失败，请手动选择复制'))
    }
  }

  if (!selectedEntry) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-500 bg-slate-900">
        <CreditCard className="w-16 h-16 mb-4 opacity-50" />
        <h3 className="text-xl font-medium mb-2">{t('选择一个条目生成卡片')}</h3>
        <p className="text-center max-w-md">{t('在左侧面板选择一个条目后，这里会显示精美的卡片视图。')}</p>
      </div>
    )
  }

  const TypeIcon = ENTRY_TYPE_ICONS[selectedEntry.type]

  return (
    <div className="h-full flex flex-col bg-slate-900 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 bg-slate-800/50 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <CreditCard className="w-5 h-5 text-purple-400" />
          <h2 className="text-lg font-semibold text-white">{t('卡片视图')}</h2>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white/10 rounded-lg p-1 mr-2">
            <button
              onClick={() => setLayout('vertical')}
              className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors ${
                layout === 'vertical' ? 'bg-purple-500 text-white' : 'text-slate-300 hover:text-white'
              }`}
              title={t('纵向布局')}
            >
              <LayoutList className="w-4 h-4" />
              {t('纵向')}
            </button>
            <button
              onClick={() => setLayout('horizontal')}
              className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors ${
                layout === 'horizontal' ? 'bg-purple-500 text-white' : 'text-slate-300 hover:text-white'
              }`}
              title={t('横向布局')}
            >
              <LayoutGrid className="w-4 h-4" />
              {t('横向')}
            </button>
          </div>

          <button
            onClick={handleCopyMarkdown}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-slate-300 hover:bg-white/20 hover:text-white transition-colors"
          >
            {copied === 'md' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            {copied === 'md' ? t('已复制') : t('复制Markdown')}
          </button>

          <button
            onClick={handleShareText}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-colors"
          >
            {copied === 'text' ? (
              <Check className="w-4 h-4 text-green-400" />
            ) : (
              <Share2 className="w-4 h-4" />
            )}
            {copied === 'text' ? t('已复制') : t('分享文本')}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto">
          <div
            className={`card-container bg-slate-800/40 rounded-2xl border border-white/10 overflow-hidden shadow-2xl ${
              layout === 'horizontal' ? 'flex flex-row' : 'flex flex-col'
            }`}
          >
            <div className="w-1 shrink-0" style={{ backgroundColor: themeColor }} />

            <div className={`flex-1 ${layout === 'horizontal' ? 'flex flex-row' : 'flex flex-col'}`}>
              <div
                className={`${
                  layout === 'horizontal' ? 'w-80 shrink-0' : 'w-full'
                } p-6 border-b border-white/10 ${layout === 'horizontal' ? 'border-r border-b-0' : ''}`}
                style={layout === 'horizontal' ? { borderColor: `${themeColor}30` } : {}}
              >
                <div className="flex items-center gap-2 mb-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${themeColor}30` }}
                  >
                    <TypeIcon className="w-5 h-5" style={{ color: themeColor }} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-medium" style={{ color: themeColor }}>
                      {ENTRY_TYPE_LABELS[selectedEntry.type]}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border inline-block w-fit mt-0.5 ${STATUS_BADGE_STYLES[selectedEntry.status]}`}
                    >
                      {ENTRY_STATUS_LABELS[selectedEntry.status]}
                    </span>
                  </div>
                </div>

                <h1 className="text-2xl font-bold text-white mb-4 leading-tight">{selectedEntry.title}</h1>

                <div className="mb-4 overflow-hidden rounded-xl border border-white/10 bg-slate-950/60">
                  <img
                    src={coverSource}
                    alt={t('{0}封面', { 0: ENTRY_TYPE_LABELS[selectedEntry.type] })}
                    className={`w-full object-contain ${
                      layout === 'horizontal' ? 'h-72' : 'h-[clamp(300px,38vw,520px)]'
                    }`}
                  />
                </div>

                {selectedEntry.summary && (
                  <div
                    className="rounded-xl p-4 italic text-sm text-slate-400 border-l-4"
                    style={{ borderColor: themeColor, backgroundColor: `${themeColor}08` }}
                  >
                    {selectedEntry.summary}
                  </div>
                )}
              </div>

              <div className={`flex-1 overflow-y-auto ${layout === 'horizontal' ? 'max-h-[70vh]' : ''}`}>
                <div className="p-6 space-y-5">
                  {Object.keys(groupedSchemas).length > 0 && (
                    <div className="space-y-5">
                      {Object.entries(groupedSchemas).map(([groupName, schemas]) => (
                        <div key={groupName} className="rounded-xl border border-white/10 overflow-hidden">
                          <div
                            className="px-4 py-2.5 border-b border-white/10 flex items-center gap-2"
                            style={{ backgroundColor: `${themeColor}12` }}
                          >
                            <Sparkles className="w-4 h-4" style={{ color: themeColor }} />
                            <h3 className="text-sm font-semibold text-white">{groupName}</h3>
                          </div>
                          <dl className="grid grid-cols-1 md:grid-cols-2 divide-x divide-y divide-white/5">
                            {schemas.map((schema) => {
                              const val = formatFieldValue(schema, getFieldValue(schema.id))
                              return (
                                <div key={schema.id} className="p-3 flex">
                                  <dt className="w-24 shrink-0 text-xs text-slate-500 pt-0.5">
                                    {schema.label}
                                  </dt>
                                  <dd
                                    className={`flex-1 text-sm ${val === '—' ? 'text-slate-600' : 'text-slate-200'}`}
                                  >
                                    {val}
                                  </dd>
                                </div>
                              )
                            })}
                          </dl>
                        </div>
                      ))}
                    </div>
                  )}

                  {(entryAliases.length > 0 || entryTags.length > 0) && (
                    <div className="space-y-4">
                      {entryAliases.length > 0 && (
                        <div>
                          <h4 className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">
                            {t('别名')}
                          </h4>
                          <div className="flex flex-wrap gap-1.5">
                            {entryAliases.map((alias) => (
                              <span
                                key={alias.id}
                                className="px-2.5 py-1 rounded-full text-xs italic bg-white/5 text-slate-400 border border-white/10"
                              >
                                {alias.value}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {entryTags.length > 0 && (
                        <div>
                          <h4 className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">
                            {t('标签')}
                          </h4>
                          <div className="flex flex-wrap gap-1.5">
                            {entryTags.map((tag: Tag) => {
                              const tagColor = tag.color || '#6366f1'
                              return (
                                <span
                                  key={tag.id}
                                  className="px-3 py-1 rounded-full text-xs font-medium"
                                  style={{
                                    backgroundColor: `${tagColor}25`,
                                    color: tagColor,
                                    border: `1px solid ${tagColor}40`,
                                  }}
                                >
                                  #{tag.name}
                                </span>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {entryRelations.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">
                        {t('关系')}
                      </h4>
                      <div className="flex flex-wrap gap-2 overflow-x-auto pb-1">
                        {entryRelations.map((rel) => {
                          const targetEntry = entries.find((e) => e.id === rel.targetEntryId)
                          const meta = RELATION_TYPE_META[rel.type]
                          const relColor = meta?.color || '#6b7280'
                          const relLabel = meta?.label || rel.type
                          return (
                            <div
                              key={rel.id}
                              onClick={() => targetEntry && selectEntry(targetEntry.id)}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors hover:opacity-90 shrink-0"
                              style={{
                                backgroundColor: `${relColor}15`,
                                borderColor: `${relColor}40`,
                              }}
                            >
                              <span
                                className="text-xs font-medium px-1.5 py-0.5 rounded"
                                style={{ backgroundColor: `${relColor}30`, color: relColor }}
                              >
                                {relLabel}
                              </span>
                              <ArrowRight className="w-3 h-3 text-slate-500" />
                              <span className="text-sm text-white truncate max-w-[120px]">
                                {targetEntry?.title || t('未知')}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {selectedEntry.content && (
                    <div className="rounded-xl border border-white/10 overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-white/10 bg-white/5 flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-slate-400" />
                        <h3 className="text-sm font-semibold text-white">{t('正文简介')}</h3>
                      </div>
                      <div className="p-4 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {selectedEntry.content.slice(0, 300)}
                        {selectedEntry.content.length > 300 && (
                          <span className="text-slate-500">
                            {t(' …（共')}
                            {selectedEntry.content.length}
                            {t(' 字）')}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {backlinks.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                        <Link className="w-3 h-3" />
                        {t('引用（反链）')}
                      </h4>
                      <div className="space-y-1.5">
                        {backlinks.map((bl, index) => (
                          <div
                            key={`${bl.entry.id}-${index}`}
                            onClick={() => selectEntry(bl.entry.id)}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 cursor-pointer transition-colors"
                          >
                            {(() => {
                              const Icon = ENTRY_TYPE_ICONS[bl.entry.type]
                              return <Icon className="w-3.5 h-3.5 text-slate-500" />
                            })()}
                            <span className="text-sm text-white">{bl.entry.title}</span>
                            {bl.linkText && (
                              <span className="text-xs text-slate-500 truncate ml-auto max-w-[200px]">
                                「{bl.linkText}」
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
