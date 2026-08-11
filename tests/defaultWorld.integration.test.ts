import { describe, expect, it, vi } from 'vitest'
import type { Asset, Entry, EntryType, Tag } from '@/types'
import type { Database } from '@/lib/storage/database'
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
    const database = {
      createTag: vi.fn(async (projectId: string, name: string, color?: string): Promise<Tag> => ({
        id: `tag-${++tagIndex}`,
        projectId,
        name,
        color: color ?? null,
        createdAt: '2026-01-01T00:00:00.000Z',
      })),
      createEntry: vi.fn(async (projectId: string, type: EntryType, title: string) =>
        makeEntry(projectId, type, title, ++entryIndex),
      ),
      addTagToEntry: vi.fn(async () => undefined),
      createRelation: vi.fn(async () => undefined),
      createEra: vi.fn(async () => undefined),
      createTimelineEvent: vi.fn(async () => undefined),
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

    expect(database.createEntry).toHaveBeenCalledTimes(10)
    expect(database.createTag).toHaveBeenCalledTimes(4)
    expect(database.createRelation).toHaveBeenCalledTimes(8)
    expect(database.createTimelineEvent).toHaveBeenCalledTimes(3)
    expect(database.createAsset).toHaveBeenCalledTimes(4)
    expect(database.updateEntryCoverAsset).toHaveBeenCalledTimes(3)
    expect(database.updateEntryMapPosition).toHaveBeenCalledTimes(6)
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
})
