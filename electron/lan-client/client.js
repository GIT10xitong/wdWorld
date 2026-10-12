/* global document, sessionStorage */
const $ = (id) => document.getElementById(id)
let language = sessionStorage.getItem('language') || 'zh-CN'
let access = null,
  state = null,
  polling = false,
  errors = {}
void fetch('/errors.json')
  .then((res) => res.json())
  .then((data) => {
    errors = data
  })
  .catch(() => {})
try {
  access = JSON.parse(sessionStorage.getItem('access'))
} catch {
  /* start at join */
}
const tr = (zh, en) => (language === 'en' ? en : zh)
function translate() {
  document.documentElement.lang = language
  $('language').value = language
  for (const node of document.querySelectorAll('[data-zh]'))
    node.textContent = node.dataset[language === 'en' ? 'en' : 'zh']
}
$('language').onchange = () => {
  language = $('language').value
  sessionStorage.setItem('language', language)
  translate()
  if (state) render(state)
}
translate()
function error(e) {
  $('error').textContent = language === 'en' ? e.message : errors[e.message] || e.message
}
async function api(path, body) {
  const res = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(access ? { Authorization: 'Bearer ' + access.token } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  if (res.status === 204) return null
  const data = await res.json()
  if (!res.ok) {
    if (res.status === 401) {
      access = null
      sessionStorage.removeItem('access')
      $('join').hidden = false
      $('room').hidden = true
    }
    throw new Error(data.error || tr('请求失败', 'Request failed'))
  }
  $('error').textContent = ''
  return data
}
function render(next) {
  if (!next) return
  state = next
  $('join').hidden = true
  $('room').hidden = false
  $('title').textContent = state.title
  $('scene').textContent = state.scene
  $('pauseStatus').textContent = state.paused
    ? tr('角色扮演已暂停，可使用场外交流。', 'Roleplay is paused. OOC chat is available.')
    : state.automation?.busy
      ? tr('AI 正在回应…', 'AI is responding…')
      : state.automation?.enabled
        ? tr('自动回复已开启', 'Automatic replies enabled')
        : tr('主持人控制回复', 'Host controls replies')
  $('roleSection').hidden = state.mode !== 'tavern'
  const mine = state.players.find((p) => p.id === access?.playerId)
  for (const input of $('character').querySelectorAll('input, textarea, button'))
    input.disabled = !!mine?.roleId
  $('releaseRole').disabled = !mine?.roleId
  $('roles').replaceChildren(
    ...(state.roles || []).map((r) => {
      const row = document.createElement('div'),
        label = document.createElement('p'),
        button = document.createElement('button')
      const owner = state.players.find((p) => p.roleId === r.id)
      label.textContent = `${r.name}${owner ? ' · ' + owner.name : ''}\n${r.description}`
      button.type = 'button'
      button.textContent = owner ? tr('已认领', 'Claimed') : tr('认领角色', 'Claim character')
      button.disabled = !!owner
      button.onclick = async () => {
        try {
          render(await api('/action', { action: 'claim', id: r.id }))
          fillCharacter()
        } catch (e) {
          error(e)
        }
      }
      row.append(label, button)
      return row
    }),
  )
  const messages = $('messages'),
    nearBottom = messages.scrollHeight - messages.scrollTop - messages.clientHeight < 60
  messages.replaceChildren(
    ...state.messages.map((m) => {
      const p = document.createElement('p')
      p.textContent = `${m.kind === 'ooc' ? '[OOC] ' : ''}${m.speaker} · ${new Date(m.at).toLocaleTimeString()}\n${m.text}${m.roll ? ' → [' + m.roll.rolls.join(', ') + '] ' + (m.roll.modifier >= 0 ? '+' : '') + m.roll.modifier + ' = ' + m.roll.total : ''}`
      return p
    }),
  )
  if (nearBottom) messages.scrollTop = messages.scrollHeight
  $('players').replaceChildren(
    ...state.players.map((p) => {
      const el = document.createElement('p')
      el.textContent = `${p.name} · ${p.character.name} · HP ${p.character.hp}/${p.character.maxHp}`
      el.title = p.character.description
      return el
    }),
  )
  $('initiative').replaceChildren(
    ...state.initiative.map((p) => {
      const el = document.createElement('li')
      el.textContent = `${p.name}: ${p.value}`
      return el
    }),
  )
  $('handouts').replaceChildren(
    ...state.handouts.map((h) => {
      const el = document.createElement('section'),
        title = document.createElement('h3'),
        body = document.createElement('pre')
      title.textContent = h.title
      body.textContent = h.content
      el.append(title, body)
      return el
    }),
  )
}
function fillCharacter() {
  const c = state?.players.find((p) => p.id === access?.playerId)?.character
  if (c) {
    $('characterName').value = c.name
    $('description').value = c.description
    $('hp').value = c.hp
    $('maxHp').value = c.maxHp
  }
}
async function poll() {
  if (polling || !access) return
  polling = true
  try {
    render(await api('/state?revision=' + (state?.revision ?? -1)))
  } catch {
    error(
      new Error(
        tr('连接中断或房间已关闭，请重新加入。', 'Connection interrupted or room closed. Please rejoin.'),
      ),
    )
  } finally {
    polling = false
    if (access) setTimeout(poll, 1500)
  }
}
$('join').onsubmit = async (event) => {
  event.preventDefault()
  try {
    const data = await api('/join', { code: $('code').value.trim().toUpperCase(), name: $('name').value })
    access = { token: data.token, playerId: data.playerId }
    sessionStorage.setItem('access', JSON.stringify(access))
    render(data.state)
    fillCharacter()
    void poll()
  } catch (e) {
    error(e)
  }
}
function submit(id, body, after = () => {}) {
  $(id).onsubmit = async (event) => {
    event.preventDefault()
    try {
      render(await api('/action', body()))
      after()
    } catch (e) {
      error(e)
    }
  }
}
submit(
  'chat',
  () => ({ action: 'chat', text: $('text').value, ooc: $('ooc').checked }),
  () => {
    $('text').value = ''
  },
)
submit('dice', () => ({ action: 'roll', expression: $('expression').value }))
submit('character', () => ({
  action: 'character',
  name: $('characterName').value,
  description: $('description').value,
  hp: Number($('hp').value),
  maxHp: Number($('maxHp').value),
}))
$('leave').onclick = async () => {
  try {
    await api('/action', { action: 'leave' })
  } catch (e) {
    error(e)
  }
  access = null
  state = null
  sessionStorage.removeItem('access')
  $('join').hidden = false
  $('room').hidden = true
}
$('releaseRole').onclick = async () => {
  try {
    render(await api('/action', { action: 'claim', id: '' }))
    fillCharacter()
  } catch (e) {
    error(e)
  }
}
if (access)
  void api('/state?revision=-1')
    .then((next) => {
      render(next)
      fillCharacter()
      void poll()
    })
    .catch(error)
