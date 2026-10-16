import { useState } from 'react'
import { t } from '@/lib/i18n'
import type { Room, StoryState } from './types'

type Props = { room: Room; act: (action: string, input?: Record<string, unknown>) => void }
export function TrpgControls({ room, act }: Props) {
  const [playerId, setPlayerId] = useState('')
  const [label, setLabel] = useState('')
  const [rule, setRule] = useState('d20')
  const [target, setTarget] = useState(12)
  const [modifier, setModifier] = useState(0)
  const [advantage, setAdvantage] = useState('normal')
  const round = room.round
  const pending = room.checks?.some((c) => c.status === 'pending')
  return (
    <section className="trpg-controls">
      <h2>{t('回合与规则检定')}</h2>
      <label>
        <input
          type="checkbox"
          checked={round?.enabled || false}
          onChange={(e) => act('round-config', { enabled: e.target.checked })}
        />
        {t('等待全体玩家提交行动')}
      </label>
      <p>{t('开启后，每位在场玩家每轮提交一次行动；场外交流不计入。检定完成后 AI 才能推进。')}</p>
      {round?.enabled && (
        <>
          <h3>
            {t('第 {0} 回合', { 0: round.number })} ·{' '}
            {round.phase === 'ready' ? t('等待主持回应') : t('收集玩家行动')}
          </h3>
          <ul>
            {room.players.map((p) => (
              <li key={p.id}>
                {p.name} · {p.away ? t('暂离') : round.submitted.includes(p.id) ? t('已提交') : t('等待行动')}
              </li>
            ))}
          </ul>
          <button
            disabled={room.paused || pending || room.automation?.busy}
            onClick={() => act('round-force')}
          >
            {t('强制汇总并请求 AI')}
          </button>
          <button disabled={room.paused || pending} onClick={() => act('round-next')}>
            {t('由主持人结束本轮')}
          </button>
          <p>{t('AI 暂停时可手动生成回复预览，或自行裁定后结束本轮。')}</p>
        </>
      )}
      <h3>{t('向玩家发起检定')}</h3>
      <p>{t('轻量规则：d20 加修正达到难度即成功；d100 不高于成功率即成功。不是完整 D&D 或 CoC 规则。')}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          act('check-request', {
            playerId,
            label,
            rule,
            target,
            modifier: rule === 'd20' ? modifier : 0,
            advantage: rule === 'd20' ? advantage : 'normal',
          })
        }}
      >
        <div className="lan-form-grid">
          <label>
            {t('检定玩家')}
            <select
              aria-label={t('检定玩家')}
              required
              value={playerId}
              onChange={(e) => setPlayerId(e.target.value)}
            >
              <option value="">{t('选择玩家')}</option>
              {room.players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.character.name || p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('检定名称')}
            <input required maxLength={120} value={label} onChange={(e) => setLabel(e.target.value)} />
          </label>
          <label>
            {t('检定规则')}
            <select
              aria-label={t('检定规则')}
              value={rule}
              onChange={(e) => {
                setRule(e.target.value)
                setTarget(e.target.value === 'd20' ? 12 : 50)
              }}
            >
              <option value="d20">d20</option>
              <option value="d100">d100</option>
            </select>
          </label>
          <label>
            {rule === 'd20' ? t('难度 DC') : t('成功率（百分比）')}
            <input
              required
              type="number"
              min={1}
              max={100}
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
            />
          </label>
          {rule === 'd20' && (
            <>
              <label>
                {t('检定修正')}
                <input
                  required
                  type="number"
                  min={-100}
                  max={100}
                  value={modifier}
                  onChange={(e) => setModifier(Number(e.target.value))}
                />
              </label>
              <label>
                {t('优势与劣势')}
                <select
                  aria-label={t('优势与劣势')}
                  value={advantage}
                  onChange={(e) => setAdvantage(e.target.value)}
                >
                  <option value="normal">{t('无优势或劣势')}</option>
                  <option value="advantage">{t('优势（取高值）')}</option>
                  <option value="disadvantage">{t('劣势（取低值）')}</option>
                </select>
              </label>
            </>
          )}
        </div>
        <button disabled={room.paused || !room.players.some((p) => p.id === playerId)}>
          {t('发布检定请求')}
        </button>
      </form>
      <ul className="lan-checks">
        {room.checks
          ?.slice(-20)
          .reverse()
          .map((c) => (
            <li key={c.id}>
              <strong>
                {c.playerName} · {c.label}
              </strong>{' '}
              · {c.rule} / {c.target} ·{' '}
              {c.status === 'pending'
                ? t('等待掷骰')
                : c.status === 'cancelled'
                  ? t('已取消')
                  : c.result?.success
                    ? t('成功')
                    : t('失败')}
              {c.result && (
                <>
                  {' '}
                  · [{c.result.rolls.join(', ')}] {c.modifier >= 0 ? '+' : ''}
                  {c.modifier} = {c.result.total}
                </>
              )}
              {c.status === 'pending' && (
                <button onClick={() => act('check-cancel', { id: c.id })}>{t('取消检定')}</button>
              )}
            </li>
          ))}
      </ul>
    </section>
  )
}

export function StoryView({ story }: { story: StoryState }) {
  return (
    <div className="lan-story">
      <p>
        <strong>{t('当前位置')}</strong> · {story.location}
      </p>
      <p>
        <strong>{t('当前目标')}</strong> · {story.goal}
      </p>
      <pre>{story.summary}</pre>
      <ul>
        {story.choices.map((c, i) => (
          <li key={i}>{c}</li>
        ))}
      </ul>
    </div>
  )
}
export function TavernControls({ room, act }: Props) {
  const [editing, setEditing] = useState<StoryState | null>(null)
  return (
    <section className="tavern-controls">
      <h2>{t('剧情状态与行动建议')}</h2>
      <p>{t('AI 状态是公开剧情参考，不会修改角色数值或世界观条目。玩家选择建议后仍需确认发送。')}</p>
      {room.story ? (
        <StoryView story={room.story} />
      ) : (
        <p>{t('开启剧情状态追踪后，下一次 AI 回复会更新这里。')}</p>
      )}
      <button onClick={() => setEditing(room.story || { location: '', goal: '', summary: '', choices: [] })}>
        {t('主持人修订剧情状态')}
      </button>
      {editing && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            act('story', { ...editing })
            setEditing(null)
          }}
        >
          <label>
            {t('当前位置')}
            <input
              maxLength={200}
              value={editing.location}
              onChange={(e) => setEditing({ ...editing, location: e.target.value })}
            />
          </label>
          <label>
            {t('当前目标')}
            <input
              maxLength={400}
              value={editing.goal}
              onChange={(e) => setEditing({ ...editing, goal: e.target.value })}
            />
          </label>
          <label>
            {t('公开剧情摘要')}
            <textarea
              maxLength={2000}
              value={editing.summary}
              onChange={(e) => setEditing({ ...editing, summary: e.target.value })}
            />
          </label>
          <button>{t('保存剧情状态')}</button>
          <button type="button" onClick={() => setEditing(null)}>
            {t('取消')}
          </button>
        </form>
      )}
    </section>
  )
}
