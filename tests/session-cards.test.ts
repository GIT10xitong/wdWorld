import { beforeEach, it, expect } from 'vitest'
import { enableTestModes } from './plugin-fixtures'
beforeEach(enableTestModes)
import { emptyStudio, validateStudio } from '@/features/studio/model'
import { trpgPresets, moduleFile, importModule } from '@/features/studio/trpg'
import { scenarioFromStudio, scenarioFile, importScenario } from '@/features/studio/scenario'
import { Database } from '@/lib/storage/database'

it('round-trips scenario cast, scene, openings and individual worldbooks through backup', async () => {
  const doc = emptyStudio()
  Object.assign(doc.drafts.tavern, {
    name: 'Guide',
    description: 'A guide',
    scenario: 'Harbor',
    first_mes: 'Hello {{user}}',
  })
  doc.book = [
    {
      id: 'b',
      title: 'Harbor',
      keys: 'sea',
      content: 'A harbor',
      constant: false,
      enabled: true,
      order: 100,
    },
  ]
  doc.cards = [{ id: 'c', draft: { ...doc.drafts.tavern, name: 'Captain' }, book: [] }]
  const scenario = importScenario(scenarioFile(scenarioFromStudio(doc)))
  expect(scenario.cards.map((c) => c.draft.name)).toEqual(['Guide', 'Captain'])
  expect(scenario.cards[0].book[0].content).toBe('A harbor')
  expect(scenario.opening).toBe('Hello {{user}}')
  doc.scenarios = [scenario]
  doc.modules = trpgPresets()
  validateStudio(doc)
  const db = new Database()
  await db.open()
  try {
    const p = await db.createProject('Cards', '', 'tavern')
    db.saveStudio(p.id, doc)
    const json = await db.exportProjectJSON(p.id)
    const copy = await db.importProjectJSON(json)
    expect(db.getStudio(copy.id).scenarios).toEqual(doc.scenarios)
    expect(db.getStudio(copy.id).modules).toEqual(doc.modules)
  } finally {
    db.close()
  }
  expect(() =>
    importScenario({ spec: 'wdworld_scenario', version: 1, title: 'x', scene: '', opening: '', cards: [] }),
  ).toThrow()
})
it('imports original modules, private text notes and world JSON without fabricating session history', () => {
  for (const module of trpgPresets()) {
    const restored = importModule(
      JSON.stringify(moduleFile({ ...module.draft, sessionLog: 'real play' }, [])),
      'test.json',
    )
    expect(restored.draft.name).toBe(module.draft.name)
    expect(restored.draft.secrets).not.toBe('')
    expect(restored.draft.sessionLog).toBe('')
  }
  const notes = importModule('# SECRET\nGM notes', 'adventure.md')
  expect(notes.draft.premise).toBe('')
  expect(notes.draft.scenes).toContain('SECRET')
  const world = importModule(
    JSON.stringify({
      project: { name: 'Sea' },
      entries: [
        { title: 'Harbor', type: 'location', content: '<p>Blue sea</p>' },
        { title: 'Old', type: 'lore', content: 'Archive', status: 'archived' },
      ],
    }),
    'world.json',
  )
  expect(world.settings).toEqual([{ title: 'Harbor', type: 'location', content: 'Blue sea' }])
  expect(world.draft.premise).toBe('')
  expect(() => importModule('text', 'book.pdf')).toThrow()
  expect(() => importModule('{"spec":"unknown"}', 'test.json')).toThrow()
})
