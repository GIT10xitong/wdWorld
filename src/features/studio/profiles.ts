import { t } from '@/lib/i18n'
import type { CreationMode, EntryType } from '@/types'

export const PROFILES: Record<
  CreationMode,
  { label: string; description: string; focus: EntryType[]; views: string[] }
> = {
  novel: {
    get label() {
      return t('小说 AI 辅助')
    },
    get description() {
      return t('故事规则、人物动机与时间线。按创作旅程逐步完成章节，再确认设定变更。')
    },
    focus: ['character', 'lore', 'event'],
    views: ['editor', 'wiki', 'graph', 'timeline', 'export', 'collab'],
  },
  oc: {
    get label() {
      return t('OC 创作者')
    },
    get description() {
      return t('以角色为中心，整理外貌、经历、关系与成长弧线，制作角色展示卡。')
    },
    focus: ['character', 'faction', 'item'],
    views: ['editor', 'wiki', 'graph', 'card', 'template', 'export', 'collab'],
  },
  trpg: {
    get label() {
      return t('TRPG 主持人')
    },
    get description() {
      return t('准备地点、阵营、线索与遭遇。主持人资料保留在本机，手动发布玩家资料。')
    },
    focus: ['location', 'faction', 'event', 'item'],
    views: ['editor', 'wiki', 'map', 'graph', 'timeline', 'template', 'export', 'collab'],
  },
  tavern: {
    get label() {
      return t('酒馆制作')
    },
    get description() {
      return t('编写角色卡、开场白和按关键词触发的世界书，开启多人角色扮演房间。')
    },
    focus: ['character', 'lore', 'location'],
    views: ['editor', 'wiki', 'graph', 'card', 'export', 'collab'],
  },
  free: {
    get label() {
      return t('自由模式')
    },
    get description() {
      return t('开放全部世界观工具，组合小说、OC 与已安装的模式插件。已有项目默认归入此模式。')
    },
    focus: [],
    views: ['editor', 'wiki', 'map', 'graph', 'timeline', 'template', 'export', 'collab', 'card'],
  },
}
export function creationMode(value: unknown): CreationMode {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PROFILES, value)
    ? (value as CreationMode)
    : 'free'
}
