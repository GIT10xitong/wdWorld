import { useEffect, useRef, useState } from 'react'
import { parseResult, readProposals } from './model'
import { t } from '@/lib/i18n'
import { useStore } from '@/store'
import { generateId } from '@/lib/utils'
import { registerDraftFlusher } from '@/lib/storage/saveQueue'
import type { Database } from '@/lib/storage/database'
import type { Project } from '@/types'
import {
  applyGeneration,
  newChapter,
  plainText,
  snapshot,
  textToHtml,
  type AITask,
  type Chapter,
  type Generation,
  type NovelDocument,
} from './model'
import { buildPrompt } from './prompts'
import { createDraftSaver } from './autoSave'
import type { AIProgress, AISettings } from './desktop'

export function useNovelSession(database: Database, project: Project) {
  const [doc, setDoc] = useState(() => database.getNovel(project.id, project.description))
  const current = useRef(doc)
  const saver = useRef<ReturnType<typeof createDraftSaver>>()
  const [dirty, setDirty] = useState(false)
  const [progress, setProgress] = useState<AIProgress | null>(null)
  const [activeSettings, setActiveSettings] = useState<AISettings | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [stream, setStream] = useState('')
  const [selectedGenerationId, setSelectedGenerationId] = useState<string | null>(null)
  const requestId = useRef<string | null>(null)
  const alive = useRef(true)
  const flush = async () => {
    if (saver.current) await saver.current.flush()
    else await useStore.getState().saveProject()
  }
  const refreshSettings = async () => {
    try {
      const config = await window.novelAI?.getSettings()
      if (alive.current) setActiveSettings(config || null)
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : '读取 AI 配置失败')
    }
  }
  const change = (update: (doc: NovelDocument) => NovelDocument) => {
    try {
      const next = update(current.current)
      database.saveNovel(project.id, next)
      current.current = next
      setDoc(next)
      saver.current?.markDirty()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败')
      throw e
    }
  }
  useEffect(() => {
    alive.current = true
    saver.current = createDraftSaver(
      async () => {
        await useStore.getState().saveProject()
        return useStore.getState().saveStatus !== 'error'
      },
      (value) => {
        if (alive.current) setDirty(value)
      },
    )
    void refreshSettings()
    const unregister = registerDraftFlusher(flush)
    const beforeUnload = () => {
      void flush()
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => {
      alive.current = false
      saver.current?.dispose()
      unregister()
      window.removeEventListener('beforeunload', beforeUnload)
      if (requestId.current) void window.novelAI?.cancel(requestId.current)
    }
  }, [])
  useEffect(() => {
    if (!busy) return
    const started = Date.now()
    setElapsed(0)
    const tick = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => clearInterval(tick)
  }, [busy])
  const updateChapter = (id: string, updates: Partial<Chapter>) =>
    change((d) => ({ ...d, chapters: d.chapters.map((c) => (c.id === id ? { ...c, ...updates } : c)) }))
  const addChapter = () => {
    const chapter = newChapter(t('第 {0} 章', { 0: current.current.chapters.length + 1 }))
    change((d) => ({ ...d, chapters: [...d.chapters, chapter], selectedChapterId: chapter.id }))
  }
  const run = async (task: AITask, instruction: string) => {
    if (requestId.current) return
    setError('')
    const api = window.novelAI
    if (!api) {
      setError('AI 功能需要桌面版。你仍然可以手动完成所有创作步骤。')
      return
    }
    let partial = ''
    let dispose = () => {}
    let disposeProgress = () => {}
    const id = generateId('generation')
    const initial = current.current
    const chapter = initial.chapters.find((c) => c.id === initial.selectedChapterId)
    const generation: Generation = {
      id,
      task,
      instruction,
      chapterId: chapter?.id ?? null,
      text: '',
      createdAt: new Date().toISOString(),
      status: 'ready',
      baseContent: task === 'idea' ? initial.idea : task === 'outline' ? initial.outline : chapter?.content,
      baseSummary: chapter?.summary,
      entryContents: Object.fromEntries(useStore.getState().entries.map((e) => [e.id, e.content])),
    }
    try {
      if (['write', 'rewrite', 'summary', 'review'].includes(task) && !chapter)
        throw new Error('请先创建并选择一个章节')
      if (['summary', 'review'].includes(task) && !plainText(chapter?.content || ''))
        throw new Error('请先写入章节正文')
      const prompt = buildPrompt(task, initial, useStore.getState().entries, instruction)
      requestId.current = id
      setBusy(true)
      setStream('')
      setProgress(null)
      setSelectedGenerationId(null)
      dispose = api.onDelta((data) => {
        if (data.id === id && alive.current) {
          partial += data.delta
          setStream(partial)
        }
      })
      disposeProgress = api.onProgress((data) => {
        if (data.id === id && alive.current) setProgress(data)
      })
      const result = await api.generate({ id, messages: prompt.messages })
      if (!alive.current) return
      if (!result.ok) throw new Error(result.error || '生成失败')
      generation.text = result.text || partial
      generation.contextDigest = result.contextDigest
      if (task === 'world' || task === 'review') {
        const settings = readProposals(parseResult(generation.text).proposals)
        generation.worldEntryIds = await database.publishGeneratedSettings(project.id, settings, (ids) => {
          generation.worldEntryIds = ids
          database.saveNovel(project.id, {
            ...current.current,
            generations: [generation, ...current.current.generations].slice(0, 30),
          })
        })
        await useStore.getState().fetchEntries()
      }
      change((d) => ({ ...d, generations: [generation, ...d.generations].slice(0, 30) }))
      setSelectedGenerationId(id)
      await flush()
    } catch (e) {
      if (alive.current) {
        setError(e instanceof Error ? e.message : '生成失败')
        if (partial) {
          change((d) => ({
            ...d,
            generations: [
              { ...generation, text: partial, status: 'interrupted' as const },
              ...d.generations,
            ].slice(0, 30),
          }))
          setSelectedGenerationId(id)
        }
      }
    } finally {
      dispose()
      disposeProgress()
      requestId.current = null
      if (alive.current) setBusy(false)
    }
  }
  const acceptGeneration = (generation: Generation) => {
    try {
      change((d) => applyGeneration(d, generation, useStore.getState().entries))
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '无法采纳结果')
    }
  }
  const confirmSetting = async (proposalId: string, revert = false) => {
    try {
      const next = await (revert
        ? database.revertNovelProposal(project.id, current.current, proposalId)
        : database.confirmNovelProposal(project.id, current.current, proposalId))
      current.current = next
      setDoc(next)
      await useStore.getState().fetchEntries()
      await flush()
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '确认失败')
    }
  }
  const manualSetting = async (type: 'character' | 'lore', title: string, content: string) => {
    if (!title.trim() || !content.trim()) {
      setError('请填写设定名称和内容')
      return false
    }
    try {
      await database.createEntry(project.id, type, title.trim(), '', textToHtml(content))
      await useStore.getState().fetchEntries()
      await flush()
      setError('')
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败')
      return false
    }
  }
  return {
    doc,
    change,
    error,
    setError,
    busy,
    stream,
    run,
    flush,
    addChapter,
    updateChapter,
    acceptGeneration,
    confirmSetting,
    manualSetting,
    dirty,
    progress,
    elapsed,
    activeSettings,
    refreshSettings,
    selectedGenerationId,
    setSelectedGenerationId,
    cancel: () => {
      if (requestId.current) void window.novelAI?.cancel(requestId.current)
    },
    checkpoint: (label = '手动保存版本') => change((d) => snapshot(d, label)),
  }
}
