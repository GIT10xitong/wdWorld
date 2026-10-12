import { getLanguage } from './i18n'
export function generateId(prefix: string): string {
  const random = Math.random().toString(36).substring(2, 9)
  return `${prefix}_${random}`
}

export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s]+/g, '-')
    .replace(/[^a-z0-9\u4e00-\u9fa5-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString(getLanguage(), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function debounce<T extends (...args: never[]) => unknown>(
  func: T,
  wait: number,
): ((...args: Parameters<T>) => void) & {
  cancel: () => void
  flush: () => ReturnType<T> | undefined
} {
  let timeout: ReturnType<typeof setTimeout> | null = null
  let pendingArgs: Parameters<T> | null = null
  const debounced = (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    pendingArgs = args
    timeout = setTimeout(() => {
      timeout = null
      const argsToUse = pendingArgs
      pendingArgs = null
      if (argsToUse) func(...argsToUse)
    }, wait)
  }
  debounced.cancel = () => {
    if (timeout) clearTimeout(timeout)
    timeout = null
    pendingArgs = null
  }
  debounced.flush = () => {
    if (!pendingArgs) return undefined
    if (timeout) clearTimeout(timeout)
    timeout = null
    const argsToUse = pendingArgs
    pendingArgs = null
    return func(...argsToUse) as ReturnType<T>
  }
  return debounced
}

export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function getNow(): string {
  return new Date().toISOString()
}

export function normalizeString(str: string): string {
  return str.toLowerCase().trim().replace(/\s+/g, '')
}

declare global {
  interface Window {
    wdAPI?: {
      isElectron: () => boolean
      saveProject: (
        projectId: string,
        projectJson: string,
        dbBase64: string,
      ) => Promise<{ ok: boolean; error?: string }>
      loadProject: (projectId: string) => Promise<{
        ok: boolean
        projectJson: string | null
        dbBase64: string | null
        error?: string
      } | null>
      listProjects: () => Promise<{
        ok: boolean
        projects: Array<{ id: string; name: string; createdAt: string; updatedAt: string }>
        error?: string
      }>
      deleteProject: (projectId: string) => Promise<{ ok: boolean; error?: string }>
      saveRecentProjects: (list: unknown) => Promise<{ ok: boolean; error?: string }>
      loadRecentProjects: () => Promise<{ ok: boolean; list: unknown | null; error?: string }>
    }
  }
}
export {}
