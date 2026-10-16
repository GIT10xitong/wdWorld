import { useSyncExternalStore } from 'react'
import { Sun, Moon } from 'lucide-react'
import { getLanguage } from './i18n'
type Theme = 'day' | 'night'
let theme: Theme = 'day'
const listeners = new Set<() => void>()
export function setTheme(value: Theme) {
  theme = value
  document.documentElement.dataset.theme = value
  document.documentElement.style.colorScheme = value === 'day' ? 'light' : 'dark'
  try {
    localStorage.setItem('wdworld-theme', value)
  } catch {
    /* Session theme still applies. */
  }
  listeners.forEach((fn) => fn())
}
export function initializeTheme() {
  let saved: string | null = null
  try {
    saved = localStorage.getItem('wdworld-theme')
  } catch {
    /* Use default. */
  }
  setTheme(saved === 'night' ? 'night' : 'day')
}
export function ThemeToggle() {
  const current = useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    },
    () => theme,
  )
  const label =
    getLanguage() === 'en'
      ? current === 'day'
        ? 'Night mode'
        : 'Day mode'
      : current === 'day'
        ? '夜晚模式'
        : '白天模式'
  return (
    <button
      className="theme-toggle"
      title={label}
      aria-label={label}
      onClick={() => setTheme(current === 'day' ? 'night' : 'day')}
    >
      {current === 'day' ? <Moon size={16} /> : <Sun size={16} />}
      <span>{label}</span>
    </button>
  )
}
