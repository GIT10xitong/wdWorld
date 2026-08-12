import { describe, expect, it } from 'vitest'
import { Database } from '@/lib/storage/database'

describe('entry deletion', () => {
  it('removes the entry and all dependent records', async () => {
    const database = new Database()
    await database.open()
    const project = await database.createProject('删除测试')
    const deletedEntry = await database.createEntry(project.id, 'location', '待删除地点')
    const survivingEntry = await database.createEntry(project.id, 'character', '保留人物')
    const tag = await database.createTag(project.id, '测试标签')

    await database.addTagToEntry(deletedEntry.id, tag.id)
    await database.createAlias(deletedEntry.id, '旧地点')
    await database.createRelation(project.id, deletedEntry.id, survivingEntry.id, 'located_in')
    await database.addBacklink(project.id, survivingEntry.id, deletedEntry.id, '提及')
    await database.createAnchor(deletedEntry.id, '入口', 0.2, 0.3)
    await database.createTimelineEvent(deletedEntry.id, '第一天', '到达', 1)

    await database.deleteEntry(deletedEntry.id)

    expect(await database.getEntry(deletedEntry.id)).toBeNull()
    expect(await database.getEntry(survivingEntry.id)).not.toBeNull()
    expect(await database.getEntryRelations(survivingEntry.id)).toEqual([])
    expect(await database.getBacklinks(deletedEntry.id)).toEqual([])
    expect(await database.getAnchors(deletedEntry.id)).toEqual([])
    expect(await database.getTimelineEvents(deletedEntry.id)).toEqual([])
    expect(await database.getEntryTags(deletedEntry.id)).toEqual([])
    expect(await database.getEntryAliases(deletedEntry.id)).toEqual([])
  })

  it('clears entry references before deleting shared resources', async () => {
    const database = new Database()
    await database.open()
    const project = await database.createProject('引用清理测试')
    const entry = await database.createEntry(project.id, 'location', '测试地点')
    const asset = await database.createAsset(
      project.id,
      'image',
      'cover.png',
      'assets/cover.png',
      'image/png',
      1,
    )
    const anchor = await database.createAnchor(entry.id, '入口', 0.2, 0.3)

    await database.updateEntryCoverAsset(entry.id, asset.id)
    await database.updateEntryAnchor(entry.id, anchor.id)
    await database.deleteAsset(asset.id)
    await database.deleteAnchor(anchor.id)

    const updatedEntry = await database.getEntry(entry.id)
    expect(updatedEntry?.coverAssetId).toBeNull()
    expect(updatedEntry?.anchorId).toBeNull()
    expect(await database.getAssets(project.id)).toEqual([])
    expect(await database.getAnchors(entry.id)).toEqual([])
  })

  it('deletes tag assignments before deleting a tag with foreign keys enabled', async () => {
    const database = new Database()
    await database.open()
    const project = await database.createProject('标签清理测试')
    const entry = await database.createEntry(project.id, 'note', '测试条目')
    const tag = await database.createTag(project.id, '待删除标签')
    await database.addTagToEntry(entry.id, tag.id)

    await expect(database.deleteTag(tag.id)).resolves.toBeUndefined()
    expect(await database.getEntryTags(entry.id)).toEqual([])
    expect(await database.getTags(project.id)).toEqual([])
  })
})
