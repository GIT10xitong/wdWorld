export type AIProvider = 'deepseek' | 'mimo' | 'openai' | 'gemini' | 'custom'
export type AIProtocol = 'chat' | 'responses' | 'gemini'
export interface AIConnection {
  provider: AIProvider
  protocol: AIProtocol
  endpoint: string
  key: string
  clearKey: boolean
}
export interface AIModel {
  id: string
  name: string
}
export interface AISettings {
  provider: AIProvider
  protocol: AIProtocol
  endpoint: string
  model: string
  hasKey: boolean
}
export interface AIProgress {
  id: string
  provider: AIProvider
  model: string
  phase: 'connecting' | 'connected' | 'thinking' | 'generating' | 'preparing'
  round?: number
  part?: number
  total?: number
  activity?: string
}
export interface DesktopAI {
  getSettings(provider?: AIProvider): Promise<AISettings>
  saveSettings(input: AIConnection & { model: string }): Promise<AISettings>
  listModels(input: AIConnection): Promise<{ ok: boolean; models?: AIModel[]; error?: string }>
  testModel(
    input: AIConnection & { model: string },
  ): Promise<{ ok: boolean; error?: string; settings?: AISettings }>
  generate(input: {
    id: string
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[]
  }): Promise<{ ok: boolean; text?: string; error?: string; contextDigest?: string }>
  cancel(id: string): Promise<boolean>
  onDelta(callback: (data: { id: string; delta: string }) => void): () => void
  onProgress(callback: (data: AIProgress) => void): () => void
}
declare global {
  interface Window {
    novelAI?: DesktopAI
    desktopLifecycle?: { onBeforeClose(callback: () => Promise<boolean>): () => void }
  }
}
