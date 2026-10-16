import trpg from './fixtures/plugins/wdworld.trpg.json'
import tavern from './fixtures/plugins/wdworld.tavern.json'
import { setPlugins, type InstalledPlugin } from '@/features/plugins/store'
export function enableTestModes() {
  setPlugins(
    [trpg, tavern].map((manifest) => ({
      manifest,
      enabled: true,
      source: 'test',
      sha256: '',
      settings: { endpoint: '', model: '', voice: '', hasKey: false },
    })) as InstalledPlugin[],
  )
}
