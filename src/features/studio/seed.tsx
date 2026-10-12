import { t } from '@/lib/i18n'

export function newSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0].toString(36)
}

export function seedInstruction(mode: string, seed: string) {
  if (!seed.trim()) return ''
  let state = 2166136261
  for (const c of mode + ':' + seed.trim()) state = Math.imul(state ^ c.charCodeAt(0), 16777619)
  const pick = (items: string[]) => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return items[(state >>> 0) % items.length]
  }
  const focus: Record<string, string[]> = {
    novel: ['a costly promise', 'an unreliable ally', 'a hidden inheritance', 'a journey with a deadline'],
    oc: ['a contradictory desire', 'an unusual occupation', 'a guarded secret', 'a broken bond'],
    trpg: ['a missing witness', 'competing factions', 'a difficult rescue', 'a place that changes at night'],
    tavern: ['an unexpected reunion', 'a shared shelter', 'a curious bargain', 'an unfinished conversation'],
    simulation: [
      'a resource shortage',
      'a new discovery',
      'a shifting alliance',
      'a rule with an unexpected consequence',
    ],
  }
  return `Creative seed: ${seed.trim()}. Mode: ${mode}. Inspiration: ${pick(focus[mode] || focus.novel)}; tone: ${pick(['hopeful', 'mysterious', 'bittersweet', 'adventurous', 'warm', 'tense'])}; complication: ${pick(['a mistaken identity', 'a time limit', 'conflicting loyalties', 'an unexpected gift', 'a small choice with large consequences'])}. Use these as optional inspiration only where compatible with the supplied facts. When context exists, preserve all established facts and fill gaps; when empty, invent a complete starting concept suitable for this mode and task. Respect stage boundaries and output format. Never invent actual session history or claim a proposed event already happened. Answer in the language of the supplied draft, or the interface language if it is empty: ${t('中文')}.`
}

export function SeedControls({
  value,
  onChange,
  disabled = false,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <fieldset disabled={disabled} className="creative-seed">
      <label>
        {t('创作随机种子')}
        <input
          aria-label={t('创作随机种子')}
          maxLength={80}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t('留空关闭随机灵感')}
        />
      </label>
      <div className="studio-actions">
        <button type="button" onClick={() => onChange(newSeed())}>
          {t('换一个种子')}
        </button>
        <button type="button" onClick={() => onChange('')}>
          {t('关闭随机')}
        </button>
      </div>
      <p className="studio-muted">
        {t('有资料时依据设定随机，空白时按模式起稿。同一种子复用灵感方向，模型文字可能不同。')}
      </p>
    </fieldset>
  )
}
