import { FilePicker } from '@/components/FilePicker'
import { useState } from 'react'
import { t, message } from '@/lib/i18n'
import {
  getPluginError,
  localize,
  pluginCall,
  refreshPlugins,
  usePlugins,
  type CatalogItem,
  type PluginReview,
  inPluginScope,
  type PluginScope,
} from './store'
import { st } from '@/features/studio/homeModel'
import './plugins.css'
export const permissionLabel = (p: string) =>
  ({
    'room.read': t('读取本项目公开对话'),
    'memory.write': t('保存本项目记忆'),
    'network.request': t('向你配置的服务发送文本'),
    'media.create': t('生成图片或音频'),
  })[p] || p
export function PluginCenter({ onClose, scope = 'modes' }: { onClose: () => void; scope?: PluginScope }) {
  const installed = usePlugins().filter((p) => inPluginScope(p.manifest, scope))
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [review, setReview] = useState<PluginReview | null>(null)
  const [url, setUrl] = useState('')
  const [approved, setApproved] = useState(false)
  const [error, setError] = useState(getPluginError())
  const [busy, setBusy] = useState(false)
  const act = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }
  const prepare = (input: Record<string, unknown>) =>
    act(async () => {
      setReview(null)
      const result = await pluginCall<PluginReview>('prepare', input)
      if (!inPluginScope(result.manifest, scope))
        throw new Error(
          st(
            '此插件不属于当前分类，请在对应模式扩展或模式插件中心安装。',
            'This package belongs to another category. Open its mode extensions or the mode plugin center.',
          ),
        )
      setReview(result)
      setApproved(false)
    })
  return (
    <div className="plugins-overlay">
      <section className="plugins-panel" role="dialog" aria-modal="true" aria-labelledby="plugins-title">
        <header>
          <div>
            <h1 id="plugins-title">
              {scope === 'modes' ? t('插件中心') : st('模式插件扩展', 'Mode extensions')}
            </h1>
            <p>
              {scope === 'modes'
                ? st(
                    '这里只下载酒馆和 TRPG 完整模式包。小插件请进入对应模式的插件扩展。',
                    'Download full Tavern and TRPG modes here. Add-ons are available inside each mode’s extensions.',
                  )
                : st(
                    '仅显示适用于当前模式的小插件；外部包也会检查适用模式。',
                    'Only add-ons for this mode are shown. Imported packages are checked too.',
                  )}
            </p>
          </div>
          <button disabled={busy} onClick={onClose}>
            {t('关闭')}
          </button>
        </header>
        {error && <p role="alert">{message(error)}</p>}
        {!window.wdPlugins && <p>{t('插件管理需要桌面版')}</p>}
        <fieldset disabled={busy || !window.wdPlugins}>
          <h2>{t('已安装插件')}</h2>
          {!installed.length && <p>{t('尚未安装插件')}</p>}
          <div className="plugins-grid">
            {installed.map((p) => (
              <article key={p.manifest.id} data-plugin={p.manifest.id}>
                <h3>
                  {localize(p.manifest.name)} <small>{p.manifest.version}</small>
                </h3>
                <p>{localize(p.manifest.description)}</p>
                <p>{p.enabled ? t('已启用') : t('已停用')}</p>
                <button
                  onClick={() =>
                    void act(async () => {
                      await pluginCall('change', {
                        id: p.manifest.id,
                        action: p.enabled ? 'disable' : 'enable',
                      })
                      await refreshPlugins()
                    })
                  }
                >
                  {p.enabled ? t('停用') : t('启用')}
                </button>
                <button
                  onClick={() =>
                    void act(async () => {
                      await pluginCall('change', { id: p.manifest.id, action: 'uninstall' })
                      await refreshPlugins()
                    })
                  }
                >
                  {t('卸载插件')}
                </button>
                <details>
                  <summary>{t('插件来源与权限')}</summary>
                  <p>{p.source}</p>
                  <code>{p.sha256}</code>
                  <ul>
                    {p.manifest.permissions.map((perm) => (
                      <li key={perm}>{permissionLabel(perm)}</li>
                    ))}
                  </ul>
                </details>
              </article>
            ))}
          </div>
          <p>{t('停用或卸载不会删除项目内容和记忆。修改插件前请先结束正在运行的房间。')}</p>
          <h2>{t('下载插件')}</h2>
          <button
            onClick={() => void act(async () => setCatalog(await pluginCall<CatalogItem[]>('catalog')))}
          >
            {t('获取官方插件目录')}
          </button>
          <div className="plugins-grid">
            {catalog
              .filter((p) => inPluginScope(p, scope))
              .map((p) => (
                <article key={p.id}>
                  <h3>
                    {localize(p.name)} · {p.version}
                  </h3>
                  <p>{localize(p.description)}</p>
                  <button onClick={() => void prepare({ catalogId: p.id })}>{t('下载并预览')}</button>
                </article>
              ))}
          </div>
          <h2>{t('导入外部插件')}</h2>
          <p>
            {t('支持 WDWorld v1 JSON 插件包和 HTTP 服务适配。SillyTavern 原生脚本需先适配，不会直接执行。')}
          </p>
          <label>
            {t('插件包 HTTPS 地址')}
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/plugin.json" />
          </label>
          <button disabled={!url.trim()} onClick={() => void prepare({ url })}>
            {t('预览地址中的插件')}
          </button>
          <FilePicker
            label={t('选择插件 JSON')}
            accept=".json,application/json"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file)
                void act(async () => {
                  if (file.size > 2 * 1024 * 1024) throw new Error(t('插件包不能超过 2 MB'))
                  await prepare({ json: await file.text() })
                })
            }}
          />
          {review && (
            <article className="plugin-review">
              <h2>
                {t('安装预览')} · {localize(review.manifest.name)}
              </h2>
              <p>{localize(review.manifest.description)}</p>
              <p>
                {review.manifest.id} · {review.manifest.version} · {review.manifest.author} ·{' '}
                {review.manifest.license}
              </p>
              <p>
                {t('来源')}：{review.source}
              </p>
              <p>
                {review.catalogVerified ? t('已通过官方目录完整性校验') : t('外部插件，请核对作者与来源')}
              </p>
              <code>SHA-256: {review.sha256}</code>
              <p>
                {t('依赖插件')}：{review.manifest.dependencies.join(', ') || '—'}
              </p>
              <ul>
                {review.manifest.permissions.map((p) => (
                  <li key={p}>{permissionLabel(p)}</li>
                ))}
              </ul>
              <label>
                <input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} />
                {t('我已核对来源并同意上述权限')}
              </label>
              <button
                disabled={!approved}
                onClick={() =>
                  void act(async () => {
                    await pluginCall('install', {
                      token: review.token,
                      permissions: review.manifest.permissions,
                    })
                    await refreshPlugins()
                    setReview(null)
                  })
                }
              >
                {t('确认安装并启用')}
              </button>
              <button onClick={() => setReview(null)}>{t('取消')}</button>
            </article>
          )}
        </fieldset>
      </section>
    </div>
  )
}
