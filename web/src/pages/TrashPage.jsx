import { useCallback, useEffect, useState } from 'react'
import Thumb from '../components/Thumb.jsx'
import { useData } from '../lib/data.jsx'
import { pb, thumbUrl } from '../lib/pb.js'
import { timeAgo } from '../lib/format.js'
import { t } from '../lib/i18n.jsx'

export default function TrashPage () {
  const data = useData()
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    pb.collection('items').getFullList({ filter: "deleted != ''", sort: '-deleted' })
      .then(setRows)
      .catch(err => setError(err.message))
  }, [])
  useEffect(load, [load])

  const act = async fn => {
    setError(null)
    try {
      await fn()
      load()
      await data.reload()
    } catch (err) {
      setError(err.message)
    }
  }
  const restore = item => act(() => pb.collection('items').update(item.id, { deleted: '' }))
  const purge = item => act(async () => {
    if (window.confirm(t('trash.confirmPurge', { name: item.name }))) await pb.collection('items').delete(item.id)
  })
  const purgeAll = () => act(async () => {
    if (!window.confirm(t('trash.confirmEmpty', { count: rows.length }))) return
    await Promise.all(rows.map(i => pb.collection('items').delete(i.id)))
  })

  if (error) return <p className='error center'>{error}</p>
  if (!rows) return <p className='muted center'>{t('common.loading')}</p>

  return (
    <div className='page'>
      <h1 className='page-title'>{t('trash.title')}</h1>
      <p className='muted'>{t('trash.intro')}</p>
      {!rows.length && <p className='empty'>{t('trash.empty')}</p>}
      {rows.length > 0 && <button className='btn danger-text' onClick={purgeAll}>{t('trash.emptyAction')}</button>}
      <ul className='rows'>
        {rows.map(i => (
          <li key={i.id} className='row-card'>
            <div className='row-main'>
              <Thumb src={thumbUrl(i, i.photos?.[0])} name={i.name} />
              <div>
                <strong>{i.name}</strong>
                <small>{t('trash.wasIn', { place: data.pathText(i.place) || t('trash.deletedPlace') })} · {timeAgo(i.deleted)}</small>
              </div>
            </div>
            <div className='row-side'>
              <button className='btn' onClick={() => restore(i)}>{t('trash.restore')}</button>
              <button className='btn danger-text' onClick={() => purge(i)}>{t('action.delete')}</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
