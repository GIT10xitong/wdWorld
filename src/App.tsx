import { t, message } from '@/lib/i18n'
import { useStore } from '@/store'
import { WelcomePage } from '@/components/WelcomePage'
import { Workspace } from '@/components/Workspace'
import { useEffect, useRef, useState } from 'react'
import { NovelStudio } from '@/features/novel/NovelStudio'
import { Bookshelf } from '@/features/novel/Bookshelf'
import { UpdateCenter } from '@/features/updates/UpdateCenter'
import { flushDrafts } from '@/lib/storage/saveQueue'
import { MODES, type AppMode } from '@/features/studio/model'
import { StudioWorkspace } from '@/features/studio/StudioWorkspace'
import '@/features/studio/studio.css'
import { PROFILES, creationMode } from '@/features/studio/profiles'
import type { CreationMode } from '@/types'
import { LanWorkspace } from '@/features/lan/LanWorkspace'
import { LanguagePicker, useLanguage } from '@/lib/i18n'
import { modeAvailable, usePlugins } from '@/features/plugins/store'
import { PluginCenter } from '@/features/plugins/PluginCenter'
import { TavernExtensions } from '@/features/plugins/TavernExtensions'
import { ThemeToggle } from '@/lib/theme'
import { st } from '@/features/studio/homeModel'
import type { PluginScope } from '@/features/plugins/store'

function App() {
  const { currentProject, database } = useStore()
  useLanguage()
  const [selectedMode, setSelectedMode] = useState<CreationMode | null>(null)
  const [view, setView] = useState<AppMode | 'lan' | 'extensions'>('world')
  const installedPlugins = usePlugins()
  const [pluginsOpen, setPluginsOpen] = useState(false)
  const [pluginScope, setPluginScope] = useState<PluginScope>('modes')
  const [extensionMode, setExtensionMode] = useState<CreationMode>('tavern')
  const [switching, setSwitching] = useState(false)
  const [busy, setBusy] = useState(false)
  const [modeError, setModeError] = useState('')
  useEffect(() => {
    if (selectedMode && !modeAvailable(selectedMode)) setSelectedMode(null)
  }, [installedPlugins, selectedMode])
  const openPlugins = async (scope: PluginScope = 'modes') => {
    if (busy || switching) {
      setModeError(t('请先停止生成或等待当前操作完成'))
      return
    }
    try {
      await flushDrafts()
      if (currentProject) {
        await useStore.getState().saveProject()
        if (useStore.getState().saveStatus === 'error') throw new Error(t('保存失败，请重试'))
      }
      setPluginScope(scope)
      setPluginsOpen(true)
    } catch (e) {
      setModeError(String(e))
    }
  }
  const openPluginsRef = useRef(openPlugins)
  openPluginsRef.current = openPlugins
  useEffect(() => window.appPreferences?.onPlugins?.(() => void openPluginsRef.current()), [])
  const pluginDialog = pluginsOpen && (
    <PluginCenter key={pluginScope} scope={pluginScope} onClose={() => setPluginsOpen(false)} />
  )
  useEffect(() => {
    document.documentElement.dataset.creationMode = currentProject?.mode || selectedMode || 'free'
  }, [currentProject?.mode, selectedMode])
  useEffect(() => {
    const mode = creationMode(currentProject?.mode)
    setView(mode === 'free' ? 'world' : mode)
    if (currentProject) setSelectedMode(creationMode(currentProject.mode))
    let alive = true
    void window.lanRoom?.state().then(async (result) => {
      if (alive && result.state && result.state.projectId !== currentProject?.id) {
        const stopped = await window.lanRoom!.stop()
        if (!stopped.ok) setModeError(stopped.error || t('保存失败'))
      }
    })
    return () => {
      alive = false
    }
  }, [currentProject?.id])
  useEffect(
    () =>
      window.desktopLifecycle?.onBeforeClose(async () => {
        await flushDrafts()
        await useStore.getState().saveProject()
        const room = await window.lanRoom?.archive()
        if (room && !room.ok) return false
        return useStore.getState().saveStatus !== 'error'
      }),
    [],
  )

  const returnToModes = async (keepMode: CreationMode | null = null) => {
    if (busy || switching) {
      setModeError(t('请先停止生成或等待当前操作完成'))
      return
    }
    setSwitching(true)
    try {
      await flushDrafts()
      await useStore.getState().saveProject()
      if (useStore.getState().saveStatus === 'error') throw new Error(t('保存失败，请重试'))
      const result = await window.lanRoom?.stop()
      if (result && !result.ok) throw new Error(result.error)
      useStore.getState().closeProject()
      setSelectedMode(keepMode)
    } catch (e) {
      setModeError(String(e))
    } finally {
      setSwitching(false)
    }
  }
  const returnToModesRef = useRef(returnToModes)
  returnToModesRef.current = returnToModes
  useEffect(() => window.appPreferences?.onSwitchMode(() => void returnToModesRef.current()), [])
  if (!currentProject || !database)
    return (
      <>
        <UpdateCenter blocked={busy || switching} />
        {pluginDialog}
        <div className="start-toolbar">
          <button
            className="app-brand"
            aria-label={st('WD WORLD · 返回主页', 'WD WORLD · Home')}
            onClick={() => void returnToModes(selectedMode)}
          >
            WD WORLD
          </button>
          <button onClick={() => void openPlugins()}>{t('插件中心')}</button>
          {selectedMode && (
            <button onClick={() => void openPlugins(selectedMode)}>
              {st('插件扩展', 'Plugin extensions')}
            </button>
          )}
          {!window.appPreferences && (
            <details>
              <summary>{t('文件')}</summary>
              <button onClick={() => void returnToModes()}>{t('切换创作模式')}</button>
            </details>
          )}
          <LanguagePicker />
          <ThemeToggle />
        </div>
        {modeError && <p role="alert">{message(modeError)}</p>}
        {selectedMode ? (
          selectedMode === 'novel' ? (
            <Bookshelf />
          ) : (
            <WelcomePage mode={selectedMode} />
          )
        ) : (
          <main className="mode-picker">
            <span className="eyebrow">WD WORLD</span>
            <h1>{t('选择你的创作方式')}</h1>
            <p>{t('默认提供自由、OC、小说模式。TRPG 和酒馆可从插件中心下载安装。')}</p>
            <div>
              {(Object.entries(PROFILES) as [CreationMode, typeof PROFILES.free][])
                .filter(([id]) => modeAvailable(id))
                .map(([id, profile]) => (
                  <button data-mode={id} key={id} onClick={() => setSelectedMode(id)}>
                    <h2>{profile.label}</h2>
                    <p>{profile.description}</p>
                    <span>{t('进入 →')}</span>
                  </button>
                ))}
            </div>
          </main>
        )}
      </>
    )
  const projectMode = creationMode(currentProject.mode)
  const switchMode = async (next: AppMode | 'lan' | 'extensions') => {
    if (switching || busy || view === next) return
    setSwitching(true)
    setModeError('')
    try {
      await flushDrafts()
      await useStore.getState().saveProject()
      if (useStore.getState().saveStatus === 'error') throw new Error(t('保存失败，请重试后再切换模式'))
      setView(next)
    } catch (e) {
      setModeError(e instanceof Error ? e.message : t('切换失败'))
    } finally {
      setSwitching(false)
    }
  }
  return (
    <div className="app-modes">
      <UpdateCenter blocked={busy || switching} />
      {pluginDialog}
      <nav className="mode-bar" aria-label={t('创作模式')}>
        <button
          className="app-brand"
          aria-label={st('WD WORLD · 返回主页', 'WD WORLD · Home')}
          disabled={busy || switching}
          onClick={() => void returnToModes(projectMode)}
        >
          WD WORLD
        </button>
        {!window.appPreferences && (
          <details>
            <summary>{t('文件')}</summary>
            <button disabled={busy || switching} onClick={() => void returnToModes()}>
              {t('切换创作模式')}
            </button>
          </details>
        )}
        {MODES.filter(
          (mode) =>
            modeAvailable(mode.id) &&
            (projectMode === 'free' || mode.id === 'world' || mode.id === projectMode),
        ).map((mode) => (
          <button
            key={mode.id}
            aria-current={
              view === mode.id || (view === 'simulation' && mode.id === 'world') ? 'page' : undefined
            }
            disabled={switching || busy}
            title={busy ? t('请先停止生成或等待当前操作完成') : mode.hint}
            onClick={() => void switchMode(mode.id)}
          >
            {mode.label}
          </button>
        ))}
        {['free', 'trpg', 'tavern'].includes(projectMode) &&
          (modeAvailable('trpg') || modeAvailable('tavern')) && (
            <button
              disabled={busy || switching}
              aria-current={view === 'lan' ? 'page' : undefined}
              onClick={() => void switchMode('lan')}
            >
              {t('局域网房间')}
            </button>
          )}
        {
          <button
            disabled={busy || switching}
            aria-current={view === 'extensions' ? 'page' : undefined}
            onClick={() => {
              setExtensionMode(projectMode === 'free' && view === 'tavern' ? 'tavern' : projectMode)
              void switchMode('extensions')
            }}
          >
            {projectMode === 'tavern' || (projectMode === 'free' && view === 'tavern')
              ? t('酒馆扩展')
              : st('插件扩展', 'Plugin extensions')}
          </button>
        }
        <button disabled={busy || switching} onClick={() => void openPlugins()}>
          {t('插件中心')}
        </button>
        <button
          className="mode-simulate"
          aria-pressed={view === 'simulation'}
          disabled={switching || busy}
          onClick={() => void switchMode('simulation')}
        >
          {t('推演世界变更')}
        </button>
        <LanguagePicker />
        <ThemeToggle />
      </nav>
      {modeError && (
        <p className="mode-error" role="alert">
          {message(modeError)}
        </p>
      )}
      <div className="mode-content">
        {!modeAvailable(view) ||
        (view === 'extensions' && !modeAvailable(extensionMode)) ||
        (view === 'lan' && !modeAvailable('trpg') && !modeAvailable('tavern')) ? (
          <section className="studio-card">
            <h2>{t('此功能需要安装模式插件')}</h2>
            <p>{t('项目内容已保留。安装并启用对应插件后即可继续编辑；世界观资料仍可访问。')}</p>
            <button onClick={() => void openPlugins()}>{t('打开插件中心')}</button>
            <button onClick={() => void switchMode('world')}>{t('世界观设定')}</button>
          </section>
        ) : view === 'extensions' ? (
          <TavernExtensions
            mode={extensionMode}
            projectId={currentProject.id}
            onManage={() => void openPlugins(extensionMode)}
            onBusyChange={setBusy}
          />
        ) : view === 'lan' ? (
          <LanWorkspace database={database} project={currentProject} onBusyChange={setBusy} />
        ) : view === 'novel' ? (
          <NovelStudio
            key={currentProject.id}
            database={database}
            project={currentProject}
            onWorld={() => void switchMode('world')}
            onBusyChange={setBusy}
          />
        ) : view === 'world' ? (
          <Workspace profile={projectMode} onExit={() => void returnToModes()} />
        ) : (
          <StudioWorkspace
            key={currentProject.id + view}
            mode={view}
            database={database}
            project={currentProject}
            onBusyChange={setBusy}
            onNavigate={(next) => {
              if (next === 'extensions') setExtensionMode(view === 'tavern' ? 'tavern' : projectMode)
              void switchMode(next)
            }}
            onLibrary={() => void returnToModes(projectMode)}
          />
        )}
      </div>
    </div>
  )
}

export default App
