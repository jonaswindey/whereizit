import { getLang, t } from './i18n.jsx'

// Claims ("I need the tent on Saturday") are whole days, kept as YYYY-MM-DD in local time and only
// ever compared as strings, so a time zone never moves them to another day.
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const today = () => ymd(new Date())
export const inDays = n => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return ymd(d)
}
// Weekends are when the tent and the ladder come out: the coming Saturday (today if it is one).
export const nextSaturday = () => inDays((6 - new Date().getDay() + 7) % 7)

export const claimStart = c => c.start.slice(0, 10)
export const claimEnd = c => (c.end ? c.end.slice(0, 10) : claimStart(c))
export const overlaps = (c, from, to) => claimStart(c) <= to && claimEnd(c) >= from

export function dayLabel (day) {
  if (day === today()) return t('claim.today')
  if (day === inDays(1)) return t('claim.tomorrow')
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(getLang(), { weekday: 'short', day: 'numeric', month: 'short' })
}

export const claimWhen = c => claimStart(c) === claimEnd(c)
  ? dayLabel(claimStart(c))
  : t('claim.range', { from: dayLabel(claimStart(c)), to: dayLabel(claimEnd(c)) })

// What would stop the thing being there on the day: lent out (and not back in time), going back to
// its owner first, up for sale, or missing.
export function conflicts (item, start) {
  const out = []
  if (item.lent_to && (!item.lent_due || item.lent_due.slice(0, 10) >= start)) out.push(t('claim.lent', { name: item.lent_to }))
  if (item.borrowed_from && item.borrowed_due && item.borrowed_due.slice(0, 10) < start) out.push(t('claim.backFirst', { name: item.borrowed_from }))
  if (item.for_sale) out.push(t('claim.forSale'))
  if (item.missing) out.push(t('claim.missing'))
  return out
}
