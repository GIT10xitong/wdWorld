import { getLanguage } from '@/lib/i18n'
import type { Entry, Relation } from '@/types'
import { FIELDS, type StudioDocument } from './model'

export type HomeMode = 'oc' | 'trpg' | 'tavern'
export const st = (zh: string, en: string) => (getLanguage() === 'en' ? en : zh)
export const homeProfile = (mode: HomeMode) =>
  ({
    oc: {
      code: 'CHARACTER ATELIER',
      title: st('角色创作室', 'Character atelier'),
      headline: st('让角色拥有自己的生命。', 'Give your characters a life of their own.'),
      description: st(
        '从一个鲜明的动机出发，连接外貌、经历与关系，逐步建立完整的人物档案。',
        'Start with a motive. Connect appearance, history and relationships into a complete character.',
      ),
      collection: st('角色企划', 'Character projects'),
      edit: st('编辑人物档案', 'Edit character profile'),
      features: [
        st('人物档案', 'Character profiles'),
        st('关系与成长', 'Relationships & growth'),
        st('展示与设定', 'Presentation & lore'),
      ],
    },
    trpg: {
      code: 'GAME MASTER DESK',
      title: st('主持人准备台', 'Game master desk'),
      headline: st('准备一个值得冒险的夜晚。', 'Prepare a night worth adventuring through.'),
      description: st(
        '整理副本、场景与线索，检查开团准备；由你决定何时公开资料、推进剧情。',
        'Prepare modules, scenes and clues. Decide what to reveal and when the story moves forward.',
      ),
      collection: st('团务档案', 'Campaign archives'),
      edit: st('继续备团', 'Prepare campaign'),
      features: [
        st('副本与世界库', 'Modules & worlds'),
        st('线索与主持人笔记', 'Clues & GM notes'),
        st('局域网跑团', 'LAN sessions'),
      ],
    },
    tavern: {
      code: 'TAVERN CREATOR STUDIO',
      title: st('酒馆制作台', 'Tavern creator studio'),
      headline: st('从一张角色卡，开启一个世界。', 'A whole world, starting with one character card.'),
      description: st(
        '打磨角色卡、开场白与世界书，把场景保存为可复用卡片，再邀请伙伴加入。',
        'Craft cards, greetings and lorebooks. Save reusable scenes and invite others to play.',
      ),
      collection: st('酒馆作品', 'Tavern projects'),
      edit: st('制作角色卡', 'Craft character card'),
      features: [
        st('角色卡工坊', 'Character card workshop'),
        st('世界书与触发词', 'Lorebooks & triggers'),
        st('场景与多人联机', 'Scenes & multiplayer'),
      ],
    },
  })[mode]

// Derived from the current document; no persisted counters or synthetic activity.
export function studioOverview(mode: HomeMode, doc: StudioDocument, entries: Entry[], relations: Relation[]) {
  const live = entries.filter((e) => e.status !== 'archived')
  const ids = new Set(live.map((e) => e.id))
  const characters = live.filter((e) => e.type === 'character')
  const draft = doc.drafts[mode]
  const fields = Object.entries(FIELDS[mode]).map(([key, label]) => ({
    key,
    label,
    ready: !!draft[key]?.trim(),
  }))
  return {
    live,
    characters,
    fields,
    filled: fields.filter((f) => f.ready).length,
    relations: relations.filter((r) => ids.has(r.sourceEntryId) && ids.has(r.targetEntryId)).length,
    pending: live.filter((e) => e.status === 'proposed').length,
    enabledBook: doc.book.filter((b) => b.enabled).length,
  }
}
