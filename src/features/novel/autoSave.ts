// A fixed interval also saves during continuous typing (unlike a debounce).
export function createDraftSaver(
  save: () => Promise<boolean>,
  notify: (dirty: boolean) => void,
  interval = 10000,
) {
  let revision = 0
  let saved = 0
  let active: Promise<void> | null = null
  let disposed = false
  const markDirty = () => {
    revision++
    if (!disposed) notify(true)
  }
  const flush = (force = true): Promise<void> => {
    if (force) markDirty()
    if (active) return active
    active = (async () => {
      while (saved !== revision) {
        const target = revision
        if (!(await save())) break
        saved = target
        if (!disposed) notify(saved !== revision)
      }
    })().finally(() => {
      active = null
    })
    return active
  }
  const timer = setInterval(() => {
    if (saved !== revision) void flush(false)
  }, interval)
  return {
    markDirty,
    flush,
    dispose: () => {
      disposed = true
      clearInterval(timer)
    },
  }
}
