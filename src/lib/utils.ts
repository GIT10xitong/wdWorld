export function generateId(prefix: string): string {
  const random = Math.random().toString(36).substring(2, 9)
  return `${prefix}_${random}`
}

export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s]+/g, '-')
    .replace(/[^a-z0-9\u4e00-\u9fa5\-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let timeout: ReturnType<typeof setTimeout> | null = null
  const debounced = (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
  debounced.cancel = () => {
    if (timeout) clearTimeout(timeout)
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