import { useState } from 'react'
import { alreadyHave } from '../lib/suggest.js'
import { Link } from 'react-router'
import Icon from '../components/Icon.jsx'
import Thumb from '../components/Thumb.jsx'
import { useData } from '../lib/data.jsx'
import { pb, thumbUrl } from '../lib/pb.js'
import { shoppingText } from '../lib/stock.js'
import { showToast } from '../lib/toast.js'
import { t } from '../lib/i18n.jsx'

// Everything at or below its reorder level, grouped by shop. "Bought" tops it up to the target.
export default function ShoppingPage () {
  const data = useData()
  const [error, setError] = useState(null)
  const [extraName, setExtraName] = useState('')
  const [extraShop, setExtraShop] = useState('')
  const rows = data.lowStock.map(item => ({ item, need: data.toBuy(item) }))
  // One-off things ("glue", "AA batteries") sit in the same shop groups as the supplies.
  const extras = data.extras.map(extra => ({ extra }))
  const shops = [...new Set([...data.staples.map(i => i.shop), ...data.extras.map(e => e.shop)].filter(Boolean))].sort()
  const byShop = new Map()
  for (const r of [...rows, ...extras]) {
    const k = (r.item?.shop ?? r.extra.shop)?.trim() || ''
    if (!byShop.has(k)) byShop.set(k, [])
    byShop.get(k).push(r)
  }
  const groups = [...byShop.entries()].sort(([a], [b]) => (a ? (b ? a.localeCompare(b) : -1) : 1))

  const run = async fn => {
    setError(null)
    try {
      await fn()
      await data.reload()
    } catch (err) {
      setError(err.message)
    }
  }
  const bought = ({ item, need }) => run(async () => {
    const before = item.quantity ?? 0
    await pb.collection('items').update(item.id, { quantity: before + need })
    showToast(t('shop.bought', { name: item.name }), {
      label: t('action.undo'),
      run: () => pb.collection('items').update(item.id, { quantity: before }).then(data.reload)
    })
  })
  const haveText = name => {
    const have = alreadyHave(data, name)
    return have.length ? t('shop.haveSome', { what: have.map(i => `${i.name} (${data.whereText(i.place)})`).join(', ') }) : null
  }
  const typingHave = extraName.trim().length >= 3 ? haveText(extraName.trim()) : null
  const addExtra = e => {
    e.preventDefault()
    const name = extraName.trim()
    if (!name) return
    setExtraName('')
    run(() => pb.collection('shopping_extras').create({ name, shop: extraShop.trim() }))
  }
  const boughtExtra = extra => run(async () => {
    await pb.collection('shopping_extras').delete(extra.id)
    showToast(t('shop.bought', { name: extra.name }), {
      label: t('action.undo'),
      run: () => pb.collection('shopping_extras').create({ name: extra.name, shop: extra.shop }).then(data.reload)
    })
  })

  const boughtAll = () => run(() => Promise.all([
    ...rows.map(({ item, need }) => pb.collection('items').update(item.id, { quantity: (item.quantity ?? 0) + need })),
    ...data.extras.map(x => pb.collection('shopping_extras').delete(x.id))
  ]))

  // Not low yet, but at the current pace gone within three days: worth taking along.
  const soon = data.staples.filter(i => !data.lowStock.includes(i) && (data.runsOutIn(i) ?? Infinity) <= 3)

  const text = shoppingText(groups, t)
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: t('shop.title'), text })
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message)
      }
      return
    }
    navigator.clipboard.writeText(text).then(() => showToast(t('share.copied')), err => setError(err.message))
  }

  return (
    <div className='page'>
      <h1 className='page-title'>{t('shop.title')}</h1>
      {error && <p className='error'>{error}</p>}
      <form className='extra-form' onSubmit={addExtra}>
        <input value={extraName} onChange={e => setExtraName(e.target.value)} placeholder={t('shop.addPlaceholder')} />
        <input value={extraShop} onChange={e => setExtraShop(e.target.value)} placeholder={t('stock.shop')} list='shop-names' />
        <datalist id='shop-names'>{shops.map(s => <option key={s} value={s} />)}</datalist>
        <button className='btn' disabled={!extraName.trim()} aria-label={t('shop.add')}><Icon name='plus' size={18} /></button>
      </form>
      {typingHave && <p className='have-hint'><Icon name='home' size={16} />{typingHave}</p>}
      {!rows.length && !extras.length && <p className='empty'>{t('shop.empty')}</p>}
      {(rows.length > 0 || extras.length > 0) && (
        <div className='action-row'>
          <button className='btn primary' onClick={share}><Icon name='share' size={18} />{t('shop.share')}</button>
          <button className='btn' onClick={() => navigator.clipboard.writeText(text).then(() => showToast(t('share.copied')), err => setError(err.message))}><Icon name='copy' size={18} />{t('shop.copy')}</button>
        </div>
      )}
      {groups.map(([shop, list]) => (
        <section key={shop}>
          <h2>{shop || t('shop.anyShop')} <span className='count'>{list.length}</span></h2>
          <ul className='rows'>
            {list.map(r => r.extra
              ? (
                <li key={r.extra.id} className='row-card'>
                  <div className='row-main'>
                    <span className='thumb extra-dot'><Icon name='cart' size={18} /></span>
                    <div><strong>{r.extra.name}</strong><small>{haveText(r.extra.name) ?? t('shop.extra')}</small></div>
                  </div>
                  <div className='row-side'><button className='btn' onClick={() => boughtExtra(r.extra)}><Icon name='check' size={18} />{t('shop.gotIt')}</button></div>
                </li>
                )
              : (
              <li key={r.item.id} className='row-card'>
                <Link to={`/i/${r.item.id}`} className='row-main'>
                  <Thumb src={thumbUrl(r.item, r.item.photos?.[0])} name={r.item.name} />
                  <div>
                    <strong>{r.need} {r.item.unit} {r.item.name}</strong>
                    <small>{t('shop.have', { count: r.item.quantity ?? 0 })}</small>
                  </div>
                </Link>
                <div className='row-side'>
                  {r.item.buy_url && <a className='btn' href={r.item.buy_url} target='_blank' rel='noreferrer'>{t('shop.order')}</a>}
                  <button className='btn' onClick={() => bought(r)}><Icon name='check' size={18} />{t('shop.gotIt')}</button>
                </div>
              </li>
                ))}
          </ul>
        </section>
      ))}
      {soon.length > 0 && (
        <section>
          <h2>{t('shop.soon')}</h2>
          <ul className='rows'>
            {soon.map(i => (
              <li key={i.id} className='row-card'>
                <Link to={`/i/${i.id}`} className='row-main'>
                  <Thumb src={thumbUrl(i, i.photos?.[0])} name={i.name} />
                  <div><strong>{i.name}</strong><small>{t('stock.runsOut', { count: data.runsOutIn(i) })}</small></div>
                </Link>
                <div className='row-side'><button className='btn' onClick={() => bought({ item: i, need: data.toBuy(i) })}><Icon name='check' size={18} />{t('shop.gotIt')}</button></div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {rows.length + extras.length > 1 && <button className='btn wide' onClick={boughtAll}>{t('shop.allBought')}</button>}
      <p className='muted small'><Link to='/stock'>{t('stock.manage')}</Link></p>
    </div>
  )
}
