const crypto = require('node:crypto')

// Room-owned, deterministic rule evaluation; only the server rolls dice.
function resolveCheck(check, randomInt = crypto.randomInt) {
  const sides = check.rule === 'd100' ? 100 : 20
  const rolls = Array.from({ length: check.rule === 'd20' && check.advantage !== 'normal' ? 2 : 1 }, () =>
    randomInt(1, sides + 1),
  )
  const selected = check.advantage === 'advantage' ? Math.max(...rolls) : Math.min(...rolls)
  const total = selected + (check.rule === 'd20' ? check.modifier : 0)
  return { rolls, total, success: check.rule === 'd100' ? total <= check.target : total >= check.target }
}

function createTrpg({ room, changed, message, automation }) {
  const assert = () => {
    const r = room()
    if (r?.mode !== 'trpg') throw new Error('TRPG room required')
    return r
  }
  const playable = () => {
    const r = assert()
    if (r.paused) throw new Error('Roleplay is paused; use OOC chat')
    return r
  }
  const pending = () => assert().checks.some((c) => c.status === 'pending')
  const ready = () => {
    const r = assert(),
      round = r.round
    if (!round.enabled || r.paused || pending()) return
    const active = r.players.filter((p) => !p.away)
    if (!active.length) return
    if (round.phase === 'ready' || active.every((p) => round.submitted.includes(p.id))) {
      round.phase = 'ready'
      changed()
      automation.playerMessage()
    }
  }
  const next = () => {
    const r = assert()
    r.round.number++
    r.round.phase = 'collecting'
    r.round.submitted = []
    changed()
  }
  return {
    ready,
    beforeChat(player) {
      const r = assert()
      if (!r.round.enabled) return
      if (player.away) throw new Error('Return to the round before acting')
      if (r.round.phase === 'ready' || r.round.submitted.includes(player.id))
        throw new Error('Action submitted; wait for the next round or use OOC')
    },
    chatted(player) {
      const r = assert()
      if (!r.round.enabled) {
        if (!pending()) automation.playerMessage()
        return
      }
      r.round.submitted.push(player.id)
      automation.invalidate()
      ready()
    },
    replied() {
      const r = room()
      if (r?.mode === 'trpg' && r.round.enabled && r.round.phase === 'ready') next()
    },
    host(action, input) {
      const r = assert()
      if (action === 'round-config') {
        automation.invalidate()
        r.round.enabled = input.enabled === true
        r.round.phase = 'collecting'
        r.round.submitted = []
        changed()
      } else if (action === 'round-force' || action === 'round-next') {
        playable()
        if (!r.round.enabled) throw new Error('Round coordination is disabled')
        if (pending()) throw new Error('Resolve or cancel pending checks first')
        automation.invalidate()
        if (action === 'round-next') next()
        else {
          r.round.phase = 'ready'
          changed()
          automation.playerMessage()
        }
      } else if (action === 'check-request') {
        playable()
        const player = r.players.find((p) => p.id === input.playerId)
        if (!player) throw new Error('Unknown player')
        if (
          typeof input.label !== 'string' ||
          !input.label.trim() ||
          input.label.length > 120 ||
          !['d20', 'd100'].includes(input.rule) ||
          !Number.isInteger(input.target) ||
          input.target < 1 ||
          input.target > 100 ||
          !Number.isInteger(input.modifier) ||
          Math.abs(input.modifier) > 100 ||
          !['normal', 'advantage', 'disadvantage'].includes(input.advantage)
        )
          throw new Error('Invalid check configuration')
        if (input.rule === 'd100' && (input.modifier !== 0 || input.advantage !== 'normal'))
          throw new Error('Invalid check configuration')
        if (
          r.checks.some(
            (c) => c.status === 'pending' && c.playerId === player.id && c.label === input.label.trim(),
          )
        )
          return
        if (r.checks.filter((c) => c.status === 'pending').length >= 32)
          throw new Error('Too many pending checks')
        automation.invalidate()
        r.checks = r.checks.filter(
          (c) => c.status === 'pending' || r.checks.indexOf(c) >= r.checks.length - 99,
        )
        r.checks.push({
          id: crypto.randomUUID(),
          playerId: player.id,
          playerName: player.character.name || player.name,
          label: input.label.trim(),
          rule: input.rule,
          target: input.target,
          modifier: input.modifier,
          advantage: input.advantage,
          round: r.round.number,
          status: 'pending',
        })
        changed()
      } else if (action === 'check-cancel') {
        const check = r.checks.find((c) => c.id === input.id)
        if (!check || check.status !== 'pending') throw new Error('Check is no longer pending')
        automation.invalidate()
        check.status = 'cancelled'
        changed()
        if (r.round.enabled) ready()
        else if (!pending()) automation.playerMessage()
      }
    },
    player(action, input, player) {
      const r = playable()
      if (action === 'away') {
        automation.invalidate()
        player.away = input.away === true
        changed()
        ready()
      } else {
        const check = r.checks.find((c) => c.id === input.id)
        if (!check || check.playerId !== player.id) throw new Error('This check belongs to another player')
        if (check.status === 'resolved') return // Retry after a lost HTTP response must not reroll.
        if (check.status !== 'pending') throw new Error('Check is no longer pending')
        automation.invalidate()
        check.result = resolveCheck(check)
        check.status = 'resolved'
        message(
          check.playerName,
          `${check.label} · ${check.rule} · ${check.result.total} / ${check.target} · ${check.result.success ? '成功 / Success' : '失败 / Failure'}`,
          'check',
          { check: structuredClone(check), playerId: player.id },
        )
        changed()
        if (r.round.enabled) ready()
        else if (!pending()) automation.playerMessage()
      }
    },
    removed(playerId) {
      const r = assert()
      r.round.submitted = r.round.submitted.filter((id) => id !== playerId)
      for (const check of r.checks)
        if (check.playerId === playerId && check.status === 'pending') check.status = 'cancelled'
      ready()
    },
  }
}
module.exports = { createTrpg, resolveCheck }
