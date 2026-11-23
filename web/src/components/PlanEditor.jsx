import { useState } from 'react'
import FloorPlan from './FloorPlan.jsx'
import Icon from './Icon.jsx'
import { useData } from '../lib/data.jsx'
import { pb } from '../lib/pb.js'
import { t } from '../lib/i18n.jsx'

// Plan section on a place page: upload a plan, then pick a child and drag its zone.
// Editing is controlled by the page (opened from its ⋯ menu).
export default function PlanEditor ({ place, editing, onEditingChange: setEditing }) {
  const data = useData()
  const [drawFor, setDrawFor] = useState(null)
  const [error, setError] = useState(null)
  const children = data.childrenOf(place.id)

  const run = async fn => {
    setError(null)
    try {
      await fn()
      await data.reload()
    } catch (err) {
      setError(err.message)
    }
  }
  // Plans are drawings or screenshots; keep them full size (no resize) so labels stay legible.
  const upload = e => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) run(() => pb.collection('places').update(place.id, { plan: file }))
  }
  const saveZone = zone => {
    const child = drawFor
    setDrawFor(null)
    run(() => pb.collection('places').update(child, { plan_zone: zone }))
  }
  const clearZone = id => run(() => pb.collection('places').update(id, { plan_zone: null }))

  if (!place.plan && !editing) return null

  return (
    <section className='plan-section'>
      <h2>
        {t('plan.title')}
        <button className='chip push' onClick={() => { setEditing(!editing); setDrawFor(null) }}>{editing ? t('action.done') : t('action.edit')}</button>
      </h2>
      {place.plan && <FloorPlan place={place} drawFor={drawFor} onDrawn={saveZone} />}
      {editing && (
        <div className='panel form'>
          <label className='btn'>
            <input type='file' accept='image/*' hidden onChange={upload} />
            <Icon name='file' size={18} />{place.plan ? t('plan.replace') : t('plan.upload')}
          </label>
          {place.plan && (
            <>
              <p className='muted small'>{drawFor ? t('plan.drawHint', { name: data.placeById.get(drawFor)?.name }) : t('plan.pickHint')}</p>
              <ul className='zone-list'>
                {children.map(c => (
                  <li key={c.id}>
                    <span>{c.name}</span>
                    <button className={`chip ${drawFor === c.id ? 'on' : ''}`} onClick={() => setDrawFor(drawFor === c.id ? null : c.id)}>
                      {c.plan_zone?.w > 0 ? t('plan.redraw') : t('plan.draw')}
                    </button>
                    {c.plan_zone?.w > 0 && <button className='ghost' onClick={() => clearZone(c.id)} aria-label={t('action.remove')}><Icon name='trash' size={16} /></button>}
                  </li>
                ))}
              </ul>
            </>
          )}
          {error && <p className='error'>{error}</p>}
        </div>
      )}
    </section>
  )
}
