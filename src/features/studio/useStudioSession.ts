import { useEffect, useRef, useState } from 'react'
import { useStore } from '@/store'
import { generateId } from '@/lib/utils'
import { registerDraftFlusher } from '@/lib/storage/saveQueue'
import type { Database } from '@/lib/storage/database'
import { createDraftSaver } from '@/features/novel/autoSave'
import type { AIProgress } from '@/features/novel/desktop'
import { newSeed } from './seed'
import { draftWorldSettings } from './worldSettings'
import { parseTavernWorld, tavernWorldPrompt } from './tavernWorld'
import {
  parseDraft,
  parseSimulation,
  studioPrompt,
  studioSources,
  type StudioDocument,
  type StudioMode,
} from './model'

export function useStudioSession(database: Database, projectId: string, mode: StudioMode) {
  const [doc, setDoc] = useState(() => database.getStudio(projectId))
  const current = useRef(doc)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [stream, setStream] = useState('')
  const [progress, setProgress] = useState<AIProgress | null>(null)
  const request = useRef<string | null>(null)
  const accepting = useRef(false)
  const alive = useRef(true)
  const saver = useRef<ReturnType<typeof createDraftSaver>>()
  const change = (update: (doc: StudioDocument) => StudioDocument) => {
    const next = update(current.current)
    database.saveStudio(projectId, next)
    current.current = next
    setDoc(next)
    saver.current?.markDirty()
  }
  const flush = async () => {
    await saver.current?.flush()
  }
  useEffect(() => {
    alive.current = true
    saver.current = createDraftSaver(async () => {
      await useStore.getState().saveProject()
      return useStore.getState().saveStatus !== 'error'
    }, setDirty)
    const unregister = registerDraftFlusher(flush)
    return () => {
      alive.current = false
      unregister()
      saver.current?.dispose()
      if (request.current) void window.novelAI?.cancel(request.current)
    }
  }, [])
  const run = async (kind: 'draft' | 'world' | 'trpg-world' = 'draft') => {
    if (request.current || accepting.current) return
    if (kind === 'world' && mode !== 'tavern') return
    if (kind === 'trpg-world' && mode !== 'trpg') return
    setError('')
    const api = window.novelAI
    if (!api) {
      setError('AI 辅助需要桌面版，手动编辑与导出仍可使用。')
      return
    }
    if (kind !== 'draft' && !current.current.seeds?.[mode]?.trim())
      change((d) => ({ ...d, seeds: { ...d.seeds, [mode]: newSeed() } }))
    const initial = current.current
    const seed = initial.seeds?.[mode] || ''
    if (mode === 'simulation' && !initial.drafts.simulation.change.trim() && !seed.trim()) {
      setError('请先填写拟发生的世界变更')
      return
    }
    if (mode !== 'simulation' && !seed.trim() && !Object.values(initial.drafts[mode]).some((v) => v.trim())) {
      setError('请先写一点创作想法或填写名称')
      return
    }
    const entries = useStore.getState().entries
    const sources = studioSources(initial, mode, entries)
    if (mode === 'simulation' && !sources.length) {
      setError('请先在世界观中建立条目，并选择推演参考资料')
      return
    }
    const baseDraft = JSON.stringify(initial.drafts[mode])
    const id = generateId('studio_ai')
    request.current = id
    setBusy(true)
    setStream('')
    setProgress(null)
    let partial = ''
    const off = api.onDelta((data) => {
      if (data.id === id && alive.current) {
        partial += data.delta
        setStream(partial)
      }
    })
    const offProgress = api.onProgress((data) => {
      if (data.id === id && alive.current) setProgress(data)
    })
    try {
      const messages =
        kind === 'world'
          ? tavernWorldPrompt(initial, entries, useStore.getState().relations)
          : studioPrompt(mode, initial, entries, useStore.getState().relations)
      if (kind === 'trpg-world')
        messages[0].content +=
          '\nCreate a complete playable original TRPG world and one-shot adventure from the seed and known context. If empty invent freely. Include geography, factions, world rules, an opening, 3 branching scenes, NPC motives, redundant clues, encounters, GM secrets and multiple endings. Return all required draft fields and 6–12 typed world_settings. Keep sessionLog unchanged. Do not reproduce published adventure text.'
      const result = await api.generate({
        id,
        messages,
      })
      if (!alive.current) return
      if (!result.ok) throw new Error(result.error || '生成失败')
      const text = result.text || partial
      change((d) => ({
        ...d,
        candidates: {
          ...d.candidates,
          [mode]: {
            text,
            baseDraft,
            status: 'ready',
            contextDigest: result.contextDigest,
            ...(kind === 'world'
              ? { kind: 'world' as const, baseWorkshop: JSON.stringify([initial.book, initial.cards]) }
              : {}),
          },
        },
      }))
      if (mode === 'simulation') {
        const simulation = parseSimulation(text, sources, initial.drafts.simulation.change || `Seed: ${seed}`)
        simulation.contextDigest = result.contextDigest
        change((d) => ({ ...d, simulations: [simulation, ...d.simulations] }))
        const ids = await database.publishGeneratedSettings(
          projectId,
          simulation.impacts.map((p) => ({
            type: sources.find((e) => e.id === p.entryId)!.type,
            title: p.title,
            content: p.content,
          })),
        )
        change((d) => ({
          ...d,
          simulations: d.simulations.map((s) =>
            s.id === simulation.id
              ? { ...s, impacts: s.impacts.map((p, i) => ({ ...p, pendingEntryId: ids[i] })) }
              : s,
          ),
          candidates: { ...d.candidates, [mode]: { ...d.candidates[mode]!, worldEntryIds: ids } },
        }))
      } else {
        const world = kind === 'world' ? parseTavernWorld(text) : null
        const settings = world
          ? [
              { type: 'lore' as const, title: world.title, content: world.premise },
              ...world.settings,
              ...world.cards.flatMap((draft) =>
                draftWorldSettings('tavern', draft, JSON.stringify(draft), []),
              ),
              ...world.book.map((b) => ({ type: 'lore' as const, title: b.title, content: b.content })),
            ]
          : draftWorldSettings(mode, parseDraft(mode, text), text, initial.book)
        const ids = await database.publishGeneratedSettings(projectId, settings, (worldEntryIds) =>
          database.saveStudio(projectId, {
            ...current.current,
            candidates: {
              ...current.current.candidates,
              [mode]: { ...current.current.candidates[mode]!, worldEntryIds },
            },
          }),
        )
        change((d) => ({
          ...d,
          candidates: { ...d.candidates, [mode]: { ...d.candidates[mode]!, worldEntryIds: ids } },
        }))
      }
      await useStore.getState().fetchEntries()
      await flush()
    } catch (e) {
      if (alive.current) {
        setError(e instanceof Error ? e.message : '生成失败')
        if (partial && current.current.candidates[mode]?.text !== partial)
          change((d) => ({
            ...d,
            candidates: { ...d.candidates, [mode]: { text: partial, baseDraft, status: 'interrupted' } },
          }))
      }
    } finally {
      off()
      offProgress()
      request.current = null
      if (alive.current) setBusy(false)
    }
  }
  const accept = async () => {
    if (request.current || accepting.current) return
    accepting.current = true
    setBusy(true)
    try {
      const c = current.current.candidates[mode]
      if (!c || c.status !== 'ready') throw new Error('没有可采纳的完整候选')
      if (JSON.stringify(current.current.drafts[mode]) !== c.baseDraft)
        throw new Error('草稿在生成后已修改，请重新生成，避免覆盖最新内容')
      if (
        c.kind === 'world' &&
        JSON.stringify([current.current.book, current.current.cards]) !== c.baseWorkshop
      )
        throw new Error('角色卡或世界书已修改，请重新生成，避免覆盖最新内容')
      const world = c.kind === 'world' ? parseTavernWorld(c.text) : null
      if (world && (current.current.cards?.length || 0) + world.cards.length > 100)
        throw new Error('角色卡收藏最多 100 张')
      const draft = world ? world.cards[0] : parseDraft(mode, c.text)
      // Plans must never overwrite the GM's record of actual play.
      if (mode === 'trpg') draft.sessionLog = current.current.drafts.trpg.sessionLog
      const d = current.current
      const next: StudioDocument = {
        ...d,
        drafts: { ...d.drafts, [mode]: { ...d.drafts[mode], ...draft } },
        candidates: { ...d.candidates, [mode]: { ...c, status: 'applied' } },
        ...(world
          ? {
              book: world.book,
              cards: [
                ...(d.cards || []),
                ...world.cards.map((draft) => ({
                  id: generateId('card'),
                  draft,
                  book: structuredClone(world.book),
                })),
              ],
            }
          : {}),
      }
      await database.confirmGeneratedSettings(projectId, c.worldEntryIds || [], () =>
        database.saveStudio(projectId, next),
      )
      change(() => next)
      await useStore.getState().fetchEntries()
      await flush()
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '采纳失败')
    } finally {
      accepting.current = false
      setBusy(false)
    }
  }
  return {
    doc,
    change,
    dirty,
    error,
    setError,
    busy,
    stream,
    progress,
    flush,
    run,
    accept,
    stop: () => request.current && void window.novelAI?.cancel(request.current),
  }
}
