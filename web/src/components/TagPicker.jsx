import { useState } from 'react'
import Icon from './Icon.jsx'
import { useData } from '../lib/data.jsx'
import { pb } from '../lib/pb.js'
import { TAG_COLORS } from '../lib/format.js'
import { t } from '../lib/i18n.jsx'
import { useBackdrop } from './Sheet.jsx'

export function TagChip ({ tag, onRemove }) {
  return (
    <span className='tag-chip' style={{ '--tag': tag.color || 'var(--muted)' }}>
      {tag.seasonal && <Icon name='sun' size={12} />}{tag.name}
      {onRemove && <button type='button' onClick={() => onRemove(tag.id)} aria-label={t('tags.remove', { name: tag.name })}><Icon name='close' size={12} /></button>}
    </span>
  )
}

// Multi-select of existing tags plus inline "create tag". selected: array of tag ids.
export default function TagPicker ({ title = t('tags.title'), selected, onChange, onClose }) {
  const backdrop = useBackdrop(onClose)
  const data = useData()
  const [filter, setFilter] = useState('')
  const [error, setError] = useState(null)
  const q = filter.trim().toLowerCase()
  const shown = data.tags.filter(t => !q || t.name.toLowerCase().includes(q))
  const exact = data.tags.some(t => t.name.toLowerCase() === q)

  const toggle = id => onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])

  const create = async () => {
    setError(null)
    try {
      const tag = await pb.collection('tags').create({
        name: filter.trim(),
        color: TAG_COLORS[data.tags.length % TAG_COLORS.length]
      })
      await data.reload()
      onChange([...selected, tag.id])
      setFilter('')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className='modal-backdrop' {...backdrop}>
      <div className='modal' onClick={e => e.stopPropagation()}>
        <div className='modal-head'>
          <h2>{title}</h2>
          <button className='btn primary' onClick={onClose}>{t('action.done')}</button>
        </div>
        <input autoFocus placeholder={t('tags.findOrCreate')} value={filter} onChange={e => setFilter(e.target.value)} />
        {error && <p className='error'>{error}</p>}
        <div className='tag-cloud'>
          {q && !exact && <button className='tag-option new' onClick={create}><Icon name='plus' size={14} />{t('tags.create', { name: filter.trim() })}</button>}
          {shown.map(t => (
            <button
              key={t.id}
              className={`tag-option ${selected.includes(t.id) ? 'on' : ''}`}
              style={{ '--tag': t.color || 'var(--muted)' }}
              onClick={() => toggle(t.id)}
            >
              {selected.includes(t.id) && <Icon name='check' size={14} />}
              {t.seasonal && <Icon name='sun' size={12} />}{t.name}
            </button>
          ))}
          {!shown.length && !q && <p className='muted'>{t('tags.noneYet')}</p>}
        </div>
      </div>
    </div>
  )
}
