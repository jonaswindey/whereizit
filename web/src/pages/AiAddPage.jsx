import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import Breadcrumb from '../components/Breadcrumb.jsx'
import Icon from '../components/Icon.jsx'
import PhotoButton from '../components/PhotoButton.jsx'
import { TagChip } from '../components/TagPicker.jsx'
import { useData } from '../lib/data.jsx'
import { pb } from '../lib/pb.js'
import { cropToBox, recognisePhoto } from '../lib/ai.js'
import { enqueue } from '../lib/uploads.js'
import { t } from '../lib/i18n.jsx'

function Suggestion ({ s, onChange }) {
  const data = useData()
  const [preview, setPreview] = useState(null)
  useEffect(() => {
    const url = URL.createObjectURL(s.crop)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [s.crop])
  const tags = s.tags.map(name => data.tags.find(tag => tag.name === name)).filter(Boolean)
  return (
    <li className={`row-card suggestion ${s.keep ? '' : 'off'}`}>
      <label className='keep'><input type='checkbox' checked={s.keep} onChange={e => onChange({ keep: e.target.checked })} /></label>
      {preview && <img src={preview} alt='' />}
      <div className='suggestion-fields'>
        <input value={s.name} onChange={e => onChange({ name: e.target.value })} aria-label={t('item.name')} />
        <div className='row'>
          <input type='number' min='1' value={s.quantity} onChange={e => onChange({ quantity: Number(e.target.value) || 1 })} aria-label={t('item.quantity')} />
          {tags.map(tag => <TagChip key={tag.id} tag={tag} />)}
        </div>
        {s.note && <small className='muted'>{s.note}</small>}
      </div>
    </li>
  )
}

// One photo of a shelf → suggested items, each with its own cropped photo. Nothing is saved until confirmed.
export default function AiAddPage () {
  const { id } = useParams()
  const data = useData()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [suggestions, setSuggestions] = useState(null)
  const place = data.placeById.get(id)
  if (!place) return <p className='muted center'>{data.loading ? t('common.loading') : t('place.unknown')}</p>

  const onPhoto = async file => {
    setBusy(true)
    setError(null)
    setSuggestions(null)
    try {
      const items = await recognisePhoto(file, { place: data.pathText(id), tags: data.tags.map(tag => tag.name) })
      const withCrops = await Promise.all(items.map(async i => ({ ...i, keep: true, crop: await cropToBox(file, i.box) })))
      setSuggestions(withCrops)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const change = (index, patch) => setSuggestions(list => list.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  const chosen = suggestions?.filter(s => s.keep && s.name.trim()) ?? []

  const save = () => {
    for (const s of chosen) {
      const tagIds = s.tags.map(name => data.tags.find(tag => tag.name === name)?.id).filter(Boolean)
      const payload = { name: s.name.trim(), place: id, quantity: s.quantity, note: s.note, tags: tagIds, photos: [s.crop] }
      enqueue(payload.name, () => pb.collection('items').create(payload), data.reload)
    }
    navigate(`/p/${id}`)
  }

  return (
    <div className='page'>
      <Breadcrumb placeId={id} includeLast />
      <h1 className='page-title'>{t('ai.addTitle', { name: place.name })}</h1>
      <p className='muted'>{t('ai.addIntro')}</p>
      <PhotoButton onPhoto={onPhoto} className='photo-drop tall'>
        <span><Icon name={busy ? 'sparkle' : 'camera'} size={40} />{busy ? t('ai.looking') : t('ai.takeShelfPhoto')}</span>
      </PhotoButton>
      {error && <p className='error'>{error}</p>}
      {suggestions && !suggestions.length && <p className='empty'>{t('ai.nothingFound')}</p>}
      {suggestions?.length > 0 && (
        <>
          <ul className='rows'>{suggestions.map((s, i) => <Suggestion key={i} s={s} onChange={patch => change(i, patch)} />)}</ul>
          <p className='muted small'>{t('ai.checkHint')}</p>
          <button className='btn primary big' disabled={!chosen.length} onClick={save}>{t('ai.addChosen', { count: chosen.length })}</button>
        </>
      )}
      <p className='muted small'>{t('ai.privacy')}</p>
    </div>
  )
}
