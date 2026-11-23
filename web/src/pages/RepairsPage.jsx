import { useState } from 'react'
import { ItemRow } from '../components/Cards.jsx'
import { useData } from '../lib/data.jsx'
import { pb } from '../lib/pb.js'
import { t } from '../lib/i18n.jsx'

// Broken things waiting for a fix, so they don't get used (or forgotten) in the meantime.
export default function RepairsPage () {
  const data = useData()
  const [error, setError] = useState(null)
  const fixed = async item => {
    setError(null)
    try {
      await pb.collection('items').update(item.id, { needs_repair: false, repair_note: '' })
      await data.reload()
    } catch (err) {
      setError(err.message)
    }
  }
  return (
    <div className='page'>
      <h1 className='page-title'>{t('repair.pageTitle')}</h1>
      <p className='muted'>{t('repair.intro')}</p>
      {error && <p className='error'>{error}</p>}
      {!data.repairs.length && <p className='empty'>{t('repair.empty')}</p>}
      <ul className='rows'>
        {data.repairs.map(i => (
          <ItemRow key={i.id} item={i}>
            <div className='row-side'>
              {i.repair_note && <small className='muted'>{i.repair_note}</small>}
              <button className='btn' onClick={() => fixed(i)}>{t('repair.fixed')}</button>
            </div>
          </ItemRow>
        ))}
      </ul>
    </div>
  )
}
