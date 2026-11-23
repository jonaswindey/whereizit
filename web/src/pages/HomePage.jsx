import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ItemCard, ItemRow, PlacesSection } from '../components/Cards.jsx'
import Avatar from '../components/Avatar.jsx'
import Fab from '../components/Fab.jsx'
import Icon from '../components/Icon.jsx'
import PlaceForm from '../components/PlaceForm.jsx'
import PlacePicker from '../components/PlacePicker.jsx'
import Sheet from '../components/Sheet.jsx'
import { ProgressBar, RoomBadge, ProgressRing } from '../components/Room.jsx'
import { TagChip } from '../components/TagPicker.jsx'
import { useData } from '../lib/data.jsx'
import { displayName, useAuthUser } from '../lib/auth.js'
import { pb, thumbUrl } from '../lib/pb.js'
import Thumb from '../components/Thumb.jsx'
import { useMembers } from '../lib/members.js'
import { timeAgo } from '../lib/format.js'
import { getLastAdd, getPref, getRecentPlaces, setPref } from '../lib/recent.js'
import { stockCheckDue } from '../lib/stock.js'
import { placeColor } from '../lib/rooms.js'
import { showToast } from '../lib/toast.js'
import { claimEnd, claimStart, claimWhen, conflicts, inDays, today } from '../lib/claims.js'
import { t } from '../lib/i18n.jsx'

const greeting = () => {
  const h = new Date().getHours()
  return h < 6 ? 'home.hello.night' : h < 12 ? 'home.hello.morning' : h < 18 ? 'home.hello.afternoon' : 'home.hello.evening'
}

// Finding is the main job, so search leads. Then the household's cataloguing progress and the four
// things people do (sweep, name, hunt, supplies), then what needs attention, then browsing.
// Kids see their own missions instead of the grown-up housekeeping.
export default function HomePage () {
  const data = useData()
  const user = useAuthUser()
  const navigate = useNavigate()
  const [mode, setMode] = useState(null) // 'place' | 'pick' | 'sweep'
  const kid = user?.role === 'kid'
  const top = data.childrenOf(null)

  // Danger-tinted cards are the ones that are actually wrong (overdue, missing, expired).
  const attention = [
    { to: '/unsorted', icon: 'inbox', count: data.unsorted.length, label: t('home.unsorted') },
    { to: '/lent', icon: 'handoff', count: data.overdue.length, label: t('home.overdue'), danger: true },
    { to: '/missing', icon: 'search', count: data.missing.length, label: t('home.missing'), danger: true },
    { to: '/expiring', icon: 'alert', count: data.expiring.length, label: t('home.expiring'), danger: data.expiring.some(i => data.expiryState(i) === 'expired') },
    { to: '/stock/check', icon: 'check', count: stockCheckDue(user, data.lastStockCheck, data.staples.length > 0) ? data.staples.length : 0, label: t('home.stockCheck') },
    { to: '/shopping', icon: 'cart', count: data.staples.length ? 0 : data.lowStock.length, label: t('home.toBuy') },
    { to: '/repairs', icon: 'wrench', count: data.repairs.length, label: t('home.repairs') },
    { to: '/maintenance', icon: 'wrench', count: data.maintenanceDue.length, label: t('home.maintenance') },
    { to: '/misplaced', icon: 'home', count: data.misplaced.length, label: t('home.misplaced') },
    { to: '/lent', icon: 'handoff', count: data.lent.length - data.overdue.length, label: t('home.lent') },
    { to: '/lent', icon: 'handoff', count: data.borrowed.length, label: t('home.borrowed'), danger: data.borrowed.some(data.isBackDue) },
    { to: '/lent', icon: 'handoff', count: data.carriedLong.length, label: t('home.carriedLong') }
  ].filter(a => a.count > 0)

  const recentPlaces = getRecentPlaces().map(id => data.placeById.get(id)).filter(Boolean).slice(0, 8)
  const lastAdd = data.placeById.get(getLastAdd())
  const seasonal = data.tags.filter(tag => tag.seasonal).map(tag => ({ tag, count: data.itemsWithTag(tag.id).length })).filter(s => s.count > 0)

  const addPlace = async values => {
    const created = await pb.collection('places').create({ ...values, parent: '' })
    await data.reload()
    setMode(null)
    navigate(`/p/${created.id}`)
  }

  const name = displayName(user, '').split(' ')[0]
  const progress = data.progress(null)
  const myRooms = data.missionRooms.filter(r => r.assignee === user?.id).map(room => ({ room, prog: data.progress(room.id) })).filter(x => x.prog.pct < 100)

  return (
    <div className='page home'>
      <div className='home-hero'>
        <div className='greeting-row'>
          <p className='greeting display'>{name ? t(greeting(), { name }) : t('home.welcomeBack')}</p>
          <Link to='/me' className='home-avatar' aria-label={t('me.title')}><Avatar user={user} size={42} /></Link>
        </div>
        <Link to='/search' className='search-launch'>
          <Icon name='search' />
          <span>{t('home.searchPrompt')}</span>
          <Icon name='mic' size={18} />
        </Link>
      </div>

      {!top.length && !data.loading && (
        <Link to='/setup' className='start-card'>
          <span className='start-icon'><Icon name='house' size={30} /></span>
          <strong className='display'>{t('home.startTitle')}</strong>
          <span>{t('home.startText')}</span>
          <span className='btn primary'>{t('setup.start')}</span>
        </Link>
      )}

      {data.openAsks.length > 0 && <AsksCard />}

      <WithMe />

      <NeedSoon />

      {top.length > 0 && (
        <Link to='/missions' className='panel household-progress home-progress'>
          <div className='hp-top'>
            <strong className='display'>{t('missions.house', { pct: progress.pct })}</strong>
            <span className='muted small'>{t('home.summary', { places: t('count.place', { count: data.places.length }), items: t('count.item', { count: data.items.length }) })}</span>
          </div>
          <ProgressBar pct={progress.pct} />
        </Link>
      )}

      {top.length > 0 && (
        <div className='quick-actions'>
          <button className='quick' onClick={() => (lastAdd ? navigate(`/sweep/${lastAdd.id}`) : setMode('sweep'))}>
            <span className='quick-icon' style={{ '--room': 'var(--room-1)' }}><Icon name='camera' size={24} /></span>
            <strong>{t('quick.sweep')}</strong>
            <small>{lastAdd ? lastAdd.name : t('quick.sweepHint')}</small>
          </button>
          <Link className='quick' to='/name'>
            <span className='quick-icon' style={{ '--room': 'var(--room-3)' }}><Icon name='edit' size={24} />{data.drafts.length > 0 && <em className='quick-badge'>{data.drafts.length}</em>}</span>
            <strong>{t('quick.name')}</strong>
            <small>{data.drafts.length ? t('drafts.count', { count: data.drafts.length }) : t('quick.nameHint')}</small>
          </Link>
          <Link className='quick' to='/hunt'>
            <span className='quick-icon' style={{ '--room': 'var(--room-2)' }}><Icon name='target' size={24} /></span>
            <strong>{t('quick.hunt')}</strong>
            <small>{t('quick.huntHint')}</small>
          </Link>
          <Link className='quick' to={kid ? '/missions' : '/stock'}>
            <span className='quick-icon' style={{ '--room': 'var(--room-4)' }}><Icon name={kid ? 'trophy' : 'cart'} size={24} /></span>
            <strong>{kid ? t('missions.title') : t('stock.title')}</strong>
            <small>{kid ? t('quick.missionsHint') : data.lowStock.length + data.extras.length ? t('home.suppliesLow', { count: data.lowStock.length + data.extras.length }) : t('quick.stockHint')}</small>
          </Link>
        </div>
      )}

      <Discovery />

      <ThisWeek />

      {myRooms.length > 0 && (
        <section>
          <h2>{t('home.myMissions')}</h2>
          <div className='my-missions'>
            {myRooms.map(({ room, prog }) => (
              <button key={room.id} className='my-mission' style={{ '--room': placeColor(data, room) }} onClick={() => { const spot = data.childrenOf(room.id).find(c => !c.done); navigate(spot ? `/sweep/${spot.id}` : `/p/${room.id}`) }}>
                <RoomBadge place={room} size={40} />
                <span className='row-text'><strong>{room.name}</strong><small>{t('progress.label', prog)}</small></span>
                <ProgressRing pct={prog.pct} color={placeColor(data, room)} label={t('progress.label', prog)} />
              </button>
            ))}
          </div>
        </section>
      )}

      {attention.length > 0 && !kid && (
        <section>
          <h2>{t('home.attention')}</h2>
          <div className='attention-grid'>
            {attention.map(a => (
              <Link key={a.label} to={a.to} className={`attention-card ${a.danger ? 'danger' : ''}`}>
                <Icon name={a.icon} size={18} />
                <strong>{a.count}</strong>
                <span>{a.label}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {(lastAdd || recentPlaces.length > 0) && (
        <section>
          <h2>{t('home.continue')}</h2>
          {lastAdd && (
            <Link to={`/add/${lastAdd.id}`} className='continue-add'>
              <Icon name='camera' />
              <span><strong>{t('home.addMoreTo', { name: lastAdd.name })}</strong><small>{data.pathText(lastAdd.parent) || t('picker.topLevel')}</small></span>
              <Icon name='chevron' size={16} />
            </Link>
          )}
          {recentPlaces.length > 0 && (
            <div className='place-pills'>
              {recentPlaces.map(p => (
                <Link key={p.id} to={`/p/${p.id}`} className='place-pill'>
                  <RoomBadge place={p} size={28} />
                  <span><strong>{p.name}</strong><small>{data.path(p.id).slice(-2, -1)[0]?.name ?? ''}</small></span>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {data.pinned.length > 0 && (
        <section>
          <h2><Icon name='star' size={16} />{t('home.pinned')}</h2>
          <div className='strip'>{data.pinned.map(i => <ItemCard key={i.id} item={i} showPath />)}</div>
        </section>
      )}

      {top.length > 0 && (
        <PlacesSection title={t('tab.places')} places={top}>
          <Link to='/map' className='section-link'>{t('home.seeMap')}</Link>
        </PlacesSection>
      )}

      {seasonal.length > 0 && (
        <section>
          <h2>{t('home.seasonal')}</h2>
          <div className='filter-row'>
            {seasonal.map(({ tag, count }) => (
              <Link key={tag.id} to={`/tags/${tag.id}`} className='season-link'><TagChip tag={tag} /><span className='muted small'>{count}</span></Link>
            ))}
          </div>
        </section>
      )}

      {data.items.length > 0 && (
        <section>
          <h2>{t('home.recent')}<Link to='/activity' className='section-link'>{t('home.seeActivity')}</Link></h2>
          <div className='strip'>{data.items.slice(0, 10).map(i => <ItemCard key={i.id} item={i} showPath />)}</div>
        </section>
      )}

      <Fab actions={[
        lastAdd && { icon: 'camera', label: t('home.addMoreTo', { name: lastAdd.name }), hint: t('home.lastAddHint'), onClick: () => navigate(`/add/${lastAdd.id}`) },
        top.length > 0 && { icon: 'box', label: t('home.addToPlace'), hint: t('home.addToPlaceHint'), onClick: () => setMode('pick') },
        { icon: 'inbox', label: t('unsorted.add'), hint: t('unsorted.addHint'), onClick: () => navigate('/add/unsorted') },
        { icon: 'plus', label: t('place.add'), hint: t('fab.topPlaceHint'), onClick: () => setMode('place') }
      ]}
      />
      {mode === 'pick' && <PlacePicker title={t('home.addToPlace')} onPick={id => navigate(`/add/${id}`)} onClose={() => setMode(null)} />}
      {mode === 'sweep' && <PlacePicker title={t('quick.sweepWhere')} onPick={id => navigate(`/sweep/${id}`)} onClose={() => setMode(null)} />}
      {mode === 'place' && (
        <Sheet title={t('place.add')} onClose={() => setMode(null)}>
          <PlaceForm submitLabel={t('place.add')} onSubmit={addPlace} onCancel={() => setMode(null)} />
        </Sheet>
      )}
    </div>
  )
}

// Open asks sit near the top for everyone: answering one is the quickest good deed in the house.
function AsksCard () {
  const data = useData()
  const members = useMembers()
  const shown = data.openAsks.slice(0, 3)
  return (
    <Link to='/asks' className='panel asks-card'>
      <div className='asks-card-head'>
        <Icon name='ask' />
        <strong className='display'>{t('asks.homeTitle', { count: data.openAsks.length })}</strong>
        <Icon name='chevron' size={16} />
      </div>
      <ul>
        {shown.map(a => {
          const author = members.find(m => m.id === a.author)
          return (
            <li key={a.id}>
              <Avatar user={author} size={26} />
              <span className='row-text'><strong>{a.text}</strong><small className='muted'>{displayName(author, '')} · {timeAgo(a.created)}</small></span>
            </li>
          )
        })}
      </ul>
    </Link>
  )
}

const dayKey = () => new Date().toISOString().slice(0, 10)
const hashText = text => {
  let h = 0
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h
}

// One thing from the house per day: a small reminder of what you own, and a gentle check that the app
// is still right. "Still there" counts as seen; "Not anymore" opens the item to fix it. Things checked
// in the last month are skipped, so it keeps surfacing forgotten corners.
function Discovery () {
  const data = useData()
  const [answered, setAnswered] = useState(() => getPref('discovery', '') === dayKey())
  const [error, setError] = useState(null)
  const month = Date.now() - 30 * 864e5
  const pool = data.items.filter(i => i.place && i.photos?.length && !i.missing && !i.staple && !(i.checked_at && new Date(i.checked_at.replace(' ', 'T')).getTime() > month))
  if (answered || pool.length < 3) return null
  const sorted = [...pool].sort((a, b) => a.id.localeCompare(b.id))
  const item = sorted[hashText(dayKey()) % sorted.length]

  const done = () => {
    setPref('discovery', dayKey())
    setAnswered(true)
  }
  const stillThere = async () => {
    setError(null)
    try {
      await pb.collection('items').update(item.id, { checked_at: new Date().toISOString(), missing: false })
      done()
      showToast(t('discovery.thanks'))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section className='discovery' style={{ '--room': placeColor(data, data.placeById.get(item.place)) }}>
      <h2><Icon name='lightbulb' size={18} />{t('discovery.title')}</h2>
      <div className='discovery-card'>
        <Link to={`/i/${item.id}`} className='discovery-photo'><Thumb src={thumbUrl(item, item.photos[0])} name={item.name} /></Link>
        <div className='discovery-text'>
          <p>{t('discovery.text', { name: item.name, where: data.whereText(item.place) })}</p>
          {error && <p className='error'>{error}</p>}
          <div className='discovery-actions'>
            <button className='btn primary' onClick={stillThere}><Icon name='check' size={16} />{t('discovery.yes')}</button>
            <Link className='btn' to={`/i/${item.id}`} onClick={done}>{t('discovery.no')}</Link>
          </div>
        </div>
      </div>
    </section>
  )
}

const weekStart = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}

// Who did what this week: things added (sweeps count) and asks answered. A quiet scoreboard that
// makes cataloguing feel shared; only in households with more than one member.
function ThisWeek () {
  const data = useData()
  const members = useMembers()
  const [added, setAdded] = useState(null) // Map userId → count
  const itemCount = data.items.length + data.drafts.length
  useEffect(() => {
    let active = true
    const since = weekStart().toISOString().replace('T', ' ')
    pb.collection('activity').getFullList({ filter: pb.filter("created >= {:since} && action = 'created' && kind = 'item'", { since }), fields: 'user', requestKey: 'this-week' })
      .then(rows => {
        if (!active) return
        const counts = new Map()
        for (const r of rows) if (r.user) counts.set(r.user, (counts.get(r.user) ?? 0) + 1)
        setAdded(counts)
      })
      .catch(err => console.warn('this week:', err.message))
    return () => { active = false }
  }, [itemCount])

  if (!added) return null
  const start = weekStart().getTime()
  const found = new Map()
  for (const a of data.asks) {
    if (a.answered_by && new Date(a.answered.replace(' ', 'T')).getTime() >= start) found.set(a.answered_by, (found.get(a.answered_by) ?? 0) + 1)
  }
  const rows = members
    .map(m => ({ m, added: added.get(m.id) ?? 0, found: found.get(m.id) ?? 0 }))
    .filter(r => r.added || r.found)
    .sort((a, b) => b.added + b.found * 5 - (a.added + a.found * 5))
  if (members.length < 2 || !rows.length) return null
  return (
    <section>
      <h2>{t('homeWeek.title')}</h2>
      <ul className='week-list'>
        {rows.map(({ m, added, found }) => (
          <li key={m.id}>
            <Avatar user={m} size={34} />
            <strong>{displayName(m, '?').split(' ')[0]}</strong>
            <span className='muted small'>{[added && t('homeWeek.added', { count: added }), found && t('homeWeek.found', { count: found })].filter(Boolean).join(' · ')}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

// Things you took along still count as "in the cupboard" for everyone else until you put them back,
// so the reminder sits on your own home screen.
function WithMe () {
  const data = useData()
  const user = useAuthUser()
  const [error, setError] = useState(null)
  const mine = data.carried.filter(i => i.with_user === user?.id)
  if (!mine.length) return null
  const putBack = async item => {
    setError(null)
    try {
      await pb.collection('items').update(item.id, { with_user: '', with_since: '' })
      showToast(t('with.putBackDone', { name: item.name, where: data.whereText(item.place) }))
    } catch (err) {
      setError(err.message)
    }
  }
  return (
    <section>
      <h2>{t('with.title')}</h2>
      {error && <p className='error'>{error}</p>}
      <ul className='rows'>
        {mine.map(i => (
          <ItemRow key={i.id} item={i}>
            <div className='row-side'>
              <small className='muted'>{timeAgo(i.with_since)}</small>
              <button className='btn' onClick={() => putBack(i)}>{t('with.putBack')}</button>
            </div>
          </ItemRow>
        ))}
      </ul>
    </section>
  )
}

// Your own claims from today to the day after tomorrow: time to dig out the tent.
function NeedSoon () {
  const data = useData()
  const user = useAuthUser()
  const soon = data.claims.filter(c => c.user === user?.id && claimStart(c) <= inDays(2) && claimEnd(c) >= today())
  if (!soon.length) return null
  return (
    <section>
      <h2>{t('claim.homeTitle')}</h2>
      <ul className='rows'>
        {soon.map(c => {
          const item = data.itemById.get(c.item)
          const issue = conflicts(item, claimStart(c) < today() ? today() : claimStart(c))[0]
          return (
            <ItemRow key={c.id} item={item}>
              <div className='row-side'>
                <small className={issue ? 'warn' : 'muted'}>{issue || claimWhen(c)}</small>
              </div>
            </ItemRow>
          )
        })}
      </ul>
    </section>
  )
}
