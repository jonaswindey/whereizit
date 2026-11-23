import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import Icon from '../components/Icon.jsx'
import { RoomBadge } from '../components/Room.jsx'
import { TagChip } from '../components/TagPicker.jsx'
import { useData } from '../lib/data.jsx'
import { fileUrl, pb } from '../lib/pb.js'
import { recognisePhoto, useAiEnabled } from '../lib/ai.js'
import { suggestTags } from '../lib/suggest.js'
import { useAuthUser } from '../lib/auth.js'
import { celebrate } from '../lib/celebrate.js'
import { play } from '../lib/sound.js'
import Sheet from '../components/Sheet.jsx'
import { thumbUrl } from '../lib/pb.js'
import { t } from '../lib/i18n.jsx'

// The calm half of a sweep: one photo at a time, give it a name (and maybe a tag), next.
// ?place= limits the queue to one cupboard or room.
export default function NamePage () {
  const data = useData()
  const user = useAuthUser()
  const aiEnabled = useAiEnabled()
  const [params] = useSearchParams()
  const scope = params.get('place')
  const [skipped, setSkipped] = useState([])
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [tags, setTags] = useState([])
  const [guessing, setGuessing] = useState(false)
  const [error, setError] = useState(null)
  const [named, setNamed] = useState(0)
  const [lastName, setLastName] = useState('')
  // Grid: pick several photos of the same kind of thing and name them in one go.
  const [grid, setGrid] = useState(false)
  const [picked, setPicked] = useState([])
  const [bulk, setBulk] = useState(null) // 'same' | 'merge'
  const [bulkName, setBulkName] = useState('')
  const input = useRef(null)

  const queue = (scope ? data.draftsIn(scope) : data.drafts).filter(d => !skipped.includes(d.id))
  const current = queue[0]
  const currentId = current?.id
  useEffect(() => {
    setName('')
    setQuantity(1)
    setTags([])
    setError(null)
    input.current?.focus()
  }, [currentId])

  if (data.loading) return <p className='muted center'>{t('common.loading')}</p>

  const applyBulk = async e => {
    e.preventDefault()
    const n = bulkName.trim()
    if (!n || !picked.length) return
    setError(null)
    try {
      if (bulk === 'merge') {
        // One item with all of them as its quantity; the first photo stays, the rest are removed.
        const [keep, ...rest] = picked
        await pb.collection('items').update(keep, { name: n, quantity: picked.length, needs_name: false })
        await Promise.all(rest.map(id => pb.collection('items').delete(id)))
        setNamed(x => x + 1)
      } else {
        await Promise.all(picked.map(id => pb.collection('items').update(id, { name: n, needs_name: false })))
        setNamed(x => x + picked.length)
      }
      play('done')
      setPicked([])
      setBulk(null)
      setBulkName('')
      await data.reload()
    } catch (err) {
      setError(err.message)
    }
  }

  if (grid && queue.length) {
    return (
      <div className='page name-page'>
        <div className='name-progress'>
          <span>{t('drafts.left', { count: queue.length })}</span>
          <button className='chip push' onClick={() => { setGrid(false); setPicked([]) }}>{t('drafts.oneByOne')}</button>
        </div>
        <p className='muted small'>{t('drafts.gridHint')}</p>
        <div className='draft-grid'>
          {queue.map(d => {
            const on = picked.includes(d.id)
            return (
              <button key={d.id} type='button' className={`draft-tile ${on ? 'on' : ''}`} onClick={() => setPicked(p => (p.includes(d.id) ? p.filter(x => x !== d.id) : [...p, d.id]))}>
                <img src={thumbUrl(d, d.photos[0])} alt='' loading='lazy' />
                {on && <span className='select-dot on'><Icon name='check' size={16} /></span>}
              </button>
            )
          })}
        </div>
        {error && <p className='error'>{error}</p>}
        {picked.length > 0 && (
          <div className='bulk-bar'>
            <span>{t('drafts.picked', { count: picked.length })}</span>
            <button className='btn' onClick={() => setBulk('same')}>{t('drafts.sameName')}</button>
            {user?.role !== 'kid' && picked.length > 1 && <button className='btn primary' onClick={() => setBulk('merge')}>{t('drafts.merge')}</button>}
          </div>
        )}
        {bulk && (
          <Sheet title={t(bulk === 'merge' ? 'drafts.mergeTitle' : 'drafts.sameTitle', { count: picked.length })} onClose={() => setBulk(null)}>
            <form className='panel form' onSubmit={applyBulk}>
              <input autoFocus value={bulkName} onChange={e => setBulkName(e.target.value)} placeholder={t('drafts.whatIsIt')} />
              <p className='muted small'>{t(bulk === 'merge' ? 'drafts.mergeHint' : 'drafts.sameHint', { count: picked.length })}</p>
              <div className='row form-actions'>
                <button className='btn primary' disabled={!bulkName.trim()}>{t('action.save')}</button>
                <button type='button' className='btn' onClick={() => setBulk(null)}>{t('action.cancel')}</button>
              </div>
            </form>
          </Sheet>
        )}
      </div>
    )
  }

  if (!current) {
    return (
      <div className='page name-page'>
        <div className='setup-hero'>
          <Icon name={named ? 'trophy' : 'check'} size={36} />
          <h1>{named ? t('drafts.allNamed', { count: named }) : t('drafts.none')}</h1>
          <p>{t('drafts.noneHint')}</p>
        </div>
        {skipped.length > 0 && <button className='btn' onClick={() => setSkipped([])}>{t('drafts.showSkipped', { count: skipped.length })}</button>}
        <Link className='btn primary big' to='/'>{t('setup.toHome')}</Link>
      </div>
    )
  }

  const save = async e => {
    e?.preventDefault()
    if (!name.trim()) return input.current?.focus()
    setError(null)
    try {
      await pb.collection('items').update(current.id, { name: name.trim(), quantity, tags, needs_name: false })
      setNamed(n => n + 1)
      setLastName(name.trim())
      play('tick')
      if (queue.length === 1) celebrate()
      await data.reload()
    } catch (err) {
      setError(err.message)
    }
  }

  const discard = async () => {
    setError(null)
    try {
      await pb.collection('items').delete(current.id)
      await data.reload()
    } catch (err) {
      setError(err.message)
    }
  }

  // Asks the AI for what's in this one photo; only on request, so photos leave the house only then.
  const guess = async () => {
    setGuessing(true)
    setError(null)
    try {
      const res = await fetch(fileUrl(current, current.photos[0]))
      const blob = await res.blob()
      const items = await recognisePhoto(new File([blob], 'photo.jpg', { type: blob.type }), { place: data.pathText(current.place), tags: data.tags.map(x => x.name) })
      if (items[0]) {
        setName(items[0].name)
        setQuantity(items[0].quantity || 1)
        setTags(items[0].tags.map(n => data.tags.find(x => x.name === n)?.id).filter(Boolean))
      }
    } catch (err) {
      setError(err.message)
    }
    setGuessing(false)
  }

  const place = data.placeById.get(current.place)
  const ideas = name.trim().length >= 3 ? suggestTags(data, name, tags, 4) : []
  const total = queue.length + named

  return (
    <div className='page name-page'>
      <div className='name-progress'>
        <span>{t('drafts.left', { count: queue.length })}</span>
        {queue.length > 1 && <button className='chip' onClick={() => setGrid(true)}><Icon name='grid' size={14} />{t('drafts.grid')}</button>}
        <span className='progress-bar'><span style={{ width: `${total ? (named / total) * 100 : 0}%`, background: 'var(--accent)' }} /></span>
      </div>
      <figure className='name-card' key={current.id}>
        <img src={fileUrl(current, current.photos[0])} alt='' />
        {place && <figcaption><RoomBadge place={place} size={26} />{data.whereText(current.place)}</figcaption>}
      </figure>
      <form className='form' onSubmit={save}>
        <div className='search-bar'>
          <input ref={input} value={name} onChange={e => setName(e.target.value)} placeholder={t('drafts.whatIsIt')} enterKeyHint='done' autoCapitalize='sentences' />
          {aiEnabled && <button type='button' className='btn icon-only' onClick={guess} disabled={guessing} aria-label={t('drafts.guess')} title={t('drafts.guess')}><Icon name='sparkle' /></button>}
        </div>
        {guessing && <p className='muted small'>{t('drafts.guessing')}</p>}
        {lastName && !name && <button type='button' className='chip same-as' onClick={() => setName(lastName)}>{t('drafts.sameAsPrevious', { name: lastName })}</button>}
        {ideas.length > 0 && (
          <div className='tag-row'>
            {ideas.map(tag => <button key={tag.id} type='button' className='plain tag-idea' onClick={() => setTags([...tags, tag.id])}><TagChip tag={tag} /></button>)}
          </div>
        )}
        {tags.length > 0 && <div className='tag-row'>{tags.map(id => data.tagById.get(id)).filter(Boolean).map(tag => <TagChip key={tag.id} tag={tag} onRemove={x => setTags(tags.filter(y => y !== x))} />)}</div>}
        <div className='stepper'>
          <span>{t('item.quantity')}</span>
          <button type='button' className='btn' onClick={() => setQuantity(q => Math.max(1, q - 1))}>−</button>
          <strong>{quantity}</strong>
          <button type='button' className='btn' onClick={() => setQuantity(q => q + 1)}>+</button>
        </div>
        {error && <p className='error'>{error}</p>}
        <button className='btn primary big' disabled={!name.trim()}><Icon name='check' />{t('drafts.save')}</button>
        <div className='row name-secondary'>
          <button type='button' className='btn' onClick={() => setSkipped(s => [...s, current.id])}>{t('drafts.skip')}</button>
          {user?.role !== 'kid' && <button type='button' className='btn danger-text' onClick={discard}><Icon name='trash' size={16} />{t('drafts.discard')}</button>}
        </div>
      </form>
    </div>
  )
}
