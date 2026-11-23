import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Grid, ItemCard } from '../components/Cards.jsx'
import Icon from '../components/Icon.jsx'
import PlacePicker from '../components/PlacePicker.jsx'
import { showToast } from '../lib/toast.js'
import { useData } from '../lib/data.jsx'
import { pb } from '../lib/pb.js'
import { TAG_COLORS, plural } from '../lib/format.js'
import { t } from '../lib/i18n.jsx'

// "Where is all the Christmas stuff?" — items with this tag, grouped by where they are.
export default function TagPage () {
  const { id } = useParams()
  const data = useData()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [moving, setMoving] = useState(false)
  const [error, setError] = useState(null)
  const tag = data.tagById.get(id)
  if (!tag) return <p className='muted center'>{data.loading ? t('common.loading') : t('tags.gone')}</p>

  const groups = new Map()
  for (const item of data.itemsWithTag(id)) {
    if (!groups.has(item.place)) groups.set(item.place, [])
    groups.get(item.place).push(item)
  }
  const sorted = [...groups.entries()].sort(([a], [b]) => data.pathText(a).localeCompare(data.pathText(b)))

  const update = async values => {
    setError(null)
    try {
      await pb.collection('tags').update(id, values)
      await data.reload()
    } catch (err) {
      setError(err.message)
    }
  }

  // Seasonal swap: all Christmas things to the attic in one go, or back to where they live.
  const tagged = data.itemsWithTag(id)
  const away = tagged.filter(i => i.home && i.home !== i.place && data.placeById.has(i.home))
  const moveAll = async (changesFor, message) => {
    setError(null)
    const changes = tagged.map(changesFor).filter(Boolean)
    const before = changes.map(([itemId]) => { const i = data.itemById.get(itemId); return [itemId, { place: i.place, home: i.home }] })
    try {
      await Promise.all(changes.map(([itemId, values]) => pb.collection('items').update(itemId, values)))
      await data.reload()
      showToast(message(changes.length), {
        label: t('action.undo'),
        run: () => Promise.all(before.map(([itemId, v]) => pb.collection('items').update(itemId, v))).then(data.reload)
      })
    } catch (err) {
      setError(err.message)
    }
  }
  const moveTo = target => {
    setMoving(false)
    moveAll(i => (i.place === target ? null : [i.id, { place: target }]), n => t('move.bulkDone', { count: n, place: data.pathText(target) }))
  }
  const putBack = () => moveAll(i => (away.includes(i) ? [i.id, { place: i.home }] : null), n => t('tags.putBackDone', { count: n }))

  const remove = async () => {
    if (!window.confirm(t('tags.confirmDelete', { name: tag.name }))) return
    try {
      await pb.collection('tags').delete(id)
      await data.reload()
      navigate('/tags')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className='page'>
      <h1 className='page-title tag-title'>
        <span className='dot big' style={{ background: tag.color || 'var(--muted)' }} />{tag.name}
        {tag.seasonal && <span className='pill'><Icon name='sun' size={14} />{t('tags.seasonal')}</span>}
      </h1>
      <p className='muted'>{t('tags.summary', { items: plural(data.itemsWithTag(id).length, 'item'), places: plural(groups.size, 'place') })}</p>
      <div className='actions'>
        <button className='chip' onClick={() => setEditing(!editing)}><Icon name='edit' size={16} />{t('action.edit')}</button>
        {tagged.length > 0 && <button className='chip' onClick={() => setMoving(true)}><Icon name='move' size={16} />{t('tags.moveAll')}</button>}
        {away.length > 0 && <button className='chip' onClick={putBack}><Icon name='home' size={16} />{t('tags.putBack', { count: away.length })}</button>}
        <button className='chip danger' onClick={remove}><Icon name='trash' size={16} />{t('action.delete')}</button>
      </div>
      {error && <p className='error'>{error}</p>}
      {editing && (
        <div className='panel form'>
          <input defaultValue={tag.name} onBlur={e => e.target.value.trim() && e.target.value !== tag.name && update({ name: e.target.value.trim() })} />
          <div className='swatches'>
            {TAG_COLORS.map(c => (
              <button key={c} className={`swatch ${tag.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => update({ color: c })} aria-label={`Colour ${c}`} />
            ))}
          </div>
          <label className='check'><input type='checkbox' checked={tag.seasonal} onChange={e => update({ seasonal: e.target.checked })} />{t('tags.seasonal')}</label>
        </div>
      )}
      {sorted.map(([placeId, items]) => (
        <section key={placeId}>
          <h2><Icon name='box' size={16} />{data.whereText(placeId)}</h2>
          <Grid>{items.map(i => <ItemCard key={i.id} item={i} />)}</Grid>
        </section>
      ))}
      {!sorted.length && <p className='empty'>{t('tags.noItems')}</p>}
      {moving && <PlacePicker title={t('tags.moveAllTitle', { name: tag.name, count: tagged.length })} onPick={moveTo} onClose={() => setMoving(false)} />}
    </div>
  )
}
