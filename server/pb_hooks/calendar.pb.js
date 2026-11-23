/// <reference path="../pb_data/types.d.ts" />

// The feed URL carries a per-person secret, because calendar apps can't send a login token.
// Resetting the token makes the old URL stop working. (Handlers run in isolated scopes, so helpers
// live in calendar.js.)

routerAdd('GET', '/api/wz/calendar/token', (e) => {
  const { token } = require(`${__hooks}/calendar.js`)
  return e.json(200, { token: token(e.app, e.auth, false) })
}, $apis.requireAuth('users'))

routerAdd('POST', '/api/wz/calendar/token', (e) => {
  const { token } = require(`${__hooks}/calendar.js`)
  return e.json(200, { token: token(e.app, e.auth, true) })
}, $apis.requireAuth('users'))

routerAdd('GET', '/api/wz/ics/{token}', (e) => {
  const token = e.request.pathValue('token')
  if (!/^[A-Za-z0-9]{40}$/.test(token)) throw new NotFoundError()
  let user
  try {
    user = e.app.findFirstRecordByData('users', 'calendar_token', token)
  } catch (_) {
    throw new NotFoundError()
  }
  const host = e.request.host
  // Behind `tailscale serve` the app is HTTPS on the ts.net name.
  const baseUrl = `${/\.ts\.net$/.test(host) ? 'https' : 'http'}://${host}`
  const { build } = require(`${__hooks}/calendar.js`)
  const body = build(e.app, user, { baseUrl, acceptLanguage: e.request.header.get('Accept-Language') })
  e.response.header().set('Content-Type', 'text/calendar; charset=utf-8')
  e.response.header().set('Cache-Control', 'no-store')
  return e.string(200, body)
})
