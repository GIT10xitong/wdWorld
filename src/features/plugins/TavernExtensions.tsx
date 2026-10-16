import { useEffect, useState } from 'react'
import { t, message } from '@/lib/i18n'
import {
  localize,
  pluginCall,
  refreshPlugins,
  usePlugins,
  type InstalledPlugin,
  type PluginOutput,
  inPluginScope,
  type PluginScope,
} from './store'
import { st } from '@/features/studio/homeModel'
import './plugins.css'

export function TavernExtensions({
  projectId,
  onManage,
  onBusyChange,
  mode = 'tavern',
}: {
  projectId: string
  onManage: () => void
  onBusyChange: (busy: boolean) => void
  mode?: Exclude<PluginScope, 'modes'>
}) {
  const plugins = usePlugins().filter((p) => p.enabled && inPluginScope(p.manifest, mode))
  const [selected, setSelected] = useState('')
  const [busy, setBusy] = useState(false)
  const active = plugins.find((p) => p.manifest.id === selected) || plugins[0]
  useEffect(() => {
    onBusyChange(busy)
    return () => onBusyChange(false)
  }, [busy, onBusyChange])
  return (
    <div className="plugins-panel" style={{ maxHeight: '100%', width: '100%', border: 0 }}>
      <header>
        <div>
          <h1>{mode === 'tavern' ? t('酒馆扩展') : st('插件扩展', 'Plugin extensions')}</h1>
          <p>{t('记忆按项目隔离，服务密钥在本机加密保存。图片与语音只发送你在此确认的文本。')}</p>
        </div>
        <button disabled={busy} onClick={onManage}>
          {t('管理与下载扩展')}
        </button>
      </header>
      {!plugins.length && (
        <p>
          {st(
            '当前模式尚无已启用扩展。点击“管理与下载扩展”获取或导入适用插件。',
            'No enabled extensions for this mode. Use “Manage and download extensions” to find or import compatible packages.',
          )}
        </p>
      )}
      <div>
        {plugins.map((p) => (
          <button
            key={p.manifest.id}
            disabled={busy}
            aria-pressed={active?.manifest.id === p.manifest.id}
            onClick={() => setSelected(p.manifest.id)}
          >
            {localize(p.manifest.name)}
          </button>
        ))}
      </div>
      {active && (
        <ExtensionForm
          key={active.manifest.id + projectId}
          plugin={active}
          projectId={projectId}
          busy={busy}
          setBusy={setBusy}
        />
      )}
    </div>
  )
}
function ExtensionForm({
  plugin,
  projectId,
  busy,
  setBusy,
}: {
  plugin: InstalledPlugin
  projectId: string
  busy: boolean
  setBusy: (value: boolean) => void
}) {
  const id = plugin.manifest.id,
    memory = plugin.manifest.capability === 'memory'
  const [endpoint, setEndpoint] = useState(plugin.settings.endpoint)
  const [model, setModel] = useState(plugin.settings.model)
  const [voice, setVoice] = useState(plugin.settings.voice)
  const [key, setKey] = useState('')
  const [clearKey, setClearKey] = useState(false)
  const [text, setText] = useState('')
  const [candidate, setCandidate] = useState('')
  const [output, setOutput] = useState<PluginOutput | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [memoryReady, setMemoryReady] = useState(!memory)
  useEffect(() => {
    let alive = true
    if (memory)
      void pluginCall<string>('memory', { id, projectId })
        .then((s) => {
          if (alive) {
            setText(s)
            setMemoryReady(true)
          }
        })
        .catch((e) => {
          if (alive) setError(e.message)
        })
    return () => {
      alive = false
    }
  }, [id, projectId, memory])
  const act = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }
  const mediaUrl = output?.base64 ? `data:${output.mime};base64,${output.base64}` : ''
  return (
    <>
      <h2>{localize(plugin.manifest.name)}</h2>
      <p>{localize(plugin.manifest.description)}</p>
      {error && <p role="alert">{message(error)}</p>}
      {notice && <p role="status">{notice}</p>}
      <fieldset disabled={busy || !memoryReady}>
        {memory ? (
          <>
            <p>{t('已保存的记忆会在本项目酒馆自动回复时按相关性选入上下文。摘要候选需手动确认保存。')}</p>
            <label>
              {t('项目记忆')}
              <textarea maxLength={12000} value={text} onChange={(e) => setText(e.target.value)} />
            </label>
            <button
              onClick={() =>
                void act(async () => {
                  await pluginCall('memory', { id, projectId, text, save: true })
                  setNotice(t('记忆已加密保存'))
                })
              }
            >
              {t('保存并启用记忆')}
            </button>
            <button
              onClick={() =>
                void act(async () => setCandidate(await pluginCall<string>('summarize', { id, projectId })))
              }
            >
              {t('从本项目房间生成摘要候选')}
            </button>
            {candidate && (
              <article>
                <label>
                  {t('记忆候选（尚未保存）')}
                  <textarea
                    maxLength={12000}
                    value={candidate}
                    onChange={(e) => setCandidate(e.target.value)}
                  />
                </label>
                <button
                  onClick={() => {
                    setText((text + '\n' + candidate).trim())
                    setCandidate('')
                  }}
                >
                  {t('追加到编辑区')}
                </button>
                <button onClick={() => setCandidate('')}>{t('放弃候选')}</button>
              </article>
            )}
          </>
        ) : (
          <>
            <details open={!plugin.settings.endpoint}>
              <summary>{t('扩展服务设置')}</summary>
              <label>
                {t('服务基础地址')}
                <input
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  placeholder="https://…/v1"
                />
              </label>
              <p>
                {t(
                  'OpenAI 兼容图片和语音填写 /v1 基础地址；标准服务使用基础地址下的 /invoke。支持本机 HTTP。',
                )}
              </p>
              <label>
                {t('模型名称')}
                <input maxLength={200} value={model} onChange={(e) => setModel(e.target.value)} />
              </label>
              {plugin.manifest.capability === 'speech' && (
                <label>
                  {t('音色名称')}
                  <input maxLength={100} value={voice} onChange={(e) => setVoice(e.target.value)} />
                </label>
              )}
              <label>
                {t('API 密钥')}
                <input
                  type="password"
                  maxLength={8000}
                  autoComplete="off"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder={plugin.settings.hasKey ? t('已保存密钥，留空保留') : ''}
                />
              </label>
              <label>
                <input type="checkbox" checked={clearKey} onChange={(e) => setClearKey(e.target.checked)} />
                {t('清除已保存密钥')}
              </label>
              <button
                onClick={() =>
                  void act(async () => {
                    await pluginCall('configure', { id, endpoint, model, voice, key, clearKey })
                    setKey('')
                    setClearKey(false)
                    await refreshPlugins()
                    setNotice(t('扩展配置已加密保存'))
                  })
                }
              >
                {t('保存扩展设置')}
              </button>
            </details>
            <label>
              {t('发送给扩展的文本')}
              <textarea maxLength={12000} value={text} onChange={(e) => setText(e.target.value)} />
            </label>
            <button
              onClick={() =>
                void act(async () => {
                  const result = await window.lanRoom?.state()
                  if (!result?.ok) throw new Error(result?.error || t('操作失败'))
                  if (result.state?.projectId !== projectId || result.state.mode !== 'tavern')
                    throw new Error(t('请先打开本项目的酒馆房间'))
                  setText(result.state.messages.filter((m) => m.kind === 'ai').slice(-1)[0]?.text || '')
                })
              }
            >
              {t('载入最近一条 AI 回复')}
            </button>
            <button
              disabled={!text.trim()}
              onClick={() =>
                void act(async () => {
                  setOutput(null)
                  setOutput(await pluginCall<PluginOutput>('invoke', { id, text }))
                })
              }
            >
              {t('确认文本并运行扩展')}
            </button>
          </>
        )}
      </fieldset>
      {busy && <p role="status">{t('正在处理扩展请求…')}</p>}
      {busy && !memory && (
        <button onClick={() => void pluginCall('cancel', { id }).catch((e) => setError(e.message))}>
          {t('停止生成')}
        </button>
      )}
      {output?.type === 'text' && <pre>{output.text}</pre>}
      {output?.type === 'image' && <img src={mediaUrl} alt={t('扩展生成图片')} />}
      {output?.type === 'audio' && <audio controls src={mediaUrl} />}
      {mediaUrl && (
        <a
          href={mediaUrl}
          download={`wdworld-${output?.type}.${output?.mime === 'audio/mpeg' ? 'mp3' : output?.mime?.split('/')[1] || 'bin'}`}
        >
          {t('保存生成文件')}
        </a>
      )}
    </>
  )
}
