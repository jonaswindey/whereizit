import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import Icon from '../components/Icon.jsx'
import { RoomBadge } from '../components/Room.jsx'
import { useData } from '../lib/data.jsx'
import { pb } from '../lib/pb.js'
import { randomCode } from '../lib/codes.js'
import { AREAS, FLOORS, ROOMS, ROOMS_ON, localName, spotsFor } from '../lib/templates.js'
import { t } from '../lib/i18n.jsx'

const STEPS = ['areas', 'floors', 'rooms', 'spots', 'review']
const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase()
let seq = 0
const node = (level, name, parent, extra = {}) => ({ key: `n${seq++}`, level, name, parent, on: false, ...extra })

// Build the starting tree: what already exists (ticked, kept) plus suggestions (some ticked).
function initialNodes (data) {
  const nodes = []
  const add = n => { nodes.push(n); return n }
  const kids = (parentKey, level) => nodes.filter(n => n.parent === parentKey && n.level === level)
  const suggest = (level, names, parentKey, onCount, extra = {}) => names.forEach((name, i) => {
    if (!nodes.some(n => n.parent === parentKey && same(n.name, name))) add(node(level, name, parentKey, { on: i < onCount, ...extra }))
  })
  const spotsOf = room => {
    for (const c of data.childrenOf(room.existingId ?? '')) add(node('spot', c.name, room.key, { on: true, existingId: c.id }))
    const s = spotsFor(room.name)
    suggest('spot', s.names, room.key, room.existingId && data.childrenOf(room.existingId).length ? 0 : s.on)
  }
  for (const a of data.childrenOf(null)) add(node('area', a.name, null, { on: true, existingId: a.id, house: /huis|house|home|appartement/i.test(a.name) }))
  AREAS.forEach(a => {
    const name = localName(a.name)
    if (!nodes.some(n => n.level === 'area' && same(n.name, name))) add(node('area', name, null, { on: !!a.on && !data.places.length, house: a.key === 'house' }))
  })
  for (const area of nodes.filter(n => n.level === 'area')) {
    if (area.house) {
      // Existing children of the house: floors when they look like floors, otherwise rooms.
      for (const c of data.childrenOf(area.existingId ?? '')) {
        const floor = FLOORS.find(f => f.name.some(n => same(n, c.name)))
        add(node(floor ? 'floor' : 'room', c.name, area.key, { on: true, existingId: c.id, floorKey: floor?.key }))
      }
      FLOORS.forEach(f => {
        const name = localName(f.name)
        if (!nodes.some(n => n.parent === area.key && same(n.name, name))) add(node('floor', name, area.key, { on: !!f.on && !area.existingId, floorKey: f.key }))
      })
      for (const floor of kids(area.key, 'floor')) {
        for (const c of data.childrenOf(floor.existingId ?? '')) add(node('room', c.name, floor.key, { on: true, existingId: c.id }))
        const names = (ROOMS[floor.floorKey] ?? []).map(localName)
        suggest('room', names, floor.key, floor.existingId && data.childrenOf(floor.existingId).length ? 0 : ROOMS_ON[floor.floorKey] ?? 1)
      }
      // Rooms straight under the house, for homes without floors.
      suggest('room', ROOMS.house.map(localName), area.key, 0, { direct: true })
    }
  }
  // Every room-level node (and areas that are a room themselves) gets storage spot suggestions.
  for (const room of nodes.filter(n => n.level === 'room' || (n.level === 'area' && !n.house))) spotsOf(room)
  return nodes
}

function Chip ({ n, onToggle }) {
  return (
    <button type='button' className={`setup-chip ${n.on ? 'on' : ''} ${n.existingId ? 'exists' : ''}`} onClick={() => !n.existingId && onToggle(n.key)} aria-pressed={n.on}>
      {n.on && <Icon name='check' size={14} />}{n.name}
    </button>
  )
}

function AddOne ({ placeholder, onAdd }) {
  const [v, setV] = useState('')
  return (
    <form className='setup-add' onSubmit={e => { e.preventDefault(); v.trim() && onAdd(v.trim()); setV('') }}>
      <input value={v} onChange={e => setV(e.target.value)} placeholder={placeholder} />
      <button className='btn icon-only' disabled={!v.trim()} aria-label={t('setup.add')}><Icon name='plus' size={18} /></button>
    </form>
  )
}

// Start from zero: areas → floors → rooms → storage spots → review, then labels and missions.
export default function SetupPage () {
  const data = useData()
  const navigate = useNavigate()
  const initial = useMemo(() => initialNodes(data), [data.loading]) // eslint-disable-line react-hooks/exhaustive-deps
  const [nodes, setNodes] = useState(initial)
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(null) // { done, total }
  const [created, setCreated] = useState(null) // ids of new storage spots
  const [error, setError] = useState(null)

  const byKey = new Map(nodes.map(n => [n.key, n]))
  const visible = n => !n.parent || (byKey.get(n.parent)?.on && visible(byKey.get(n.parent)))
  const children = (key, level) => nodes.filter(n => n.parent === key && (!level || n.level === level))
  const toggle = key => setNodes(ns => ns.map(n => (n.key === key ? { ...n, on: !n.on } : n)))
  const addNode = (level, parent, name, extra) => setNodes(ns => {
    if (ns.some(n => n.parent === parent && same(n.name, name))) return ns.map(n => (n.parent === parent && same(n.name, name) ? { ...n, on: true } : n))
    const added = node(level, name, parent, { on: true, ...extra })
    // A room (or an outside area) typed in by hand gets storage spot suggestions straight away.
    const spots = level === 'room' || level === 'area' ? spotsFor(name) : null
    return [...ns, added, ...(spots ? spots.names.map((sn, i) => node('spot', sn, added.key, { on: i < spots.on })) : [])]
  })

  const areas = nodes.filter(n => n.level === 'area')
  const house = areas.find(a => a.house && a.on)
  const floors = house ? children(house.key, 'floor') : []
  const floorsOn = floors.filter(f => f.on)
  // Room containers: chosen floors, or the house itself when it has no floors.
  const roomParents = house ? (floorsOn.length ? floorsOn : [house]) : []
  const roomsOn = nodes.filter(n => n.level === 'room' && n.on && visible(n) && (floorsOn.length ? !n.direct : n.direct || n.parent === house?.key))
  const spotParents = [...roomsOn, ...areas.filter(a => a.on && !a.house)]
  const toCreate = nodes.filter(n => n.on && !n.existingId && visible(n) && (n.level !== 'room' || roomsOn.includes(n)) && (n.level !== 'spot' || spotParents.some(p => p.key === n.parent)))
  const steps = STEPS.filter(s => s !== 'floors' || house)

  const create = async () => {
    setError(null)
    setBusy({ done: 0, total: toCreate.length })
    const ids = new Map(nodes.filter(n => n.existingId).map(n => [n.key, n.existingId]))
    const newSpots = []
    try {
      for (const level of ['area', 'floor', 'room', 'spot']) {
        for (const n of toCreate.filter(x => x.level === level)) {
          const rec = await pb.collection('places').create({ name: n.name, parent: n.parent ? ids.get(n.parent) ?? '' : '' })
          ids.set(n.key, rec.id)
          if (level === 'spot') newSpots.push(rec.id)
          setBusy(b => ({ ...b, done: b.done + 1 }))
        }
      }
      await data.reload()
      setCreated(newSpots)
    } catch (err) {
      setError(err.message)
    }
    setBusy(null)
  }

  const labels = async () => {
    setBusy({ done: 0, total: created.length })
    const codes = []
    try {
      for (const id of created) {
        codes.push((await pb.collection('labels').create({ code: randomCode(), place: id })).code)
        setBusy(b => ({ ...b, done: b.done + 1 }))
      }
      navigate(`/labels?codes=${codes.join(',')}`)
    } catch (err) {
      setError(err.message)
      setBusy(null)
    }
  }

  if (created) {
    return (
      <div className='page setup'>
        <div className='setup-hero'>
          <Icon name='house' size={36} />
          <h1>{t('setup.doneTitle')}</h1>
          <p>{t('setup.doneText', { count: created.length })}</p>
        </div>
        {busy && <p className='muted'>{t('setup.working', busy)}</p>}
        {error && <p className='error'>{error}</p>}
        {created.length > 0 && <button className='btn primary big' disabled={!!busy} onClick={labels}><Icon name='qr' />{t('setup.printLabels', { count: created.length })}</button>}
        <button className='btn big' onClick={() => navigate('/missions')}><Icon name='target' />{t('setup.toMissions')}</button>
        <button className='btn big' onClick={() => navigate('/')}>{t('setup.toHome')}</button>
      </div>
    )
  }

  const current = steps[step]
  return (
    <div className='page setup'>
      <div className='setup-steps'>
        {steps.map((s, i) => <span key={s} className={i <= step ? 'on' : ''} />)}
      </div>
      <h1 className='page-title'>{t(`setup.${current}.title`)}</h1>
      <p className='muted'>{t(`setup.${current}.intro`)}</p>

      {current === 'areas' && (
        <div className='panel form'>
          <div className='setup-chips'>{areas.map(n => <Chip key={n.key} n={n} onToggle={toggle} />)}</div>
          <AddOne placeholder={t('setup.addArea')} onAdd={name => addNode('area', null, name)} />
        </div>
      )}

      {current === 'floors' && house && (
        <div className='panel form'>
          <div className='setup-chips'>{floors.map(n => <Chip key={n.key} n={n} onToggle={toggle} />)}</div>
          <AddOne placeholder={t('setup.addFloor')} onAdd={name => addNode('floor', house.key, name)} />
          <p className='muted small'>{t('setup.noFloors')}</p>
        </div>
      )}

      {current === 'rooms' && roomParents.map(p => (
        <div key={p.key} className='panel form'>
          <h2 className='setup-group'>{p.name}</h2>
          <div className='setup-chips'>
            {children(p.key, 'room').filter(n => (floorsOn.length ? !n.direct : true)).map(n => <Chip key={n.key} n={n} onToggle={toggle} />)}
          </div>
          <AddOne placeholder={t('setup.addRoom')} onAdd={name => addNode('room', p.key, name, { direct: !floorsOn.length })} />
        </div>
      ))}
      {current === 'rooms' && !roomParents.length && <p className='empty'>{t('setup.noHouse')}</p>}

      {current === 'spots' && spotParents.map(room => (
        <div key={room.key} className='panel form'>
          <h2 className='setup-group'><RoomBadge place={{ name: room.name }} size={30} />{room.name}</h2>
          <div className='setup-chips'>
            {children(room.key, 'spot').map(n => <Chip key={n.key} n={n} onToggle={toggle} />)}
          </div>
          <AddOne placeholder={t('setup.addSpot')} onAdd={name => addNode('spot', room.key, name)} />
        </div>
      ))}

      {current === 'review' && (
        <div className='panel form'>
          <p className='setup-summary'>
            {['area', 'floor', 'room', 'spot'].map(level => {
              const n = toCreate.filter(x => x.level === level).length
              return n ? <span key={level}><strong>{n}</strong> {t(`setup.level.${level}`, { count: n })}</span> : null
            })}
          </p>
          {!toCreate.length && <p className='muted'>{t('setup.nothing')}</p>}
          <p className='muted small'>{t('setup.reviewHint')}</p>
          {busy && <p className='muted'>{t('setup.working', busy)}</p>}
          {error && <p className='error'>{error}</p>}
        </div>
      )}

      <div className='setup-nav'>
        {step > 0 && <button className='btn' onClick={() => setStep(step - 1)} disabled={!!busy}>{t('setup.back')}</button>}
        {current !== 'review'
          ? <button className='btn primary' onClick={() => setStep(step + 1)}>{t('setup.next')}</button>
          : <button className='btn primary' disabled={!toCreate.length || !!busy} onClick={create}>{t('setup.create', { count: toCreate.length })}</button>}
      </div>
    </div>
  )
}
