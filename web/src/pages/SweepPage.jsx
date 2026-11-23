import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import Icon from '../components/Icon.jsx'
import PhotoButton from '../components/PhotoButton.jsx'
import { ProgressRing, RoomBadge } from '../components/Room.jsx'
import { useData } from '../lib/data.jsx'
import { pb } from '../lib/pb.js'
import { enqueue } from '../lib/uploads.js'
import { useAiEnabled } from '../lib/ai.js'
import { placeColor } from '../lib/rooms.js'
import { celebrate } from '../lib/celebrate.js'
import { play } from '../lib/sound.js'
import { resizeImage } from '../lib/image.js'
import { getPref, setLastAdd, setPref } from '../lib/recent.js'
import { t } from '../lib/i18n.jsx'

// A sweep: stand at one cupboard and photograph everything in it, one thing per photo, no typing.
// Naming happens later in the naming queue. Made for speed (and for kids): the shutter is the page.
export default function SweepPage () {
  const { id } = useParams()
  const data = useData()
  const navigate = useNavigate()
  const aiEnabled = useAiEnabled()
  const camera = useRef(null)
  const [shots, setShots] = useState([]) // object URLs of this session's photos, newest first
  const [typeNames, setTypeNames] = useState(() => getPref('sweepNames', '0') === '1')
  const [name, setName] = useState('')
  const [error, setError] = useState(null)
  const place = data.placeById.get(id)

  useEffect(() => () => shots.forEach(URL.revokeObjectURL), []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!place) return <p className='muted center'>{data.loading ? t('common.loading') : t('place.unknown')}</p>

  const color = placeColor(data, place)
  const room = data.path(id).at(-2)
  // Next spot in the same room that isn't done yet, to keep the round going.
  const siblings = data.childrenOf(place.parent).filter(p => !data.childrenOf(p.id).length)
  const next = siblings.find(p => p.id !== id && !p.done)
  const drafts = data.draftsIn(id).length

  const onPhoto = file => {
    const label = name.trim()
    const values = { place: id, home: id, quantity: 1, photos: [file], ...(label ? { name: label } : { name: t('drafts.placeholder'), needs_name: true }) }
    enqueue(label || t('drafts.placeholder'), () => pb.collection('items').create(values), data.reload)
    setShots(s => [URL.createObjectURL(file), ...s].slice(0, 30))
    setName('')
    setLastAdd(id)
    navigator.vibrate?.(25)
    play('shutter')
  }

  // Already took the photos with the normal camera? Pick them all at once from the library.
  const fromLibrary = async e => {
    const files = [...(e.target.files ?? [])]
    e.target.value = ''
    for (const f of files) onPhoto(await resizeImage(f))
  }

  const finish = async () => {
    setError(null)
    try {
      await pb.collection('places').update(id, { done: true })
      play('done')
      await data.reload()
      // The whole room finished with this spot: that deserves a moment.
      const parent = place.parent && data.progress(place.parent)
      if (parent && parent.done + 1 >= parent.total) celebrate()
      navigate(next ? `/sweep/${next.id}` : place.parent ? `/p/${place.parent}` : '/')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className='page sweep' style={{ '--room': color }}>
      <div className='sweep-head'>
        <RoomBadge place={place} size={44} />
        <div>
          <small className='muted'>{room ? room.name : t('sweep.title')}</small>
          <h1>{place.name}</h1>
        </div>
        {place.parent && (() => { const p = data.progress(place.parent); return p.total > 1 ? <ProgressRing pct={p.pct} color={color} label={t('progress.label', p)} /> : null })()}
      </div>

      <PhotoButton ref={camera} onPhoto={onPhoto} className='shutter'>
        <span className='shutter-ring'><Icon name='camera' size={40} /></span>
        <strong>{shots.length ? t('sweep.again') : t('sweep.start')}</strong>
        <small>{t('sweep.oneThing')}</small>
      </PhotoButton>

      <label className='check sweep-toggle'>
        <input type='checkbox' checked={typeNames} onChange={e => { setTypeNames(e.target.checked); setPref('sweepNames', e.target.checked ? '1' : '0') }} />
        {t('sweep.typeNames')}
      </label>
      {typeNames && <input value={name} onChange={e => setName(e.target.value)} placeholder={t('sweep.namePlaceholder')} />}

      {shots.length > 0 && (
        <div className='sweep-strip' aria-label={t('sweep.count', { count: shots.length })}>
          <span className='sweep-count'>{shots.length}</span>
          {shots.map(src => <img key={src} src={src} alt='' />)}
        </div>
      )}

      <div className='sweep-actions'>
        <label className='btn'>
          <input type='file' accept='image/*' multiple hidden onChange={fromLibrary} />
          <Icon name='layers' size={18} />{t('sweep.library')}
        </label>
        {drafts > 0 && <Link className='btn' to={`/name?place=${id}`}><Icon name='edit' size={18} />{t('drafts.nameNow', { count: drafts })}</Link>}
        {aiEnabled && <Link className='btn' to={`/ai-add/${id}`}><Icon name='sparkle' size={18} />{t('sweep.ai')}</Link>}
      </div>

      {error && <p className='error'>{error}</p>}
      <button className='btn primary big sweep-done' onClick={finish}>
        <Icon name='check' />{place.done ? t('sweep.stillDone') : t('sweep.done')}
      </button>
      {next && <p className='muted small center-text'>{t('sweep.next', { name: next.name })}</p>}
    </div>
  )
}
