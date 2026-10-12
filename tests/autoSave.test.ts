import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDraftSaver } from '@/features/novel/autoSave'
afterEach(() => vi.useRealTimers())
describe('fixed ten-second manuscript saving', () => {
  it('saves during continuous editing and skips unchanged intervals', async () => {
    vi.useFakeTimers()
    const save = vi.fn(async () => true)
    const notify = vi.fn()
    const saver = createDraftSaver(save, notify)
    for (let i = 0; i < 9; i++) {
      saver.markDirty()
      await vi.advanceTimersByTimeAsync(1000)
    }
    expect(save).not.toHaveBeenCalled()
    saver.markDirty()
    await vi.advanceTimersByTimeAsync(1000)
    expect(save).toHaveBeenCalledTimes(1)
    expect(notify).toHaveBeenLastCalledWith(false)
    await vi.advanceTimersByTimeAsync(10000)
    expect(save).toHaveBeenCalledTimes(1)
    saver.dispose()
  })
  it('retries failed saves and manual save includes edits made during an in-flight save', async () => {
    vi.useFakeTimers()
    let release!: () => void
    const save = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockImplementationOnce(
        () =>
          new Promise<boolean>((resolve) => {
            release = () => resolve(true)
          }),
      )
      .mockResolvedValue(true)
    const notify = vi.fn()
    const saver = createDraftSaver(save, notify)
    saver.markDirty()
    await vi.advanceTimersByTimeAsync(10000)
    expect(notify).not.toHaveBeenCalledWith(false)
    const flushed = saver.flush()
    saver.markDirty()
    release()
    await flushed
    expect(save).toHaveBeenCalledTimes(3)
    expect(notify).toHaveBeenLastCalledWith(false)
    saver.dispose()
    saver.markDirty()
    await vi.advanceTimersByTimeAsync(20000)
    expect(save).toHaveBeenCalledTimes(3)
  })
})
