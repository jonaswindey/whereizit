import { useState } from 'react'
import { Link, useParams } from 'react-router'
import Breadcrumb from '../components/Breadcrumb.jsx'
import Icon from '../components/Icon.jsx'
import Thumb from '../components/Thumb.jsx'
import { useData } from '../lib/data.jsx'
import { pb, thumbUrl } from '../lib/pb.js'
import { t } from '../lib/i18n.jsx'
import { timeAgo } from '../lib/format.js'

// Stocktake: open a box/room, tap "still here" or "missing" for each item.
export default function CheckPage () {
  const { id } = useParams()
  const data = useData()
  const [done, setDone] = useState({}) // itemId → 'here' | 'missing', for this session
  const [error, setError] = useState(null)
  const place = data.placeById.get(id)
  if (!place) return <p className='muted center'>{data.loading ? t('common.loading') : t('place.unknown')}</p>

  const items = data.itemsOf(id)
  const mark = async (item, state) => {
    setError(null)
    setDone(d => ({ ...d, [item.id]: state }))
    try {
      await pb.collection('items').update(item.id, state === 'here'
        ? { missing: false, checked_at: new Date().toISOString() }
        : { missing: true })
      await data.reload()
    } catch (err) {
      setDone(d => ({ ...d, [item.id]: undefined }))
      setError(err.message)
    }
  }
  const count = Object.values(done).filter(Boolean).length

  return (
    <div className='page'>
      <Breadcrumb placeId={id} includeLast />
      <h1 className='page-title'>{t('check.title', { name: place.name })}</h1>
      <p className='muted'>{t('check.progress', { done: count, total: items.length })}</p>
      {error && <p className='error'>{error}</p>}
      {!items.length && <p className='empty'>{t('check.none')}</p>}
      <ul className='rows check-list'>
        {items.map(i => (
          <li key={i.id} className={`row-card ${done[i.id] ?? ''}`}>
            <div className='row-main'>
              <Thumb src={thumbUrl(i, i.photos?.[0])} name={i.name} />
              <div>
                <strong>{i.name}{i.quantity > 1 && <em> ×{i.quantity}</em>}</strong>
                <small>{i.checked_at ? t('check.lastSeen', { when: timeAgo(i.checked_at) }) : t('check.never')}</small>
              </div>
            </div>
            <div className='row-side'>
              <button className={`btn ${done[i.id] === 'here' ? 'primary' : ''}`} onClick={() => mark(i, 'here')}><Icon name='check' size={18} />{t('check.here')}</button>
              <button className={`btn ${done[i.id] === 'missing' ? 'danger-fill' : ''}`} onClick={() => mark(i, 'missing')}>{t('check.missing')}</button>
            </div>
          </li>
        ))}
      </ul>
      {items.length > 0 && count === items.length && (
        <p className='empty'>{t('check.finished')} <Link to={`/p/${id}`}>{t('check.back', { name: place.name })}</Link></p>
      )}
    </div>
  )
}
