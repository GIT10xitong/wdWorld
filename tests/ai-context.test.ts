import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'
const require = createRequire(import.meta.url)
const { splitText, prepareContext } = require('../electron/ai-context.js')
const limits = require('../electron/ai-limits.json')
describe('bounded sequential context preparation', () => {
  it('splits all source text without dropping characters or splitting surrogate pairs', () => {
    const text = ('行末😀\n' + '字'.repeat(83)).repeat(700)
    const chunks = splitText(text, 91)
    expect(chunks.join('')).toBe(text)
    expect(chunks.every((c: string) => c.length <= 91 && !/[\ud800-\udbff]$/.test(c))).toBe(true)
  })
  it('sends a short prompt unchanged and prepares every part of a long one before final generation', async () => {
    const complete = vi.fn(async () => '人物甲，条目 ID: char-1；只能在日落后行动。')
    const short = [
      { role: 'system', content: '写作' },
      { role: 'user', content: '想法' },
    ]
    expect((await prepareContext(short, complete, () => {})).messages).toBe(short)
    expect(complete).not.toHaveBeenCalled()
    const long = [
      { role: 'system', content: '检查矛盾' },
      { role: 'user', content: JSON.stringify({ 正文: '长篇资料'.repeat(25000), 作者要求: '保留人物甲' }) },
    ]
    const progress = vi.fn()
    const prepared = await prepareContext(long, complete, progress)
    expect(complete.mock.calls.length).toBeGreaterThan(9)
    for (const [messages] of complete.mock.calls as any)
      expect(messages.reduce((n: number, m: any) => n + m.content.length, 0)).toBeLessThan(limits.inputChars)
    expect(prepared.messages.reduce((n: number, m: any) => n + m.content.length, 0)).toBeLessThan(
      limits.inputChars,
    )
    expect(prepared.messages[1].content).toContain('作者原始要求：\n保留人物甲')
    expect(prepared.contextDigest).toContain('char-1')
    expect(progress).toHaveBeenCalledWith(expect.objectContaining({ phase: 'preparing', part: 1 }))
  })
  it('stops between segments on cancellation and does not turn partial notes into manuscript', async () => {
    const controller = new AbortController()
    const complete = vi.fn(async () => {
      controller.abort()
      return '笔记'
    })
    await expect(
      prepareContext([{ role: 'user', content: '字'.repeat(50000) }], complete, () => {}, controller.signal),
    ).rejects.toThrow()
    expect(complete).toHaveBeenCalledTimes(1)
  })

  it('reduces accumulated notes again when one pass still exceeds the final request budget', async () => {
    const complete = vi.fn(async () => '保留事实'.repeat(150))
    const progress = vi.fn()
    const prepared = await prepareContext(
      [
        { role: 'system', content: '制定大纲' },
        { role: 'user', content: '字'.repeat(300000) },
      ],
      complete,
      progress,
    )
    expect(progress).toHaveBeenCalledWith(expect.objectContaining({ round: 2 }))
    expect(prepared.messages.reduce((n: number, m: any) => n + m.content.length, 0)).toBeLessThan(
      limits.inputChars,
    )
    expect(complete.mock.calls.length).toBeGreaterThan(30)
  })
})
