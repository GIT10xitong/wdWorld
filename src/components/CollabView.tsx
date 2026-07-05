import { useState, useRef } from 'react'
import { useStore } from '@/store'
import { Entry, Tag, Relation, Asset, Anchor, TimelineEvent, Template } from '@/types'
import { Users, Download, Upload, FileJson, Copy, Check, Info, AlertCircle } from 'lucide-react'

interface ExportData {
  version: string
  project: {
    id: string
    name: string
    slug: string
    description: string
    createdAt: string
    updatedAt: string
  }
  entries: Entry[]
  tags: Tag[]
  relations: Relation[]
  assets: Asset[]
  anchors: Anchor[]
  timelineEvents: TimelineEvent[]
  templates: Template[]
}

export function CollabView() {
  const { currentProject, entries, tags, relations, projectAssets, anchors, entryTimelineEvents, worldTimelineEvents, templates, saveProject, openProject, initializeDatabase, database } = useStore()
  const [exportData, setExportData] = useState<string>('')
  const [importStatus, setImportStatus] = useState<'idle' | 'importing' | 'success' | 'error'>('idle')
  const [importMessage, setImportMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = () => {
    if (!currentProject) return

    const data: ExportData = {
      version: '1.0',
      project: {
        id: currentProject.id,
        name: currentProject.name,
        slug: currentProject.slug,
        description: currentProject.description,
        createdAt: currentProject.createdAt,
        updatedAt: currentProject.updatedAt,
      },
      entries,
      tags,
      relations,
      assets: projectAssets,
      anchors,
      timelineEvents: [...entryTimelineEvents, ...worldTimelineEvents],
      templates,
    }

    const json = JSON.stringify(data, null, 2)
    setExportData(json)
  }

  const handleCopyExport = () => {
    navigator.clipboard.writeText(exportData)
    alert('数据已复制到剪贴板')
  }

  const handleDownloadExport = () => {
    const blob = new Blob([exportData], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${currentProject?.slug || 'wdworld'}-export.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImportStatus('importing')
    setImportMessage('正在导入数据...')

    try {
      const text = await file.text()
      const data = JSON.parse(text) as ExportData

      if (!data.project || !data.entries) {
        throw new Error('无效的导出文件格式')
      }

      await initializeDatabase()

      if (database) {
        await database.createProject(data.project.name, data.project.description)
        
        for (const entry of data.entries) {
          await database.createEntry(
            data.project.id,
            entry.type,
            entry.title,
            entry.summary || '',
            entry.content || ''
          )
        }

        for (const tag of data.tags) {
          await database.createTag(data.project.id, tag.name, tag.color || undefined)
        }

        for (const relation of data.relations) {
          await database.createRelation(relation.sourceEntryId, relation.targetEntryId, relation.type, relation.note || '')
        }

        for (const asset of data.assets) {
          await database.createAsset(data.project.id, asset.kind, asset.filename, asset.relativePath, asset.mimeType, asset.size, asset.checksum || undefined)
        }

        for (const anchor of data.anchors) {
          await database.createAnchor(anchor.entryId, anchor.label, anchor.x, anchor.y, anchor.notes || undefined)
        }

        for (const event of data.timelineEvents) {
          await database.createTimelineEvent(event.entryId, event.pointLabel, event.title, event.sortValue, event.description)
        }

        for (const template of data.templates) {
          await database.createTemplate(data.project.id, template.name, template.type, template.description, template.content, template.tags, template.aliases)
        }

        await saveProject()
        await openProject(data.project.id)
      }

      setImportStatus('success')
      setImportMessage('导入成功！项目数据已加载')
    } catch (error) {
      console.error('Import failed:', error)
      setImportStatus('error')
      setImportMessage(`导入失败：${error instanceof Error ? error.message : '未知错误'}`)
    }

    e.target.value = ''
  }

  const handlePasteImport = async () => {
    try {
      const text = await navigator.clipboard.readText()
      const data = JSON.parse(text) as ExportData

      if (!data.project || !data.entries) {
        throw new Error('无效的导出数据格式')
      }

      setImportStatus('importing')
      setImportMessage('正在导入数据...')

      await initializeDatabase()

      if (database) {
        await database.createProject(data.project.name, data.project.description)
        
        for (const entry of data.entries) {
          await database.createEntry(
            data.project.id,
            entry.type,
            entry.title,
            entry.summary || '',
            entry.content || ''
          )
        }

        for (const tag of data.tags) {
          await database.createTag(data.project.id, tag.name, tag.color || undefined)
        }

        for (const relation of data.relations) {
          await database.createRelation(relation.sourceEntryId, relation.targetEntryId, relation.type, relation.note || '')
        }

        for (const asset of data.assets) {
          await database.createAsset(data.project.id, asset.kind, asset.filename, asset.relativePath, asset.mimeType, asset.size, asset.checksum || undefined)
        }

        for (const anchor of data.anchors) {
          await database.createAnchor(anchor.entryId, anchor.label, anchor.x, anchor.y, anchor.notes || undefined)
        }

        for (const event of data.timelineEvents) {
          await database.createTimelineEvent(event.entryId, event.pointLabel, event.title, event.sortValue, event.description)
        }

        for (const template of data.templates) {
          await database.createTemplate(data.project.id, template.name, template.type, template.description, template.content, template.tags, template.aliases)
        }

        await saveProject()
        await openProject(data.project.id)
      }

      setImportStatus('success')
      setImportMessage('导入成功！项目数据已加载')
    } catch (error) {
      console.error('Paste import failed:', error)
      setImportStatus('error')
      setImportMessage(`导入失败：${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  return (
    <div className="h-full flex flex-col bg-slate-900">
      <div className="flex items-center justify-between p-6 border-b border-white/10">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Users className="w-7 h-7 text-cyan-400" />
            项目协作
          </h2>
          <p className="text-slate-400 mt-1">通过文件共享实现项目数据的导入和导出</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-800/50 rounded-xl border border-white/10 p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Download className="w-5 h-5 text-green-400" />
              导出项目数据
            </h3>

            {!currentProject ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                <FileJson className="w-12 h-12 mb-4" />
                <p>请先打开或创建一个项目</p>
              </div>
            ) : (
              <>
                <button
                  onClick={handleExport}
                  className="w-full py-3 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors mb-4 flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  生成导出数据
                </button>

                {exportData && (
                  <div className="space-y-4">
                    <div className="bg-black/40 rounded-lg p-4">
                      <textarea
                        value={exportData}
                        readOnly
                        className="w-full h-48 bg-transparent text-slate-300 font-mono text-xs resize-none focus:outline-none"
                      />
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={handleCopyExport}
                        className="flex-1 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
                      >
                        <Copy className="w-4 h-4" />
                        复制到剪贴板
                      </button>
                      <button
                        onClick={handleDownloadExport}
                        className="flex-1 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        下载文件
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="mt-6 p-4 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-slate-300">
                  <p className="font-medium text-cyan-400 mb-1">导出说明</p>
                  <p className="text-slate-400">
                    导出的 JSON 文件包含项目的所有数据，包括条目、标签、关系、资源、锚点、时间轴事件和模板。
                    可以将此文件发送给其他用户进行协作，或用于备份项目。
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-xl border border-white/10 p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5 text-orange-400" />
              导入项目数据
            </h3>

            <div className="space-y-4">
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors"
                style={{
                  borderColor: importStatus === 'success' ? '#22c55e' : importStatus === 'error' ? '#ef4444' : '#475569',
                  backgroundColor: importStatus === 'success' ? 'rgba(34, 197, 94, 0.1)' : importStatus === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(71, 85, 105, 0.1)',
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
                {importStatus === 'success' ? (
                  <>
                    <Check className="w-12 h-12 text-green-400 mx-auto mb-4" />
                    <p className="text-green-400 font-medium">{importMessage}</p>
                  </>
                ) : importStatus === 'error' ? (
                  <>
                    <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                    <p className="text-red-400 font-medium">{importMessage}</p>
                  </>
                ) : importStatus === 'importing' ? (
                  <>
                    <div className="w-12 h-12 border-4 border-orange-400 border-t-transparent rounded-full mx-auto mb-4 animate-spin" />
                    <p className="text-orange-400 font-medium">{importMessage}</p>
                  </>
                ) : (
                  <>
                    <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-300 font-medium">点击或拖拽文件到此处</p>
                    <p className="text-slate-500 text-sm mt-2">支持 .json 格式的导出文件</p>
                  </>
                )}
              </div>

              <button
                onClick={handlePasteImport}
                className="w-full py-3 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
              >
                <Copy className="w-5 h-5" />
                从剪贴板粘贴导入
              </button>
            </div>

            <div className="mt-6 p-4 bg-orange-500/10 rounded-lg border border-orange-500/20">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-slate-300">
                  <p className="font-medium text-orange-400 mb-1">导入说明</p>
                  <p className="text-slate-400">
                    导入会创建一个新的项目，包含导出文件中的所有数据。
                    如果数据库中已存在同名项目，可能会产生冲突，请确保在导入前备份当前项目。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 bg-slate-800/50 rounded-xl border border-white/10 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">协作流程</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-black/20 rounded-lg p-4 text-center">
              <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-purple-400 font-bold">1</span>
              </div>
              <h4 className="text-white font-medium mb-2">导出数据</h4>
              <p className="text-slate-400 text-sm">在"导出项目数据"面板中生成 JSON 文件</p>
            </div>
            <div className="bg-black/20 rounded-lg p-4 text-center">
              <div className="w-10 h-10 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-cyan-400 font-bold">2</span>
              </div>
              <h4 className="text-white font-medium mb-2">共享文件</h4>
              <p className="text-slate-400 text-sm">通过局域网文件共享或即时通讯工具发送文件</p>
            </div>
            <div className="bg-black/20 rounded-lg p-4 text-center">
              <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-green-400 font-bold">3</span>
              </div>
              <h4 className="text-white font-medium mb-2">导入数据</h4>
              <p className="text-slate-400 text-sm">在另一台设备上导入 JSON 文件进行协作</p>
            </div>
          </div>
        </div>

        <div className="mt-6 bg-slate-800/50 rounded-xl border border-white/10 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">注意事项</h3>
          <ul className="space-y-2 text-slate-400">
            <li className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <span>导入会覆盖当前数据库状态，请确保在导入前已保存并关闭当前项目</span>
            </li>
            <li className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <span>导出的 JSON 文件可能包含大量数据，请确保有足够的存储空间</span>
            </li>
            <li className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <span>建议定期导出项目数据作为备份，防止数据丢失</span>
            </li>
            <li className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <span>多人同时编辑同一项目时，建议通过文件版本管理工具协调（如 Git）</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}