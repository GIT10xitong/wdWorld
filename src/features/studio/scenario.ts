import { generateId } from '@/lib/utils'
import { t } from '@/lib/i18n'
import type { ScenarioCard, StudioDocument } from './model'
import { characterCard, importCard, importBook, worldBook } from './tavern'

export function scenarioFromStudio(doc: StudioDocument): ScenarioCard {
  characterCard(doc.drafts.tavern, doc.book)
  const current = {
    id: generateId('card'),
    draft: structuredClone(doc.drafts.tavern),
    book: structuredClone(doc.book),
  }
  return {
    id: generateId('scenario'),
    title: doc.drafts.tavern.name,
    scene: doc.drafts.tavern.scenario,
    opening: doc.drafts.tavern.first_mes,
    cards: [
      current,
      ...(doc.cards || []).filter((c) => JSON.stringify(c.draft) !== JSON.stringify(current.draft)),
    ],
    book: structuredClone(doc.book),
  }
}
export function scenarioFile(card: ScenarioCard) {
  return {
    spec: 'wdworld_scenario',
    version: 1,
    title: card.title,
    scene: card.scene,
    opening: card.opening,
    cards: card.cards.map((c) => characterCard(c.draft, c.book)),
    worldbook: card.book.length ? worldBook(card.book) : { entries: [] },
  }
}
export function importScenario(value: unknown): ScenarioCard {
  const v = value as ReturnType<typeof scenarioFile>
  if (
    !v ||
    v.spec !== 'wdworld_scenario' ||
    v.version !== 1 ||
    ![v.title, v.scene, v.opening].every((s) => typeof s === 'string' && s.length <= 12000) ||
    !Array.isArray(v.cards) ||
    !v.cards.length ||
    v.cards.length > 100
  )
    throw new Error(t('场景卡格式无效'))
  return {
    id: generateId('scenario'),
    title: v.title,
    scene: v.scene,
    opening: v.opening,
    cards: v.cards.map((c) => ({ id: generateId('card'), ...importCard(c) })),
    book: importBook(v.worldbook),
  }
}
