import type { Entry } from '@/types'
import { t } from '@/lib/i18n'
import { plainText, type NovelDocument, type NovelStep } from './model'

export function stageBlock(doc: NovelDocument, entries: Entry[], target: NovelStep): string {
  const requirements: [NovelStep, boolean, string][] = [
    ['world', !!doc.idea.trim(), '请先在 01 填写故事想法'],
    [
      'outline',
      entries.some(
        (e) => e.status !== 'archived' && e.status !== 'proposed' && ['character', 'lore'].includes(e.type),
      ),
      '请先在 02 手动建立或确认人物与规则',
    ],
    ['chapters', !!doc.outline.trim(), '请先在 03 完成故事大纲'],
    ['write', doc.chapters.length > 0, '请先在 04 创建章节计划'],
    ['review', doc.chapters.some((c) => !!plainText(c.content)), '请先在 05 写入章节正文'],
    [
      'canon',
      doc.issues.length > 0 || doc.generations.some((g) => g.task === 'review' && g.status === 'applied'),
      '请先在 06 保留检查结果或手动记录问题',
    ],
  ]
  if (target === 'idea') return ''
  for (const [step, ready, reason] of requirements) {
    if (!ready) return t(reason)
    if (step === target) break
  }
  return ''
}
