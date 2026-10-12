import { t, message } from '@/lib/i18n'
import { useStore } from '@/store'
import { WelcomePage } from '@/components/WelcomePage'
import { Workspace } from '@/components/Workspace'
import { useEffect, useRef, useState } from 'react'
import { NovelWorkspace } from '@/features/novel/NovelWorkspace'
import { flushDrafts } from '@/lib/storage/saveQueue'
import { MODES, type AppMode } from '@/features/studio/model'
import { StudioWorkspace } from '@/features/studio/StudioWorkspace'
import '@/features/studio/studio.css'
import { PROFILES, creationMode } from '@/features/studio/profiles'
import type { CreationMode } from '@/types'
import { LanWorkspace } from '@/features/lan/LanWorkspace'
import { LanguagePicker, useLanguage } from '@/lib/i18n'

function App() {
  const { currentProject, database } = useStore()
  useLanguage()
  const [selectedMode, setSelectedMode] = useState<CreationMode | null>(null)
  const [view, setView] = useState<AppMode | 'lan'>('world')
  const [switching, setSwitching] = useState(false)
  const [busy, setBusy] = useState(false)
  const [modeError, setModeError] = useState('')
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

  const returnToModes = async () => {
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
      setSelectedMode(null)
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
        <div className="start-toolbar">
          {!window.appPreferences && (
            <details>
              <summary>{t('文件')}</summary>
              <button onClick={() => void returnToModes()}>{t('切换创作模式')}</button>
            </details>
          )}
          <LanguagePicker />
        </div>
        {modeError && <p role="alert">{message(modeError)}</p>}
        {selectedMode ? (
          <WelcomePage mode={selectedMode} />
        ) : (
          <main className="mode-picker">
            <span className="eyebrow">WD WORLD</span>
            <h1>{t('选择你的创作方式')}</h1>
            <p>{t('每种模式有独立的项目与世界观。自由模式开放全部工具。')}</p>
            <div>
              {(Object.entries(PROFILES) as [CreationMode, typeof PROFILES.free][]).map(([id, profile]) => (
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
  const switchMode = async (next: AppMode | 'lan') => {
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
      <nav className="mode-bar" aria-label={t('创作模式')}>
        <strong>WD WORLD</strong>
        {!window.appPreferences && (
          <details>
            <summary>{t('文件')}</summary>
            <button disabled={busy || switching} onClick={() => void returnToModes()}>
              {t('切换创作模式')}
            </button>
          </details>
        )}
        {MODES.filter((mode) => projectMode === 'free' || mode.id === 'world' || mode.id === projectMode).map(
          (mode) => (
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
          ),
        )}
        {['free', 'trpg', 'tavern'].includes(projectMode) && (
          <button
            disabled={busy || switching}
            aria-current={view === 'lan' ? 'page' : undefined}
            onClick={() => void switchMode('lan')}
          >
            {t('局域网房间')}
          </button>
        )}
        <button
          className="mode-simulate"
          aria-pressed={view === 'simulation'}
          disabled={switching || busy}
          onClick={() => void switchMode('simulation')}
        >
          {t('推演世界变更')}
        </button>
        <LanguagePicker />
      </nav>
      {modeError && (
        <p className="mode-error" role="alert">
          {message(modeError)}
        </p>
      )}
      <div className="mode-content">
        {view === 'lan' ? (
          <LanWorkspace database={database} project={currentProject} onBusyChange={setBusy} />
        ) : view === 'novel' ? (
          <NovelWorkspace
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
          />
        )}
      </div>
    </div>
  )
}

export default App
