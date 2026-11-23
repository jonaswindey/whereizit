import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { hue } from './Thumb.jsx'
import { useData } from '../lib/data.jsx'
import { fileUrl } from '../lib/pb.js'
import { t } from '../lib/i18n.jsx'

const pct = v => `${(v * 100).toFixed(2)}%`
const clamp = v => Math.min(1, Math.max(0, v))

// A place's plan image with its children drawn as zones. highlight: child id to emphasise (item page).
// drawFor: child id currently being drawn; onDrawn(zone) receives { x, y, w, h } as fractions.
export default function FloorPlan ({ place, highlight, drawFor, onDrawn, compact }) {
  const data = useData()
  const box = useRef(null)
  const [draft, setDraft] = useState(null)
  const zones = data.childrenOf(place.id).filter(c => c.plan_zone?.w > 0)

  const point = e => {
    const r = box.current.getBoundingClientRect()
    return { x: clamp((e.clientX - r.left) / r.width), y: clamp((e.clientY - r.top) / r.height) }
  }
  const down = e => {
    if (!drawFor) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = point(e)
    setDraft({ x0: p.x, y0: p.y, x1: p.x, y1: p.y })
  }
  const move = e => draft && setDraft(d => ({ ...d, x1: point(e).x, y1: point(e).y }))
  const up = () => {
    if (!draft) return
    const zone = { x: Math.min(draft.x0, draft.x1), y: Math.min(draft.y0, draft.y1), w: Math.abs(draft.x1 - draft.x0), h: Math.abs(draft.y1 - draft.y0) }
    setDraft(null)
    if (zone.w > 0.02 && zone.h > 0.02) onDrawn(zone)
  }

  return (
    <div className={`floorplan ${drawFor ? 'drawing' : ''} ${compact ? 'compact' : ''}`}>
      <div className='floorplan-box' ref={box} onPointerDown={down} onPointerMove={move} onPointerUp={up}>
        <img src={fileUrl(place, place.plan)} alt={t('plan.alt', { name: place.name })} draggable='false' />
        {zones.map(c => {
          const z = c.plan_zone
          const style = { left: pct(z.x), top: pct(z.y), width: pct(z.w), height: pct(z.h), '--h': hue(c.name) }
          const cls = `zone ${highlight === c.id ? 'hit' : ''} ${highlight && highlight !== c.id ? 'dim' : ''} ${drawFor === c.id ? 'editing' : ''}`
          return drawFor
            ? <div key={c.id} className={cls} style={style}><span>{c.name}</span></div>
            : <Link key={c.id} to={`/p/${c.id}`} className={cls} style={style}><span>{c.name}</span></Link>
        })}
        {draft && (
          <div className='zone draft' style={{ left: pct(Math.min(draft.x0, draft.x1)), top: pct(Math.min(draft.y0, draft.y1)), width: pct(Math.abs(draft.x1 - draft.x0)), height: pct(Math.abs(draft.y1 - draft.y0)) }} />
        )}
      </div>
    </div>
  )
}

// Every plan along an item's path, each highlighting the next step: House plan → Kitchen, Kitchen plan → Cabinet.
export function PlansAlongPath ({ placeId }) {
  const data = useData()
  const trail = data.path(placeId)
  const plans = []
  for (let i = 0; i < trail.length; i++) {
    const p = trail[i]
    const next = trail[i + 1]
    if (p.plan && next?.plan_zone?.w > 0) plans.push({ place: p, highlight: next.id })
  }
  if (!plans.length) return null
  return (
    <div className='plans-along'>
      {plans.map(({ place, highlight }) => <FloorPlan key={place.id} place={place} highlight={highlight} compact />)}
    </div>
  )
}
