import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import Thumb from '../components/Thumb.jsx'
import { useData } from '../lib/data.jsx'
import { pb, thumbUrl } from '../lib/pb.js'
import { displayName } from '../lib/auth.js'
import { timeAgo } from '../lib/format.js'
import { t, tx } from '../lib/i18n.jsx'

function PlaceLink ({ place, kind }) {
  if (!place) return <span className='muted'>{t(kind === 'item' ? 'unsorted.noPlace' : 'picker.topLevel').toLowerCase()}</span>
  return <Link to={`/p/${place.id}`}>{place.name}</Link>
}

export function Sentence ({ a, data, who }) {
  const ex = a.expand ?? {}
  const target = a.item && data.itemById.get(a.item)
  const name = a.kind === 'item' && target
    ? <Link to={`/i/${a.item}`}><strong>{a.name}</strong></Link>
    : a.kind === 'place' && a.place
      ? <Link to={`/p/${a.place}`}><strong>{a.name}</strong></Link>
      : <strong>{a.name}</strong>
  const vars = {
    who,
    name,
    from: <PlaceLink place={ex.from_place} kind={a.kind} />,
    to: <PlaceLink place={ex.to_place} kind={a.kind} />,
    // "gone" stores "reason: note"; the reason picks the sentence, the note is shown.
    detail: <strong>{a.action === 'gone' ? a.detail.split(': ').slice(1).join(': ') : a.detail}</strong>
  }
  // One template per action, including the person: word order differs per language.
  const unsortedItem = a.kind === 'item'
  const key = a.action === 'deleted' && !ex.from_place
    ? 'activity.deletedNoPlace'
    : unsortedItem && a.action === 'created' && !ex.to_place
      ? 'activity.createdUnsorted'
      : unsortedItem && a.action === 'moved' && !ex.from_place
        ? 'activity.putAway'
        : a.action === 'gone'
          ? `activity.gone.${a.detail.split(': ')[0] || 'other'}`
          : `activity.${a.action}`
  return <>{tx(key, vars)}</>
}

// Filters run on the server so "Load more" pages through the filtered list, not the whole feed.
const KINDS = {
  all: null,
  added: ['created'],
  moved: ['moved'],
  lent: ['lent', 'returned'],
  removed: ['deleted', 'restored', 'gone', 'back'],
  checks: ['missing', 'found', 'serviced']
}
const PAGE = 50

export default function ActivityPage () {
  const data = useData()
  const [rows, setRows] = useState(null)
  const [more, setMore] = useState(false)
  const [pages, setPages] = useState(1)
  const [kind, setKind] = useState('all')
  const [who, setWho] = useState('')
  const [people, setPeople] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    pb.collection('users').getFullList({ sort: 'name' })
      .then(setPeople)
      .catch(err => console.warn('users:', err.message))
  }, [])

  const load = useCallback(() => {
    const parts = []
    const params = {}
    KINDS[kind]?.forEach((a, n) => { params[`a${n}`] = a })
    if (KINDS[kind]) parts.push(`(${KINDS[kind].map((_, n) => `action = {:a${n}}`).join(' || ')})`)
    if (who) { parts.push('user = {:who}'); params.who = who }
    pb.collection('activity').getList(1, PAGE * pages, { sort: '-created', expand: 'user,from_place,to_place', filter: pb.filter(parts.join(' && '), params) })
      .then(res => { setRows(res.items); setMore(res.totalItems > res.items.length) })
      .catch(err => setError(err.message))
  }, [kind, who, pages])

  useEffect(() => {
    load()
    let active = true
    let unsub
    pb.collection('activity').subscribe('*', load)
      .then(u => (active ? (unsub = u) : u()))
      .catch(err => console.warn('realtime activity:', err.message))
    return () => {
      active = false
      unsub?.()
    }
  }, [load])

  // This week at a glance: counts come from the server so they don't depend on the loaded page.
  const [week, setWeek] = useState(null)
  useEffect(() => {
    const since = new Date(Date.now() - 7 * 86400000).toISOString().replace('T', ' ')
    const count = filter => pb.collection('activity').getList(1, 1, { filter: pb.filter(`created >= {:since} && (${filter})`, { since }) }).then(r => r.totalItems)
    Promise.all([count("action = 'created' && kind = 'item'"), count("action = 'moved'"), count("action = 'lent' || action = 'returned'"), count("action = 'gone' || action = 'deleted'")])
      .then(([added, moved, lent, removed]) => setWeek({ added, moved, lent, removed }))
      .catch(err => console.warn('week:', err.message))
  }, [])

  const pick = (setter, value) => { setter(value); setPages(1) }

  if (error) return <p className='error center'>{error}</p>
  if (!rows) return <p className='muted center'>{t('common.loading')}</p>

  return (
    <div className='page'>
      <h1 className='page-title'>{t('tab.activity')}</h1>
      {week && (week.added + week.moved + week.lent + week.removed > 0) && (
        <div className='stat-tiles week'>
          <div className='stat'><strong>{week.added}</strong><span>{t('week.added')}</span></div>
          <div className='stat'><strong>{week.moved}</strong><span>{t('week.moved')}</span></div>
          {week.lent > 0 && <div className='stat'><strong>{week.lent}</strong><span>{t('week.lent')}</span></div>}
          {week.removed > 0 && <div className='stat'><strong>{week.removed}</strong><span>{t('week.removed')}</span></div>}
        </div>
      )}
      <div className='filter-row'>
        {Object.keys(KINDS).map(k => <button key={k} className={`chip ${kind === k ? 'on' : ''}`} onClick={() => pick(setKind, k)}>{t(`activity.filter.${k}`)}</button>)}
      </div>
      {people.length > 1 && (
        <div className='filter-row'>
          <button className={`chip ${!who ? 'on' : ''}`} onClick={() => pick(setWho, '')}>{t('activity.everyone')}</button>
          {people.map(p => <button key={p.id} className={`chip ${who === p.id ? 'on' : ''}`} onClick={() => pick(setWho, p.id)}>{displayName(p, '?')}</button>)}
        </div>
      )}
      {!rows.length && <p className='empty'>{kind === 'all' && !who ? t('activity.empty') : t('activity.noneFiltered')}</p>}
      <ul className='feed'>
        {rows.map(a => {
          const item = a.item && data.itemById.get(a.item)
          const place = a.place && data.placeById.get(a.place)
          const thumb = item ? thumbUrl(item, item.photos?.[0]) : place ? thumbUrl(place, place.photo) : null
          return (
            <li key={a.id}>
              <Thumb src={thumb} name={a.name} />
              <div>
                <p><Sentence a={a} data={data} who={<span className='who'>{displayName(a.expand?.user, t('activity.someone'))}</span>} /></p>
                <small className='muted'>{timeAgo(a.created)}</small>
              </div>
            </li>
          )
        })}
      </ul>
      {more && <button className='btn wide' onClick={() => setPages(p => p + 1)}>{t('activity.loadMore')}</button>}
    </div>
  )
}
