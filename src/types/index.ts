import { t } from '@/lib/i18n'
export type EntryType = 'character' | 'location' | 'faction' | 'item' | 'event' | 'lore' | 'region' | 'note'

export type CustomFieldType =
  'text' | 'text_long' | 'number' | 'date' | 'select' | 'multiselect' | 'boolean' | 'color' | 'image'

export interface CustomFieldSchema {
  id: string
  key: string
  label: string
  type: CustomFieldType
  entryType?: EntryType
  required?: boolean
  options?: string[]
  placeholder?: string
  defaultValue?: unknown
  sortOrder: number
  group?: string
}

export interface CustomFieldValue {
  entryId: string
  fieldId: string
  value: unknown
  updatedAt: string
}

export const BUILTIN_FIELD_SCHEMAS: CustomFieldSchema[] = [
  {
    id: 'chr_gender',
    key: 'gender',
    get label() {
      return t('性别')
    },
    type: 'select',
    entryType: 'character',
    options: ['男', '女', '非二元', '未知', '其他'],
    get group() {
      return t('基础信息')
    },
    sortOrder: 10,
  },
  {
    id: 'chr_age',
    key: 'age',
    get label() {
      return t('年龄')
    },
    type: 'number',
    entryType: 'character',
    get group() {
      return t('基础信息')
    },
    sortOrder: 11,
  },
  {
    id: 'chr_birthday',
    key: 'birthday',
    get label() {
      return t('生日/诞生日')
    },
    type: 'text',
    entryType: 'character',
    get group() {
      return t('基础信息')
    },
    sortOrder: 12,
  },
  {
    id: 'chr_race',
    key: 'race',
    get label() {
      return t('种族/族群')
    },
    type: 'text',
    entryType: 'character',
    get group() {
      return t('基础信息')
    },
    sortOrder: 13,
  },
  {
    id: 'chr_height',
    key: 'height',
    get label() {
      return t('身高(cm)')
    },
    type: 'number',
    entryType: 'character',
    get group() {
      return t('外貌')
    },
    sortOrder: 20,
  },
  {
    id: 'chr_weight',
    key: 'weight',
    get label() {
      return t('体重(kg)')
    },
    type: 'number',
    entryType: 'character',
    get group() {
      return t('外貌')
    },
    sortOrder: 21,
  },
  {
    id: 'chr_appearance',
    key: 'appearance',
    get label() {
      return t('外貌特征')
    },
    type: 'text_long',
    entryType: 'character',
    get group() {
      return t('外貌')
    },
    sortOrder: 22,
  },
  {
    id: 'chr_occupation',
    key: 'occupation',
    get label() {
      return t('职业/身份')
    },
    type: 'text',
    entryType: 'character',
    get group() {
      return t('社会属性')
    },
    sortOrder: 30,
  },
  {
    id: 'chr_faction',
    key: 'faction_affiliation',
    get label() {
      return t('所属势力')
    },
    type: 'text',
    entryType: 'character',
    get group() {
      return t('社会属性')
    },
    sortOrder: 31,
  },
  {
    id: 'chr_personality',
    key: 'personality',
    get label() {
      return t('性格')
    },
    type: 'text_long',
    entryType: 'character',
    get group() {
      return t('内在')
    },
    sortOrder: 40,
  },
  {
    id: 'chr_motivation',
    key: 'motivation',
    get label() {
      return t('动机/目标')
    },
    type: 'text_long',
    entryType: 'character',
    get group() {
      return t('内在')
    },
    sortOrder: 41,
  },
  {
    id: 'chr_skills',
    key: 'skills',
    get label() {
      return t('能力/技能')
    },
    type: 'text_long',
    entryType: 'character',
    get group() {
      return t('能力')
    },
    sortOrder: 50,
  },
  {
    id: 'chr_weapon',
    key: 'weapon',
    get label() {
      return t('常用武器')
    },
    type: 'text',
    entryType: 'character',
    get group() {
      return t('能力')
    },
    sortOrder: 51,
  },

  {
    id: 'loc_population',
    key: 'population',
    get label() {
      return t('人口')
    },
    type: 'text',
    entryType: 'location',
    get group() {
      return t('基本属性')
    },
    sortOrder: 10,
  },
  {
    id: 'loc_climate',
    key: 'climate',
    get label() {
      return t('气候/地形')
    },
    type: 'text',
    entryType: 'location',
    get group() {
      return t('基本属性')
    },
    sortOrder: 11,
  },
  {
    id: 'loc_specialty',
    key: 'specialty',
    get label() {
      return t('特产/资源')
    },
    type: 'text_long',
    entryType: 'location',
    get group() {
      return t('经济')
    },
    sortOrder: 20,
  },
  {
    id: 'loc_government',
    key: 'government',
    get label() {
      return t('管理方式/统治者')
    },
    type: 'text',
    entryType: 'location',
    get group() {
      return t('政治')
    },
    sortOrder: 30,
  },
  {
    id: 'loc_defense',
    key: 'defense',
    get label() {
      return t('防御工事')
    },
    type: 'text_long',
    entryType: 'location',
    get group() {
      return t('政治')
    },
    sortOrder: 31,
  },

  {
    id: 'itm_rarity',
    key: 'rarity',
    get label() {
      return t('稀有度')
    },
    type: 'select',
    entryType: 'item',
    options: ['普通', '稀有', '史诗', '传说', '神器'],
    get group() {
      return t('基本属性')
    },
    sortOrder: 10,
  },
  {
    id: 'itm_category',
    key: 'category',
    get label() {
      return t('分类')
    },
    type: 'select',
    entryType: 'item',
    options: ['武器', '防具', '饰品', '消耗品', '材料', '卷轴', '法器', '生活物品', '其他'],
    get group() {
      return t('基本属性')
    },
    sortOrder: 11,
  },
  {
    id: 'itm_owner',
    key: 'owner',
    get label() {
      return t('当前持有者')
    },
    type: 'text',
    entryType: 'item',
    get group() {
      return t('归属')
    },
    sortOrder: 20,
  },
  {
    id: 'itm_effect',
    key: 'effect',
    get label() {
      return t('效果/能力')
    },
    type: 'text_long',
    entryType: 'item',
    get group() {
      return t('属性')
    },
    sortOrder: 30,
  },
  {
    id: 'itm_origin',
    key: 'origin',
    get label() {
      return t('出处/历史')
    },
    type: 'text_long',
    entryType: 'item',
    get group() {
      return t('背景')
    },
    sortOrder: 40,
  },

  {
    id: 'gen_color',
    key: 'theme_color',
    get label() {
      return t('主题色')
    },
    type: 'color',
    sortOrder: 100,
  },
  {
    id: 'gen_inspiration',
    key: 'inspiration',
    get label() {
      return t('灵感来源')
    },
    type: 'text',
    sortOrder: 101,
  },
]

export type EntryStatus = 'draft' | 'proposed' | 'active' | 'complete' | 'archived'

export type EntryVisibility = 'private' | 'internal' | 'public_exportable'

export type RelationDirection = 'directed' | 'bidirectional'

export type AssetKind = 'cover' | 'image' | 'attachment' | 'map_image'

export type CreationMode = 'novel' | 'oc' | 'trpg' | 'tavern' | 'free'
export interface Project {
  mode?: CreationMode
  id: string
  name: string
  slug: string
  description: string
  schemaVersion: number
  createdAt: string
  updatedAt: string
}

export interface ProjectSummary {
  id: string
  name: string
  slug: string
  description: string
  entryCount: number
  createdAt: string
  updatedAt: string
}

export interface Entry {
  id: string
  projectId: string
  type: EntryType
  title: string
  slug: string
  summary: string
  content: string
  status: EntryStatus
  visibility: EntryVisibility
  region: string
  condition: string
  occupants: string
  coverAssetId: string | null
  mapPositionX: number | null
  mapPositionY: number | null
  anchorId: string | null
  createdAt: string
  updatedAt: string
  archivedAt: string | null
}

export interface EntryListItem {
  id: string
  type: EntryType
  title: string
  slug: string
  summary: string
  status: EntryStatus
  tags: string[]
  updatedAt: string
}

export interface Tag {
  id: string
  projectId: string
  name: string
  color: string | null
  createdAt: string
}

export interface Alias {
  id: string
  entryId: string
  value: string
  normalizedValue: string
}

export interface Relation {
  id: string
  projectId: string
  sourceEntryId: string
  targetEntryId: string
  type: string
  direction: RelationDirection
  note: string
  createdAt: string
  updatedAt: string
}

export interface Asset {
  id: string
  projectId: string
  kind: AssetKind
  filename: string
  relativePath: string
  mimeType: string
  size: number
  checksum: string | null
  createdAt: string
}

export interface Backlink {
  id: string
  projectId: string
  sourceEntryId: string
  targetEntryId: string
  linkText: string
  createdAt: string
}

export interface Anchor {
  id: string
  entryId: string
  label: string
  x: number
  y: number
  notes: string
  createdAt: string
}

export interface TimelineEvent {
  id: string
  entryId: string
  pointLabel: string
  title: string
  sortValue: number
  description: string
  createdAt: string
}

export interface Era {
  id: string
  projectId: string
  parentId: string | null
  name: string
  shortName: string
  startSortValue: number
  endSortValue: number
  description: string
  color: string
  createdAt: string
}

export interface Template {
  id: string
  projectId: string
  name: string
  type: EntryType
  description: string
  content: string
  tags: string[]
  aliases: string[]
  createdAt: string
  updatedAt: string
}

export interface SearchResult {
  id: string
  title: string
  summary: string
  type: EntryType
  matchType: 'title' | 'content' | 'tag'
  snippet?: string
}

export interface RecentProject {
  mode?: CreationMode
  id: string
  name: string
  path: string
  lastOpened: string
}

export interface CreateEntryParams {
  type: EntryType
  title: string
  summary?: string
  content?: string
}

export interface UpdateEntryParams {
  title?: string
  summary?: string
  content?: string
  status?: EntryStatus
  visibility?: EntryVisibility
  region?: string
  condition?: string
  occupants?: string
}

export const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  get character() {
    return t('人物')
  },
  get location() {
    return t('地点')
  },
  get faction() {
    return t('组织')
  },
  get item() {
    return t('物品')
  },
  get event() {
    return t('事件')
  },
  get lore() {
    return t('设定')
  },
  get region() {
    return t('区域')
  },
  get note() {
    return t('笔记')
  },
}

export const ENTRY_STATUS_LABELS: Record<EntryStatus, string> = {
  get proposed() {
    return t('AI 待确认')
  },
  get draft() {
    return t('草稿')
  },
  get active() {
    return t('活跃')
  },
  get complete() {
    return t('完成')
  },
  get archived() {
    return t('已归档')
  },
}

export const RELATION_TYPE_META: Record<string, { label: string; color?: string; symmetric?: boolean }> = {
  member_of: {
    get label() {
      return t('隶属')
    },
    color: '#a855f7',
  },
  leader_of: {
    get label() {
      return t('领导')
    },
    color: '#f97316',
  },
  located_in: {
    get label() {
      return t('位于')
    },
    color: '#22c55e',
  },
  part_of: {
    get label() {
      return t('部分属于')
    },
    color: '#06b6d4',
  },
  allied_with: {
    get label() {
      return t('盟友')
    },
    color: '#3b82f6',
    symmetric: true,
  },
  enemy_of: {
    get label() {
      return t('敌对')
    },
    color: '#ef4444',
    symmetric: true,
  },
  parent_of: {
    get label() {
      return t('父母/长辈')
    },
    color: '#f59e0b',
  },
  child_of: {
    get label() {
      return t('子女/晚辈')
    },
    color: '#ec4899',
  },
  owns: {
    get label() {
      return t('拥有')
    },
    color: '#84cc16',
  },
  created: {
    get label() {
      return t('创造')
    },
    color: '#14b8a6',
  },
  discovered: {
    get label() {
      return t('发现')
    },
    color: '#0ea5e9',
  },
  participated_in: {
    get label() {
      return t('参与')
    },
    color: '#8b5cf6',
  },
  caused: {
    get label() {
      return t('导致')
    },
    color: '#dc2626',
  },
  mentions: {
    get label() {
      return t('提及')
    },
    color: '#64748b',
  },
  colleague_of: {
    get label() {
      return t('同事')
    },
    color: '#6366f1',
    symmetric: true,
  },
  friend_of: {
    get label() {
      return t('朋友')
    },
    color: '#10b981',
    symmetric: true,
  },
  relative_of: {
    get label() {
      return t('亲属')
    },
    color: '#f97316',
    symmetric: true,
  },
  teacher_of: {
    get label() {
      return t('师徒')
    },
    color: '#0ea5e9',
  },
  user_of: {
    get label() {
      return t('使用者')
    },
    color: '#84cc16',
  },
  rival_of: {
    get label() {
      return t('对手')
    },
    color: '#ef4444',
    symmetric: true,
  },
  related: {
    get label() {
      return t('相关')
    },
    color: '#6b7280',
    symmetric: true,
  },
  stationed_at: {
    get label() {
      return t('驻守于')
    },
    color: '#a855f7',
  },
}

export const RELATION_TYPE_KEYS: string[] = Object.keys(RELATION_TYPE_META)

export const RELATION_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(RELATION_TYPE_META).map(([key, meta]) => [key, meta.label]),
)
