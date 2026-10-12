import { describe, expect, it } from 'vitest'
import { Database } from '@/lib/storage/database'
import { seedMysteryRevivalWorld } from '@/lib/defaultWorld'
import { cacheAssetData, resolveAssetSource } from '@/lib/assetSources'
import { emptyNovel, newChapter } from '@/features/novel/model'

describe('complete project backup', () => {
  it('round-trips world references, custom fields, templates, images and the novel into a fresh database', async () => {
    const db = new Database()
    await db.open()
    const project = await db.createProject('备份测试')
    await seedMysteryRevivalWorld(db, project.id)
    const entries = await db.listEntries(project.id)
    const investigator = entries.find((e) => e.type === 'character')!
    const asset = await db.createAsset(project.id, 'image', 'test.png', 'backup-test-image', 'image/png', 3)
    const data = 'data:image/png;base64,YWJj'
    cacheAssetData(asset.relativePath, data)
    await db.updateEntryCoverAsset(investigator.id, asset.id)
    const doc = emptyNovel('故事想法')
    const chapter = newChapter('第一章')
    chapter.content = '<p>正文</p>'
    chapter.entryIds = [investigator.id]
    doc.chapters = [chapter]
    doc.selectedChapterId = chapter.id
    db.saveNovel(project.id, doc)
    const backup = await db.exportProjectJSON(project.id)
    const imported = new Database()
    await imported.open()
    const copy = await imported.importProjectJSON(backup)
    const copyEntries = await imported.listEntries(copy.id)
    const copiedInvestigator = copyEntries.find((e) => e.title === investigator.title)!
    const assets = await imported.getAssets(copy.id)
    expect(resolveAssetSource(assets.find((a) => a.id === copiedInvestigator.coverAssetId))).toBe(data)
    expect(copiedInvestigator.coverAssetId).not.toBe(asset.id)
    expect(copyEntries.find((e) => e.title === '七中旧广播室')?.anchorId).toBeTruthy()
    expect(await imported.getTemplates(copy.id)).toHaveLength(1)
    const incident = copyEntries.find((e) => e.title === '七中静默事件')!
    const fields = await imported.listFieldSchemas(copy.id)
    const custom = fields.find((f) => f.key === 'risk_level') || fields.find((f) => f.id.startsWith('cus'))
    const values = await imported.getEntryFieldValues(incident.id)
    expect(values).toHaveLength(1)
    expect(fields.some((f) => f.id === values[0].fieldId)).toBe(true)
    expect(custom).toBeDefined()
    expect(await imported.getRelations(copy.id)).toHaveLength(17)
    expect(imported.getNovel(copy.id).chapters[0].entryIds).toEqual([copiedInvestigator.id])
    expect(imported.getNovel(copy.id).chapters[0].content).toBe('<p>正文</p>')
    // Importing the same backup again must not collide on project slug.
    const again = await imported.importProjectJSON(backup)
    expect(again.id).not.toBe(copy.id)
    // Persisting and reopening the SQLite file retains image bytes and manuscript.
    const reopened = new Database()
    await reopened.importDatabase(await imported.exportDatabase())
    expect(reopened.getNovel(copy.id).idea).toBe('故事想法')
    expect(
      JSON.parse(await reopened.exportProjectJSON(copy.id)).assets.some(
        (a: { data_url?: string }) => a.data_url === data,
      ),
    ).toBe(true)
    await db.close()
    await imported.close()
    await reopened.close()
  })

  it('rolls back a failed import rather than leaving a partial project', async () => {
    const db = new Database()
    await db.open()
    const p = await db.createProject('完整项目')
    await db.createEntry(p.id, 'character', '人物')
    const data = JSON.parse(await db.exportProjectJSON(p.id))
    data.entries.push({ ...data.entries[0], id: 'other', slug: data.entries[0].slug })
    const before = await db.exportDatabase()
    await expect(db.importProjectJSON(JSON.stringify(data))).rejects.toThrow()
    expect(await db.listEntries(p.id)).toHaveLength(1)
    expect((await db.exportDatabase()).length).toBe(before.length)
    await db.close()
  })

  it('makes canon changes only on confirmation and rejects stale suggestions', async () => {
    const db = new Database()
    await db.open()
    const p = await db.createProject('设定确认')
    const entry = await db.createEntry(p.id, 'character', '林', '', '<p>原设定</p>')
    const doc = emptyNovel()
    doc.proposals = [
      {
        id: 'p',
        type: 'character',
        title: '林',
        content: '新设定',
        targetEntryId: entry.id,
        baseContent: entry.content,
        evidence: '原文',
        status: 'pending',
      },
    ]
    db.saveNovel(p.id, doc)
    expect((await db.getEntry(entry.id))?.content).toBe('<p>原设定</p>')
    await db.updateEntry(entry.id, { content: '<p>作者修改</p>' })
    await expect(db.confirmNovelProposal(p.id, doc, 'p')).rejects.toThrow('原设定已修改')
    doc.proposals[0].baseContent = '<p>作者修改</p>'
    const next = await db.confirmNovelProposal(p.id, doc, 'p')
    expect((await db.getEntry(entry.id))?.content).toBe('<p>新设定</p>')
    expect(next.proposals[0].previousContent).toBe('<p>作者修改</p>')
    expect(db.getNovel(p.id).proposals[0].status).toBe('accepted')
    await expect(db.confirmNovelProposal(p.id, next, 'p')).rejects.toThrow('已处理')
    await db.updateEntry(entry.id, { content: '<p>后来编辑</p>' })
    await expect(db.revertNovelProposal(p.id, next, 'p')).rejects.toThrow('确认后已修改')
    expect(db.getNovel(p.id).proposals[0].status).toBe('accepted')
    expect((await db.getEntry(entry.id))?.content).toBe('<p>后来编辑</p>')
    await db.updateEntry(entry.id, { content: '<p>新设定</p>' })
    const reverted = await db.revertNovelProposal(p.id, next, 'p')
    expect(reverted.proposals[0].status).toBe('reverted')
    expect((await db.getEntry(entry.id))?.content).toBe('<p>作者修改</p>')
    await expect(db.revertNovelProposal(p.id, reverted, 'p')).rejects.toThrow('只有已确认')
    const copy = await db.importProjectJSON(await db.exportProjectJSON(p.id))
    expect(db.getNovel(copy.id).proposals[0].status).toBe('reverted')
    await db.close()
  })

  it('rejects incomplete novel documents in imported backups', async () => {
    const db = new Database()
    await db.open()
    const p = await db.createProject('校验备份')
    const data = JSON.parse(await db.exportProjectJSON(p.id))
    delete data.novel.idea
    await expect(db.importProjectJSON(JSON.stringify(data))).rejects.toThrow('小说备份格式无效')
    await db.close()
  })
})
