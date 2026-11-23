// Searches that found nothing. One row per normalised text; repeats bump the count, so the list
// shows what the house keeps looking for.

const key = text => String(text || '').toLowerCase().replace(/\s+/g, ' ').trim()

function logMiss (app, userId, text, via) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 120)
  const k = key(clean)
  if (k.length < 3) return
  let rec
  try {
    rec = app.findFirstRecordByData('misses', 'key', k)
    rec.set('count', rec.getInt('count') + 1)
  } catch (_) {
    rec = new Record(app.findCollectionByNameOrId('misses'))
    rec.set('key', k)
    rec.set('text', clean)
    rec.set('count', 1)
  }
  rec.set('last', new DateTime())
  rec.set('user', userId || '')
  rec.set('via', via || 'app')
  app.save(rec)
}

module.exports = { logMiss }
