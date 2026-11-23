// What a device takes ("AA ×4", "2x CR2032", "9V") and how many of that kind are in the house, so
// nobody buys AAA while a drawer is full of them, or opens the remote to find out.
const TYPES = /(?:^|[^a-z0-9])(AAA|AA|C|D|9 ?V|CR ?\d{4}|LR ?\d{2,4}|SR ?\d{2,4}|18650|21700)(?![a-z0-9])/i
const BATTERY_WORD = /batter|knoopcel|button cell|\bcel(len)?\b|\bcells?\b/i

export function parseBattery (text) {
  const s = String(text || '').trim()
  if (!s) return null
  const m = s.match(TYPES)
  const type = m ? m[1].toUpperCase().replace(/\s/g, '') : s
  const n = s.match(/(\d+)\s*[x×]|[x×]\s*(\d+)|^(\d+)\s+(?=\S)/i)
  const count = n ? Number(n[1] ?? n[2] ?? n[3]) : null
  return { type, count: count > 0 && count < 100 ? count : null }
}

const tokens = s => String(s || '').toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean)

// Items that are batteries of this type: "AA batterijen", "Knoopcel CR2032", or simply "CR2032".
export function batteryStock (items, type) {
  return items.filter(i => {
    if (i.battery) return false // a device, not a pack of batteries
    const text = `${i.name} ${i.aliases ?? ''}`
    const has = tokens(text).includes(type)
    return has && (BATTERY_WORD.test(text) || tokens(i.name).length === 1 || type.length > 3)
  })
}

export const label = b => (b.count ? `${b.type} ×${b.count}` : b.type)
