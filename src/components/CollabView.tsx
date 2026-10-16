import { t } from '@/lib/i18n'
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
      setImportMessage(error instanceof Error ? error.message : t('生成备份失败'))
    }
  }

  const handleCopyExport = async () => {
    try {
      await navigator.clipboard.writeText(exportData)
      setCopyDone(true)
      window.setTimeout(() => setCopyDone(false), 1600)
    } catch {
      setImportStatus('error')
      setImportMessage(t('无法写入剪贴板，请手动复制备份内容'))
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
    setImportMessage(t('正在导入完整项目备份…'))
    try {
      const project = await importProjectBackupJSON(text)
      setImportStatus('success')
      setImportMessage(t('已创建并打开“{0}”', { 0: project.name }))
    } catch (error) {
      setImportStatus('error')
      setImportMessage(t('导入失败：{0}', { 0: error instanceof Error ? error.message : '未知错误' }))
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
      setImportMessage(t('无法读取剪贴板，请改用 JSON 文件导入'))
    }
  }

  return (
    <div className="flex h-full flex-col bg-ui-canvas">
      <div className="border-b border-ui-line p-6">
        <h2 className="flex items-center gap-3 text-2xl font-bold text-ui-text">
          <Users className="h-7 w-7 text-cyan-400" />
          {t('项目协作')}
        </h2>
        <p className="mt-1 text-ui-muted">{t('通过完整项目备份在设备或协作者之间传递数据')}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-ui-line bg-ui-panel p-6">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-ui-text">
              <Download className="h-5 w-5 text-ui-success" />
              {t('导出完整备份')}
            </h3>
            {!currentProject ? (
              <div className="flex flex-col items-center py-8 text-ui-muted">
                <FileJson className="mb-4 h-12 w-12" />
                <p>{t('请先打开或创建一个项目')}</p>
              </div>
            ) : (
              <>
                <button
                  onClick={() => void handleExport()}
                  className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg bg-ui-success-soft py-3 text-ui-success transition-colors hover:bg-ui-success-soft"
                >
                  <Download className="h-5 w-5" />
                  {t('生成备份数据')}
                </button>
                {exportData && (
                  <div className="space-y-4">
                    <div className="rounded-lg bg-ui-input p-4">
                      <textarea
                        value={exportData}
                        readOnly
                        aria-label={t('项目备份 JSON')}
                        className="h-48 w-full resize-none bg-transparent font-mono text-xs text-ui-text focus:outline-none"
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => void handleCopyExport()}
                        className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-ui-panel py-2 text-ui-text hover:bg-ui-hover"
                      >
                        {copyDone ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copyDone ? t('已复制') : t('复制')}
                      </button>
                      <button
                        onClick={handleDownloadExport}
                        className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-ui-accent py-2 text-ui-on-accent hover:bg-ui-accent-hover"
                      >
                        <Download className="h-4 w-4" />
                        {t('下载文件')}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
            <Notice
              tone="cyan"
              text={t('备份包含条目、标签、关系、别名、资源元数据、锚点、时间轴、自定义字段和纪元。')}
            />
          </section>

          <section className="rounded-xl border border-ui-line bg-ui-panel p-6">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-ui-text">
              <Upload className="h-5 w-5 text-orange-400" />
              {t('导入完整备份')}
            </h3>
            <button
              type="button"
              disabled={importStatus === 'importing'}
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-lg border-2 border-dashed border-ui-line bg-ui-panel p-8 text-center transition-colors hover:border-orange-400/60 disabled:cursor-wait"
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
                <Check className="mx-auto mb-4 h-12 w-12 text-ui-success" />
              ) : importStatus === 'error' ? (
                <AlertCircle className="mx-auto mb-4 h-12 w-12 text-ui-danger" />
              ) : (
                <Upload className="mx-auto mb-4 h-12 w-12 text-ui-muted" />
              )}
              <p
                className={
                  importStatus === 'error'
                    ? 'text-ui-danger'
                    : importStatus === 'success'
                      ? 'text-ui-success'
                      : 'text-ui-text'
                }
              >
                {importMessage || t('点击选择 JSON 备份文件')}
              </p>
            </button>
            <button
              disabled={importStatus === 'importing'}
              onClick={() => void handlePasteImport()}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-ui-panel py-3 text-ui-text hover:bg-ui-hover disabled:cursor-wait disabled:opacity-60"
            >
              <Copy className="h-5 w-5" />
              {t('从剪贴板粘贴导入')}
            </button>
            <Notice
              tone="orange"
              text={t('导入会创建名称带“副本”的新项目，不会覆盖当前项目；完成后会自动打开新项目。')}
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
      <p className="text-sm text-ui-muted">{text}</p>
    </div>
  )
}
