import { useState } from 'react'
import { ItemRow } from '../components/Cards.jsx'
import { useData } from '../lib/data.jsx'
import { pb } from '../lib/pb.js'
import { t } from '../lib/i18n.jsx'

export default function MissingPage () {
  const data = useData()
  const [error, setError] = useState(null)
  const found = async item => {
    setError(null)
    try {
      await pb.collection('items').update(item.id, { missing: false, checked_at: new Date().toISOString() })
      await data.reload()
    } catch (err) {
      setError(err.message)
    }
  }
  return (
    <div className='page'>
      <h1 className='page-title'>{t('missing.title')}</h1>
      <p className='muted'>{t('missing.intro')}</p>
      {error && <p className='error'>{error}</p>}
      {!data.missing.length && <p className='empty'>{t('missing.empty')}</p>}
      <ul className='rows'>
        {data.missing.map(i => (
          <ItemRow key={i.id} item={i}>
            <div className='row-side'><button className='btn primary' onClick={() => found(i)}>{t('missing.found')}</button></div>
          </ItemRow>
        ))}
      </ul>
    </div>
  )
}
