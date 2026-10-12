// Keep file/IndexedDB writes in request order; a failed write must not poison later saves.
let tail: Promise<unknown> = Promise.resolve()
export function enqueueSave<T>(write: () => Promise<T>): Promise<T> {
  const next = tail.then(write, write)
  tail = next.catch(() => undefined)
  return next
}

const flushers = new Set<() => Promise<void>>()
export function registerDraftFlusher(flush: () => Promise<void>) {
  flushers.add(flush)
  return () => {
    flushers.delete(flush)
  }
}
export async function flushDrafts() {
  for (const flush of flushers) await flush()
}
