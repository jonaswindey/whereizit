import { useCallback, useEffect, useState } from 'react'
import Thumb from '../components/Thumb.jsx'
import { useData } from '../lib/data.jsx'
import { pb, thumbUrl } from '../lib/pb.js'
import { formatDate, formatPrice } from '../lib/format.js'
import { t } from '../lib/i18n.jsx'

// "What did we do with the old drill?" Items that left the house, newest first.
export default function GonePage () {
  const data = useData()
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    pb.collection('items').getFullList({ filter: "gone != '' && deleted = ''", sort: '-gone' })
      .then(setRows)
      .catch(err => setError(err.message))
  }, [])
  useEffect(load, [load])

  const bringBack = async item => {
    setError(null)
    try {
      await pb.collection('items').update(item.id, { gone: '', gone_reason: '', gone_note: '' })
      await data.reload()
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  if (!rows && !error) return <p className='muted center'>{t('common.loading')}</p>
  const sold = (rows ?? []).filter(i => i.gone_reason === 'sold').length

  return (
    <div className='page'>
      <h1 className='page-title'>{t('gone.pageTitle')}</h1>
      <p className='muted'>{t('gone.intro')}</p>
      {error && <p className='error'>{error}</p>}
      {rows?.length === 0 && <p className='empty'>{t('gone.empty')}</p>}
      {sold > 0 && <p className='muted small'>{t('gone.soldCount', { count: sold })}</p>}
      <ul className='rows'>
        {rows?.map(i => (
          <li key={i.id} className='row-card'>
            <div className='row-main'>
              <Thumb src={thumbUrl(i, i.photos?.[0])} name={i.name} />
              <div>
                <strong>{i.name}</strong>
                <small>
                  {[t(`gone.reason.${i.gone_reason || 'other'}`), i.gone_note, formatDate(i.gone)].filter(Boolean).join(' · ')}
                </small>
                {i.place && data.placeById.has(i.place) && <small className='muted'>{t('gone.was', { place: data.pathText(i.place) })}{i.price > 0 && ` · ${formatPrice(i.price)}`}</small>}
              </div>
            </div>
            <div className='row-side'><button className='btn' onClick={() => bringBack(i)}>{t('gone.bringBack')}</button></div>
          </li>
        ))}
      </ul>
    </div>
  )
}
