import { t } from '@/lib/i18n'
import { parseResult, type Generation } from './model'

export function GenerationPreview({ generation }: { generation: Generation }) {
  if (['idea', 'outline', 'write', 'rewrite', 'summary'].includes(generation.task))
    return <pre>{generation.text}</pre>
  try {
    const result = parseResult(generation.text)
    const proposals = Array.isArray(result.proposals) ? result.proposals : []
    const chapters = Array.isArray(result.chapters) ? result.chapters : []
    const issues = Array.isArray(result.issues) ? result.issues : []
    const text = (value: unknown) => (typeof value === 'string' ? value : '')
    return (
      <div className="novel-candidate-cards">
        {chapters.map((c, i) => (
          <article key={i}>
            <small>{text(c.volume) || t('章节计划')}</small>
            <h3>{text(c.title)}</h3>
            <p>{text(c.outline)}</p>
          </article>
        ))}
        {issues.map((issue, i) => (
          <article key={'issue-' + i}>
            <small>{t('疑似矛盾')}</small>
            <h3>{text(issue.title)}</h3>
            <p>{text(issue.evidence)}</p>
            <p>
              {t('建议：')}
              {text(issue.suggestion)}
            </p>
          </article>
        ))}
        {generation.task === 'review' && issues.length === 0 && (
          <p className="novel-muted">{t('本次未提出矛盾问题，仍建议人工核对。')}</p>
        )}
        {proposals.map((p, i) => (
          <article key={'proposal-' + i}>
            <small>
              {p.type === 'character' ? t('人物建议') : t('世界规则建议')} ·{' '}
              {p.targetEntryId ? t('更新已有设定') : t('新设定')}
            </small>
            <h3>{text(p.title)}</h3>
            <p>{text(p.content)}</p>
            {p.evidence && (
              <p className="novel-muted">
                {t('依据：')}
                {text(p.evidence)}
              </p>
            )}
          </article>
        ))}
        {!chapters.length && !issues.length && !proposals.length && generation.task !== 'review' && (
          <p>{t('没有可采纳的建议，请调整要求后重新生成。')}</p>
        )}
      </div>
    )
  } catch {
    return (
      <>
        <p className="novel-muted">{t('这次返回未形成完整建议，可以重新生成或查看原文后手动整理。')}</p>
        <details>
          <summary>{t('查看返回内容')}</summary>
          <pre>{generation.text}</pre>
        </details>
      </>
    )
  }
}
