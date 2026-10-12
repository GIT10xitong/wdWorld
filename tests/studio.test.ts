import { describe, expect, it } from 'vitest'
import { Database } from '@/lib/storage/database'
import {
  emptyStudio,
  parseDraft,
  parseSimulation,
  studioPrompt,
  validateStudio,
} from '@/features/studio/model'
import { characterCard, worldBook } from '@/features/studio/tavern'

async function world() {
  const db = new Database()
  await db.open()
  const project = await db.createProject('模式测试')
  const entry = await db.createEntry(project.id, 'lore', '潮汐规则', '', '<p>每年涨潮一次。</p>')
  return { db, project, entry }
}
describe('creation modes and world simulation', () => {
  it('keeps mode prompts separate and honors source selection', async () => {
    const { db, entry } = await world()
    const doc = emptyStudio()
    doc.drafts.oc.name = '林默'
    doc.drafts.trpg.secrets = '只有主持人知道的秘密'
    doc.sourceIds.oc = []
    const prompt = studioPrompt('oc', doc, [entry], [])
    expect(prompt[1].content).toContain('林默')
    expect(prompt[1].content).not.toContain('主持人知道')
    expect(prompt[1].content).not.toContain('潮汐规则')
    expect(studioPrompt('trpg', doc, [entry], [])[0].content).toContain('不得把计划当成已发生事件')
    expect(() => parseDraft('oc', '{"name":"只有一个字段"}')).toThrow('缺少字段')
    await db.close()
  })
  it('holds simulated changes for approval, supports undo, and blocks double acceptance', async () => {
    const { db, project, entry } = await world()
    const doc = emptyStudio()
    const sim = parseSimulation(
      JSON.stringify({
        analysis: '月亮碎裂导致潮汐加剧。',
        impacts: [{ entryId: entry.id, reason: '引力改变', content: '每月涨潮一次。' }],
      }),
      [entry],
      '月亮碎裂',
    )
    doc.simulations.push(sim)
    db.saveStudio(project.id, doc)
    expect((await db.getEntry(entry.id))!.content).toBe(entry.content)
    const applied = await db.applyWorldImpact(project.id, sim.id, sim.impacts[0].id)
    expect(applied.simulations[0].impacts[0].status).toBe('accepted')
    expect((await db.getEntry(entry.id))!.content).toContain('每月涨潮')
    await expect(db.applyWorldImpact(project.id, sim.id, sim.impacts[0].id)).rejects.toThrow('已处理')
    await db.applyWorldImpact(project.id, sim.id, sim.impacts[0].id, true)
    expect((await db.getEntry(entry.id))!.content).toBe(entry.content)
    await db.close()
  })
  it('rejects unknown targets and stale edits both before approval and undo', async () => {
    const { db, project, entry } = await world()
    expect(() =>
      parseSimulation(
        '{"analysis":"x","impacts":[{"entryId":"unknown","reason":"x","content":"y"}]}',
        [entry],
        'x',
      ),
    ).toThrow('未知')
    const doc = emptyStudio()
    const sim = parseSimulation(
      JSON.stringify({
        analysis: '假设',
        impacts: [{ entryId: entry.id, reason: '变化', content: '新规则' }],
      }),
      [entry],
      '变化',
    )
    doc.simulations = [sim]
    db.saveStudio(project.id, doc)
    await db.updateEntry(entry.id, { content: '作者手动修改' })
    await expect(db.applyWorldImpact(project.id, sim.id, sim.impacts[0].id)).rejects.toThrow('已修改')
    const fresh = (await db.getEntry(entry.id))!
    doc.simulations = [
      parseSimulation(
        JSON.stringify({
          analysis: '假设',
          impacts: [{ entryId: entry.id, reason: '变化', content: '新规则' }],
        }),
        [fresh],
        '变化',
      ),
    ]
    db.saveStudio(project.id, doc)
    const next = doc.simulations[0]
    await db.applyWorldImpact(project.id, next.id, next.impacts[0].id)
    await db.updateEntry(entry.id, { content: '采纳后的新编辑' })
    await expect(db.applyWorldImpact(project.id, next.id, next.impacts[0].id, true)).rejects.toThrow('已修改')
    expect((await db.getEntry(entry.id))!.content).toBe('采纳后的新编辑')
    await db.close()
  })
  it('backs up all mode drafts and remaps simulation targets on import', async () => {
    const { db, project, entry } = await world()
    const doc = emptyStudio()
    doc.drafts.oc.name = '人物甲'
    doc.drafts.trpg.sessionLog = '玩家已打开门'
    doc.drafts.tavern.name = '角色卡甲'
    doc.sourceIds.simulation = [entry.id]
    doc.simulations = [
      parseSimulation(
        JSON.stringify({
          analysis: '分析',
          impacts: [{ entryId: entry.id, reason: '原因', content: '候选规则' }],
        }),
        [entry],
        '改变',
      ),
    ]
    db.saveStudio(project.id, doc)
    const backup = await db.exportProjectJSON(project.id)
    const copy = new Database()
    await copy.open()
    const imported = await copy.importProjectJSON(backup)
    const restored = copy.getStudio(imported.id)
    expect(restored.drafts).toEqual(doc.drafts)
    expect(restored.sourceIds.simulation![0]).not.toBe(entry.id)
    expect(restored.simulations[0].impacts[0].entryId).toBe(restored.sourceIds.simulation![0])
    await copy.applyWorldImpact(
      imported.id,
      restored.simulations[0].id,
      restored.simulations[0].impacts[0].id,
    )
    expect((await db.getEntry(entry.id))!.content).toBe(entry.content)
    await copy.close()
    await db.close()
  })
  it('validates imported mode data without changing legacy empty defaults', () => {
    expect(() => validateStudio(emptyStudio())).not.toThrow()
    const invalid = emptyStudio() as any
    invalid.book = [{ id: 'one', enabled: 'yes' }]
    expect(() => validateStudio(invalid)).toThrow('格式无效')
  })
})

describe('tavern exports', () => {
  it('exports a V2 card with embedded lore and a separate native world book', () => {
    const draft = {
      ...emptyStudio().drafts.tavern,
      name: '林默',
      description: '调查员',
      first_mes: '{{user}}，你收到信了吗？',
    }
    const book = [
      {
        id: 'b',
        title: '潮汐',
        keys: '潮汐，月亮',
        content: '潮汐每年一次。',
        enabled: false,
        constant: false,
        order: 200,
      },
    ]
    const card = characterCard(draft, book)
    expect(card.spec).toBe('chara_card_v2')
    expect(card.data.first_mes).toContain('{{user}}')
    expect(card.data.character_book.entries[0]).toMatchObject({
      keys: ['潮汐', '月亮'],
      enabled: false,
      insertion_order: 200,
      extensions: {},
    })
    expect(worldBook(book).entries[0]).toMatchObject({
      key: ['潮汐', '月亮'],
      disable: true,
      order: 200,
      position: 0,
    })
    expect(JSON.stringify(card)).not.toContain('encryptedKey')
  })
  it('rejects unusable exports and allows constant entries without trigger words', () => {
    expect(() => characterCard(emptyStudio().drafts.tavern, [])).toThrow('名称与角色描述')
    expect(() => worldBook([])).toThrow('先添加')
    const entry = {
      id: 'b',
      title: '规则',
      keys: '',
      content: '不变的规则',
      enabled: true,
      constant: false,
      order: 100,
    }
    expect(() => worldBook([entry])).toThrow('触发词')
    expect(() => worldBook([{ ...entry, constant: true }])).not.toThrow()
  })
})
