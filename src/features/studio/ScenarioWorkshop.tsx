import { useState } from 'react'
import { saveAs } from 'file-saver'
import { t } from '@/lib/i18n'
import type { ScenarioCard, StudioDocument } from './model'
import { scenarioFile, scenarioFromStudio, importScenario } from './scenario'

export function ScenarioWorkshop({
  doc,
  change,
  disabled,
  onError,
}: {
  doc: StudioDocument
  change: (fn: (d: StudioDocument) => StudioDocument) => void
  disabled: boolean
  onError: (s: string) => void
}) {
  const [selected, setSelected] = useState('')
  const [pending, setPending] = useState<ScenarioCard | null>(null)
  const act = async (fn: () => void | Promise<void>) => {
    try {
      onError('')
      await fn()
    } catch (e) {
      onError(e instanceof Error ? e.message : t('操作失败'))
    }
  }
  return (
    <section className="studio-card studio-workshop">
      <h2>{t('角色场景卡')}</h2>
      <p>{t('把当前角色、收藏角色、场景、开场白和世界书保存为一套可复用的场景卡。')}</p>
      <fieldset disabled={disabled}>
        <button
          onClick={() =>
            void act(() => {
              if ((doc.scenarios?.length || 0) >= 100) throw new Error(t('场景卡最多 100 张'))
              const card = scenarioFromStudio(doc)
              change((d) => ({ ...d, scenarios: [...(d.scenarios || []), card] }))
              setSelected(card.id)
            })
          }
        >
          {t('保存角色场景卡')}
        </button>
        <label>
          {t('选择场景卡')}
          <select aria-label={t('选择场景卡')} value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">{t('选择场景卡')}</option>
            {(doc.scenarios || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
        <button
          disabled={!selected}
          onClick={() => {
            const card = doc.scenarios?.find((c) => c.id === selected)
            if (card) setPending(structuredClone(card))
          }}
        >
          {t('预览场景卡')}
        </button>
        <button
          disabled={!selected}
          onClick={() =>
            void act(() => {
              const card = doc.scenarios!.find((c) => c.id === selected)!
              saveAs(
                new Blob([JSON.stringify(scenarioFile(card), null, 2)], { type: 'application/json' }),
                card.title.replace(/[<>:"/\\|?*]/g, '_') + '.scenario.json',
              )
            })
          }
        >
          {t('导出场景卡')}
        </button>
        <label>
          {t('导入场景卡')}
          <input
            type="file"
            accept=".json"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file)
                void act(async () => {
                  if (file.size > 4 * 1024 * 1024) throw new Error(t('导入文件不能超过 4 MB'))
                  setPending(importScenario(JSON.parse(await file.text())))
                })
            }}
          />
        </label>
        {pending && (
          <div className="studio-book">
            <h3>{pending.title}</h3>
            <pre>{pending.scene}</pre>
            <pre>{pending.opening}</pre>
            <p>{pending.cards.map((c) => c.draft.name).join(' / ')}</p>
            <p>{t('载入将替换当前角色草稿和世界书，并把场景内角色加入收藏；现有收藏会保留。')}</p>
            <button
              onClick={() =>
                void act(() => {
                  const additions = pending.cards.filter(
                    (c) =>
                      !(doc.cards || []).some(
                        (old) => JSON.stringify([old.draft, old.book]) === JSON.stringify([c.draft, c.book]),
                      ),
                  )
                  if ((doc.cards?.length || 0) + additions.length > 100)
                    throw new Error(t('角色卡收藏最多 100 张'))
                  const exists = doc.scenarios?.some((c) => c.id === pending.id)
                  if (!exists && (doc.scenarios?.length || 0) >= 100) throw new Error(t('场景卡最多 100 张'))
                  change((d) => ({
                    ...d,
                    drafts: {
                      ...d.drafts,
                      tavern: {
                        ...pending.cards[0].draft,
                        scenario: pending.scene,
                        first_mes: pending.opening,
                      },
                    },
                    book: pending.book,
                    cards: [...(d.cards || []), ...additions],
                    scenarios: exists ? d.scenarios : [...(d.scenarios || []), pending],
                  }))
                  setSelected(pending.id)
                  setPending(null)
                })
              }
            >
              {t('确认载入场景卡')}
            </button>
            <button onClick={() => setPending(null)}>{t('取消')}</button>
          </div>
        )}
      </fieldset>
    </section>
  )
}
