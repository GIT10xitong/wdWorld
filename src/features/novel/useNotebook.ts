import { useEffect, useRef, useState } from 'react'
import { generateId } from '@/lib/utils'
import { registerDraftFlusher } from '@/lib/storage/saveQueue'
import { createDraftSaver } from './autoSave'
import { nt } from './workbench'
export interface Notebook {
  draft: string
  goal: number
  notes: { id: string; text: string; createdAt: string }[]
}
declare global {
  interface Window {
    novelHome?: {
      load(): Promise<{ ok: boolean; data?: Notebook }>
      save(data: Notebook): Promise<{ ok: boolean }>
    }
  }
}
const blank = (): Notebook => ({ draft: '', goal: 3000, notes: [] })
export function useNotebook() {
  const [data, setData] = useState(blank),
    [ready, setReady] = useState(false),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState('')
  const current = useRef(data),
    loaded = useRef(false),
    failed = useRef(false),
    saver = useRef<ReturnType<typeof createDraftSaver>>()
  const flush = async () => {
    if (!loaded.current) return
    await saver.current?.flush(false)
    if (failed.current)
      throw new Error(nt('灵感保存失败，请重试后再离开', 'Could not save notes. Retry before leaving.'))
  }
  useEffect(() => {
    let alive = true
    saver.current = createDraftSaver(
      async () => {
        try {
          if (!loaded.current) return false
          if (window.novelHome) {
            if (!(await window.novelHome.save(current.current)).ok) throw new Error('save')
          } else localStorage.setItem('wdworld-novel-notebook', JSON.stringify(current.current))
          failed.current = false
          if (alive) setError('')
          return true
        } catch {
          failed.current = true
          if (alive)
            setError(
              nt(
                '灵感保存失败，内容仍保留在编辑区',
                'Notes could not be saved. Your text remains in the editor.',
              ),
            )
          return false
        }
      },
      (dirty) => {
        if (alive) setDirty(dirty)
      },
    )
    void (async () => {
      try {
        let value: Notebook
        if (window.novelHome) {
          const result = await window.novelHome.load()
          if (!result.ok || !result.data) throw new Error('load')
          value = result.data
        } else value = JSON.parse(localStorage.getItem('wdworld-novel-notebook') || 'null') || blank()
        if (
          !value ||
          typeof value.draft !== 'string' ||
          !Array.isArray(value.notes) ||
          !Number.isInteger(value.goal)
        )
          throw new Error('data')
        if (alive) {
          current.current = value
          loaded.current = true
          setData(value)
          setReady(true)
        }
      } catch {
        if (alive)
          setError(
            nt(
              '无法读取灵感便笺，已阻止覆盖。请检查本地数据。',
              'Cannot read notebook. Overwriting is blocked. Check local data.',
            ),
          )
      }
    })()
    const unregister = registerDraftFlusher(flush)
    return () => {
      alive = false
      unregister()
      saver.current?.dispose()
    }
  }, [])
  const change = (fn: (data: Notebook) => Notebook) => {
    if (!loaded.current) return
    current.current = fn(current.current)
    setData(current.current)
    saver.current?.markDirty()
  }
  return {
    data,
    ready,
    dirty,
    error,
    change,
    flush,
    add: async () => {
      if (!current.current.draft.trim() || current.current.notes.length >= 200) return
      change((d) => ({
        ...d,
        draft: '',
        notes: [
          { id: generateId('idea'), text: d.draft.trim(), createdAt: new Date().toISOString() },
          ...d.notes,
        ],
      }))
      await flush()
    },
  }
}
