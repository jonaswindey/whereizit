import { useState } from 'react'
import { Link } from 'react-router'
import Icon from '../components/Icon.jsx'
import PlacePicker from '../components/PlacePicker.jsx'
import Scanner from '../components/Scanner.jsx'
import Sheet from '../components/Sheet.jsx'
import Stepper from '../components/Stepper.jsx'
import Thumb from '../components/Thumb.jsx'
import { useData } from '../lib/data.jsx'
import { useAuthUser } from '../lib/auth.js'
import { pb, thumbUrl } from '../lib/pb.js'
import { timeAgo } from '../lib/format.js'
import { getPref, setPref } from '../lib/recent.js'
import { STOCK_FREQS, stockCheckDue } from '../lib/stock.js'
import { t } from '../lib/i18n.jsx'

function SupplyForm ({ item, barcode, onSave, onCancel }) {
  const data = useData()
  const [draft, setDraft] = useState({
    name: item?.name ?? '',
    unit: item?.unit ?? '',
    quantity: item?.quantity ?? 0,
    min_quantity: item?.min_quantity ?? 1,
    stock_target: item?.stock_target ?? 3,
    shop: item?.shop ?? '',
    buy_url: item?.buy_url ?? '',
    place: item ? item.place : getPref('supplyPlace', ''),
    barcode: item?.barcode || barcode || ''
  })
  const [picking, setPicking] = useState(false)
  const set = key => e => setDraft({ ...draft, [key]: e.target.value })
  const shops = [...new Set(data.staples.map(i => i.shop).filter(Boolean))].sort()
  const submit = e => {
    e.preventDefault()
    if (draft.place) setPref('supplyPlace', draft.place)
    onSave({
      ...draft,
      name: draft.name.trim(),
      unit: draft.unit.trim(),
      shop: draft.shop.trim(),
      buy_url: draft.buy_url.trim(),
      quantity: Number(draft.quantity) || 0,
      min_quantity: Number(draft.min_quantity) || 0,
      stock_target: Number(draft.stock_target) || 0,
      staple: true
    })
  }
  return (
    <form className='panel form' onSubmit={submit}>
      <div className='two'>
        <label className='field'>{t('item.name')}<input value={draft.name} onChange={set('name')} required placeholder={t('stock.namePlaceholder')} autoFocus={!item} /></label>
        <label className='field'>{t('stock.unit')}<input value={draft.unit} onChange={set('unit')} placeholder={t('stock.unitPlaceholder')} /></label>
      </div>
      <div className='three'>
        <label className='field'>{t('stock.have')}<input type='number' min='0' value={draft.quantity} onChange={set('quantity')} /></label>
        <label className='field'>{t('stock.reorderAt')}<input type='number' min='0' value={draft.min_quantity} onChange={set('min_quantity')} /></label>
        <label className='field'>{t('stock.target')}<input type='number' min='0' value={draft.stock_target} onChange={set('stock_target')} /></label>
      </div>
      <p className='muted small'>{t('stock.levelsHint')}</p>
      <label className='field'>{t('stock.shop')}<input value={draft.shop} onChange={set('shop')} list='supply-shops' placeholder={t('stock.shopPlaceholder')} /></label>
      <datalist id='supply-shops'>{shops.map(s => <option key={s} value={s} />)}</datalist>
      <label className='field'>{t('stock.buyUrl')}<input type='url' value={draft.buy_url} onChange={set('buy_url')} placeholder='https://' /></label>
      {draft.barcode && (
        <p className='muted small barcode-line'>
          <Icon name='barcode' size={16} />{draft.barcode}
          <button type='button' className='ghost' onClick={() => setDraft(d => ({ ...d, barcode: '' }))}>{t('scan.unlink')}</button>
        </p>
      )}
      <button type='button' className='btn' onClick={() => setPicking(true)}><Icon name='box' size={18} />{draft.place ? data.whereText(draft.place) : t('stock.pickPlace')}</button>
      {picking && <PlacePicker title={t('stock.pickPlace')} onPick={id => { setDraft(d => ({ ...d, place: id })); setPicking(false) }} onClose={() => setPicking(false)} />}
      <div className='row form-actions'>
        <button className='btn primary'>{t('action.save')}</button>
        <button type='button' className='btn' onClick={onCancel}>{t('action.cancel')}</button>
      </div>
    </form>
  )
}

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

function Reminder () {
  const user = useAuthUser()
  const [error, setError] = useState(null)
  const save = async values => {
    setError(null)
    try {
      await pb.collection('users').update(user.id, values)
      await pb.collection('users').authRefresh()
    } catch (err) {
      setError(err.message)
    }
  }
  const freq = user?.stock_check || ''
  return (
    <div className='panel form'>
      <div className='segmented left wrap' role='group' aria-label={t('stock.reminder')}>
        <button className={!freq ? 'on' : ''} onClick={() => save({ stock_check: '' })}>{t('stock.freq.off')}</button>
        {STOCK_FREQS.map(f => <button key={f} className={freq === f ? 'on' : ''} onClick={() => save({ stock_check: f, stock_check_time: user.stock_check_time || '18:00', stock_check_day: user.stock_check_day ?? 5 })}>{t(`stock.freq.${f}`)}</button>)}
      </div>
      {freq && freq !== 'daily' && (
        <div className='segmented left wrap' role='group'>
          {DAY_KEYS.map((d, n) => <button key={d} className={(user.stock_check_day ?? 5) === n ? 'on' : ''} onClick={() => save({ stock_check_day: n })}>{t(`day.${d}`)}</button>)}
        </div>
      )}
      {freq && (
        <label className='field inline'>{t('stock.at')}<input type='time' value={user.stock_check_time || '18:00'} onChange={e => e.target.value && save({ stock_check_time: e.target.value })} /></label>
      )}
      <p className='muted small'>{freq ? t('stock.reminderHow') : t('stock.reminderOff')} <Link to='/more'>{t('calendar.title')}</Link></p>
      {error && <p className='error'>{error}</p>}
    </div>
  )
}

// After a scan: the supply it belongs to with one-tap stock changes, or a way to link the code.
function ScanResult ({ code, onNext, onNew, onClose }) {
  const data = useData()
  const [error, setError] = useState(null)
  const matches = data.items.filter(i => i.barcode === code)
  const unlinked = data.staples.filter(i => !i.barcode)
  const run = async fn => {
    setError(null)
    try {
      await fn()
      await data.reload()
      onNext()
    } catch (err) {
      setError(err.message)
    }
  }
  const setQty = (item, quantity) => run(() => pb.collection('items').update(item.id, { quantity: Math.max(0, quantity) }))
  return (
    <Sheet title={matches.length ? matches[0].name : t('scan.unknown')} onClose={onClose}>
      {matches.map(i => (
        <div key={i.id} className='panel form'>
          <p className='muted'>{t('scan.have', { count: i.quantity ?? 0, unit: i.unit || '' })}</p>
          <div className='scan-actions'>
            <button className='btn big' onClick={() => setQty(i, (i.quantity ?? 0) - 1)}>{t('scan.usedOne')}</button>
            <button className='btn big' onClick={() => setQty(i, 0)}>{t('scan.empty')}</button>
            <button className='btn big' onClick={() => setQty(i, (i.quantity ?? 0) + 1)}>{t('scan.addOne')}</button>
            <button className='btn big primary' onClick={() => setQty(i, (i.quantity ?? 0) + data.toBuy(i))}>{t('scan.bought', { count: data.toBuy(i) })}</button>
          </div>
        </div>
      ))}
      {!matches.length && (
        <div className='panel form'>
          <p className='muted small'>{t('scan.unknownHint', { code })}</p>
          {unlinked.length > 0 && (
            <ul className='pick-list'>
              {unlinked.map(i => (
                <li key={i.id}>
                  <button onClick={() => run(() => pb.collection('items').update(i.id, { barcode: code }))}>
                    <Thumb src={thumbUrl(i, i.photos?.[0])} name={i.name} className='mini' />{t('scan.linkTo', { name: i.name })}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button className='btn primary' onClick={onNew}><Icon name='plus' size={18} />{t('scan.newSupply')}</button>
        </div>
      )}
      {error && <p className='error'>{error}</p>}
    </Sheet>
  )
}

// Everyday supplies: what's in the house, when to check, and what to buy.
export default function StockPage () {
  const data = useData()
  const user = useAuthUser()
  const [editing, setEditing] = useState(null) // 'new' | item
  const [scan, setScan] = useState(null) // null | 'camera' | { code }
  const [error, setError] = useState(null)
  const due = stockCheckDue(user, data.lastStockCheck, data.staples.length > 0)

  const run = async fn => {
    setError(null)
    try {
      await fn()
      await data.reload()
    } catch (err) {
      setError(err.message)
    }
  }
  const save = values => run(async () => {
    const target = editing
    setEditing(null)
    if (target === 'new' || target.newBarcode) await pb.collection('items').create(values)
    else await pb.collection('items').update(target.id, values)
  })
  const setQty = (item, quantity) => run(() => pb.collection('items').update(item.id, { quantity }))
  const low = data.lowStock.length

  return (
    <div className='page'>
      <h1 className='page-title'>{t('stock.title')}</h1>
      <p className='muted small'>{data.lastStockCheck ? t('stock.lastCheck', { when: timeAgo(data.lastStockCheck) }) : t('stock.intro')}</p>
      <div className='action-row'>
        <Link className={`btn ${due ? 'primary' : ''}`} to='/stock/check'><Icon name='check' size={18} />{t('stock.check')}</Link>
        <button className='btn icon-only' onClick={() => setScan('camera')} aria-label={t('scan.title')} title={t('scan.title')}><Icon name='barcode' size={20} /></button>
        <Link className={`btn ${!due && low ? 'primary' : ''}`} to='/shopping'><Icon name='list' size={18} />{t('shop.short')}{low > 0 && <span className='count'>{low}</span>}</Link>
      </div>
      {error && <p className='error'>{error}</p>}

      <section>
        <h2>{t('stock.supplies')} <span className='count'>{data.staples.length}</span><button className='chip push' onClick={() => setEditing('new')}><Icon name='plus' size={14} />{t('stock.add')}</button></h2>
        {!data.staples.length && <p className='empty'>{t('stock.none')}</p>}
        <ul className='rows'>
          {data.staples.map(i => {
            const isLow = (i.quantity ?? 0) <= (i.min_quantity || 0)
            const left = data.runsOutIn(i)
            return (
              <li key={i.id} className={`row-card ${isLow ? 'low' : ''}`}>
                <button type='button' className='row-main plain select-row' onClick={() => setEditing(i)}>
                  <Thumb src={thumbUrl(i, i.photos?.[0])} name={i.name} />
                  <div>
                    <strong>{i.name}</strong>
                    <small>{[i.shop, isLow ? t('stock.low') : left !== null && left <= 14 ? t('stock.runsOut', { count: left }) : t('stock.levels', { min: i.min_quantity || 0, target: i.stock_target || '–' })].filter(Boolean).join(' · ')}</small>
                  </div>
                </button>
                <Stepper value={i.quantity ?? 0} onChange={v => setQty(i, v)} suffix={i.unit ? ` ${i.unit}` : null} />
              </li>
            )
          })}
        </ul>
      </section>

      <section>
        <h2>{t('stock.reminder')}</h2>
        <Reminder />
      </section>

      {scan === 'camera' && <Scanner onCode={code => setScan({ code })} onClose={() => setScan(null)} />}
      {scan?.code && (
        <ScanResult
          code={scan.code}
          onClose={() => setScan(null)}
          onNext={() => setScan('camera')}
          onNew={() => { setEditing({ newBarcode: scan.code }); setScan(null) }}
        />
      )}
      {editing && (
        <Sheet title={editing === 'new' || editing.newBarcode ? t('stock.add') : editing.name} onClose={() => setEditing(null)}>
          <SupplyForm item={editing === 'new' || editing.newBarcode ? null : editing} barcode={editing.newBarcode} onSave={save} onCancel={() => setEditing(null)} />
          {editing !== 'new' && !editing.newBarcode && <p className='center'><Link to={`/i/${editing.id}`}>{t('stock.openItem')}</Link></p>}
        </Sheet>
      )}
    </div>
  )
}
