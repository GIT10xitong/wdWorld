import { describe, expect, it, vi } from 'vitest'
import { debounce, generateId, generateSlug, normalizeString, uuid } from '@/lib/utils'

describe('utility helpers', () => {
  it('creates URL-safe slugs for Chinese and Latin titles', () => {
    expect(generateSlug('  Fog 港：Archive  ')).toBe('fog-港archive')
    expect(generateSlug('A---B')).toBe('a-b')
  })

  it('creates prefixed IDs and RFC4122-shaped UUIDs', () => {
    expect(generateId('entry')).toMatch(/^entry_[a-z0-9]{7}$/)
    expect(uuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('normalizes case and whitespace', () => {
    expect(normalizeString('  Fog   Harbor  ')).toBe('fogharbor')
  })

  it('debounces calls and supports cancellation', () => {
    vi.useFakeTimers()
    const callback = vi.fn()
    const run = debounce(callback, 200)

    run('first')
    run('second')
    vi.advanceTimersByTime(199)
    expect(callback).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(callback).toHaveBeenCalledOnce()
    expect(callback).toHaveBeenCalledWith('second')

    run('cancelled')
    run.cancel()
    vi.advanceTimersByTime(200)
    expect(callback).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it('flushes the latest pending debounced call immediately', () => {
    vi.useFakeTimers()
    const callback = vi.fn((value: string) => value)
    const run = debounce(callback, 200)

    run('first')
    run('latest')
    expect(run.flush()).toBe('latest')
    expect(callback).toHaveBeenCalledOnce()
    expect(callback).toHaveBeenCalledWith('latest')
    vi.advanceTimersByTime(200)
    expect(callback).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })
})
