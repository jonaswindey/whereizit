/// <reference path="../pb_data/types.d.ts" />

// Records each quantity change of a supply (server-side, so every client and the import count).
// Kept short: the estimate only needs the last few weeks.
onRecordUpdateRequest((e) => {
  const before = e.record.original()
  if (e.record.getBool('staple') && before.getInt('quantity') !== e.record.getInt('quantity')) {
    let log = []
    try {
      log = JSON.parse(e.record.getString('stock_log') || '[]') || []
    } catch (_) {}
    if (!Array.isArray(log)) log = []
    // A supply that just became a staple starts its history from the old count.
    if (!log.length) log.push([new Date(Date.now() - 1000).toISOString(), before.getInt('quantity')])
    log.push([new Date().toISOString(), e.record.getInt('quantity')])
    e.record.set('stock_log', log.slice(-30))
  }
  e.next()
}, 'items')
