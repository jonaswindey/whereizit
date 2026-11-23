import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import Icon from '../components/Icon.jsx'
import ItemPicker from '../components/ItemPicker.jsx'
import Thumb from '../components/Thumb.jsx'
import { useData } from '../lib/data.jsx'
import { pb, thumbUrl } from '../lib/pb.js'
import { t } from '../lib/i18n.jsx'

// A gather list ("Camping trip"): items grouped by where they are, so you collect them in one walk.
// "Put back" mode groups by each item's home and un-ticks as things go back.
export default function ListPage () {
  const { id } = useParams()
  const data = useData()
  const navigate = useNavigate()
  const [mode, setMode] = useState('gather') // 'gather' | 'putback'
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState(null)
  const list = data.lists.find(l => l.id === id)
  if (!list) return <p className='muted center'>{data.loading ? t('common.loading') : t('lists.gone')}</p>

  const items = (list.items ?? []).map(i => data.itemById.get(i)).filter(Boolean)
  const done = new Set((list.done ?? []).filter(i => data.itemById.has(i)))

  const save = async values => {
    setError(null)
    try {
      await pb.collection('lists').update(id, values)
      await data.reload()
    } catch (err) {
      setError(err.message)
    }
  }
  const toggle = itemId => save({ done: done.has(itemId) ? [...done].filter(x => x !== itemId) : [...done, itemId] })
  const removeItem = itemId => save({ items: list.items.filter(x => x !== itemId), done: [...done].filter(x => x !== itemId) })
  const addTag = tagId => {
    if (!tagId) return
    const ids = data.itemsWithTag(tagId).map(i => i.id)
    save({ items: [...new Set([...(list.items ?? []), ...ids])] })
  }
  const remove = async () => {
    if (!window.confirm(t('confirm.delete', { name: list.name }))) return
    try {
      await pb.collection('lists').delete(id)
      await data.reload()
      navigate('/lists')
    } catch (err) {
      setError(err.message)
    }
  }

  // Gather: everything, grouped by current place. Put back: only gathered items, grouped by home.
  const shown = mode === 'gather' ? items : items.filter(i => done.has(i.id))
  const groupKey = i => (mode === 'gather' ? i.place : i.home || i.place)
  const groups = new Map()
  for (const i of shown) {
    const k = groupKey(i)
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k).push(i)
  }
  const sorted = [...groups.entries()].sort(([a], [b]) => data.pathText(a).localeCompare(data.pathText(b)))
  const isTicked = i => (mode === 'gather' ? done.has(i.id) : !done.has(i.id))

  return (
    <div className='page'>
      <h1 className='page-title'>{list.name}</h1>
      <p className='muted'>{mode === 'gather' ? t('lists.progress', { done: done.size, total: items.length }) : t('lists.toPutBack', { count: done.size })}</p>
      <div className='segmented left' role='group'>
        <button className={mode === 'gather' ? 'on' : ''} onClick={() => setMode('gather')}>{t('lists.gather')}</button>
        <button className={mode === 'putback' ? 'on' : ''} onClick={() => setMode('putback')}>{t('lists.putBack')}</button>
      </div>
      <div className='actions'>
        <button className='chip' onClick={() => setPicking(true)}><Icon name='plus' size={16} />{t('lists.addItems')}</button>
        {data.tags.length > 0 && (
          <select className='chip' value='' onChange={e => addTag(e.target.value)} aria-label={t('lists.addTag')}>
            <option value=''>{t('lists.addTag')}</option>
            {data.tags.map(tag => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
          </select>
        )}
        {done.size > 0 && <button className='chip' onClick={() => save({ done: [] })}>{t('lists.reset')}</button>}
        <button className='chip danger' onClick={remove}><Icon name='trash' size={16} />{t('action.delete')}</button>
      </div>
      {error && <p className='error'>{error}</p>}
      {!items.length && <p className='empty'>{t('lists.empty')}</p>}
      {mode === 'putback' && items.length > 0 && !done.size && <p className='empty'>{t('lists.allBack')}</p>}

      {sorted.map(([placeId, group]) => (
        <section key={placeId}>
          <h2><Icon name={mode === 'gather' ? 'box' : 'home'} size={16} /><Link to={placeId ? `/p/${placeId}` : '/unsorted'}>{data.whereText(placeId)}</Link></h2>
          <ul className='rows'>
            {group.map(i => (
              <li key={i.id} className={`row-card gather ${isTicked(i) ? 'ticked' : ''}`}>
                <button className='tick' onClick={() => toggle(i.id)} aria-pressed={isTicked(i)}>
                  {isTicked(i) && <Icon name='check' size={20} />}
                </button>
                <Link to={`/i/${i.id}`} className='row-main'>
                  <Thumb src={thumbUrl(i, i.photos?.[0])} name={i.name} />
                  <div>
                    <strong>{i.name}{i.quantity > 1 && <em> ×{i.quantity}</em>}</strong>
                    {i.lent_to && <small className='lent-note'>{t('search.lentTo', { name: i.lent_to })}</small>}
                  </div>
                </Link>
                {mode === 'gather' && <button className='ghost' onClick={() => removeItem(i.id)} aria-label={t('action.remove')}><Icon name='close' size={18} /></button>}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {picking && (
        <ItemPicker title={t('lists.addItems')} selected={list.items ?? []} onChange={ids => save({ items: ids, done: [...done].filter(x => ids.includes(x)) })} onClose={() => setPicking(false)} />
      )}
    </div>
  )
}
