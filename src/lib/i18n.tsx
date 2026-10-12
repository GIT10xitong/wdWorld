import { useSyncExternalStore } from 'react'
import uiCatalog from './locales/en.json'
import errorCatalog from '../../electron/messages.en.json'
import lanErrors from '../../electron/lan-client/errors.json'
import '@/features/lan/types'
type Language = 'zh-CN' | 'en'
const catalog = { ...uiCatalog, ...errorCatalog }
const reverseMessages: Record<string, string> = Object.fromEntries(
  Object.entries(catalog).map(([zh, en]) => [en, zh]),
)
let language: Language = 'zh-CN'
const listeners = new Set<() => void>()
export const getLanguage = () => language
export function setLanguage(value: string) {
  language = value === 'en' ? 'en' : 'zh-CN'
  document.documentElement.lang = language
  localStorage.setItem('wdworld-language', language)
  listeners.forEach((listener) => listener())
}
export function useLanguage() {
  return useSyncExternalStore((listener) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }, getLanguage)
}
export function t(text: string, values?: Record<string, unknown>): string {
  const translated = language === 'en' ? (catalog as Record<string, string>)[text] || text : text
  return values ? translated.replace(/\{(\d+)\}/g, (_, key) => String(values[key] ?? '')) : translated
}
// Translate application messages only; never pass authored manuscript content here.
const messagePatterns = Object.entries(catalog)
  .filter(([key]) => key.includes('{0}') && key.length < 500)
  .map(([key, value]) => ({
    regex: new RegExp(
      '^' +
        key
          .split(/\{\d+\}/)
          .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('(.*?)') +
        '$',
      's',
    ),
    value,
  }))
export function message(text: string): string {
  if (language !== 'en') return (lanErrors as Record<string, string>)[text] || reverseMessages[text] || text
  const direct = t(text)
  if (language !== 'en' || direct !== text) return direct
  for (const item of messagePatterns) {
    const match = item.regex.exec(text)
    if (match) return item.value.replace(/\{(\d+)\}/g, (_, key) => t(match[Number(key) + 1] || ''))
  }
  return text
}
export async function initializeLanguage() {
  setLanguage(
    (await window.appPreferences?.getLanguage()) || localStorage.getItem('wdworld-language') || 'zh-CN',
  )
  window.appPreferences?.onLanguage(setLanguage)
}
export function LanguagePicker() {
  const locale = useLanguage()
  return (
    <select
      className="language-picker"
      aria-label="Language / 语言"
      value={locale}
      onChange={(event) => {
        const value = event.target.value
        if (window.appPreferences) void window.appPreferences.setLanguage(value).then(setLanguage)
        else setLanguage(value)
      }}
    >
      <option value="zh-CN">简体中文</option>
      <option value="en">English</option>
    </select>
  )
}
