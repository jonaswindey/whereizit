import { useState } from 'react'
import { ItemRow } from '../components/Cards.jsx'
import { useData } from '../lib/data.jsx'
import { pb } from '../lib/pb.js'
import { t } from '../lib/i18n.jsx'

// Things that were moved "just for now" and never went back.
export default function MisplacedPage () {
  const data = useData()
  const [error, setError] = useState(null)

  const update = async (item, values) => {
    setError(null)
    try {
      await pb.collection('items').update(item.id, values)
      await data.reload()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className='page'>
      <h1 className='page-title'>{t('misplaced.title')}</h1>
      <p className='muted'>{t('misplaced.intro')}</p>
      {error && <p className='error'>{error}</p>}
      {!data.misplaced.length && <p className='empty'>{t('misplaced.empty')}</p>}
      <ul className='rows'>
        {data.misplaced.map(i => (
          <ItemRow key={i.id} item={i}>
            <div className='row-side column'>
              <small className='muted'>{t('misplaced.home', { place: data.pathText(i.home) })}</small>
              <div className='row'>
                <button className='btn primary' onClick={() => update(i, { place: i.home })}>{t('home.putBack')}</button>
                <button className='btn' onClick={() => update(i, { home: i.place })}>{t('home.keepHere')}</button>
              </div>
            </div>
          </ItemRow>
        ))}
      </ul>
    </div>
  )
}
