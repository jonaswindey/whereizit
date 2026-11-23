import { useMemo, useState } from 'react'
import Icon from './Icon.jsx'
import Thumb from './Thumb.jsx'
import { useData } from '../lib/data.jsx'
import { thumbUrl } from '../lib/pb.js'
import { t } from '../lib/i18n.jsx'
import { useBackdrop } from './Sheet.jsx'

// Multi-select of items (e.g. "goes with": drill ↔ charger). selected: array of item ids.
export default function ItemPicker ({ title, exclude, selected, onChange, onClose }) {
  const backdrop = useBackdrop(onClose)
  const data = useData()
  const [filter, setFilter] = useState('')
  const options = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return data.items
      .filter(i => i.id !== exclude)
      .filter(i => !q || i.name.toLowerCase().includes(q) || data.pathText(i.place).toLowerCase().includes(q))
      .slice(0, 80)
  }, [data, exclude, filter])
  const toggle = id => onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])

  return (
    <div className='modal-backdrop' {...backdrop}>
      <div className='modal' onClick={e => e.stopPropagation()}>
        <div className='modal-head'>
          <h2>{title}</h2>
          <button className='btn primary' onClick={onClose}>{t('action.done')}</button>
        </div>
        <input autoFocus placeholder={t('picker.filterItems')} value={filter} onChange={e => setFilter(e.target.value)} />
        <ul className='pick-list'>
          {options.map(i => (
            <li key={i.id}>
              <button className={selected.includes(i.id) ? 'on' : ''} onClick={() => toggle(i.id)}>
                <Thumb src={thumbUrl(i, i.photos?.[0])} name={i.name} className='mini' />
                <span className='pick-text'><strong>{i.name}</strong><small className='muted'>{data.whereText(i.place)}</small></span>
                {selected.includes(i.id) && <Icon name='check' size={18} />}
              </button>
            </li>
          ))}
          {!options.length && <li className='muted'>{t('picker.noItems')}</li>}
        </ul>
      </div>
    </div>
  )
}
