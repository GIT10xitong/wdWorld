import { useState } from 'react'
import {
  Users,
  Compass,
  BookOpen,
  ArrowUpRight,
  Check,
  Circle,
  Sparkles,
  Network,
  Radio,
  Puzzle,
  Search,
  FileText,
} from 'lucide-react'
import type { Entry, Relation, Project } from '@/types'
import type { StudioDocument } from './model'
import { homeProfile, studioOverview, st, type HomeMode } from './homeModel'
import { trpgPresets } from './trpg'
import './home.css'

export type StudioTarget = 'draft' | 'modules' | 'scenarios' | 'cards' | 'book' | 'assistant'
export type StudioPage = 'world' | 'lan' | 'extensions'

export function StudioHome({
  mode,
  doc,
  project,
  entries,
  relations,
  disabled,
  edit,
  navigate,
  openEntry,
}: {
  mode: HomeMode
  doc: StudioDocument
  project: Project
  entries: Entry[]
  relations: Relation[]
  disabled: boolean
  edit: (target: StudioTarget) => void
  navigate: (page: StudioPage) => void
  openEntry: (id: string) => void
}) {
  const p = homeProfile(mode),
    summary = studioOverview(mode, doc, entries, relations),
    draft = doc.drafts[mode]
  const [query, setQuery] = useState('')
  const Icon = { oc: Users, trpg: Compass, tavern: BookOpen }[mode]
  const stats =
    mode === 'oc'
      ? [
          [st('人物档案', 'Characters'), summary.characters.length],
          [st('世界关系', 'World relationships'), summary.relations],
          [st('设定条目', 'Lore entries'), summary.live.length],
          [st('AI 待确认', 'Awaiting review'), summary.pending],
        ]
      : mode === 'trpg'
        ? [
            [st('收藏副本', 'Saved modules'), doc.modules?.length || 0],
            [st('可选预设', 'Built-in modules'), trpgPresets().length],
            [st('地点与场景', 'Locations'), summary.live.filter((e) => e.type === 'location').length],
            [st('AI 待确认', 'Awaiting review'), summary.pending],
          ]
        : [
            [st('收藏角色卡', 'Saved cards'), doc.cards?.length || 0],
            [st('世界书条目', 'Lorebook entries'), doc.book.length],
            [st('已启用条目', 'Enabled entries'), summary.enabledBook],
            [st('场景卡', 'Scene cards'), doc.scenarios?.length || 0],
          ]
  const tasks =
    mode === 'trpg'
      ? summary.fields.filter((f) =>
          ['name', 'system', 'premise', 'hooks', 'scenes', 'clues', 'secrets'].includes(f.key),
        )
      : mode === 'tavern'
        ? summary.fields.filter((f) =>
            ['name', 'description', 'personality', 'scenario', 'first_mes'].includes(f.key),
          )
        : summary.fields
  const items = (mode === 'oc' ? summary.characters : summary.live)
    .filter((e) => e.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const tools: { icon: typeof Users; title: string; hint: string; action: () => void }[] = [
    {
      icon: Sparkles,
      title: st('AI 创作助手', 'AI creative assistant'),
      hint: st('随机种子、上下文与候选确认', 'Seeds, context and candidate review'),
      action: () => edit('assistant'),
    },
    {
      icon: Network,
      title: st('世界观与关系', 'Lore & relationships'),
      hint: st('查看正式设定与待确认条目', 'Review lore and proposed changes'),
      action: () => navigate('world'),
    },
    ...(mode === 'oc'
      ? [
          {
            icon: FileText,
            title: st('外貌、动机与成长', 'Appearance, motives & growth'),
            hint: st('补全档案中的关键细节', 'Develop the details of your character'),
            action: () => edit('draft'),
          },
        ]
      : [
          {
            icon: Radio,
            title: st('局域网房间', 'LAN room'),
            hint: st('准备好后开房，邀请伙伴加入', 'Host a room when you are ready'),
            action: () => navigate('lan'),
          },
        ]),
    ...(mode === 'tavern'
      ? [
          {
            icon: Puzzle,
            title: st('酒馆扩展', 'Tavern extensions'),
            hint: st('记忆、图片与语音服务', 'Memory, image and speech services'),
            action: () => navigate('extensions'),
          },
        ]
      : []),
  ]
  const action = (target: StudioTarget, title: string) => (
    <button disabled={disabled} onClick={() => edit(target)}>
      {title}
      <ArrowUpRight size={15} />
    </button>
  )
  return (
    <main className={`studio-home home-theme-${mode}`}>
      <header className="home-banner">
        <div>
          <span className="home-eyebrow">
            {p.code} / {project.name}
          </span>
          <h2>{p.headline}</h2>
          <p>{p.description}</p>
          <div className="home-actions">
            <button className="home-primary" disabled={disabled} onClick={() => edit('draft')}>
              {p.edit}
              <ArrowUpRight size={16} />
            </button>
            {mode !== 'oc' && (
              <button disabled={disabled} onClick={() => edit(mode === 'trpg' ? 'modules' : 'cards')}>
                {mode === 'trpg'
                  ? st('选择或导入副本', 'Choose or import module')
                  : st('导入与收藏角色卡', 'Import & save cards')}
              </button>
            )}
          </div>
        </div>
        <Icon className="home-banner-icon" size={86} strokeWidth={1} />
      </header>
      <div className="home-stat-grid">
        {stats.map(([label, value]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      <div className="home-work-grid">
        <section className="home-panel home-current">
          <div className="home-panel-heading">
            <h2>
              {mode === 'oc'
                ? st('正在塑造的角色', 'Character in progress')
                : mode === 'trpg'
                  ? st('本次冒险', 'Current adventure')
                  : st('当前角色卡', 'Current character card')}
            </h2>
            {action('draft', st('编辑', 'Edit'))}
          </div>
          <h3>{draft.name || st('尚未命名', 'Untitled')}</h3>
          <p className="home-preview">
            {(mode === 'oc' ? draft.concept : mode === 'trpg' ? draft.premise : draft.description) ||
              st(
                '从一个名字、一句话设想开始。可以自己填写，也可以请 AI 生成候选。',
                'Start with a name and an idea. Write it yourself or ask AI for a candidate.',
              )}
          </p>
          {mode === 'tavern' ? (
            <div className="home-quote">
              <small>{st('开场白预览', 'Greeting preview')}</small>
              <p>
                {draft.first_mes ||
                  st(
                    '还没有开场白，写一句邀请玩家进入故事的话。',
                    'No greeting yet. Invite the player into your story.',
                  )}
              </p>
            </div>
          ) : mode === 'trpg' ? (
            <div className="home-quote">
              <small>{st('规则系统', 'Rules system')}</small>
              <p>
                {draft.system || st('尚未选择，可在备团页填写', 'Not set; choose in the preparation editor')}
              </p>
              <small>
                {st(
                  '这里只展示玩家背景。秘密与实际记录在备团编辑页查看。',
                  'This preview shows the player premise. Secrets and actual logs remain in the preparation editor.',
                )}
              </small>
            </div>
          ) : (
            <div className="home-quote">
              <small>{st('角色动机', 'Character motivation')}</small>
              <p>
                {draft.motivation ||
                  st(
                    '他想得到什么，又为什么不能轻易得到？',
                    'What do they want, and what stands in their way?',
                  )}
              </p>
            </div>
          )}
        </section>
        <section className="home-panel">
          <div className="home-panel-heading">
            <h2>
              {mode === 'trpg' ? st('开团准备', 'Session preparation') : st('创作清单', 'Creation checklist')}
            </h2>
            <span>
              {tasks.filter((f) => f.ready).length}/{tasks.length}
            </span>
          </div>
          <div className="home-checklist">
            {tasks.map((f) => (
              <button key={f.key} disabled={disabled} onClick={() => edit('draft')}>
                <span className={f.ready ? 'ready' : ''}>
                  {f.ready ? <Check size={15} /> : <Circle size={15} />}
                </span>
                {f.label}
                <small>{f.ready ? st('已填写', 'Filled') : st('待补充', 'To add')}</small>
              </button>
            ))}
          </div>
          <p className="home-footnote">
            {st(
              '清单仅表示字段已填写，内容仍需作者检查。',
              'The checklist tracks filled fields. Review the content yourself.',
            )}
          </p>
        </section>
      </div>
      {mode !== 'oc' && (
        <div className="home-asset-grid">
          {mode === 'trpg' ? (
            <section className="home-panel">
              <div className="home-panel-heading">
                <h2>{st('副本库', 'Module library')}</h2>
                {action('modules', st('管理副本', 'Manage modules'))}
              </div>
              <div className="home-chips">
                {[...trpgPresets(), ...(doc.modules || [])].slice(0, 6).map((m) => (
                  <button key={m.id} disabled={disabled} onClick={() => edit('modules')}>
                    <Compass size={15} />
                    {m.draft.name}
                  </button>
                ))}
              </div>
              <p>
                {st(
                  '预览后确认载入。支持副本／世界 JSON、TXT 与 Markdown。',
                  'Preview before loading. Supports module/world JSON, TXT and Markdown.',
                )}
              </p>
            </section>
          ) : (
            <>
              <section className="home-panel">
                <div className="home-panel-heading">
                  <h2>{st('角色与场景收藏', 'Cards & scenes')}</h2>
                  {action('scenarios', st('场景卡管理', 'Manage scenes'))}
                </div>
                <div className="home-chips">
                  {(doc.cards || []).slice(0, 4).map((c) => (
                    <button key={c.id} disabled={disabled} onClick={() => edit('cards')}>
                      <Users size={15} />
                      {c.draft.name || st('未命名角色', 'Untitled character')}
                    </button>
                  ))}
                  {(doc.scenarios || []).slice(0, 3).map((c) => (
                    <button key={c.id} disabled={disabled} onClick={() => edit('scenarios')}>
                      <Compass size={15} />
                      {c.title}
                    </button>
                  ))}
                </div>
                {!doc.cards?.length && !doc.scenarios?.length && (
                  <p>
                    {st(
                      '收藏角色卡，或把角色、开场白与世界书保存为场景卡。',
                      'Save a character card, or bundle characters, greetings and lore into a scene card.',
                    )}
                  </p>
                )}
                {action('cards', st('打开角色卡工坊', 'Open card workshop'))}
              </section>
              <section className="home-panel">
                <div className="home-panel-heading">
                  <h2>{st('世界书制作', 'Lorebook workshop')}</h2>
                  {action('book', st('编辑世界书', 'Edit lorebook'))}
                </div>
                <p>
                  {st(
                    '用触发词关联场景细节；常驻条目保存关键规则。',
                    'Connect scene details with keywords; keep essential rules in constant entries.',
                  )}
                </p>
                <div className="home-chips">
                  {doc.book.slice(0, 4).map((b) => (
                    <button key={b.id} disabled={disabled} onClick={() => edit('book')}>
                      {b.title || st('未命名条目', 'Untitled entry')}
                      <small>{b.enabled ? st('启用', 'On') : st('停用', 'Off')}</small>
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      )}
      <section className="home-panel">
        <div className="home-panel-heading">
          <h2>
            {mode === 'oc' ? st('人物档案库', 'Character library') : st('最近世界设定', 'Recent world lore')}
          </h2>
          <label className="home-search">
            <Search size={15} />
            <input
              aria-label={st('搜索首页设定', 'Search home lore')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={st('搜索名称…', 'Search names…')}
            />
          </label>
        </div>
        <div className="home-entry-grid">
          {items.slice(0, 6).map((e) => (
            <button key={e.id} disabled={disabled} onClick={() => openEntry(e.id)}>
              <span className="home-initial">{(e.title || '?').slice(0, 1)}</span>
              <span>
                <strong>{e.title || st('未命名条目', 'Untitled entry')}</strong>
                <small>
                  {e.status === 'proposed'
                    ? st('AI 待确认', 'Awaiting AI review')
                    : e.summary || st('打开查看详情', 'Open details')}
                </small>
              </span>
              <ArrowUpRight size={15} />
            </button>
          ))}
        </div>
        {!items.length && (
          <p className="home-empty">
            {st(
              '还没有匹配的条目。编辑档案或采纳 AI 候选后，可在这里查看。',
              'No matching entries yet. Edit profiles or accept AI candidates to build your library.',
            )}
          </p>
        )}
        {items.length > 6 && (
          <p>
            {st('显示前 6 条，可进入世界观查看全部。', 'Showing 6 entries. Open worldbuilding to see all.')}
          </p>
        )}
      </section>
      <div className="home-tool-grid">
        {tools.map((tool) => (
          <button key={tool.title} disabled={disabled} onClick={tool.action}>
            <tool.icon size={22} />
            <span>
              <strong>{tool.title}</strong>
              <small>{tool.hint}</small>
            </span>
            <ArrowUpRight size={15} />
          </button>
        ))}
      </div>
    </main>
  )
}
