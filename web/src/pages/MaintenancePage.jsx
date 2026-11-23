import { useState } from 'react'
import { ItemRow } from '../components/Cards.jsx'
import { useData } from '../lib/data.jsx'
import { pb } from '../lib/pb.js'
import { t } from '../lib/i18n.jsx'
import { formatDate } from '../lib/format.js'

export default function MaintenancePage () {
  const data = useData()
  const [error, setError] = useState(null)
  const markDone = async item => {
    setError(null)
    try {
      await pb.collection('items').update(item.id, { serviced_at: new Date().toISOString() })
      await data.reload()
    } catch (err) {
      setError(err.message)
    }
  }
  return (
    <div className='page'>
      <h1 className='page-title'>{t('maint.title')}</h1>
      <p className='muted'>{t('maint.intro')}</p>
      {error && <p className='error'>{error}</p>}
      {!data.maintenanceDue.length && <p className='empty'>{t('maint.empty')}</p>}
      <ul className='rows'>
        {data.maintenanceDue.map(i => {
          const due = data.nextService(i)
          return (
            <ItemRow key={i.id} item={i}>
              <div className='row-side column'>
                <small className={due < Date.now() ? 'danger-text' : 'muted'}>
                  {i.service_note && <>{i.service_note} · </>}
                  {due < Date.now() ? t('maint.overdue') : t('maint.dueOn', { date: formatDate(new Date(due).toISOString()) })}
                </small>
                <button className='btn primary' onClick={() => markDone(i)}>{t('maint.markDone')}</button>
              </div>
            </ItemRow>
          )
        })}
      </ul>
    </div>
  )
}
