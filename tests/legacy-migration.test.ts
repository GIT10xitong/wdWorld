import { expect, it } from 'vitest'
import { Database } from '@/lib/storage/database'
import fixture from './fixtures/legacy/project-1.7.0.json'

it('opens a real 1.7.0 database and preserves its entries and relations through backup and reopen', async () => {
  const db = new Database()
  const restored = new Database()
  const reopened = new Database()
  try {
    await db.importDatabase(new Uint8Array(Buffer.from(fixture.dbBase64, 'base64')))
    const project = JSON.parse(fixture.projectJson)
    const entries = await db.listEntries(project.id)
    const sentinel = entries.find((entry) => entry.title === 'Legacy migration sentinel')!
    expect(sentinel.summary).toBe('Created with version 1.7.0; preserve through upgrades.')
    expect(entries.length).toBeGreaterThan(10)
    const relations = await db.getRelations(project.id)
    expect(relations).toHaveLength(17)
    await db.updateEntry(sentinel.id, { summary: 'Updated after migration' })
    await restored.open()
    const copy = await restored.importProjectJSON(await db.exportProjectJSON(project.id))
    expect(await restored.listEntries(copy.id)).toHaveLength(entries.length)
    expect(await restored.getRelations(copy.id)).toHaveLength(relations.length)
    await reopened.importDatabase(await restored.exportDatabase())
    expect(
      (await reopened.listEntries(copy.id)).find((entry) => entry.title === sentinel.title)?.summary,
    ).toBe('Updated after migration')
    expect(reopened.getNovel(copy.id).version).toBe(1)
  } finally {
    await db.close()
    await restored.close()
    await reopened.close()
  }
})
