import Icon from './Icon.jsx'
import { placeColor, placeIcon } from '../lib/rooms.js'
import { useData } from '../lib/data.jsx'

// A place's identity: its icon on a soft tile of its room colour.
export function RoomBadge ({ place, size = 44 }) {
  const data = useData()
  return (
    <span className='room-badge' style={{ '--room': placeColor(data, place), width: size, height: size }}>
      <Icon name={placeIcon(place)} size={Math.round(size * 0.5)} />
    </span>
  )
}

// How much of a place has been gone through. Drawn, not coloured alone: the number is in the label.
export function ProgressRing ({ pct, size = 36, stroke = 4, color = 'var(--accent)', label }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <span className='ring' style={{ width: size, height: size }} title={label} aria-label={label} role='img'>
      <svg className='ring-svg' width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill='none' stroke='var(--surface-2)' strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill='none' stroke={color} strokeWidth={stroke} strokeLinecap='round'
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(100, pct) / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {pct >= 100 ? <Icon name='check' size={Math.round(size * 0.42)} /> : <small>{pct}</small>}
    </span>
  )
}

// One bar for the whole household.
export function ProgressBar ({ pct, color = 'var(--accent)' }) {
  return (
    <span className='progress-bar' role='progressbar' aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${Math.min(100, pct)}%`, background: color }} />
    </span>
  )
}
