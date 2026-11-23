import Icon from './Icon.jsx'
import { thumbUrl } from '../lib/pb.js'

// Placeholder colour comes from the name, so an unphotographed place still looks like *something*.
export function hue (text) {
  let h = 0
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 360
  return h
}

// mosaic: items whose first photo forms a 2x2 collage, used when a place has no photo itself.
export default function Thumb ({ src, name, mosaic, className = '' }) {
  if (src) return <img className={`thumb ${className}`} src={src} alt='' loading='lazy' />
  if (mosaic?.length) {
    return (
      <div className={`thumb mosaic n${Math.min(mosaic.length, 4)} ${className}`}>
        {mosaic.slice(0, 4).map(i => <img key={i.id} src={thumbUrl(i, i.photos[0])} alt='' loading='lazy' />)}
      </div>
    )
  }
  return (
    <div className={`thumb placeholder ${className}`} style={{ '--h': hue(name ?? '') }}>
      <span>{(name ?? '?').trim().charAt(0).toUpperCase()}</span>
      <Icon name='camera' size={16} />
    </div>
  )
}
