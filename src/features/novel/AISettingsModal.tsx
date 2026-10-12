import { t, message as translateMessage } from '@/lib/i18n'
import { useEffect, useRef, useState } from 'react'
import { X, KeyRound, RefreshCw, CheckCircle2, Loader2 } from 'lucide-react'
import providers from '../../../electron/ai-providers.json'
import type { AISettings, AIProvider, AIProtocol, AIModel } from './desktop'

export function AISettingsModal({ onClose }: { onClose: () => void }) {
  const [provider, setProvider] = useState<AIProvider>('deepseek')
  const [protocol, setProtocol] = useState<AIProtocol>('chat')
  const [endpoint, setEndpoint] = useState(providers[0].endpoint)
  const [model, setModel] = useState('')
  const [key, setKey] = useState('')
  const [hasKey, setHasKey] = useState(false)
  const [savedEndpoint, setSavedEndpoint] = useState('')
  const [clearKey, setClearKey] = useState(false)
  const [models, setModels] = useState<AIModel[]>([])
  const [fetched, setFetched] = useState(false)
  const [manual, setManual] = useState(false)
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState<'loading' | 'models' | 'test' | 'save' | null>(null)
  const lock = useRef(false)
  const alive = useRef(true)
  const retainedKey = hasKey && endpoint.trim().replace(/\/$/, '') === savedEndpoint.replace(/\/$/, '')
  const selectedProvider = providers.find((p) => p.id === provider)!
  const invalidateList = () => {
    setModels([])
    setFetched(false)
    setSearch('')
    setMessage('')
  }
  const applySettings = (s: AISettings) => {
    setProvider(s.provider)
    setProtocol(s.protocol)
    setEndpoint(s.endpoint)
    setModel(s.model)
    setHasKey(s.hasKey)
    setSavedEndpoint(s.endpoint)
    setKey('')
    setClearKey(false)
  }
  const load = async (id?: AIProvider) => {
    if (!window.novelAI || lock.current) return
    lock.current = true
    setBusy('loading')
    try {
      const s = await window.novelAI.getSettings(id)
      if (!alive.current) return
      applySettings(s)
      invalidateList()
      setManual(false)
    } catch (e) {
      if (alive.current) {
        setFailed(true)
        setMessage(e instanceof Error ? e.message : t('读取配置失败'))
      }
    } finally {
      lock.current = false
      if (alive.current) setBusy(null)
    }
  }
  useEffect(() => {
    alive.current = true
    void load()
    return () => {
      alive.current = false
      void window.novelAI?.cancel('models')
      void window.novelAI?.cancel('test')
    }
  }, [])
  const execute = async (action: 'models' | 'test' | 'save') => {
    const api = window.novelAI
    if (!api || lock.current) return
    lock.current = true
    setBusy(action)
    setMessage('')
    setFailed(false)
    const input = { provider, protocol, endpoint, model, key, clearKey }
    try {
      if (action === 'models') {
        const result = await api.listModels(input)
        if (!alive.current) return
        if (!result.ok) throw new Error(result.error || t('获取模型失败'))
        const choices = result.models || []
        setModels(choices)
        setFetched(true)
        setSearch('')
        if (!model && choices.length) setModel(choices[0].id)
        if (choices.length) setManual(false)
        setMessage(
          choices.length
            ? t('已获取 {0} 个模型，请选择支持文字生成的型号。', { 0: choices.length })
            : t('服务没有返回可用模型，可手动填写模型名称。'),
        )
      } else if (action === 'test') {
        const result = await api.testModel(input)
        if (!alive.current) return
        if (!result.ok) throw new Error(result.error || t('测试模型失败'))
        if (result.settings) applySettings(result.settings)
        setMessage(t('模型连接成功，配置已加密保存并用于创作。'))
      } else {
        const config = await api.saveSettings(input)
        if (!alive.current) return
        applySettings(config)
        setMessage(t('配置已保存。可以关闭设置并开始生成。'))
      }
    } catch (e) {
      if (alive.current) {
        setFailed(true)
        setMessage(e instanceof Error ? e.message : t('请求失败'))
      }
    } finally {
      lock.current = false
      if (alive.current) setBusy(null)
    }
  }
  const visibleModels = models.filter((m) => `${m.id} ${m.name}`.toLowerCase().includes(search.toLowerCase()))
  const missingCurrent = model && !visibleModels.some((m) => m.id === model)
  return (
    <div className="novel-modal-backdrop" onClick={busy === 'save' ? undefined : onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={t('AI 设置')}
        className="novel-modal novel-ai-settings"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="novel-row">
          <h2>
            <KeyRound size={20} />
            {t(' AI 设置')}
          </h2>
          <button aria-label={t('关闭设置')} disabled={busy === 'save'} onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <p className="novel-muted">
          {t('选择服务商，填写密钥，再点击获取模型。生成时会发送创作区预览中的资料。')}
        </p>
        {!window.novelAI && (
          <div className="novel-notice">{t('请使用桌面版配置 AI；浏览器中可使用全部手动创作功能。')}</div>
        )}
        <fieldset disabled={!!busy || !window.novelAI} className="novel-ai-fields">
          <label>
            {t('模型服务商')}
            <select
              aria-label={t('模型服务商')}
              value={provider}
              onChange={(e) => void load(e.target.value as AIProvider)}
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {t(p.name)}
                </option>
              ))}
            </select>
          </label>
          <p className="novel-muted">{t(selectedProvider.hint)}</p>
          <label>
            {t('接口地址')}
            <input
              value={endpoint}
              onChange={(e) => {
                setEndpoint(e.target.value)
                setKey('')
                invalidateList()
              }}
              placeholder={selectedProvider.endpoint}
            />
          </label>
          <label>
            {t('API 密钥')}
            <input
              type="password"
              autoComplete="off"
              value={key}
              onChange={(e) => {
                setKey(e.target.value)
                setClearKey(false)
                invalidateList()
              }}
              placeholder={
                retainedKey
                  ? t('已加密保存；留空则保留原密钥')
                  : t('填写当前服务的密钥；本机无认证服务可留空')
              }
            />
          </label>
          {retainedKey && (
            <label className="novel-check">
              <input
                type="checkbox"
                checked={clearKey}
                onChange={(e) => {
                  setClearKey(e.target.checked)
                  setKey('')
                  invalidateList()
                }}
              />
              {t('清除已保存的密钥')}
            </label>
          )}
          <div className="novel-row novel-model-toolbar">
            <strong>{t('可用模型')}</strong>
            <button className="novel-secondary" onClick={() => void execute('models')}>
              <RefreshCw size={15} />
              {fetched ? t('刷新模型') : t('获取模型')}
            </button>
          </div>
          {!manual && (
            <>
              {models.length > 8 && (
                <input
                  aria-label={t('搜索模型')}
                  placeholder={t('搜索模型名称…')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              )}
              <label>
                {t('选择模型')}
                <select
                  aria-label={t('选择模型')}
                  value={model}
                  disabled={!model && !models.length}
                  onChange={(e) => {
                    setModel(e.target.value)
                    setMessage('')
                  }}
                >
                  <option value="" disabled>
                    {fetched ? t('列表为空，可手动填写') : t('点击“获取模型”加载列表')}
                  </option>
                  {missingCurrent && (
                    <option value={model}>
                      {model}
                      {fetched && !models.some((m) => m.id === model)
                        ? t('（未在列表中返回）')
                        : t('（当前配置）')}
                    </option>
                  )}
                  {visibleModels.map((m) => (
                    <option value={m.id} key={m.id}>
                      {m.name === m.id ? m.id : `${m.name} · ${m.id}`}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <label className="novel-check">
            <input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} />
            {t('手动填写模型名称')}
          </label>
          {manual && (
            <label>
              {t('模型名称')}
              <input
                value={model}
                onChange={(e) => {
                  setModel(e.target.value)
                  setMessage('')
                }}
                placeholder={t('填写服务商提供的准确模型名称')}
              />
            </label>
          )}
          <details className="novel-ai-advanced" open={provider === 'custom' ? true : undefined}>
            <summary>{t('高级设置 · 接口协议')}</summary>
            <label>
              {t('接口协议')}
              <select
                aria-label={t('接口协议')}
                value={protocol}
                onChange={(e) => {
                  setProtocol(e.target.value as AIProtocol)
                  invalidateList()
                }}
              >
                <option value="chat">{t('Chat Completions（兼容接口）')}</option>
                <option value="responses">Responses（OpenAI / Codex）</option>
                <option value="gemini">{t('Gemini 原生接口')}</option>
              </select>
            </label>
          </details>
          <p className="novel-muted">
            {t('地址、模型和密钥在本机整体加密保存。保存或测试成功后生效；更换地址需重新填写密钥。')}
          </p>
          <div className="novel-actions">
            <button className="novel-primary" disabled={!model.trim()} onClick={() => void execute('save')}>
              {t('保存配置')}
            </button>
            <button disabled={!model.trim()} onClick={() => void execute('test')}>
              <CheckCircle2 size={15} />
              {t('测试模型')}
            </button>
          </div>
          <p className="novel-muted">{t('测试仅发送一句问候，可能产生少量模型用量。')}</p>
        </fieldset>
        {busy && (
          <p role="status" className="novel-ai-progress">
            <Loader2 size={15} className="animate-spin" />
            {
              {
                get loading() {
                  return t('正在读取配置…')
                },
                get models() {
                  return t('正在获取模型列表…')
                },
                get test() {
                  return t('正在测试模型…')
                },
                get save() {
                  return t('正在保存配置…')
                },
              }[busy]
            }
          </p>
        )}
        {message && (
          <p role={failed ? 'alert' : 'status'} className={`novel-notice ${failed ? 'novel-error' : ''}`}>
            {translateMessage(message)}
          </p>
        )}
      </section>
    </div>
  )
}
