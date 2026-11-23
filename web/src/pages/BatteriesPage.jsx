import { useState } from 'react'
import { Link } from 'react-router'
import Icon from '../components/Icon.jsx'
import { ItemRow } from '../components/Cards.jsx'
import { useData } from '../lib/data.jsx'
import { pb } from '../lib/pb.js'
import { batteryStock, parseBattery } from '../lib/batteries.js'
import { showToast } from '../lib/toast.js'
import { t } from '../lib/i18n.jsx'

// Which devices take which batteries, and whether there are any in the house.
export default function BatteriesPage () {
  const data = useData()
  const [error, setError] = useState(null)

  const groups = new Map()
  for (const item of data.items) {
    const b = parseBattery(item.battery)
    if (!b) continue
    if (!groups.has(b.type)) groups.set(b.type, [])
    groups.get(b.type).push({ item, count: b.count })
  }
  const types = [...groups.entries()].map(([type, devices]) => {
    const stock = batteryStock(data.items, type)
    return { type, devices, stock, have: stock.reduce((n, i) => n + (i.quantity ?? 0), 0) }
  }).sort((a, b) => (a.have > 0) - (b.have > 0) || b.devices.length - a.devices.length)

  const extraName = type => t('battery.extraName', { type })
  const onList = type => data.extras.some(x => x.name.toLowerCase() === extraName(type).toLowerCase())
  const addToList = async type => {
    setError(null)
    try {
      await pb.collection('shopping_extras').create({ name: extraName(type) })
      await data.reload()
      showToast(t('battery.added', { name: extraName(type) }))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className='page batteries'>
      <h1 className='page-title'>{t('battery.title')}</h1>
      <p className='muted'>{t('battery.intro')}</p>
      {error && <p className='error'>{error}</p>}
      {!types.length && <p className='empty'>{t('battery.empty')}</p>}
      {types.map(({ type, devices, stock, have }) => (
        <section key={type} className='battery-group'>
          <h2>{type} <span className='count'>{devices.length}</span></h2>
          <div className={`panel battery-stock ${have ? 'ok' : 'out'}`}>
            {have > 0
              ? (
                <p className='battery-have'>
                  <strong>{t('battery.have', { count: have })}</strong>
                  <small>
                    {stock.filter(i => i.quantity > 0).map((i, n) => (
                      <span key={i.id}>{n > 0 && ', '}<Link to={`/i/${i.id}`}>{data.whereText(i.place)}</Link></span>
                    ))}
                  </small>
                </p>
                )
              : <p>{t('battery.none')}</p>}
            {!have && (onList(type)
              ? <span className='muted small'>{t('battery.onList')}</span>
              : <button className='btn' onClick={() => addToList(type)}><Icon name='cart' size={16} />{t('battery.toList')}</button>)}
          </div>
          <ul className='rows'>
            {devices.map(({ item, count }) => (
              <ItemRow key={item.id} item={item}>
                {count && <div className='row-side'><small className='muted'>×{count}</small></div>}
              </ItemRow>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
