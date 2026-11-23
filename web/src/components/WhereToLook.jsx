import { Link } from 'react-router'
import Icon from './Icon.jsx'
import Thumb from './Thumb.jsx'
import { useData } from '../lib/data.jsx'
import { thumbUrl } from '../lib/pb.js'
import { suggestPlaces } from '../lib/suggest.js'
import { timeAgo } from '../lib/format.js'
import { t } from '../lib/i18n.jsx'

// Where a lost thing might be, other than the spot the app has for it (that's where it wasn't):
// its own home, places it stood before (from the item's history), and where similar things live.
export function placesToLook (data, item, history = [], limit = 4, skipHome = false) {
  const out = []
  const seen = new Set([item.place])
  const add = (id, reason) => {
    if (!id || seen.has(id) || !data.placeById.has(id) || out.length >= limit) return
    seen.add(id)
    out.push({ place: data.placeById.get(id), ...reason })
  }
  if (!skipHome) add(item.home, { kind: 'home' })
  for (const e of history) if (e.action === 'moved') add(e.from_place, { kind: 'before', when: e.created })
  for (const s of suggestPlaces(data, [item], { limit: 3 })) add(s.place.id, { kind: 'similar', names: s.examples })
  return out
}

// skipHome: the item page already has its own "belongs in" banner.
export default function WhereToLook ({ item, history, limit, skipHome }) {
  const data = useData()
  const spots = placesToLook(data, item, history ?? [], limit, skipHome)
  if (!spots.length) return null
  const why = s => s.kind === 'home'
    ? t('look.home')
    : s.kind === 'before' ? t('look.before', { when: timeAgo(s.when) }) : t('look.similar', { names: s.names.join(', ') })
  return (
    <div className='look'>
      <p className='pick-heading'>{t('look.title')}</p>
      <ul className='pick-list'>
        {spots.map(s => (
          <li key={s.place.id}>
            <Link to={`/p/${s.place.id}`}>
              <Thumb src={thumbUrl(s.place, s.place.photo)} name={s.place.name} className='mini' />
              <span className='pick-text'><strong>{data.pathText(s.place.id)}</strong><small className='muted'>{why(s)}</small></span>
              <Icon name='chevron' size={16} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
