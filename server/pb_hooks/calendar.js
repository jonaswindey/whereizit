// Builds a private iCalendar feed with the dates the app tracks, so reminders come from the phone's
// own calendar (web push to an iOS home-screen app needs a public push service; this does not).

const WORDS = {
  en: { expires: 'Expires', warranty: 'Warranty ends', due: 'Return due', back: 'Give back', from: 'from', maint: 'Maintenance', name: 'whereizit', stock: 'Check supplies', low: 'Running low', need: 'You need', ready: 'Get it ready' },
  nl: { expires: 'Vervalt', warranty: 'Garantie loopt af', due: 'Terug verwacht', back: 'Terugbrengen', from: 'van', maint: 'Onderhoud', name: 'whereizit', stock: 'Voorraad nakijken', low: 'Bijna op', need: 'Nodig', ready: 'Klaarleggen' }
}

const esc = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

// RFC 5545: lines longer than 75 octets are folded; count UTF-8 bytes so accents don't break it.
function fold (line) {
  const out = []
  let cur = ''
  let bytes = 0
  for (const ch of line) {
    const n = unescape(encodeURIComponent(ch)).length
    if (bytes + n > 73) {
      out.push(cur)
      cur = ' '
      bytes = 1
    }
    cur += ch
    bytes += n
  }
  out.push(cur)
  return out.join('\r\n')
}

const day = s => s.slice(0, 10).replace(/-/g, '')
const nextDay = ymd => {
  const d = new Date(Date.UTC(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8) + 1))
  return d.toISOString().slice(0, 10).replace(/-/g, '')
}

function pickLang (user, acceptLanguage) {
  const own = user.getString('language')
  if (WORDS[own]) return own
  return /^\s*nl/i.test(acceptLanguage || '') ? 'nl' : 'en'
}

function build (app, user, opts) {
  const w = WORDS[pickLang(user, opts.acceptLanguage)]
  const places = {}
  for (const p of app.findAllRecords('places')) places[p.id] = p
  const pathOf = id => {
    const names = []
    const seen = {}
    let cur = places[id]
    while (cur && !seen[cur.id]) {
      seen[cur.id] = true
      names.unshift(cur.getString('name'))
      cur = places[cur.getString('parent')]
    }
    return names.join(' › ')
  }

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
  const today = new Date().toISOString().slice(0, 10)
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//whereizit//calendar//EN', 'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${w.name}`, 'REFRESH-INTERVAL;VALUE=DURATION:PT6H', 'X-PUBLISHED-TTL:PT6H'
  ]
  const event = (uid, date, summary, item) => {
    const start = day(date)
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}@whereizit`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${nextDay(start)}`,
      `SUMMARY:${esc(summary)}`,
      `DESCRIPTION:${esc(pathOf(item.getString('place')))}`,
      `URL:${opts.baseUrl}/i/${item.id}`,
      'TRANSP:TRANSPARENT',
      // 09:00 on the day itself.
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(summary)}`, 'TRIGGER:PT9H', 'END:VALARM',
      'END:VEVENT'
    )
  }

  const items = app.findRecordsByFilter('items', "deleted = '' && gone = '' && needs_name = false", '', 10000, 0)
  for (const item of items) {
    const name = item.getString('name')
    const expires = item.getString('expires')
    const warranty = item.getString('warranty_until')
    const due = item.getString('lent_due')
    const lentTo = item.getString('lent_to')
    if (expires) event(`${item.id}-expires`, expires, `${w.expires}: ${name}`, item)
    if (warranty) event(`${item.id}-warranty`, warranty, `${w.warranty}: ${name}`, item)
    if (lentTo && due) event(`${item.id}-due`, due, `${w.due}: ${name} (${lentTo})`, item)
    const owner = item.getString('borrowed_from')
    const back = item.getString('borrowed_due')
    if (owner && back) event(`${item.id}-back`, back, `${w.back}: ${name} (${owner})`, item)
    const every = item.getInt('service_every_days')
    if (every > 0) {
      const last = item.getString('serviced_at')
      // Never done or overdue: shows today, and moves along until it is marked done.
      let next = last ? new Date(new Date(last.replace(' ', 'T')).getTime() + every * 86400000).toISOString().slice(0, 10) : today
      if (next < today) next = today
      const what = item.getString('service_note')
      event(`${item.id}-maint`, next, `${w.maint}: ${name}${what ? ` (${what})` : ''}`, item)
    }
  }
  // Your own claims ("I need the tent on Saturday"): the days you need it, and a nudge at 18:00 the
  // evening before to get it ready.
  const byId = {}
  for (const item of items) byId[item.id] = item
  const claims = app.findRecordsByFilter('reservations', 'user = {:u} && (start >= {:t} || end >= {:t})', 'start', 500, 0, { u: user.id, t: today })
  for (const r of claims) {
    const item = byId[r.getString('item')]
    if (!item) continue
    const start = day(r.getString('start'))
    const end = r.getString('end') ? day(r.getString('end')) : start
    const note = r.getString('note')
    const summary = `${w.need}: ${item.getString('name')}${note ? ` (${note})` : ''}`
    lines.push(
      'BEGIN:VEVENT',
      `UID:${r.id}-claim@whereizit`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${nextDay(end < start ? start : end)}`,
      `SUMMARY:${esc(summary)}`,
      `DESCRIPTION:${esc(pathOf(item.getString('place')))}`,
      `URL:${opts.baseUrl}/i/${item.id}`,
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(`${w.ready}: ${item.getString('name')}`)}`, 'TRIGGER:-PT6H', 'END:VALARM',
      'END:VEVENT'
    )
  }
  // Recurring stock-check reminder in floating local time (no time zone: it follows the phone).
  const freq = user.getString('stock_check')
  if (freq) {
    const days = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']
    const day = user.getInt('stock_check_day')
    const time = (user.getString('stock_check_time') || '18:00').replace(':', '')
    const start = new Date()
    if (freq !== 'daily') {
      // Next occurrence of the chosen weekday (JS Sunday = 0; ours Monday = 0).
      while ((start.getDay() + 6) % 7 !== day) start.setDate(start.getDate() + 1)
    }
    const ymd = `${start.getFullYear()}${String(start.getMonth() + 1).padStart(2, '0')}${String(start.getDate()).padStart(2, '0')}`
    const rule = {
      daily: 'FREQ=DAILY',
      twice_weekly: `FREQ=WEEKLY;BYDAY=${days[day]},${days[(day + 3) % 7]}`,
      weekly: `FREQ=WEEKLY;BYDAY=${days[day]}`,
      biweekly: `FREQ=WEEKLY;INTERVAL=2;BYDAY=${days[day]}`
    }[freq]
    const low = items.filter(i => (i.getBool('staple') || i.getInt('min_quantity') > 0) && i.getInt('quantity') <= i.getInt('min_quantity')).map(i => i.getString('name'))
    for (const x of app.findAllRecords('shopping_extras')) low.push(x.getString('name'))
    lines.push(
      'BEGIN:VEVENT',
      `UID:stockcheck-${user.id}@whereizit`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${ymd}T${time}00`,
      'DURATION:PT15M',
      `RRULE:${rule}`,
      `SUMMARY:${esc(w.stock)}`,
      `DESCRIPTION:${esc(low.length ? `${w.low}: ${low.join(', ')}` : '')}`,
      `URL:${opts.baseUrl}/stock/check`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(w.stock)}`, 'TRIGGER:PT0M', 'END:VALARM',
      'END:VEVENT'
    )
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}

function token (app, auth, reset) {
  const user = app.findRecordById('users', auth.id)
  let value = user.getString('calendar_token')
  if (!value || reset) {
    value = $security.randomString(40)
    user.set('calendar_token', value)
    app.save(user)
  }
  return value
}

module.exports = { build, token }
