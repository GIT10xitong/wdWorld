import { useRef, useState } from 'react'
import { useStore } from '@/store'
import { AlertCircle, Check, Copy, Download, FileJson, Info, Loader2, Upload, Users } from 'lucide-react'

export function CollabView() {
  const currentProject = useStore((state) => state.currentProject)
  const getProjectBackupJSON = useStore((state) => state.getProjectBackupJSON)
  const importProjectBackupJSON = useStore((state) => state.importProjectBackupJSON)
  const [exportData, setExportData] = useState('')
  const [copyDone, setCopyDone] = useState(false)
  const [importStatus, setImportStatus] = useState<'idle' | 'importing' | 'success' | 'error'>('idle')
  const [importMessage, setImportMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = async () => {
    try {
      setExportData(await getProjectBackupJSON())
    } catch (error) {
      setImportStatus('error')
      setImportMessage(error instanceof Error ? error.message : '生成备份失败')
    }
  }

  const handleCopyExport = async () => {
    try {
      await navigator.clipboard.writeText(exportData)
      setCopyDone(true)
      window.setTimeout(() => setCopyDone(false), 1600)
    } catch {
      setImportStatus('error')
      setImportMessage('无法写入剪贴板，请手动复制备份内容')
    }
  }

  const handleDownloadExport = () => {
    const blob = new Blob([exportData], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${currentProject?.slug || 'wdworld'}-backup.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const importText = async (text: string) => {
    setImportStatus('importing')
    setImportMessage('正在导入完整项目备份…')
    try {
      const project = await importProjectBackupJSON(text)
      setImportStatus('success')
      setImportMessage(`已创建并打开“${project.name}”`)
    } catch (error) {
      setImportStatus('error')
      setImportMessage(`导入失败：${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) await importText(await file.text())
    event.target.value = ''
  }

  const handlePasteImport = async () => {
    try {
      await importText(await navigator.clipboard.readText())
    } catch {
      setImportStatus('error')
      setImportMessage('无法读取剪贴板，请改用 JSON 文件导入')
    }
  }

  return (
    <div className="flex h-full flex-col bg-slate-900">
      <div className="border-b border-white/10 p-6">
        <h2 className="flex items-center gap-3 text-2xl font-bold text-white">
          <Users className="h-7 w-7 text-cyan-400" />
          项目协作
        </h2>
        <p className="mt-1 text-slate-400">通过完整项目备份在设备或协作者之间传递数据</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-white/10 bg-slate-800/50 p-6">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
              <Download className="h-5 w-5 text-green-400" />
              导出完整备份
            </h3>
            {!currentProject ? (
              <div className="flex flex-col items-center py-8 text-slate-500">
                <FileJson className="mb-4 h-12 w-12" />
                <p>请先打开或创建一个项目</p>
              </div>
            ) : (
              <>
                <button
                  onClick={() => void handleExport()}
                  className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg bg-green-500/20 py-3 text-green-400 transition-colors hover:bg-green-500/30"
                >
                  <Download className="h-5 w-5" />
                  生成备份数据
                </button>
                {exportData && (
                  <div className="space-y-4">
                    <div className="rounded-lg bg-black/40 p-4">
                      <textarea
                        value={exportData}
                        readOnly
                        aria-label="项目备份 JSON"
                        className="h-48 w-full resize-none bg-transparent font-mono text-xs text-slate-300 focus:outline-none"
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => void handleCopyExport()}
                        className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-700 py-2 text-white hover:bg-slate-600"
                      >
                        {copyDone ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copyDone ? '已复制' : '复制'}
                      </button>
                      <button
                        onClick={handleDownloadExport}
                        className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-500 py-2 text-white hover:bg-green-600"
                      >
                        <Download className="h-4 w-4" />
                        下载文件
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
            <Notice
              tone="cyan"
              text="备份包含条目、标签、关系、别名、资源元数据、锚点、时间轴、自定义字段和纪元。"
            />
          </section>

          <section className="rounded-xl border border-white/10 bg-slate-800/50 p-6">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
              <Upload className="h-5 w-5 text-orange-400" />
              导入完整备份
            </h3>
            <button
              type="button"
              disabled={importStatus === 'importing'}
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-lg border-2 border-dashed border-slate-600 bg-slate-700/10 p-8 text-center transition-colors hover:border-orange-400/60 disabled:cursor-wait"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={(event) => void handleImport(event)}
                className="hidden"
              />
              {importStatus === 'importing' ? (
                <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-orange-400" />
              ) : importStatus === 'success' ? (
                <Check className="mx-auto mb-4 h-12 w-12 text-green-400" />
              ) : importStatus === 'error' ? (
                <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-400" />
              ) : (
                <Upload className="mx-auto mb-4 h-12 w-12 text-slate-400" />
              )}
              <p
                className={
                  importStatus === 'error'
                    ? 'text-red-400'
                    : importStatus === 'success'
                      ? 'text-green-400'
                      : 'text-slate-300'
                }
              >
                {importMessage || '点击选择 JSON 备份文件'}
              </p>
            </button>
            <button
              disabled={importStatus === 'importing'}
              onClick={() => void handlePasteImport()}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-700 py-3 text-white hover:bg-slate-600 disabled:cursor-wait disabled:opacity-60"
            >
              <Copy className="h-5 w-5" />
              从剪贴板粘贴导入
            </button>
            <Notice
              tone="orange"
              text="导入会创建名称带“副本”的新项目，不会覆盖当前项目；完成后会自动打开新项目。"
            />
          </section>
        </div>
      </div>
    </div>
  )
}

function Notice({ tone, text }: { tone: 'cyan' | 'orange'; text: string }) {
  const classes =
    tone === 'cyan'
      ? 'border-cyan-500/20 bg-cyan-500/10 text-cyan-400'
      : 'border-orange-500/20 bg-orange-500/10 text-orange-400'
  return (
    <div className={`mt-6 flex items-start gap-3 rounded-lg border p-4 ${classes}`}>
      <Info className="mt-0.5 h-5 w-5 shrink-0" />
      <p className="text-sm text-slate-400">{text}</p>
    </div>
  )
}
