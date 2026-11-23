import { fileUrl } from '../lib/pb.js'

// A place photo with pins at { x, y } fractions. The box shrink-wraps the image, so percentages
// map onto the picture exactly (no letterboxing, the same lesson as the floor plans).
export default function PhotoPins ({ place, pins, editing, onPlace, onOpen }) {
  const click = e => {
    if (!editing) return
    const r = e.currentTarget.getBoundingClientRect()
    const round = v => Math.round(Math.min(1, Math.max(0, v)) * 1000) / 1000
    onPlace({ x: round((e.clientX - r.left) / r.width), y: round((e.clientY - r.top) / r.height) })
  }
  return (
    <div className={`photo-pins ${editing ? 'editing' : ''}`}>
      <div className='photo-pins-box' onClick={click}>
        <img src={fileUrl(place, place.photo)} alt='' draggable={false} />
        {pins.map(p => (
          <button
            key={p.id}
            type='button'
            className={`pin ${p.active ? 'active' : ''}`}
            style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
            onClick={e => { if (editing) return; e.stopPropagation(); onOpen?.(p.id) }}
          >
            <span>{p.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
