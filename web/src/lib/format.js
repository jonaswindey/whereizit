import { getLang, t } from './i18n.jsx'

// Household currency; change here if needed.
const CURRENCY = 'EUR'

// PocketBase dates look like "2026-11-17 00:00:00.000Z".
export const toDate = value => (value ? new Date(value.replace(' ', 'T')) : null)

export const dateInput = value => (value ? value.slice(0, 10) : '')

export const formatDate = value =>
  value ? toDate(value).toLocaleDateString(getLang(), { day: 'numeric', month: 'short', year: 'numeric' }) : ''

export const formatPrice = value =>
  value ? new Intl.NumberFormat(getLang(), { style: 'currency', currency: CURRENCY }).format(value) : ''

export function timeAgo (value) {
  const seconds = Math.round((Date.now() - toDate(value).getTime()) / 1000)
  const units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]]
  const rtf = new Intl.RelativeTimeFormat(getLang(), { numeric: 'auto' })
  for (const [unit, size] of units) {
    if (seconds >= size) return rtf.format(-Math.floor(seconds / size), unit)
  }
  return t('time.justNow')
}

// Counted nouns go through the dictionary so Dutch gets "1 voorwerp / 3 voorwerpen".
export const plural = (count, noun) => t(`count.${noun}`, { count })

// Colours offered for new tags; readable as text on both themes.
export const TAG_COLORS = ['#d9612c', '#c0392b', '#8e44ad', '#2e86c1', '#16a085', '#27ae60', '#b7950b', '#6e7b8b']
