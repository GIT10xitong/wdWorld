const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function safeLinkUrl(value: string): string | null {
  const trimmed = value.trim()
  if (
    trimmed.startsWith('#') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('./') ||
    trimmed.startsWith('../')
  ) {
    return trimmed
  }
  try {
    const url = new URL(trimmed)
    return SAFE_LINK_PROTOCOLS.has(url.protocol) ? trimmed : null
  } catch {
    return null
  }
}

function markdownToHtml(markdown: string): string {
  return escapeHtml(markdown)
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*([^*]+)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/gim, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, (_match, label: string, href: string) => {
      const url = safeLinkUrl(href.replace(/&amp;/g, '&'))
      return url
        ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`
        : label
    })
    .replace(/`([^`]+)`/gim, '<code>$1</code>')
    .replace(/\[\[([^\]]+)\]\]/gim, '<span class="text-purple-400 cursor-pointer hover:underline">$1</span>')
    .replace(/\n/gim, '<br />')
}

function looksLikeHtml(content: string): boolean {
  return /<\/?(?:p|div|h[1-6]|ul|ol|li|blockquote|pre|strong|em|s|a|img|br)\b/i.test(content)
}

export function contentToSafeHtml(content: string): string {
  const html = looksLikeHtml(content) ? content : markdownToHtml(content)
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
  })
}

export const markdownToSafeHtml = contentToSafeHtml
import DOMPurify from 'dompurify'
