import { useMemo, useState } from 'react'
import Icon from './Icon.jsx'
import Thumb from './Thumb.jsx'
import { thumbUrl } from '../lib/pb.js'
import { useData } from '../lib/data.jsx'
import { suggestPlaces } from '../lib/suggest.js'
import { t } from '../lib/i18n.jsx'
import { useBackdrop } from './Sheet.jsx'

// homeToggle: offer "also make this its home" when moving items (default on: most moves are reorganising;
// untick it for "I'm just using it in the garage for now").
// suggestFor: the item(s) being put away; places holding similar things are offered first.
export default function PlacePicker ({ title, exclude = new Set(), allowTop = false, homeToggle = false, suggestFor, onPick, onClose }) {
  const backdrop = useBackdrop(onClose)
  const data = useData()
  const [filter, setFilter] = useState('')
  const [makeHome, setMakeHome] = useState(true)
  const pick = id => onPick(id, { makeHome: homeToggle && makeHome })

  const options = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return data.places
      .filter(p => !exclude.has(p.id))
      .map(p => ({ place: p, path: data.pathText(p.id) }))
      .filter(o => !q || o.path.toLowerCase().includes(q))
      .sort((a, b) => a.path.localeCompare(b.path))
  }, [data, exclude, filter])

  const suggestions = useMemo(() => (suggestFor?.length ? suggestPlaces(data, suggestFor, { exclude }) : []), [data, suggestFor, exclude])

  return (
    <div className='modal-backdrop' {...backdrop}>
      <div className='modal' onClick={e => e.stopPropagation()}>
        <div className='modal-head'>
          <h2>{title}</h2>
          <button className='ghost' onClick={onClose} aria-label={t('action.close')}><Icon name='close' /></button>
        </div>
        <input autoFocus placeholder={t('picker.filter')} value={filter} onChange={e => setFilter(e.target.value)} />
        {homeToggle && (
          <label className='check'><input type='checkbox' checked={makeHome} onChange={e => setMakeHome(e.target.checked)} />{t('picker.makeHome')}</label>
        )}
        {suggestions.length > 0 && !filter && (
          <>
            <p className='pick-heading'>{t('suggest.title')}</p>
            <ul className='pick-list suggested'>
              {suggestions.map(({ place, examples }) => (
                <li key={place.id}>
                  <button onClick={() => pick(place.id)}>
                    <Thumb src={thumbUrl(place, place.photo)} name={place.name} className='mini' />
                    <span className='pick-text'><strong>{data.pathText(place.id)}</strong><small className='muted'>{t('suggest.because', { names: examples.join(', ') })}</small></span>
                  </button>
                </li>
              ))}
            </ul>
            <p className='pick-heading'>{t('suggest.all')}</p>
          </>
        )}
        <ul className='pick-list'>
          {allowTop && !filter && (
            <li><button onClick={() => pick(null)}><span className='thumb mini top'><Icon name='home' size={14} /></span>{t('picker.topLevel')}</button></li>
          )}
          {options.map(({ place, path }) => (
            <li key={place.id}>
              <button onClick={() => pick(place.id)}>
                <Thumb src={thumbUrl(place, place.photo)} name={place.name} className='mini' />
                {path}
                {place.full && <span className='badge'>{t('place.fullBadge')}</span>}
              </button>
            </li>
          ))}
          {options.length === 0 && <li className='muted'>{t('picker.none')}</li>}
        </ul>
      </div>
    </div>
  )
}
