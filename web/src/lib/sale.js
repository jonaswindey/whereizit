import { fileUrl } from './pb.js'
import { formatPrice } from './format.js'
import { t } from './i18n.jsx'

// A starting point, not an appraisal: 60% of what it cost, less 15% for every year since, at least
// 20%, rounded to €5 (€1 below €20). Nothing to go on → no suggestion.
export function suggestPrice (item) {
  if (!item.price) return null
  const bought = item.purchase_date ? new Date(item.purchase_date.replace(' ', 'T')) : null
  const years = bought ? Math.max(0, (Date.now() - bought.getTime()) / 31536e6) : 1
  const value = item.price * Math.max(0.2, 0.6 * 0.85 ** years)
  const step = value < 20 ? 1 : 5
  return Math.max(1, Math.round(value / step) * step)
}

export function listingText (item) {
  const lines = [item.name]
  const make = [item.brand, item.model].filter(Boolean).join(' ')
  if (make && !item.name.toLowerCase().includes(make.toLowerCase())) lines.push(make)
  if (item.purchase_date) lines.push(t('sale.boughtIn', { year: item.purchase_date.slice(0, 4) }))
  if (item.note) lines.push(item.note)
  lines.push(item.sale_price ? t('sale.asking', { price: formatPrice(item.sale_price) }) : t('sale.makeOffer'))
  return lines.join('\n')
}

// With photos where the phone can share files (iOS, Android), so the listing app gets them directly.
// Returns 'shared' | 'copied' | 'cancelled'.
export async function shareListing (item) {
  const text = listingText(item)
  if (navigator.share) {
    let files = []
    try {
      files = await Promise.all((item.photos ?? []).slice(0, 4).map(async (f, n) => {
        const res = await fetch(fileUrl(item, f))
        if (!res.ok) throw new Error(res.statusText)
        const blob = await res.blob()
        return new File([blob], `${item.name.replace(/[^\w-]+/g, '_')}-${n + 1}.${(blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')}`, { type: blob.type })
      }))
    } catch (err) {
      console.warn('listing photos:', err.message)
      files = []
    }
    const payload = files.length && navigator.canShare?.({ files, text }) ? { files, text } : { title: item.name, text }
    try {
      await navigator.share(payload)
      return 'shared'
    } catch (err) {
      if (err.name === 'AbortError') return 'cancelled'
      throw err
    }
  }
  await navigator.clipboard.writeText(text)
  return 'copied'
}
