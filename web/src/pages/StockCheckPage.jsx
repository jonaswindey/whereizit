import { useState } from 'react'
import { useNavigate } from 'react-router'
import Stepper from '../components/Stepper.jsx'
import Thumb from '../components/Thumb.jsx'
import { useData } from '../lib/data.jsx'
import { pb, thumbUrl } from '../lib/pb.js'
import { t } from '../lib/i18n.jsx'

// Walk past the fridge and cupboards, adjust what's off, tap Done. Counts are saved together at the
// end so a half-finished check doesn't look like a finished one.
export default function StockCheckPage () {
  const data = useData()
  const navigate = useNavigate()
  const [counts, setCounts] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const staples = data.staples
  const count = i => counts[i.id] ?? i.quantity ?? 0

  const done = async () => {
    setSaving(true)
    setError(null)
    const now = new Date().toISOString()
    try {
      await Promise.all(staples.map(i => pb.collection('items').update(i.id, { quantity: count(i), checked_at: now })))
      await data.reload()
      navigate('/shopping')
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className='page'>
      <h1 className='page-title'>{t('stock.checkTitle')}</h1>
      <p className='muted'>{t('stock.checkIntro')}</p>
      {!staples.length && <p className='empty'>{t('stock.none')}</p>}
      <ul className='rows'>
        {staples.map(i => {
          const n = count(i)
          const low = n <= (i.min_quantity || 0)
          return (
            <li key={i.id} className={`row-card ${low ? 'low' : ''}`}>
              <div className='row-main'>
                <Thumb src={thumbUrl(i, i.photos?.[0])} name={i.name} />
                <div>
                  <strong>{i.name}</strong>
                  <small>{low ? t('stock.toBuy', { count: Math.max((i.stock_target || (i.min_quantity || 0) + 1) - n, 1), unit: i.unit || '' }) : data.whereText(i.place)}</small>
                </div>
              </div>
              <Stepper value={n} onChange={v => setCounts(c => ({ ...c, [i.id]: v }))} suffix={i.unit ? ` ${i.unit}` : null} />
            </li>
          )
        })}
      </ul>
      {error && <p className='error'>{error}</p>}
      {staples.length > 0 && (
        <div className='bulk-bar'>
          <span>{t('stock.changed', { count: Object.keys(counts).filter(id => counts[id] !== (data.itemById.get(id)?.quantity ?? 0)).length })}</span>
          <button className='btn primary' disabled={saving} onClick={done}>{t('stock.done')}</button>
        </div>
      )}
    </div>
  )
}
