/// <reference path="../pb_data/types.d.ts" />

// Lets the app hide AI features when no key is configured.
routerAdd('GET', '/api/wz/ai/status', (e) => {
  const { apiKey } = require(`${__hooks}/ai.js`)
  return e.json(200, { enabled: !!apiKey() })
}, $apis.requireAuth())

routerAdd('POST', '/api/wz/ai/photo', (e) => {
  const ai = require(`${__hooks}/ai.js`)
  if (!ai.apiKey()) throw new BadRequestError('AI is not configured on this server.')
  const body = e.requestInfo().body
  if (!body.image) throw new BadRequestError('No image.')
  return e.json(200, { items: ai.recognise(body) })
}, $apis.requireAuth())

routerAdd('POST', '/api/wz/ai/search', (e) => {
  const ai = require(`${__hooks}/ai.js`)
  if (!ai.apiKey()) throw new BadRequestError('AI is not configured on this server.')
  const body = e.requestInfo().body
  if (!String(body.query || '').trim()) throw new BadRequestError('No question.')
  return e.json(200, { matches: ai.search(e.app, body) })
}, $apis.requireAuth())

routerAdd('POST', '/api/wz/ai/receipt', (e) => {
  const ai = require(`${__hooks}/ai.js`)
  if (!ai.apiKey()) throw new BadRequestError('AI is not configured on this server.')
  const body = e.requestInfo().body
  if (!body.image) throw new BadRequestError('No image.')
  return e.json(200, ai.receipt(body))
}, $apis.requireAuth())
