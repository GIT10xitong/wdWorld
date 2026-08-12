import type { Asset, EntryType } from '@/types'
import linjiangMapUrl from '@/assets/linjiang-investigation-map.png'
import linMoUrl from '@/assets/sample/lin-mo.png'
import blackUmbrellaUrl from '@/assets/sample/black-umbrella.png'
import seventhSchoolUrl from '@/assets/sample/seventh-school.png'
import characterPlaceholderUrl from '@/assets/placeholders/character.png'
import locationPlaceholderUrl from '@/assets/placeholders/location.png'
import factionPlaceholderUrl from '@/assets/placeholders/faction.png'
import itemPlaceholderUrl from '@/assets/placeholders/item.png'

export const BUILTIN_ASSET_PATHS = {
  map: '__builtin__/linjiang-investigation-map.png',
  linMo: '__builtin__/sample/lin-mo.png',
  blackUmbrella: '__builtin__/sample/black-umbrella.png',
  seventhSchool: '__builtin__/sample/seventh-school.png',
} as const

const builtInSources: Record<string, string> = {
  [BUILTIN_ASSET_PATHS.map]: linjiangMapUrl,
  [BUILTIN_ASSET_PATHS.linMo]: linMoUrl,
  [BUILTIN_ASSET_PATHS.blackUmbrella]: blackUmbrellaUrl,
  [BUILTIN_ASSET_PATHS.seventhSchool]: seventhSchoolUrl,
}

const entryPlaceholderSources: Record<EntryType, string> = {
  character: characterPlaceholderUrl,
  location: locationPlaceholderUrl,
  region: locationPlaceholderUrl,
  event: locationPlaceholderUrl,
  faction: factionPlaceholderUrl,
  lore: factionPlaceholderUrl,
  item: itemPlaceholderUrl,
  note: itemPlaceholderUrl,
}

export function getEntryPlaceholderSource(type: EntryType): string {
  return entryPlaceholderSources[type]
}

export function resolveAssetSource(asset: Asset | undefined, fallback = ''): string {
  if (!asset) return fallback

  const builtIn = builtInSources[asset.relativePath]
  if (builtIn) return builtIn

  const stored =
    localStorage.getItem(`wdworld_asset_${asset.relativePath}`) ??
    localStorage.getItem(`wdworld_asset_${asset.id}`)
  if (!stored) return fallback
  return stored.startsWith('data:') ? stored : `data:${asset.mimeType};base64,${stored}`
}
