/// <reference path="../pb_data/types.d.ts" />

// The app reports a search that stayed empty for a few seconds (not every keystroke).
routerAdd('POST', '/api/wz/misses', (e) => {
  const { logMiss } = require(`${__hooks}/misses.js`)
  const body = e.requestInfo().body || {}
  logMiss(e.app, e.auth.id, body.text, 'app')
  return e.noContent(204)
}, $apis.requireAuth('users'))
