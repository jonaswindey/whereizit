import { displayName } from '../lib/auth.js'
import { thumbUrl } from '../lib/pb.js'

const hue = text => {
  let h = 0
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return (h % 8) + 1
}

// A member's photo, or their initial on one of the room colours (stable per name).
export default function Avatar ({ user, size = 40 }) {
  const name = displayName(user, '?')
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) }
  if (user?.avatar) return <img className='avatar photo' style={style} src={thumbUrl(user, user.avatar)} alt='' />
  return <span className='avatar' style={{ ...style, background: `var(--room-${hue(name)})` }}>{name.charAt(0).toUpperCase()}</span>
}
