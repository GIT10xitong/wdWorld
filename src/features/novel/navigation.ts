export type NovelSection =
  'write' | 'board' | 'resources' | 'agents' | 'polish' | 'analysis' | 'memory' | 'panels' | 'health' | 'lore'
export type NovelDestination = NovelSection | 'journey'
let destination: NovelDestination = 'write'
export const setNovelDestination = (next: NovelDestination) => {
  destination = next
}
export const getNovelDestination = () => destination
