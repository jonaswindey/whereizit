import { useState } from 'react'
import SaleSheet from '../components/SaleSheet.jsx'
import { ItemRow } from '../components/Cards.jsx'
import GoneSheet from '../components/GoneSheet.jsx'
import { useData } from '../lib/data.jsx'
import { pb } from '../lib/pb.js'
import { timeAgo } from '../lib/format.js'
import { getPref, setPref } from '../lib/recent.js'
import { showToast } from '../lib/toast.js'
import { t } from '../lib/i18n.jsx'

const PERIODS = [6, 12, 24] // months

// Things nobody has touched (opened, moved, edited, checked) for a long time: keep them, or let them go.
export default function DeclutterPage () {
  const data = useData()
  const [months, setMonths] = useState(() => Number(getPref('declutterMonths', 12)))
  const [going, setGoing] = useState(null)
  const [selling, setSelling] = useState(null)
  const [error, setError] = useState(null)
  const cutoff = new Date(Date.now() - months * 30.4 * 86400000).toISOString().replace('T', ' ')
  const lastTouched = i => [i.updated, i.checked_at, i.used_at].filter(Boolean).sort().pop()
  const rows = data.items
    .filter(i => !i.lent_to && !i.for_sale && lastTouched(i) < cutoff)
    .sort((a, b) => lastTouched(a).localeCompare(lastTouched(b)))

  const run = async fn => {
    setError(null)
    try {
      await fn()
      await data.reload()
    } catch (err) {
      setError(err.message)
    }
  }
  // "Keep" counts as having looked at it, so it drops off the list for another period.
  const keep = item => run(() => pb.collection('items').update(item.id, { checked_at: new Date().toISOString() }))
  const letGo = values => run(async () => {
    const item = going
    setGoing(null)
    await pb.collection('items').update(item.id, values)
    showToast(t('gone.done', { name: item.name }), {
      label: t('action.undo'),
      run: () => pb.collection('items').update(item.id, { gone: '', gone_reason: '', gone_note: '' }).then(data.reload)
    })
  })

  return (
    <div className='page'>
      <h1 className='page-title'>{t('declutter.title')}</h1>
      <p className='muted'>{t('declutter.intro')}</p>
      <div className='segmented left' role='group'>
        <span className='muted small'>{t('declutter.untouched')}</span>
        {PERIODS.map(m => <button key={m} className={months === m ? 'on' : ''} onClick={() => { setMonths(m); setPref('declutterMonths', m) }}>{t('declutter.months', { count: m })}</button>)}
      </div>
      {error && <p className='error'>{error}</p>}
      {!rows.length && <p className='empty'>{t('declutter.empty', { count: months })}</p>}
      <ul className='rows'>
        {rows.map(i => (
          <ItemRow key={i.id} item={i}>
            <div className='row-side'>
              <small className='muted'>{timeAgo(lastTouched(i))}</small>
              <button className='btn' onClick={() => keep(i)}>{t('declutter.keep')}</button>
              <button className='btn' onClick={() => setSelling(i)}>{t('sale.sell')}</button>
              <button className='btn' onClick={() => setGoing(i)}>{t('gone.action')}</button>
            </div>
          </ItemRow>
        ))}
      </ul>
      {going && <GoneSheet item={going} onSave={letGo} onClose={() => setGoing(null)} />}
      {selling && <SaleSheet item={selling} onSave={values => { const item = selling; setSelling(null); run(() => pb.collection('items').update(item.id, values)); showToast(t('sale.listed', { name: item.name })) }} onClose={() => setSelling(null)} />}
    </div>
  )
}
