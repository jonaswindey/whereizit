import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import Breadcrumb from '../components/Breadcrumb.jsx'
import Icon from '../components/Icon.jsx'
import PhotoButton from '../components/PhotoButton.jsx'
import TagPicker, { TagChip } from '../components/TagPicker.jsx'
import { useData } from '../lib/data.jsx'
import { pb } from '../lib/pb.js'
import { enqueue } from '../lib/uploads.js'
import { setLastAdd } from '../lib/recent.js'
import { suggestTags } from '../lib/suggest.js'
import { useItemSearch } from './SearchPage.jsx'
import { getLang, t } from '../lib/i18n.jsx'

const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition

// Camera loop: photo → name → "Save & next" reopens the camera immediately; uploads run behind.
export default function QuickAdd () {
  const { id } = useParams()
  const data = useData()
  const navigate = useNavigate()
  const cameraRef = useRef(null)
  const nameRef = useRef(null)
  const [photo, setPhoto] = useState(null)
  const [preview, setPreview] = useState(null)
  // ?name= comes from search ("not found, add it here").
  const [params] = useSearchParams()
  const [name, setName] = useState(() => params.get('name') ?? '')
  const [quantity, setQuantity] = useState(1)
  const [error, setError] = useState(null)
  const [added, setAdded] = useState(0)
  const [startedAt] = useState(() => Date.now())
  // Tags stick for the whole session: photograph a box of Christmas stuff without re-tagging each item.
  const [batchTags, setBatchTags] = useState([])
  const [pickingTags, setPickingTags] = useState(false)
  // Suggested tags apply to this one item only, unlike the batch tags above.
  const [itemTags, setItemTags] = useState([])

  useEffect(() => {
    if (!photo) return setPreview(null)
    const url = URL.createObjectURL(photo)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  const [listening, setListening] = useState(false)
  const fuse = useItemSearch()
  // "/add/unsorted": items without a place yet, put away later from the Unsorted list.
  const unsorted = id === 'unsorted'
  const place = unsorted ? { name: t('unsorted.title') } : data.placeById.get(id)
  const doneUrl = unsorted ? '/unsorted' : `/p/${id}`
  if (!place) return <p className='muted center'>{data.loading ? t('common.loading') : t('place.unknown')}</p>

  // Say the name instead of typing it, handy with dusty hands in the shed.
  const listen = () => {
    const rec = new Recognition()
    const phone = navigator.language || ''
    rec.lang = phone.toLowerCase().startsWith(getLang()) ? phone : getLang() === 'nl' ? 'nl-NL' : 'en-US'
    rec.onresult = e => setName(e.results[0][0].transcript.trim().replace(/[.!?]+$/, '').replace(/^./, c => c.toUpperCase()))
    rec.onerror = e => setError(e.error === 'not-allowed' ? t('voice.blocked') : t('voice.failed', { error: e.error }))
    rec.onend = () => setListening(false)
    setListening(true)
    rec.start()
  }

  const onPhoto = file => {
    setPhoto(file)
    nameRef.current?.focus()
  }

  const save = again => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError(t('form.needName'))
      nameRef.current?.focus()
      return
    }
    const payload = { name: trimmed, place: unsorted ? '' : id, quantity, tags: [...new Set([...batchTags, ...itemTags])], ...(photo && { photos: [photo] }) }
    // Added from the emergency card: that one thing (not the rest of the session) is an essential.
    if (params.get('essential') && trimmed === params.get('name')) payload.essential = true
    enqueue(trimmed, () => pb.collection('items').create(payload), data.reload)
    if (!unsorted) setLastAdd(id)
    setAdded(n => n + 1)
    setName('')
    setQuantity(1)
    setItemTags([])
    setPhoto(null)
    setError(null)
    // Must stay synchronous inside the tap handler, or iOS refuses to open the camera.
    if (again) cameraRef.current?.click()
    else navigate(doneUrl)
  }

  // "You already have this": catches buying/adding a second ladder that's actually in the shed.
  const dupes = name.trim().length >= 3
    ? fuse.search(name.trim(), { limit: 3 }).filter(r => r.item.kind === 'item' && r.score < 0.25).map(r => r.item.record)
    : []

  const tagIdeas = name.trim().length >= 3 ? suggestTags(data, name, batchTags, 4) : []

  const perItem = added ? Math.round((Date.now() - startedAt) / 1000 / added) : null

  return (
    <div className='page quick'>
      {!unsorted && <Breadcrumb placeId={id} includeLast />}
      <h1 className='page-title'>{unsorted ? t('unsorted.addTitle') : t('quick.title', { name: place.name })}</h1>
      {added > 0 && <p className='muted'>{t('quick.progress', { count: added, seconds: perItem })}</p>}

      <PhotoButton ref={cameraRef} onPhoto={onPhoto} className='photo-drop tall'>
        {preview
          ? <img src={preview} alt='' />
          : <span><Icon name='camera' size={40} />{t('quick.takePhoto')}</span>}
      </PhotoButton>

      <div className='tag-row'>
        <span className='muted small'>{t('quick.batchTags')}:</span>
        {batchTags.map(t => data.tagById.get(t)).filter(Boolean).map(t => (
          <TagChip key={t.id} tag={t} onRemove={x => setBatchTags(batchTags.filter(y => y !== x))} />
        ))}
        <button type='button' className='chip' onClick={() => setPickingTags(true)}><Icon name='plus' size={14} />{t('action.tag')}</button>
      </div>
      {pickingTags && <TagPicker title={t('quick.batchTags')} selected={batchTags} onChange={setBatchTags} onClose={() => setPickingTags(false)} />}

      <form className='form' onSubmit={e => { e.preventDefault(); save(true) }}>
        <div className='search-bar'>
          <input ref={nameRef} placeholder={listening ? t('voice.listening') : t('quick.whatIsIt')} value={name} onChange={e => setName(e.target.value)} enterKeyHint='next' />
          {Recognition && (
            <button type='button' className={`btn mic ${listening ? 'on' : ''}`} onClick={listen} disabled={listening} aria-label={t('voice.button')}><Icon name='mic' /></button>
          )}
        </div>
        {dupes.length > 0 && (
          <p className='dupes'>
            {t('quick.alreadyHave')} {dupes.map((d, i) => (
              <span key={d.id}>{i > 0 && ', '}<Link to={`/i/${d.id}`}>{d.name}</Link> <small className='muted'>({data.whereText(d.place)})</small></span>
            ))}
          </p>
        )}
        {tagIdeas.length > 0 && (
          <div className='tag-row'>
            <span className='muted small'>{t('quick.tagIdeas')}</span>
            {tagIdeas.map(tag => {
              const on = itemTags.includes(tag.id)
              return (
                <button key={tag.id} type='button' className={`plain tag-idea ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => setItemTags(on ? itemTags.filter(x => x !== tag.id) : [...itemTags, tag.id])}>
                  {on && <Icon name='check' size={14} />}<TagChip tag={tag} />
                </button>
              )
            })}
          </div>
        )}
        <div className='stepper'>
          <span>{t('item.quantity')}</span>
          <button type='button' className='btn' onClick={() => setQuantity(q => Math.max(1, q - 1))}>−</button>
          <strong>{quantity}</strong>
          <button type='button' className='btn' onClick={() => setQuantity(q => q + 1)}>+</button>
        </div>
        {error && <p className='error'>{error}</p>}
        <div className='row'>
          <button type='submit' className='btn primary big'><Icon name='camera' />{t('quick.saveNext')}</button>
          <button type='button' className='btn big' onClick={() => (name.trim() ? save(false) : navigate(doneUrl))}>
            {name.trim() ? t('quick.saveDone') : t('action.done')}
          </button>
        </div>
      </form>
    </div>
  )
}
