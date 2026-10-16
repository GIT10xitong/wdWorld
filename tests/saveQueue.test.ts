import { expect, it } from 'vitest'
import { enqueueSave, flushDrafts, registerDraftFlusher } from '@/lib/storage/saveQueue'

it('serializes writes and allows the next save after a failed disk write', async () => {
  const events: string[] = []
  let release!: () => void
  const blocked = new Promise<void>((resolve) => {
    release = resolve
  })
  const first = enqueueSave(async () => {
    events.push('start')
    await blocked
    throw new Error('disk full')
  })
  const rejected = expect(first).rejects.toThrow('disk full')
  const second = enqueueSave(async () => {
    events.push('retry')
    return 'saved'
  })
  await Promise.resolve()
  expect(events).toEqual(['start'])
  release()
  await rejected
  expect(await second).toBe('saved')
  expect(events).toEqual(['start', 'retry'])
})

it('blocks navigation on a draft failure and unregisters disposed editors', async () => {
  const events: string[] = []
  const removeFailing = registerDraftFlusher(async () => {
    throw new Error('unsaved')
  })
  const removeHealthy = registerDraftFlusher(async () => {
    events.push('saved')
  })
  try {
    await expect(flushDrafts()).rejects.toThrow('unsaved')
    expect(events).toEqual([])
    removeFailing()
    await flushDrafts()
    expect(events).toEqual(['saved'])
    removeHealthy()
    await flushDrafts()
    expect(events).toEqual(['saved'])
  } finally {
    removeFailing()
    removeHealthy()
  }
})
