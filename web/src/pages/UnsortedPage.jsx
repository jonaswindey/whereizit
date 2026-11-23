import { useState } from 'react'
import { Link } from 'react-router'
import { Grid, ItemCard } from '../components/Cards.jsx'
import Icon from '../components/Icon.jsx'
import PlacePicker from '../components/PlacePicker.jsx'
import { useData } from '../lib/data.jsx'
import { pb } from '../lib/pb.js'
import { showToast } from '../lib/toast.js'
import { t } from '../lib/i18n.jsx'

// Things added before deciding where they go. Select a few and put them away together.
export default function UnsortedPage () {
  const data = useData()
  const [selected, setSelected] = useState(null) // null = not selecting, else Set of item ids
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState(null)
  const items = data.unsorted

  const toggle = id => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const putAway = async place => {
    setPicking(false)
    setError(null)
    const ids = [...selected]
    try {
      // First place is also the home: that's where it was decided it belongs.
      await Promise.all(ids.map(id => pb.collection('items').update(id, { place, home: place })))
      setSelected(null)
      await data.reload()
      showToast(t('move.bulkDone', { count: ids.length, place: data.pathText(place) }), {
        label: t('action.undo'),
        run: () => Promise.all(ids.map(id => pb.collection('items').update(id, { place: '', home: '' })))
          .then(data.reload)
          .catch(err => showToast(t('move.undoFailed', { error: err.message })))
      })
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className='page'>
      <h1 className='page-title'>{t('unsorted.title')}</h1>
      <p className='muted'>{t('unsorted.intro')}</p>
      {error && <p className='error'>{error}</p>}
      <div className='action-row'>
        <Link className='btn' to='/add/unsorted'><Icon name='camera' size={18} />{t('unsorted.add')}</Link>
        {items.length > 0 && (
          <button className={`chip ${selected ? 'on' : ''}`} onClick={() => setSelected(selected ? null : new Set())}>{selected ? t('action.cancel') : t('action.select')}</button>
        )}
        {selected && items.length > 1 && (
          <button className='chip' onClick={() => setSelected(selected.size === items.length ? new Set() : new Set(items.map(i => i.id)))}>
            {selected.size === items.length ? t('unsorted.selectNone') : t('unsorted.selectAll')}
          </button>
        )}
      </div>
      {!items.length && <p className='empty'>{t('unsorted.empty')}</p>}
      <Grid>
        {items.map(i => <ItemCard key={i.id} item={i} selectable={!!selected} selected={selected?.has(i.id)} onToggle={toggle} />)}
      </Grid>
      {selected?.size > 0 && (
        <div className='bulk-bar'>
          <span>{t('count.item', { count: selected.size })}</span>
          <button className='btn primary' onClick={() => setPicking(true)}><Icon name='move' size={18} />{t('unsorted.putAway')}</button>
        </div>
      )}
      {picking && <PlacePicker title={t('bulk.moveTo', { count: selected?.size ?? 0 })} suggestFor={items.filter(i => selected?.has(i.id))} onPick={putAway} onClose={() => setPicking(false)} />}
    </div>
  )
}
