export interface Player {
  roleId?: string
  id: string
  name: string
  character: { name: string; description: string; hp: number; maxHp: number }
}
export interface Room {
  automation?: {
    enabled: boolean
    greet: boolean
    busy: boolean
    error?: string
    config?: AutomationConfig
    preview?: { speaker: string; text: string; roleId: string } | null
  }
  roles?: { id: string; name: string; description: string }[]
  paused?: boolean
  id: string
  projectId: string
  title: string
  mode: 'trpg' | 'tavern'
  revision: number
  code: string
  addresses: string[]
  port: number
  locked: boolean
  scene: string
  players: Player[]
  handouts: { id: string; title: string; content: string }[]
  initiative: { playerId: string; name: string; value: number }[]
  messages: {
    id: string
    at: string
    speaker: string
    text: string
    kind: string
    roll?: { expression: string; rolls: number[]; modifier: number; total: number }
  }[]
}
export interface AutomationConfig {
  enabled: boolean
  greet: boolean
  roleId: string
  character: Record<string, string>
  opening: string
  system: string
  instructions: string
  book: { keys: string; content: string; enabled: boolean; constant: boolean }[]
}
export interface LanResult {
  ok: boolean
  state?: Room | null
  error?: string
}
declare global {
  interface Window {
    lanRoom?: {
      start(input: {
        mode: 'trpg' | 'tavern'
        projectId: string
        title: string
        port?: number
        scene?: string
        automation?: AutomationConfig
      }): Promise<LanResult>
      state(): Promise<LanResult>
      action(input: Record<string, unknown> & { action: string }): Promise<LanResult>
      stop(): Promise<LanResult>
      archive(): Promise<LanResult>
      archiveStatus(): Promise<{ error: string }>
      history(projectId: string): Promise<Room[]>
    }
    appPreferences?: {
      onSwitchMode(callback: () => void): () => void
      getLanguage(): Promise<string>
      setLanguage(value: string): Promise<string>
      onLanguage(callback: (value: string) => void): () => void
    }
  }
}
