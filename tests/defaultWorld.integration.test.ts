import { describe, expect, it, vi } from 'vitest'
import type { Asset, Entry, EntryType, Tag } from '@/types'
import { Database } from '@/lib/storage/database'
import { BUILTIN_ASSET_PATHS } from '@/lib/assetSources'
import { seedMysteryRevivalWorld } from '@/lib/defaultWorld'

function makeEntry(projectId: string, type: EntryType, title: string, index: number): Entry {
  return {
    id: `entry-${index}`,
    projectId,
    type,
    title,
    slug: `entry-${index}`,
    summary: '',
    content: '',
    status: 'draft',
    visibility: 'private',
    region: '',
    condition: '',
    occupants: '',
    coverAssetId: null,
    mapPositionX: null,
    mapPositionY: null,
    anchorId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    archivedAt: null,
  }
}

describe('mystery revival example world', () => {
  it('seeds a connected, illustrated and mapped example project', async () => {
    let entryIndex = 0
    let tagIndex = 0
    let assetIndex = 0
    const entries: Entry[] = []
    const tags: Tag[] = []
    const database = {
      createTag: vi.fn(async (projectId: string, name: string, color?: string): Promise<Tag> => {
        const tag = {
          id: `tag-${++tagIndex}`,
          projectId,
          name,
          color: color ?? null,
          createdAt: '2026-01-01T00:00:00.000Z',
        }
        tags.push(tag)
        return tag
      }),
      getTags: vi.fn(async () => tags),
      createEntry: vi.fn(async (projectId: string, type: EntryType, title: string) => {
        const entry = makeEntry(projectId, type, title, ++entryIndex)
        entries.push(entry)
        return entry
      }),
      listEntries: vi.fn(async () => entries),
      updateEntry: vi.fn(async () => undefined),
      addTagToEntry: vi.fn(async () => undefined),
      createAlias: vi.fn(async () => undefined),
      createRelation: vi.fn(async () => undefined),
      addBacklink: vi.fn(async () => undefined),
      createEra: vi.fn(async () => undefined),
      createTimelineEvent: vi.fn(async () => undefined),
      createAnchor: vi.fn(async () => ({ id: 'anchor-1' })),
      updateEntryAnchor: vi.fn(async () => undefined),
      listFieldSchemas: vi.fn(async () => []),
      createCustomFieldSchema: vi.fn(async (_projectId: string, schema: { id: string }) => schema),
      upsertFieldValue: vi.fn(async () => undefined),
      getTemplates: vi.fn(async () => []),
      createTemplate: vi.fn(async () => undefined),
      createAsset: vi.fn(
        async (
          projectId: string,
          kind: Asset['kind'],
          filename: string,
          relativePath: string,
          mimeType: string,
          size: number,
        ): Promise<Asset> => ({
          id: `asset-${++assetIndex}`,
          projectId,
          kind,
          filename,
          relativePath,
          mimeType,
          size,
          checksum: null,
          createdAt: '2026-01-01T00:00:00.000Z',
        }),
      ),
      updateEntryCoverAsset: vi.fn(async () => undefined),
      updateEntryMapPosition: vi.fn(async () => undefined),
    } as unknown as Database

    const result = await seedMysteryRevivalWorld(database, 'example-project')

    expect(database.createEntry).toHaveBeenCalledTimes(15)
    expect(database.createTag).toHaveBeenCalledTimes(6)
    expect(database.createRelation).toHaveBeenCalledTimes(17)
    expect(database.createTimelineEvent).toHaveBeenCalledTimes(7)
    expect(database.createAsset).toHaveBeenCalledTimes(4)
    expect(database.updateEntryCoverAsset).toHaveBeenCalledTimes(3)
    expect(database.updateEntryMapPosition).toHaveBeenCalledTimes(9)
    expect(database.createAlias).toHaveBeenCalledTimes(5)
    expect(database.addBacklink).toHaveBeenCalledTimes(3)
    expect(database.createAnchor).toHaveBeenCalledTimes(1)
    expect(database.createCustomFieldSchema).toHaveBeenCalledTimes(1)
    expect(database.createTemplate).toHaveBeenCalledTimes(1)
    expect(database.createAsset).toHaveBeenCalledWith(
      'example-project',
      'map_image',
      '临江市调查地图.png',
      BUILTIN_ASSET_PATHS.map,
      'image/png',
      2838691,
    )
    expect(result.mapAssetId).toBe('asset-1')
  })

  it('creates a feature-complete example in a real database', async () => {
    const database = new Database()
    await database.open()
    const project = await database.createProject('雾港档案集成测试')

    await seedMysteryRevivalWorld(database, project.id)

    const entries = await database.listEntries(project.id)
    const entryByTitle = new Map(entries.map((entry) => [entry.title, entry]))
    const silenceIncident = entryByTitle.get('七中静默事件')
    const analyst = entryByTitle.get('周岚')
    const broadcastRoom = entryByTitle.get('七中旧广播室')

    expect(entries).toHaveLength(15)
    expect(silenceIncident).toBeDefined()
    expect(analyst).toBeDefined()
    expect(broadcastRoom?.anchorId).not.toBeNull()
    expect(await database.getEntryAliases(analyst!.id)).toHaveLength(1)
    expect(await database.getRelations(project.id)).toHaveLength(17)
    expect(await database.getBacklinks(silenceIncident!.id)).toHaveLength(1)
    expect(await database.getTimelineEvents(silenceIncident!.id)).toHaveLength(4)
    expect(await database.getTemplates(project.id)).toHaveLength(1)
    expect(await database.getEntryFieldValues(silenceIncident!.id)).toEqual([
      expect.objectContaining({ fieldId: 'example_event_risk', value: 'A级' }),
    ])

    const clueTag = (await database.getTags(project.id)).find((tag) => tag.name === '调查线索')
    expect(clueTag).toBeDefined()
    expect((await database.searchByTag(project.id, clueTag!.id)).map((entry) => entry.title)).toEqual(
      expect.arrayContaining(['周岚', '陈渡', '七中静默事件', '证物：1998届合照']),
    )
  })
})
