import { toDate } from './format.js'

export const STOCK_FREQS = ['daily', 'twice_weekly', 'weekly', 'biweekly']
const DAYS = { daily: 1, twice_weekly: 3.5, weekly: 7, biweekly: 14 }

// Due when the person's interval has passed since anyone in the household last checked.
export function stockCheckDue (user, lastCheck, hasStaples) {
  if (!hasStaples || !user?.stock_check) return false
  if (!lastCheck) return true
  const since = (Date.now() - toDate(lastCheck).getTime()) / 86400000
  return since >= DAYS[user.stock_check] - 0.5
}

// Plain-text list for messages and notes apps, grouped by shop.
export function shoppingText (groups, t) {
  return groups.map(([shop, items]) => [
    shop ? `${shop}:` : null,
    ...items.map(({ item, need, extra }) => (extra ? `- ${extra.name}` : `- ${need} ${item.unit ? `${item.unit} ` : ''}${item.name}`))
  ].filter(Boolean).join('\n')).join('\n\n')
}
