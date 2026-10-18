import { FilePicker } from '@/components/FilePicker'
import { useState } from 'react'
import { CollectionPicker } from './CollectionPicker'
import { t } from '@/lib/i18n'
import { generateId } from '@/lib/utils'
import type { StudioDocument, Draft, BookEntry } from './model'
import { importCard, importBook, characterCard, activatedBook } from './tavern'

export function TavernWorkshop({
  doc,
  change,
  disabled,
  onError,
  onLoaded,
}: {
  doc: StudioDocument
  change: (fn: (doc: StudioDocument) => StudioDocument) => void
  disabled: boolean
  onError: (error: string) => void
  onLoaded: (target: 'draft' | 'book') => void
}) {
  const [pending, setPending] = useState<{ draft?: Draft; book: BookEntry[] } | null>(null)
  const [scan, setScan] = useState('')
  const [selected, setSelected] = useState('')
  const field = (key: string, value: string) =>
    change((d) => ({ ...d, drafts: { ...d.drafts, tavern: { ...d.drafts.tavern, [key]: value } } }))
  const read = async (file: File | undefined, kind: 'card' | 'book') => {
    if (!file) return
    try {
      if (file.size > 4 * 1024 * 1024) throw new Error(t('导入文件不能超过 4 MB'))
      const data = JSON.parse(await file.text())
      setPending(kind === 'card' ? importCard(data) : { book: importBook(data) })
      onError('')
    } catch (e) {
      onError(e instanceof Error ? e.message : t('导入失败'))
    }
  }
  return (
    <section className="studio-card">
      <h2>{t('角色卡工坊')}</h2>
      <fieldset disabled={disabled}>
        <details>
          <summary>{t('角色卡扩展字段')}</summary>
          <div className="studio-fields">
            {[
              ['creator', t('创作者')],
              ['character_version', t('角色卡版本')],
              ['tags', t('标签（逗号分隔）')],
              ['alternate_greetings', t('备用开场白（用独立一行 --- 分隔）')],
              ['system_prompt', t('角色提示词')],
              ['post_history_instructions', t('对话后置提示词')],
            ].map(([key, label]) => (
              <label key={key}>
                {label}
                <textarea value={doc.drafts.tavern[key] || ''} onChange={(e) => field(key, e.target.value)} />
              </label>
            ))}
          </div>
        </details>
        <h3>{t('导入与预览')}</h3>
        <p className="studio-muted">
          {t(
            '支持 V2 / 旧版角色卡 JSON 和世界书 JSON。高级世界书规则会保留用于导出，本机触发预览使用常驻与普通关键词。',
          )}
        </p>
        <FilePicker
          label={t('导入角色卡 JSON')}
          accept=".json,application/json"
          onChange={(e) => {
            void read(e.target.files?.[0], 'card')
            e.target.value = ''
          }}
        />
        <FilePicker
          label={t('导入世界书 JSON')}
          accept=".json,application/json"
          onChange={(e) => {
            void read(e.target.files?.[0], 'book')
            e.target.value = ''
          }}
        />
        {pending && (
          <div className="studio-book">
            <h3>{pending.draft?.name || t('世界书导入预览')}</h3>
            <pre>{pending.draft?.description}</pre>
            <p>{t('包含 {0} 条世界书条目', { 0: pending.book.length })}</p>
            <ul>
              {pending.book.map((b) => (
                <li key={b.id}>{b.title || b.keys || t('未命名条目')}</li>
              ))}
            </ul>
            <p>
              {pending.draft
                ? t('确认后替换当前角色卡草稿与世界书，请先收藏需要保留的草稿。')
                : t('确认后追加世界书条目。')}
            </p>
            <button
              onClick={() => {
                change((d) => ({
                  ...d,
                  drafts: pending.draft ? { ...d.drafts, tavern: pending.draft } : d.drafts,
                  book: pending.draft ? pending.book : [...d.book, ...pending.book],
                }))
                setPending(null)
                setSelected('')
                onLoaded(pending.draft ? 'draft' : 'book')
              }}
            >
              {t('确认导入')}
            </button>
            <button onClick={() => setPending(null)}>{t('取消')}</button>
          </div>
        )}
        <h3>{t('本项目角色卡收藏')}</h3>
        <p className="studio-muted">
          {t('收藏包含角色卡及其世界书。载入前会预览；联机时可分别选择 AI 角色。')}
        </p>
        <button
          disabled={(doc.cards?.length || 0) >= 100}
          onClick={() => {
            try {
              characterCard(doc.drafts.tavern, doc.book)
              change((d) => ({
                ...d,
                cards: [
                  ...(d.cards || []),
                  {
                    id: generateId('card'),
                    draft: structuredClone(d.drafts.tavern),
                    book: structuredClone(d.book),
                  },
                ],
              }))
              onError('')
            } catch (e) {
              onError(e instanceof Error ? e.message : t('保存失败，请重试'))
            }
          }}
        >
          {t('收藏当前角色卡')}
        </button>
        <CollectionPicker
          label={t('选择收藏角色卡')}
          value={selected}
          onChange={setSelected}
          items={(doc.cards || []).map((c) => ({
            id: c.id,
            title: c.draft.name,
            description: c.draft.description,
          }))}
        />
        <button
          disabled={!selected}
          onClick={() => {
            const card = doc.cards?.find((c) => c.id === selected)
            if (card) setPending(structuredClone(card))
          }}
        >
          {t('预览并载入收藏')}
        </button>
        <button
          disabled={!selected}
          onClick={() => {
            try {
              characterCard(doc.drafts.tavern, doc.book)
              change((d) => ({
                ...d,
                cards: d.cards?.map((c) =>
                  c.id === selected
                    ? { ...c, draft: structuredClone(d.drafts.tavern), book: structuredClone(d.book) }
                    : c,
                ),
              }))
              onError('')
            } catch (e) {
              onError(e instanceof Error ? e.message : t('保存失败，请重试'))
            }
          }}
        >
          {t('更新所选收藏')}
        </button>
        <h3>{t('世界书触发测试')}</h3>
        <textarea
          aria-label={t('测试对话')}
          value={scan}
          onChange={(e) => setScan(e.target.value)}
          placeholder={t('输入对话，检查会发送哪些设定')}
        />
        <ul>
          {activatedBook(doc.book, scan).map((b) => (
            <li key={b.id}>
              <strong>{b.title || b.keys}</strong>
              <pre>{b.content}</pre>
            </li>
          ))}
        </ul>
        {!activatedBook(doc.book, scan).length && <p>{t('没有触发条目')}</p>}
      </fieldset>
    </section>
  )
}
