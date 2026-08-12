import { describe, expect, it } from 'vitest'
import { contentToSafeHtml, markdownToSafeHtml } from '@/lib/markdown'

describe('safe Markdown rendering', () => {
  it('renders supported Markdown formatting', () => {
    const html = markdownToSafeHtml('# 标题\n**重点**')
    expect(html).toContain('<h1>标题</h1>')
    expect(html).toContain('<strong>重点</strong>')
  })

  it('escapes raw HTML and event handlers', () => {
    const html = contentToSafeHtml('<img src="https://example.com/a.png" onerror="alert(1)">')
    expect(html).toContain('<img')
    expect(html).not.toContain('onerror')
  })

  it('preserves safe TipTap HTML while removing scripts', () => {
    const html = contentToSafeHtml('<p><strong>正文</strong></p><script>alert(1)</script>')
    expect(html).toContain('<p><strong>正文</strong></p>')
    expect(html).not.toContain('<script')
  })

  it('removes unsafe link destinations', () => {
    expect(markdownToSafeHtml('[危险](javascript:alert)')).toBe('危险')
    expect(markdownToSafeHtml('[安全](https://example.com)')).toContain('href="https://example.com"')
  })
})
