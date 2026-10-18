import { FilePicker } from '@/components/FilePicker'
import { useState } from 'react'
import { CollectionPicker } from './CollectionPicker'
import { saveAs } from 'file-saver'
import { t } from '@/lib/i18n'
import { generateId } from '@/lib/utils'
import { useStore } from '@/store'
import type { Database } from '@/lib/storage/database'
import type { StudioDocument } from './model'
import { draftWorldSettings } from './worldSettings'
import { importModule, moduleFile, trpgPresets, type TrpgModule } from './trpg'

export function TrpgWorkshop({
  doc,
  change,
  disabled,
  database,
  projectId,
  onError,
  flush,
  random,
  onLoaded,
}: {
  doc: StudioDocument
  change: (fn: (d: StudioDocument) => StudioDocument) => void
  disabled: boolean
  database: Database
  projectId: string
  onError: (v: string) => void
  flush: () => Promise<void>
  random: () => void
  onLoaded: () => void
}) {
  const [pending, setPending] = useState<TrpgModule | null>(null)
  const [selected, setSelected] = useState('preset-0')
  const [loading, setLoading] = useState(false)
  const choices = [...trpgPresets(), ...(doc.modules || [])]
  const save = () => {
    if (!doc.drafts.trpg.name.trim()) throw new Error(t('请先填写团务名称'))
    if ((doc.modules?.length || 0) >= 100) throw new Error(t('副本库最多 100 个'))
    const id = generateId('module')
    change((d) => ({
      ...d,
      modules: [
        ...(d.modules || []),
        {
          id,
          draft: { ...d.drafts.trpg, sessionLog: '' },
          settings: draftWorldSettings('trpg', d.drafts.trpg, JSON.stringify(d.drafts.trpg), []),
        },
      ],
    }))
    setSelected(id)
  }
  const act = async (fn: () => void | Promise<void>) => {
    setLoading(true)
    onError('')
    try {
      await fn()
      await flush()
    } catch (e) {
      onError(e instanceof Error ? e.message : t('操作失败'))
    } finally {
      setLoading(false)
    }
  }
  return (
    <section className="studio-card studio-workshop">
      <h2>{t('TRPG 副本与世界库')}</h2>
      <fieldset disabled={disabled || loading}>
        <button className="studio-primary" onClick={random}>
          {t('一键随机 TRPG 世界')}
        </button>
        <p>
          {t(
            '根据已有设定和随机种子生成世界与副本；留空时自由随机。预设为原创、无系统短篇，可按你的规则改编。',
          )}
        </p>
        <CollectionPicker
          label={t('选择跑团副本')}
          value={selected}
          onChange={setSelected}
          allowEmpty={false}
          items={choices.map((m) => ({ id: m.id, title: m.draft.name, description: m.draft.premise }))}
        />
        <button
          disabled={!selected}
          onClick={() => setPending(structuredClone(choices.find((m) => m.id === selected) || choices[0]))}
        >
          {t('预览所选副本')}
        </button>
        <button onClick={() => void act(save)}>{t('保存当前副本')}</button>
        <button
          onClick={() =>
            void act(() => {
              const settings = draftWorldSettings(
                'trpg',
                doc.drafts.trpg,
                JSON.stringify(doc.drafts.trpg),
                [],
              )
              saveAs(
                new Blob([JSON.stringify(moduleFile(doc.drafts.trpg, settings), null, 2)], {
                  type: 'application/json',
                }),
                (doc.drafts.trpg.name || 'trpg').replace(/[<>:"/\\|?*]/g, '_') + '.trpg.json',
              )
            })
          }
        >
          {t('导出 TRPG 副本')}
        </button>
        <FilePicker
          label={t('导入世界或跑团文件')}
          accept=".json,.txt,.md,.markdown"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file)
              void act(async () => {
                if (file.size > 2 * 1024 * 1024) throw new Error(t('跑团资料不能超过 2 MB'))
                setPending(importModule(await file.text(), file.name))
              })
          }}
        />
        <p>
          {t('支持副本 JSON、世界观导出 JSON、TXT、Markdown。文本资料先载入主持人场景草稿，不会自动公开。')}
        </p>
        {pending && (
          <div className="studio-book">
            <h3>{pending.draft.name}</h3>
            <pre>{pending.draft.premise || pending.draft.scenes}</pre>
            <p>
              {t('载入会替换备团草稿，并同步设定到世界观；实际跑团记录会保留。副本同时加入本项目副本库。')}
            </p>
            <button
              onClick={() =>
                void act(async () => {
                  if ((doc.modules?.length || 0) >= 100) throw new Error(t('副本库最多 100 个'))
                  const settings = [
                    ...pending.settings,
                    ...draftWorldSettings('trpg', pending.draft, JSON.stringify(pending.draft), []),
                  ]
                  const ids = await database.publishGeneratedSettings(projectId, settings)
                  const module = { ...pending, id: generateId('module'), settings: pending.settings }
                  const next = {
                    ...doc,
                    drafts: {
                      ...doc.drafts,
                      trpg: { ...pending.draft, sessionLog: doc.drafts.trpg.sessionLog },
                    },
                    modules: [...(doc.modules || []), module],
                  }
                  await database.confirmGeneratedSettings(projectId, ids, () =>
                    database.saveStudio(projectId, next),
                  )
                  change(() => next)
                  await useStore.getState().fetchEntries()
                  setPending(null)
                  setSelected(module.id)
                  onLoaded()
                })
              }
            >
              {t('确认载入副本')}
            </button>
            <button onClick={() => setPending(null)}>{t('取消')}</button>
          </div>
        )}
      </fieldset>
    </section>
  )
}
