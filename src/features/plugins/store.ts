import { useSyncExternalStore } from 'react'
import { getLanguage } from '@/lib/i18n'
export interface Localized {
  zh: string
  en: string
}
export interface PluginManifest {
  schema: 'wdworld-plugin'
  apiVersion: 1
  id: string
  version: string
  minAppVersion: string
  name: Localized
  description: Localized
  author: string
  license: string
  kind: 'mode' | 'extension'
  targets?: ('free' | 'novel' | 'oc' | 'trpg' | 'tavern')[]
  mode?: 'trpg' | 'tavern'
  capability?: 'memory' | 'image' | 'speech' | 'service'
  protocol?: string
  permissions: string[]
  dependencies: string[]
  resources?: {
    instructions: Localized
    presets?: { zh: Record<string, string>; en: Record<string, string> }[]
  }
}
export interface InstalledPlugin {
  manifest: PluginManifest
  enabled: boolean
  source: string
  sha256: string
  settings: { endpoint: string; model: string; voice: string; hasKey: boolean }
}
export interface PluginReview {
  token: string
  manifest: PluginManifest
  source: string
  sha256: string
  catalogVerified: boolean
}
export interface CatalogItem {
  kind?: 'mode' | 'extension'
  targets?: PluginManifest['targets']
  id: string
  version: string
  name: Localized
  description: Localized
  sha256: string
  url: string
}
export interface PluginOutput {
  type: 'text' | 'image' | 'audio'
  text?: string
  mime?: string
  base64?: string
}
type Result = { ok: boolean; value?: any; error?: string }
declare global {
  interface Window {
    wdPlugins?: Record<
      | 'list'
      | 'catalog'
      | 'prepare'
      | 'install'
      | 'change'
      | 'configure'
      | 'invoke'
      | 'cancel'
      | 'memory'
      | 'summarize',
      (input?: Record<string, unknown>) => Promise<Result>
    >
  }
}
let installed: InstalledPlugin[] = []
let loadError = ''
const listeners = new Set<() => void>()
export const localize = (text: Localized) => (getLanguage() === 'en' ? text.en : text.zh)
export const getPlugins = () => installed
export const getPluginError = () => loadError
export function setPlugins(next: InstalledPlugin[]) {
  installed = next
  listeners.forEach((fn) => fn())
}
export const usePlugins = () =>
  useSyncExternalStore((fn) => {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }, getPlugins)
export async function pluginCall<T = unknown>(
  method: keyof NonNullable<Window['wdPlugins']>,
  input?: Record<string, unknown>,
): Promise<T> {
  if (!window.wdPlugins) throw new Error('Plugin management requires the desktop app')
  const result = await window.wdPlugins[method](input)
  if (!result.ok) throw new Error(result.error || 'Plugin operation failed')
  return result.value as T
}
export async function refreshPlugins() {
  const next = await pluginCall<InstalledPlugin[]>('list')
  loadError = ''
  setPlugins(next)
}
export async function initializePlugins() {
  if (window.wdPlugins)
    try {
      await refreshPlugins()
    } catch (e) {
      loadError = e instanceof Error ? e.message : String(e)
    }
}
export const modeAvailable = (mode: string) =>
  !['trpg', 'tavern'].includes(mode) ||
  installed.some((p) => p.enabled && p.manifest.kind === 'mode' && p.manifest.mode === mode)
export const modeResources = (mode: string) =>
  installed.find((p) => p.enabled && p.manifest.mode === mode)?.manifest.resources

export type PluginScope = 'modes' | 'free' | 'novel' | 'oc' | 'trpg' | 'tavern'
export function inPluginScope(
  p: { id: string; kind?: string; targets?: PluginManifest['targets'] },
  scope: PluginScope,
) {
  const kind = p.kind || (['wdworld.trpg', 'wdworld.tavern'].includes(p.id) ? 'mode' : 'extension')
  return scope === 'modes'
    ? kind === 'mode'
    : kind === 'extension' && (p.targets || ['tavern']).includes(scope)
}
