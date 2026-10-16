import { plainText, type NovelDocument } from './model'
import { nt } from './workbench'
export interface NovelWorldLink {
  entryId: string
  sourceText: string
  entryContent: string
  entryTitle: string
}
export interface NovelSource {
  key: string
  title: string
  content: string
  ai?: boolean
}
export function novelSources(doc: NovelDocument): NovelSource[] {
  const wb = doc.workbench
  return [
    { key: 'idea', title: nt('故事想法', 'Story idea'), content: doc.idea },
    { key: 'outline', title: nt('故事大纲', 'Story outline'), content: doc.outline },
    {
      key: 'style',
      title: nt('文风与类型', 'Style & genre'),
      content: [doc.genre, doc.style].filter(Boolean).join('\n\n'),
    },
    { key: 'memory', title: nt('作者记忆', 'Author memory'), content: wb?.authorMemory || '' },
    ...doc.chapters.map((c) => ({
      key: 'chapter:' + c.id,
      title: c.title,
      content: [c.outline, c.summary, plainText(c.content)].filter(Boolean).join('\n\n'),
    })),
    ...(['board', 'resources', 'panels'] as const).flatMap((k) =>
      (wb?.[k] || []).map((c) => ({ key: k + ':' + c.id, title: c.title || c.kind, content: c.content })),
    ),
    ...(wb?.agents || []).map((a) => ({
      key: 'agent:' + a.id,
      title: nt('智能体配置：', 'Agent configuration: ') + a.name,
      content: a.instruction,
    })),
    ...(wb?.results || []).map((r) => ({ key: 'result:' + r.id, title: r.title, content: r.text, ai: true })),
    ...doc.issues.map((r, i) => ({
      key: 'issue:' + i,
      title: r.title,
      content: [r.evidence, r.suggestion].join('\n\n'),
    })),
  ].filter((s) => s.content.trim())
}
