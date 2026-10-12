import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
const require = createRequire(import.meta.url)
const { streamCompletion, normalizeEndpoint, listModels } = require('../electron/ai.js')

const sse = (events: unknown[]) => ({
  ok: true,
  headers: { get: () => 'text/event-stream' },
  body: new ReadableStream({
    start(controller) {
      const bytes = new TextEncoder().encode(
        events.map((e) => 'data: ' + JSON.stringify(e) + '\r\n\r\n').join(''),
      )
      // Exercise both partial JSON and multi-byte Chinese characters.
      for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7))
      controller.close()
    },
  }),
})
const json = (data: unknown) => ({
  ok: true,
  headers: { get: () => 'application/json' },
  json: async () => data,
})

describe('desktop model transport', () => {
  it('accepts HTTPS or loopback and normalizes completion URLs', () => {
    expect(normalizeEndpoint('http://127.0.0.1:11434/v1/')).toBe('http://127.0.0.1:11434/v1')
    expect(normalizeEndpoint('https://example.com/v1/chat/completions')).toBe('https://example.com/v1')
    expect(() => normalizeEndpoint('http://example.com')).toThrow()
    expect(() => normalizeEndpoint('https://user:secret@example.com')).toThrow()
  })
  it('decodes split SSE chunks and keeps partial text separate from success', async () => {
    const chunks = [
      'data: {"choices":[{"delta":{"content":"你',
      '好"}}]}\r\n\r\ndata: {"choices":[{"delta":{"content":"世界"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
    ]
    const deltas: string[] = []
    const result = await streamCompletion({
      endpoint: 'https://example.com',
      model: 'model',
      key: '',
      messages: [],
      onDelta: (s: string) => deltas.push(s),
      fetchImpl: async () => ({
        ok: true,
        headers: { get: () => 'text/event-stream' },
        body: new ReadableStream({
          start(controller) {
            chunks.forEach((c) => controller.enqueue(new TextEncoder().encode(c)))
            controller.close()
          },
        }),
      }),
    })
    expect(result).toBe('你好世界')
    expect(deltas).toEqual(['你好', '世界'])
  })
  it('does not mark a disconnected or truncated stream as a usable result', async () => {
    for (const finish of ['', ',"finish_reason":"length"']) {
      const chunk = `data: {"choices":[{"delta":{"content":"未完成"}${finish}}]}\n\n`
      await expect(
        streamCompletion({
          endpoint: 'https://example.com',
          model: 'm',
          messages: [],
          onDelta: () => {},
          fetchImpl: async () => ({
            ok: true,
            headers: { get: () => 'text/event-stream' },
            body: new ReadableStream({
              start(c) {
                c.enqueue(new TextEncoder().encode(chunk))
                c.close()
              },
            }),
          }),
        }),
      ).rejects.toThrow()
    }
  })
  it('reports HTTP failures without echoing provider error bodies or secrets', async () => {
    await expect(
      streamCompletion({
        endpoint: 'https://example.com',
        model: 'm',
        key: 'secret',
        messages: [],
        onDelta: () => {},
        fetchImpl: async () => ({ ok: false, status: 401 }),
      }),
    ).rejects.toThrow('HTTP 401')
  })

  it('distinguishes input context overflow from authentication and output limits', async () => {
    await expect(
      streamCompletion({
        endpoint: 'https://example.com',
        model: 'm',
        messages: [],
        fetchImpl: async () => ({
          ok: false,
          status: 400,
          json: async () => ({
            error: { message: 'Maximum context length exceeded: provider secret context' },
          }),
        }),
      }),
    ).rejects.toThrow('输入资料超过')
  })

  it.each(['deepseek', 'mimo', 'openai', 'custom'])(
    'fetches %s models with the correct authentication',
    async (provider) => {
      let captured: any
      const models = await listModels({
        provider,
        endpoint: 'https://example.com/v1/',
        key: 'test-key',
        fetchImpl: async (url: string, options: any) => {
          captured = { url, ...options }
          return json({
            data: [
              { id: 'writer-b' },
              { id: 'writer-a', name: '写作模型' },
              { id: 'writer-a' },
              { wrong: true },
              { id: 'speech', output_modalities: ['audio'] },
            ],
          })
        },
      })
      expect(captured.url).toBe('https://example.com/v1/models')
      expect(captured.method).toBe('GET')
      expect(captured.redirect).toBe('error')
      expect(captured.headers).toEqual(
        provider === 'mimo' ? { 'api-key': 'test-key' } : { Authorization: 'Bearer test-key' },
      )
      expect(models.map((m: any) => m.id)).toEqual(['writer-a', 'writer-b'])
    },
  )

  it('paginates Gemini discovery and keeps models supporting content generation', async () => {
    const urls: string[] = []
    const models = await listModels({
      provider: 'gemini',
      endpoint: 'https://example.com/v1beta',
      key: 'gemini-key',
      fetchImpl: async (url: string, options: any) => {
        urls.push(url)
        expect(options.headers).toEqual({ 'x-goog-api-key': 'gemini-key' })
        expect(url).not.toContain('gemini-key')
        return json(
          urls.length === 1
            ? {
                models: [
                  {
                    name: 'models/gemini-writer',
                    displayName: 'Writer',
                    supportedGenerationMethods: ['generateContent'],
                  },
                  { name: 'models/embedding', supportedGenerationMethods: ['embedContent'] },
                ],
                nextPageToken: 'next/token',
              }
            : { models: [{ name: 'models/gemini-second', supportedGenerationMethods: ['generateContent'] }] },
        )
      },
    })
    expect(new URL(urls[1]).searchParams.get('pageToken')).toBe('next/token')
    expect(models.map((m: any) => m.id)).toEqual(['gemini-second', 'gemini-writer'])
  })

  it('uses Responses for OpenAI/Codex, streams only output text and handles JSON responses', async () => {
    const output = [{ type: 'message', content: [{ type: 'output_text', text: '小说正文' }] }]
    for (const streaming of [true, false]) {
      const text = await streamCompletion({
        provider: 'openai',
        endpoint: 'https://api.openai.com/v1',
        model: 'account-codex-model',
        key: 'key',
        messages: [
          { role: 'system', content: '系统要求' },
          { role: 'user', content: '写小说' },
        ],
        fetchImpl: async (url: string, options: any) => {
          expect(url).toBe('https://api.openai.com/v1/responses')
          const body = JSON.parse(options.body)
          expect(body.input[0]).toEqual({ role: 'system', content: '系统要求' })
          expect(body.store).toBe(false)
          expect(body.max_output_tokens).toBe(4096)
          expect(body).not.toHaveProperty('messages')
          return streaming
            ? sse([
                { type: 'response.reasoning_summary_text.delta', delta: '不进入正文' },
                { type: 'response.output_text.delta', delta: '小说正文' },
                { type: 'response.completed', response: { status: 'completed', output } },
              ])
            : json({ status: 'completed', output })
        },
      })
      expect(text).toBe('小说正文')
    }
  })

  it('maps Gemini roles and system instructions and excludes thought parts from manuscript', async () => {
    const text = await streamCompletion({
      provider: 'gemini',
      endpoint: 'https://example.com/v1beta',
      model: 'models/gemini-writer',
      key: 'gemini-key',
      messages: [
        { role: 'system', content: '规则' },
        { role: 'user', content: '写故事' },
        { role: 'assistant', content: '旧文' },
        { role: 'user', content: '继续' },
      ],
      fetchImpl: async (url: string, options: any) => {
        expect(url).toBe('https://example.com/v1beta/models/gemini-writer:streamGenerateContent?alt=sse')
        expect(options.headers['x-goog-api-key']).toBe('gemini-key')
        const body = JSON.parse(options.body)
        expect(body.systemInstruction.parts).toEqual([{ text: '规则' }])
        expect(body.contents.map((m: any) => m.role)).toEqual(['user', 'model', 'user'])
        return sse([
          { candidates: [{ content: { parts: [{ text: '思考过程', thought: true }, { text: '新的' }] } }] },
          { candidates: [{ content: { parts: [{ text: '正文' }] }, finishReason: 'STOP' }] },
        ])
      },
    })
    expect(text).toBe('新的正文')
  })

  it.each([
    ['responses', { type: 'response.incomplete' }],
    ['responses', { type: 'response.failed' }],
    ['responses', { type: 'error', message: 'provider-secret' }],
    ['gemini', { candidates: [{ finishReason: 'MAX_TOKENS' }] }],
    ['gemini', { candidates: [{ finishReason: 'SAFETY' }] }],
    ['gemini', { promptFeedback: { blockReason: 'SAFETY' } }],
  ])('rejects unfinished or blocked %s output', async (protocol, event) => {
    await expect(
      streamCompletion({
        protocol,
        endpoint: 'https://example.com',
        model: 'writer',
        messages: [],
        fetchImpl: async () => sse([event]),
      }),
    ).rejects.toThrow()
  })

  it('preserves abort signals and refuses redirects and malformed model lists', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      listModels({
        endpoint: 'https://example.com',
        signal: controller.signal,
        fetchImpl: async (_url: string, options: any) => {
          expect(options.signal).toBe(controller.signal)
          expect(options.redirect).toBe('error')
          throw new DOMException('Aborted', 'AbortError')
        },
      }),
    ).rejects.toThrow('Aborted')
    await expect(
      listModels({ endpoint: 'https://example.com', fetchImpl: async () => json({ message: 'secret' }) }),
    ).rejects.toThrow('未返回模型列表')
  })
})
