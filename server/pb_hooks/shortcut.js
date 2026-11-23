// Apple Shortcuts bridge: iOS Reminders has no API a web app can reach, but a Shortcut can fetch a
// URL and add each line as a reminder, and post dictated text back. The URL carries a per-person
// secret because Shortcuts can't log in.

const RESEND_AFTER = 3 * 24 * 3600 * 1000 // a line comes back only if still needed after 3 days

function token (app, auth, reset) {
  const user = app.findRecordById('users', auth.id)
  let value = user.getString('shortcut_token')
  if (!value || reset) {
    value = $security.randomString(40)
    user.set('shortcut_token', value)
    user.set('shortcut_sent', {})
    app.save(user)
  }
  return value
}

function userFor (app, value) {
  if (!/^[A-Za-z0-9]{40}$/.test(value || '')) throw new NotFoundError()
  try {
    return app.findFirstRecordByData('users', 'shortcut_token', value)
  } catch (_) {
    throw new NotFoundError()
  }
}

// What to buy, one line per thing, same rules as the app's shopping list: supplies at or below their
// reorder level (topped up to the target) and the one-off entries. Shop in brackets when set.
function shoppingLines (app) {
  const lines = []
  const low = app.findRecordsByFilter('items', "deleted = '' && gone = '' && needs_name = false && (min_quantity > 0 || staple = true) && quantity <= min_quantity", 'name', 0, 0)
  for (const i of low) {
    const min = i.getInt('min_quantity')
    const need = Math.max((i.getInt('stock_target') || min + 1) - i.getInt('quantity'), 1)
    const unit = i.getString('unit')
    const shop = i.getString('shop')
    lines.push({ key: i.id, text: `${need} ${unit ? unit + ' ' : ''}${i.getString('name')}${shop ? ` (${shop})` : ''}` })
  }
  for (const x of app.findRecordsByFilter('shopping_extras', '', 'created', 0, 0)) {
    const shop = x.getString('shop')
    lines.push({ key: x.id, text: `${x.getString('name')}${shop ? ` (${shop})` : ''}` })
  }
  return lines
}

function shopping (app, user, onlyNew) {
  const lines = shoppingLines(app)
  if (!onlyNew) return lines.map(l => l.text)
  const now = Date.now()
  let sent = {}
  try {
    sent = JSON.parse(user.getString('shortcut_sent') || '{}') || {}
  } catch (_) {}
  const fresh = lines.filter(l => !sent[l.key] || now - sent[l.key] > RESEND_AFTER)
  // Keep only keys still on the list, so a thing bought and needed again later is sent again.
  const next = {}
  for (const l of lines) if (sent[l.key] && !fresh.includes(l)) next[l.key] = sent[l.key]
  for (const l of fresh) next[l.key] = now
  user.set('shortcut_sent', next)
  app.save(user)
  return fresh.map(l => l.text)
}

// "melk, eieren" or one per line; existing entries (same name) are left alone.
function add (app, text) {
  const names = String(text || '').split(/[\n,;]+/).map(s => s.trim()).filter(Boolean).slice(0, 20)
  const existing = {}
  for (const x of app.findRecordsByFilter('shopping_extras', '', '', 0, 0)) existing[x.getString('name').toLowerCase()] = true
  const added = []
  const col = app.findCollectionByNameOrId('shopping_extras')
  for (const raw of names) {
    const name = raw.slice(0, 120)
    if (existing[name.toLowerCase()]) continue
    const rec = new Record(col)
    rec.set('name', name.charAt(0).toUpperCase() + name.slice(1))
    app.save(rec)
    existing[name.toLowerCase()] = true
    added.push(rec.getString('name'))
  }
  return added
}

function dutch (user, acceptLanguage) {
  const lang = user.getString('language')
  return lang ? lang === 'nl' : /^\s*nl/i.test(acceptLanguage || '')
}

// "Hé Siri, waar is de boormachine?" Simple word matching (whole words, or one a prefix of the
// other), every searched word must match; the filler of a spoken question is ignored.
const FILLER = ['de', 'het', 'een', 'mijn', 'onze', 'ons', 'waar', 'is', 'ligt', 'liggen', 'staat', 'staan', 'zit', 'zitten', 'hangt', 'zijn', 'van', 'die', 'dat',
  'the', 'a', 'an', 'my', 'our', 'where', 'are', 'did', 'we', 'put', 'keep', 'of']
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const wordsOf = s => norm(s).split(/[^a-z0-9]+/).filter(Boolean)
const close = (a, b) => {
  if (a === b) return 3
  if (a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a))) return 2
  if (a.length >= 4 && b.includes(a)) return 1 // "boormachine" in "accuboormachine"
  return 0
}
function score (query, name, extra) {
  const own = wordsOf(name)
  const more = wordsOf(extra)
  let total = 0
  for (const q of query) {
    let best = 0
    for (const w of own) best = Math.max(best, close(q, w))
    for (const w of more) best = Math.max(best, close(q, w) * 0.8)
    if (!best) return 0
    total += best
  }
  return total + (norm(name).trim() === query.join(' ') ? 2 : 0)
}

function where (app, user, nl, q) {
  const all = wordsOf(q)
  const query = all.filter(w => FILLER.indexOf(w) < 0)
  const words = query.length ? query : all
  if (!words.length) return { found: false, text: nl ? 'Wat zoek je?' : 'What are you looking for?' }

  const places = {}
  for (const p of app.findRecordsByFilter('places', '', '', 0, 0)) places[p.id] = { name: p.getString('name'), parent: p.getString('parent') }
  const path = id => {
    const names = []
    for (let at = places[id], n = 0; at && n < 12; at = places[at.parent], n++) names.unshift(at.name)
    return names.join(', ')
  }
  const userName = id => {
    try {
      const u = app.findRecordById('users', id)
      return u.getString('name') || u.getString('email').split('@')[0]
    } catch (_) {
      return '?'
    }
  }

  const hits = []
  for (const i of app.findRecordsByFilter('items', "deleted = '' && gone = '' && needs_name = false", '', 0, 0)) {
    const s = score(words, i.getString('name'), [i.getString('aliases'), i.getString('brand')].join(' '))
    if (s) hits.push({ s, i })
  }
  hits.sort((a, b) => b.s - a.s)
  const lines = hits.slice(0, 2).map(({ i }) => {
    const spot = path(i.getString('place')) || (nl ? 'nog zonder plek' : 'no place yet')
    let line = `${i.getString('name')}: ${spot}.`
    if (i.getString('lent_to')) line += nl ? ` Uitgeleend aan ${i.getString('lent_to')}.` : ` Lent to ${i.getString('lent_to')}.`
    if (i.getString('with_user')) line += nl ? ` ${userName(i.getString('with_user'))} heeft het bij zich.` : ` ${userName(i.getString('with_user'))} has it.`
    if (i.getBool('missing')) line += nl ? ' Staat als kwijt gemarkeerd.' : ' Marked as missing.'
    return line
  })
  if (lines.length) {
    if (hits.length > 2) lines.push(nl ? `En nog ${hits.length - 2} in de app.` : `And ${hits.length - 2} more in the app.`)
    return { found: true, text: lines.join(' ') }
  }

  // No thing by that name: maybe it's a spot ("waar is kast 3?").
  let place = null
  let best = 0
  for (const id in places) {
    const s = score(words, places[id].name, '')
    if (s > best) { best = s; place = id }
  }
  if (place) {
    const parent = path(places[place].parent)
    return { found: true, text: parent ? `${places[place].name}: ${parent}.` : (nl ? `${places[place].name} is een ruimte.` : `${places[place].name} is a room.`) }
  }
  const asked = String(q).trim()
  return { found: false, text: nl ? `Ik vind niets voor „${asked}”. Ik heb het genoteerd.` : `Nothing found for "${asked}". I've noted it.` }
}

// Things already in the house that look like what was just put on the list ("tape" when there is a
// roll in the garage). Low supplies don't count: that's why they're bought.
function inHouse (app, names) {
  const places = {}
  for (const p of app.findRecordsByFilter('places', '', '', 0, 0)) places[p.id] = { name: p.getString('name'), parent: p.getString('parent') }
  const path = id => {
    const out = []
    for (let at = places[id], n = 0; at && n < 12; at = places[at.parent], n++) out.unshift(at.name)
    return out.join(', ')
  }
  const items = app.findRecordsByFilter('items', "deleted = '' && gone = '' && needs_name = false && lent_to = ''", '', 0, 0)
    .filter(i => !((i.getInt('min_quantity') > 0 || i.getBool('staple')) && i.getInt('quantity') <= i.getInt('min_quantity')))
  const found = []
  for (const name of names) {
    const words = wordsOf(name)
    if (!words.some(w => w.length >= 3)) continue
    const hit = items.find(i => score(words, i.getString('name'), i.getString('aliases')))
    if (hit) found.push(`${hit.getString('name')} (${path(hit.getString('place')) || '?'})`)
  }
  return found
}

module.exports = { token, userFor, shopping, add, dutch, where, inHouse }
