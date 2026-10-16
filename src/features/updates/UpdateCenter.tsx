import { useEffect, useState } from 'react'
import { flushDrafts } from '@/lib/storage/saveQueue'
import { useStore } from '@/store'
import { nt } from '@/features/novel/workbench'
import '@/features/novel/desk.css'
interface UpdateState {
  phase: string
  current: string
  version: string
  percent: number
  supported: boolean
  automatic: boolean
  error: string
}
declare global {
  interface Window {
    appUpdates?: {
      state(): Promise<{ ok: boolean; state: UpdateState }>
      check(): Promise<{ ok: boolean; state: UpdateState }>
      download(): Promise<{ ok: boolean; state: UpdateState; error?: string }>
      install(): Promise<{ ok: boolean; state: UpdateState; error?: string }>
      automatic(value: boolean): Promise<{ ok: boolean; state: UpdateState }>
      releases(): Promise<void>
      onState(fn: (state: UpdateState) => void): () => void
      onOpen(fn: () => void): () => void
    }
  }
}
export function UpdateCenter({ blocked }: { blocked: boolean }) {
  const [open, setOpen] = useState(false),
    [state, setState] = useState<UpdateState | null>(null),
    [error, setError] = useState(''),
    [installing, setInstalling] = useState(false)
  useEffect(() => {
    const api = window.appUpdates
    if (!api) return
    void api.state().then((r) => {
      if (r.ok) setState(r.state)
    })
    const a = api.onState(setState),
      b = api.onOpen(() => setOpen(true))
    return () => {
      a()
      b()
    }
  }, [])
  const run = async (action: 'check' | 'download' | 'install') => {
    const api = window.appUpdates
    if (!api) return
    setError('')
    try {
      if (action === 'install') {
        if (blocked)
          throw new Error(nt('请先停止生成并保存当前工作', 'Stop generation and save your work first'))
        setInstalling(true)
        await flushDrafts()
        await useStore.getState().saveProject()
        if (useStore.getState().saveStatus === 'error')
          throw new Error(nt('保存失败，已取消安装', 'Save failed; installation cancelled'))
        const room = await window.lanRoom?.state()
        if (room && !room.ok)
          throw new Error(
            nt('无法确认房间状态，已取消安装', 'Cannot confirm room state; installation cancelled'),
          )
        if (room?.state)
          throw new Error(nt('请先结束局域网房间再安装更新', 'End the LAN room before installing the update'))
      }
      const result = await api[action]()
      if (result.ok) setState(result.state)
      else throw new Error(nt('操作失败，请重试', 'Operation failed. Please retry.'))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setInstalling(false)
    }
  }
  if (!window.appUpdates) return null
  const labels: Record<string, string> = {
    idle: nt('尚未检查', 'Not checked'),
    checking: nt('正在检查 GitHub…', 'Checking GitHub…'),
    latest: nt('没有可用的新稳定版', 'No newer stable release'),
    available: nt('发现新版本', 'New version available'),
    downloading: nt('正在下载并校验…', 'Downloading and verifying…'),
    ready: nt('下载完成，等待重启安装', 'Ready to restart and install'),
    installing: nt('正在重启安装', 'Restarting to install'),
    error: nt('检查或下载失败，请重试', 'Check or download failed. Please retry.'),
  }
  return (
    <>
      <button className="app-update-trigger" onClick={() => setOpen(true)}>
        {state && ['available', 'ready'].includes(state.phase)
          ? nt('有更新', 'Update available')
          : nt('应用更新', 'Updates')}
      </button>
      {open && (
        <div className="desk-overlay">
          <section
            className="desk-modal"
            role="dialog"
            aria-modal="true"
            aria-label={nt('应用更新', 'Application updates')}
          >
            <h2>{nt('应用更新', 'Application updates')}</h2>
            <p>WD World {state?.current}</p>
            <p>
              {nt(
                '更新源：GitHub · actrox/wdWorld（稳定版本）',
                'Source: GitHub · actrox/wdWorld (stable releases)',
              )}
            </p>
            <p role="status">
              {state ? labels[state.phase] : nt('正在读取…', 'Loading…')}
              {state?.version ? ' · ' + state.version : ''}
            </p>
            {state?.phase === 'downloading' && <progress max={100} value={state.percent} />}
            {state && !state.supported && (
              <p>
                {nt(
                  '当前为源码或便携版，可检查版本。安装 NSIS 安装版后，可在应用内下载、校验并重启更新。',
                  'Source and portable builds can check versions. Install the NSIS edition to download, verify and restart into updates inside the app.',
                )}
              </p>
            )}
            {(error || state?.error) && (
              <p role="alert">
                {error ||
                  (state?.error === 'save-before-update-failed'
                    ? nt('请保存作品并结束房间后重试', 'Save your work and end the room before retrying')
                    : nt(
                        '无法获取更新。请检查网络，并确认 Release 已上传安装包与 latest.yml。',
                        'Update unavailable. Check your network and ensure the release includes an installer and latest.yml.',
                      ))}
              </p>
            )}
            <label>
              <input
                type="checkbox"
                checked={state?.automatic ?? true}
                onChange={(e) =>
                  void window
                    .appUpdates!.automatic(e.target.checked)
                    .then((r) => setState(r.state))
                    .catch(() => setError(nt('设置保存失败', 'Could not save preference')))
                }
              />
              {nt('启动时自动检查更新', 'Check for updates on startup')}
            </label>
            <div className="update-buttons">
              <button
                disabled={!state || ['checking', 'downloading', 'ready', 'installing'].includes(state.phase)}
                onClick={() => void run('check')}
              >
                {nt('检查更新', 'Check for updates')}
              </button>
              {state?.supported && state.phase === 'available' && (
                <button onClick={() => void run('download')}>{nt('下载更新', 'Download update')}</button>
              )}
              {state?.phase === 'ready' && (
                <button
                  disabled={blocked || installing}
                  className="desk-primary"
                  onClick={() => void run('install')}
                >
                  {nt('保存并重启安装', 'Save, restart and install')}
                </button>
              )}
              <button onClick={() => void window.appUpdates!.releases()}>
                {nt('打开 GitHub 发布页', 'Open GitHub releases')}
              </button>
              <button onClick={() => setOpen(false)} disabled={installing}>
                {nt('关闭', 'Close')}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
