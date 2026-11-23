import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useData } from '../lib/data.jsx'
import { pb } from '../lib/pb.js'
import { displayName } from '../lib/auth.js'
import { formatPrice } from '../lib/format.js'
import { getLang, t } from '../lib/i18n.jsx'

// One measure per list, one hue, every bar labelled with its value: readable without a legend.
function Bars ({ rows, format = n => n }) {
  const max = Math.max(1, ...rows.map(r => r.value))
  return (
    <ul className='bars'>
      {rows.map(r => {
        const label = r.to ? <Link to={r.to}>{r.label}</Link> : r.label
        return (
          <li key={r.key} title={`${r.label}: ${format(r.value)}`}>
            <span className='bar-label'>{label}</span>
            <span className='bar-track'><span className='bar-fill' style={{ width: `${(r.value / max) * 100}%` }} /></span>
            <span className='bar-value'>{format(r.value)}</span>
          </li>
        )
      })}
    </ul>
  )
}

export default function StatsPage () {
  const data = useData()
  const [byPerson, setByPerson] = useState(null)

  useEffect(() => {
    let active = true
    // Counts come from the activity log, so they include items added before anyone moved them.
    pb.collection('users').getFullList()
      .then(users => Promise.all(users.map(async u => {
        const res = await pb.collection('activity').getList(1, 1, { filter: pb.filter("user = {:id} && action = 'created' && kind = 'item'", { id: u.id }) })
        return { key: u.id, label: displayName(u, '?'), value: res.totalItems }
      })))
      .then(rows => active && setByPerson(rows.filter(r => r.value > 0).sort((a, b) => b.value - a.value)))
      .catch(err => console.warn('stats by person:', err.message))
    return () => { active = false }
  }, [])

  const items = data.items
  const withPhoto = items.filter(i => i.photos?.length).length
  const photoPct = items.length ? Math.round((withPhoto / items.length) * 100) : 0
  const value = data.totalValue()

  const top = data.childrenOf(null).map(p => ({ key: p.id, label: p.name, to: `/p/${p.id}`, value: data.totalItems(p.id) }))
    .sort((a, b) => b.value - a.value)
  // Rooms: the level below the top places, the most crowded first.
  const rooms = data.childrenOf(null).flatMap(p => data.childrenOf(p.id).flatMap(f => [f, ...data.childrenOf(f.id)]))
    .map(p => ({ key: p.id, label: p.name, to: `/p/${p.id}`, value: data.totalItems(p.id) }))
    .filter(r => r.value > 0).sort((a, b) => b.value - a.value).slice(0, 8)
  const tags = data.tags.map(tag => ({ key: tag.id, label: tag.name, to: `/tags/${tag.id}`, value: data.itemsWithTag(tag.id).length }))
    .filter(r => r.value > 0).sort((a, b) => b.value - a.value).slice(0, 8)

  const months = []
  const now = new Date()
  for (let n = 5; n >= 0; n--) {
    const d = new Date(now.getFullYear(), now.getMonth() - n, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    months.push({ key, label: d.toLocaleDateString(getLang(), { month: 'short', year: '2-digit' }), value: items.filter(i => i.created.startsWith(key)).length })
  }

  const valued = data.childrenOf(null).map(p => ({ key: p.id, label: p.name, to: `/p/${p.id}`, value: data.totalValue(p.id) }))
    .filter(r => r.value > 0).sort((a, b) => b.value - a.value)

  return (
    <div className='page'>
      <h1 className='page-title'>{t('stats.title')}</h1>
      <div className='stat-tiles'>
        <div className='stat'><strong>{items.length}</strong><span>{t('stats.items')}</span></div>
        <div className='stat'><strong>{data.places.length}</strong><span>{t('stats.places')}</span></div>
        <Link className='stat' to='/search?f=nophoto'><strong>{photoPct}%</strong><span>{t('stats.withPhoto')}</span></Link>
        {value > 0 && <div className='stat'><strong>{formatPrice(value)}</strong><span>{t('stats.value')}</span></div>}
      </div>

      {top.length > 0 && <section><h2>{t('stats.perPlace')}</h2><Bars rows={top} /></section>}
      {rooms.length > 1 && <section><h2>{t('stats.fullest')}</h2><Bars rows={rooms} /></section>}
      <section><h2>{t('stats.addedPerMonth')}</h2><Bars rows={months} /></section>
      {byPerson?.length > 0 && <section><h2>{t('stats.byPerson')}</h2><Bars rows={byPerson} /></section>}
      {tags.length > 0 && <section><h2>{t('stats.tags')}</h2><Bars rows={tags} /></section>}
      {valued.length > 0 && <section><h2>{t('stats.valuePerPlace')}</h2><Bars rows={valued} format={formatPrice} /></section>}
    </div>
  )
}
