export type EntryType = 'character' | 'location' | 'faction' | 'item' | 'event' | 'lore' | 'region' | 'note'

export type EntryStatus = 'draft' | 'active' | 'complete' | 'archived'

export type EntryVisibility = 'private' | 'internal' | 'public_exportable'

export type RelationDirection = 'directed' | 'bidirectional'

export type AssetKind = 'cover' | 'image' | 'attachment' | 'map_image'

export interface Project {
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
  character: '人物',
  location: '地点',
  faction: '组织',
  item: '物品',
  event: '事件',
  lore: '设定',
  region: '区域',
  note: '笔记',
}

export const ENTRY_STATUS_LABELS: Record<EntryStatus, string> = {
  draft: '草稿',
  active: '活跃',
  complete: '完成',
  archived: '已归档',
}

export const RELATION_TYPES = [
  'member_of',
  'leader_of',
  'located_in',
  'part_of',
  'allied_with',
  'enemy_of',
  'parent_of',
  'child_of',
  'owns',
  'created',
  'discovered',
  'participated_in',
  'caused',
  'mentions',
  '驻守于',
  '隶属',
  '对抗',
  '合作',
]