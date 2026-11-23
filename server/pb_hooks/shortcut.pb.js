/// <reference path="../pb_data/types.d.ts" />

// Apple Shortcuts: plain-text routes keyed by a per-person secret (helpers in shortcut.js, because
// handlers run in isolated scopes). Resetting the secret makes the old link stop working.

routerAdd('GET', '/api/wz/shortcut/token', (e) => {
  const { token } = require(`${__hooks}/shortcut.js`)
  return e.json(200, { token: token(e.app, e.auth, false) })
}, $apis.requireAuth('users'))

routerAdd('POST', '/api/wz/shortcut/token', (e) => {
  const { token } = require(`${__hooks}/shortcut.js`)
  return e.json(200, { token: token(e.app, e.auth, true) })
}, $apis.requireAuth('users'))

// One line per thing to buy. ?new=1: only what wasn't sent in the last three days.
routerAdd('GET', '/api/wz/shortcut/{token}/shopping', (e) => {
  const { userFor, shopping } = require(`${__hooks}/shortcut.js`)
  const user = userFor(e.app, e.request.pathValue('token'))
  const lines = shopping(e.app, user, e.request.url.query().get('new') === '1')
  e.response.header().set('Cache-Control', 'no-store')
  return e.string(200, lines.join('\n'))
})

// Add to the shopping list: body text (plain, JSON {"text"} or form field "text") or ?text=.
routerAdd('POST', '/api/wz/shortcut/{token}/shopping', (e) => {
  const { userFor, add, dutch, inHouse } = require(`${__hooks}/shortcut.js`)
  const user = userFor(e.app, e.request.pathValue('token'))
  let text = e.request.url.query().get('text')
  if (!text && /^text\/plain/i.test(e.request.header.get('Content-Type') || '')) {
    text = toString(e.request.body, 20000)
  } else if (!text) {
    const info = e.requestInfo()
    text = info.body && info.body.text
  }
  const added = add(e.app, text)
  const nl = dutch(user, e.request.header.get('Accept-Language'))
  e.response.header().set('Cache-Control', 'no-store')
  if (!added.length) return e.string(200, nl ? 'Stond al op de lijst.' : 'Already on the list.')
  const have = inHouse(e.app, added)
  const extra = have.length ? ` ${nl ? 'Al in huis' : 'Already in the house'}: ${have.join('; ')}.` : ''
  return e.string(200, `${nl ? 'Op de lijst' : 'Added'}: ${added.join(', ')}.${extra}`)
})

// A spoken answer to "where is …?" (?q=). Nothing found is noted for the "searched, not found" list.
routerAdd('GET', '/api/wz/shortcut/{token}/where', (e) => {
  const { userFor, dutch, where } = require(`${__hooks}/shortcut.js`)
  const user = userFor(e.app, e.request.pathValue('token'))
  const q = (e.request.url.query().get('q') || '').slice(0, 200)
  const answer = where(e.app, user, dutch(user, e.request.header.get('Accept-Language')), q)
  if (!answer.found && q.trim()) {
    const { logMiss } = require(`${__hooks}/misses.js`)
    logMiss(e.app, user.id, q.replace(/^\s*(waar\s+(is|zijn|ligt|liggen|staat|staan)|where\s+(is|are))\s+/i, '').replace(/[?.!]+$/, ''), 'siri')
  }
  e.response.header().set('Cache-Control', 'no-store')
  return e.string(200, answer.text)
})
