import { useState } from 'react'
import { Link } from 'react-router'
import Icon from './Icon.jsx'
import Thumb from './Thumb.jsx'
import { ProgressRing, RoomBadge } from './Room.jsx'
import { placeColor, placeIcon } from '../lib/rooms.js'
import { pb, thumbUrl } from '../lib/pb.js'
import { useData } from '../lib/data.jsx'
import { plural } from '../lib/format.js'
import { getPref, setPref } from '../lib/recent.js'
import { t } from '../lib/i18n.jsx'

// Places are for getting somewhere, so by default they're compact rows (two per screen as tiles
// was too slow to scan); tiles stay available for people who navigate by photo. Per device.
export function usePlaceView () {
  const [view, setView] = useState(() => getPref('placeView', 'list'))
  const toggle = () => {
    const next = view === 'list' ? 'tiles' : 'list'
    setView(next)
    setPref('placeView', next)
  }
  return [view, toggle]
}

export function PlaceViewToggle ({ view, onToggle }) {
  return (
    <button className='chip icon-only' onClick={onToggle} aria-label={t(view === 'list' ? 'view.tiles' : 'view.list')} title={t(view === 'list' ? 'view.tiles' : 'view.list')}>
      <Icon name={view === 'list' ? 'grid' : 'list'} size={16} />
    </button>
  )
}

function placeMeta (data, place) {
  const places = data.childrenOf(place.id).length
  const items = data.totalItems(place.id)
  return [items && plural(items, 'item'), places && t('place.inside', { count: places })].filter(Boolean).join(' · ') || t('place.empty')
}

export function PlaceList ({ places, view }) {
  const data = useData()
  if (view === 'tiles') return <Grid>{places.map(p => <PlaceCard key={p.id} place={p} />)}</Grid>
  return (
    <ul className='place-rows'>
      {places.map(p => (
        <li key={p.id}>
          <PlaceRow place={p} />
        </li>
      ))}
    </ul>
  )
}

// Icon and colour say what kind of place it is; the ring says how far the cataloguing got.
function PlaceRow ({ place: p }) {
  const data = useData()
  const prog = data.progress(p.id)
  const drafts = data.draftsIn(p.id).length
  const hasKids = data.childrenOf(p.id).length > 0
  return (
    <Link to={`/p/${p.id}`} className='place-row' style={{ '--room': placeColor(data, p) }}>
      {p.photo ? <span className='place-photo'><Thumb src={thumbUrl(p, p.photo)} name={p.name} /><RoomBadge place={p} size={22} /></span> : <RoomBadge place={p} size={48} />}
      <span className='row-text'>
        <strong>{p.name}</strong>
        <small>
          {placeMeta(data, p)}
          {drafts > 0 && <> · <em className='draft-note'>{t('drafts.count', { count: drafts })}</em></>}
        </small>
      </span>
      {p.full && <span className='badge'>{t('place.fullBadge')}</span>}
      {hasKids && prog.total > 0
        ? <ProgressRing pct={prog.pct} color={placeColor(data, p)} label={t('progress.label', { done: prog.done, total: prog.total })} />
        : p.done ? <span className='done-tick'><Icon name='check' size={16} /></span> : <Icon name='chevron' size={16} />}
    </Link>
  )
}

// Up/down instead of drag: reliable with a thumb on a phone, and a household has few siblings.
function PlaceOrder ({ places }) {
  const data = useData()
  const [error, setError] = useState(null)
  const move = async (index, delta) => {
    const next = [...places]
    const [moved] = next.splice(index, 1)
    next.splice(index + delta, 0, moved)
    setError(null)
    try {
      await Promise.all(next.map((p, n) => (p.order === n + 1 ? null : pb.collection('places').update(p.id, { order: n + 1 }))))
      await data.reload()
    } catch (err) {
      setError(err.message)
    }
  }
  return (
    <>
      {error && <p className='error'>{error}</p>}
      <ul className='place-rows'>
        {places.map((p, n) => (
          <li key={p.id} className='place-row ordering'>
            <RoomBadge place={p} size={40} />
            <span className='row-text'><strong>{p.name}</strong></span>
            <button className='btn icon-only' disabled={n === 0} onClick={() => move(n, -1)} aria-label={t('order.up')}><Icon name='up' size={18} /></button>
            <button className='btn icon-only' disabled={n === places.length - 1} onClick={() => move(n, 1)} aria-label={t('order.down')}><Icon name='down' size={18} /></button>
          </li>
        ))}
      </ul>
    </>
  )
}

// Heading with list/tiles and order controls, then the places. Used on home and on place pages.
export function PlacesSection ({ title, places, children }) {
  const [view, toggle] = usePlaceView()
  const [ordering, setOrdering] = useState(false)
  return (
    <section>
      <h2>
        {title}
        <span className='h2-tools'>
          {children}
          {places.length > 1 && (
            <button className={`chip icon-only ${ordering ? 'on' : ''}`} onClick={() => setOrdering(!ordering)} aria-label={t('order.toggle')} title={t('order.toggle')}>
              <Icon name='sort' size={16} />
            </button>
          )}
          {!ordering && <PlaceViewToggle view={view} onToggle={toggle} />}
        </span>
      </h2>
      {ordering ? <PlaceOrder places={places} /> : <PlaceList places={places} view={view} />}
    </section>
  )
}

export function PlaceCard ({ place }) {
  const data = useData()
  const places = data.childrenOf(place.id).length
  const items = data.totalItems(place.id)
  const meta = [items && plural(items, 'item'), places && t('place.inside', { count: places })].filter(Boolean).join(' · ')
  return (
    <Link to={`/p/${place.id}`} className='card place-card' style={{ '--room': placeColor(data, place) }}>
      {place.photo || data.mosaic(place.id).length
        ? <Thumb src={thumbUrl(place, place.photo)} mosaic={place.photo ? null : data.mosaic(place.id)} name={place.name} />
        : <span className='thumb room-fill'><Icon name={placeIcon(place)} size={44} /></span>}
      {place.full && <div className='badges'><span className='badge'>{t('place.fullBadge')}</span></div>}
      <div className='card-label'>
        <strong>{place.name}</strong>
        <small>{meta || t('place.empty')}</small>
      </div>
    </Link>
  )
}

export function ItemBadges ({ item }) {
  const data = useData()
  const low = item.min_quantity > 0 && (item.quantity ?? 0) <= item.min_quantity
  const expiry = data.expiryState(item)
  const away = item.home && item.home !== item.place && data.placeById.has(item.home)
  if (!item.lent_to && !item.borrowed_from && !item.with_user && !low && !expiry && !away && !item.needs_repair) return null
  return (
    <div className='badges'>
      {item.lent_to && <span className='badge lent'><Icon name='handoff' size={12} />{item.lent_to}</span>}
      {item.with_user && <span className='badge lent'><Icon name='user' size={12} />{t('with.badge')}</span>}
      {item.borrowed_from && <span className='badge lent'><Icon name='handoff' size={12} />{t('borrow.fromShort', { name: item.borrowed_from })}</span>}
      {low && <span className='badge low'><Icon name='alert' size={12} />{t('badge.low')}</span>}
      {expiry && <span className={`badge ${expiry === 'expired' ? 'low' : 'warn'}`}>{expiry === 'expired' ? t('badge.expired') : t('badge.expiresSoon')}</span>}
      {item.needs_repair && <span className='badge warn'><Icon name='wrench' size={12} />{t('repair.badge')}</span>}
      {away && <span className='badge away'><Icon name='home' size={12} />{t('badge.away')}</span>}
    </div>
  )
}

export function ItemCard ({ item, showPath, selectable, selected, onToggle }) {
  const data = useData()
  const body = (
    <>
      <Thumb src={thumbUrl(item, item.photos?.[0])} name={item.name} />
      <ItemBadges item={item} />
      {selectable && <span className={`select-dot ${selected ? 'on' : ''}`}>{selected && <Icon name='check' size={16} />}</span>}
      <div className='card-label'>
        <strong>{item.name}{item.quantity > 1 && <em> ×{item.quantity}</em>}</strong>
        {showPath && <small>{data.whereText(item.place)}</small>}
      </div>
    </>
  )
  if (selectable) {
    return <button type='button' className={`card item ${selected ? 'selected' : ''}`} onClick={() => onToggle(item.id)}>{body}</button>
  }
  return <Link to={`/i/${item.id}`} className='card item'>{body}</Link>
}

export function Grid ({ children }) {
  return <div className='grid'>{children}</div>
}

export function ItemRow ({ item, children }) {
  const data = useData()
  return (
    <li className='row-card'>
      <Link to={`/i/${item.id}`} className='row-main'>
        <Thumb src={thumbUrl(item, item.photos?.[0])} name={item.name} />
        <div>
          <strong>{item.name}{item.quantity > 1 && <em> ×{item.quantity}</em>}</strong>
          <small>{data.whereText(item.place)}</small>
        </div>
      </Link>
      {children}
    </li>
  )
}
