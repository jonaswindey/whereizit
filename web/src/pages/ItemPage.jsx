import { useEffect, useRef, useState } from 'react'
import SaleSheet from '../components/SaleSheet.jsx'
import ClaimSheet from '../components/ClaimSheet.jsx'
import { claimStart, claimWhen, conflicts, today } from '../lib/claims.js'
import { shareListing } from '../lib/sale.js'
import WhereToLook from '../components/WhereToLook.jsx'
import { batteryStock, label as batteryLabel, parseBattery } from '../lib/batteries.js'
import { Link, useNavigate, useParams } from 'react-router'
import Icon from '../components/Icon.jsx'
import ItemPicker from '../components/ItemPicker.jsx'
import Sheet, { ActionSheet } from '../components/Sheet.jsx'
import { resizeImage } from '../lib/image.js'
import { ItemRow } from '../components/Cards.jsx'
import Lightbox from '../components/Lightbox.jsx'
import GoneSheet from '../components/GoneSheet.jsx'
import PhotoPins from '../components/PhotoPins.jsx'
import ReceiptSheet from '../components/ReceiptSheet.jsx'
import { readReceipt, useAiEnabled } from '../lib/ai.js'
import { useAuthUser } from '../lib/auth.js'
import NestedWhere from '../components/NestedWhere.jsx'
import { PlansAlongPath } from '../components/FloorPlan.jsx'
import { Sentence } from './ActivityPage.jsx'
import { displayName } from '../lib/auth.js'
import PlacePicker from '../components/PlacePicker.jsx'
import TagPicker, { TagChip } from '../components/TagPicker.jsx'
import Thumb from '../components/Thumb.jsx'
import { useData } from '../lib/data.jsx'
import { fileUrl, pb, thumbUrl } from '../lib/pb.js'
import { dateInput, formatDate, formatPrice, timeAgo, toDate } from '../lib/format.js'
import { pushRecent } from '../lib/recent.js'
import { useMembers } from '../lib/members.js'
import { showToast } from '../lib/toast.js'
import { t, tx } from '../lib/i18n.jsx'

function EditForm ({ item, owners, onSave, onCancel, onRemovePhoto, onRemoveAttachment, onMakeCover }) {
  const [draft, setDraft] = useState({
    name: item.name,
    quantity: item.quantity || 1,
    min_quantity: item.min_quantity || 0,
    note: item.note,
    purchase_date: dateInput(item.purchase_date),
    price: item.price || '',
    warranty_until: dateInput(item.warranty_until),
    expires: dateInput(item.expires),
    service_every_days: item.service_every_days || '',
    service_note: item.service_note,
    brand: item.brand ?? '',
    model: item.model ?? '',
    serial: item.serial ?? '',
    owner: item.owner ?? '',
    aliases: item.aliases ?? '',
    battery: item.battery ?? ''
  })
  const set = key => e => setDraft({ ...draft, [key]: e.target.value })
  const submit = e => {
    e.preventDefault()
    onSave({
      ...draft,
      name: draft.name.trim(),
      brand: draft.brand.trim(),
      model: draft.model.trim(),
      serial: draft.serial.trim(),
      owner: draft.owner.trim(),
      aliases: draft.aliases.trim(),
      battery: draft.battery.trim(),
      quantity: Number(draft.quantity) || 0,
      min_quantity: Number(draft.min_quantity) || 0,
      price: Number(draft.price) || 0,
      service_every_days: Number(draft.service_every_days) || 0
    })
  }
  return (
    <form className='panel form' onSubmit={submit}>
      <label className='field'>{t('item.name')}<input value={draft.name} onChange={set('name')} required /></label>
      <div className='two'>
        <label className='field'>{t('item.quantity')}<input type='number' min='0' value={draft.quantity} onChange={set('quantity')} /></label>
        <label className='field'>{t('item.warnBelow')}<input type='number' min='0' value={draft.min_quantity} onChange={set('min_quantity')} /></label>
      </div>
      <label className='field'>{t('item.note')}<textarea rows={3} value={draft.note} onChange={set('note')} /></label>
      <label className='field'>{t('aliases.label')}<input value={draft.aliases} onChange={set('aliases')} placeholder={t('aliases.placeholder')} /></label>
      <label className='field'>{t('owner.label')}<input value={draft.owner} onChange={set('owner')} list='item-owners' placeholder={t('owner.placeholder')} /></label>
      <datalist id='item-owners'>{owners.map(o => <option key={o} value={o} />)}</datalist>
      {/* Rarely needed fields fold away; open when one of them already has a value. */}
      <details className='more-fields' open={!!(item.purchase_date || item.price || item.warranty_until || item.expires || item.service_every_days || item.brand || item.model || item.serial || item.battery)}>
        <summary>{t('item.moreDetails')}</summary>
      <div className='two'>
        <label className='field'>{t('item.brand')}<input value={draft.brand} onChange={set('brand')} /></label>
        <label className='field'>{t('item.model')}<input value={draft.model} onChange={set('model')} /></label>
      </div>
      <label className='field'>{t('item.serial')}<input value={draft.serial} onChange={set('serial')} autoCapitalize='characters' spellCheck={false} /></label>
      <label className='field'>{t('battery.label')}<input value={draft.battery} onChange={set('battery')} placeholder={t('battery.placeholder')} /></label>
      <div className='two'>
        <label className='field'>{t('item.boughtOn')}<input type='date' value={draft.purchase_date} onChange={set('purchase_date')} /></label>
        <label className='field'>{t('item.price')}<input type='number' min='0' step='0.01' value={draft.price} onChange={set('price')} /></label>
      </div>
      <div className='two'>
        <label className='field'>{t('item.warrantyUntil')}<input type='date' value={draft.warranty_until} onChange={set('warranty_until')} /></label>
        <label className='field'>{t('item.expires')}<input type='date' value={draft.expires} onChange={set('expires')} /></label>
      </div>
      <div className='two'>
        <label className='field'>{t('maint.everyDays')}<input type='number' min='0' value={draft.service_every_days} onChange={set('service_every_days')} /></label>
        <label className='field'>{t('maint.what')}<input value={draft.service_note} placeholder={t('maint.whatPlaceholder')} onChange={set('service_note')} /></label>
      </div>
      </details>
      {(item.photos.length > 0 || item.attachments?.length > 0) && (
        <div className='manage-files'>
          {item.photos.map((f, i) => (
            <span key={f} className={`manage-thumb ${i === 0 && item.photos.length > 1 ? 'cover' : ''}`}>
              <img src={thumbUrl(item, f)} alt='' />
              {i > 0 && <button type='button' className='make-cover' onClick={() => onMakeCover(f)} aria-label={t('item.makeCover')} title={t('item.makeCover')}><Icon name='star' size={14} /></button>}
              <button type='button' onClick={() => onRemovePhoto(f)} aria-label={t('action.remove')}><Icon name='close' size={14} /></button>
            </span>
          ))}
          {(item.attachments ?? []).map(f => (
            <span key={f} className='manage-file'>
              <Icon name='file' size={16} />{f.replace(/_[a-z0-9]{10}(\.\w+)$/, '$1')}
              <button type='button' onClick={() => onRemoveAttachment(f)} aria-label={t('action.remove')}><Icon name='close' size={14} /></button>
            </span>
          ))}
        </div>
      )}
      <div className='row form-actions'>
        <button className='btn primary'>{t('action.save')}</button>
        <button type='button' className='btn' onClick={onCancel}>{t('action.cancel')}</button>
      </div>
    </form>
  )
}

// Offers people this household lent to before, so names stay consistent on the Lent page.
function RepairForm ({ onSave, onCancel }) {
  const [note, setNote] = useState('')
  return (
    <form className='panel form' onSubmit={e => { e.preventDefault(); onSave(note.trim()) }}>
      <input autoFocus placeholder={t('repair.notePlaceholder')} value={note} onChange={e => setNote(e.target.value)} />
      <div className='row form-actions'>
        <button className='btn primary'>{t('repair.mark')}</button>
        <button type='button' className='btn' onClick={onCancel}>{t('action.cancel')}</button>
      </div>
    </form>
  )
}

// borrow: the same form the other way round ("borrowed from", "give back by").
function LendForm ({ people, onLend, onCancel, borrow = false, claims = [], related = [], who = () => '?' }) {
  const [to, setTo] = useState('')
  const [due, setDue] = useState('')
  const inDays = n => dateInput(new Date(Date.now() + n * 86400000).toISOString())
  return (
    <form className='panel form' onSubmit={e => { e.preventDefault(); to.trim() && onLend(to.trim(), due) }}>
      <input autoFocus placeholder={t(borrow ? 'borrow.who' : 'lend.who')} value={to} onChange={e => setTo(e.target.value)} list='lend-people' />
      <datalist id='lend-people'>{people.map(p => <option key={p} value={p} />)}</datalist>
      <label className='field'>{t(borrow ? 'borrow.dueLabel' : 'lend.dueLabel')}<input type='date' value={due} onChange={e => setDue(e.target.value)} /></label>
      <div className='chips'>
        {[7, 14, 30].map(n => <button key={n} type='button' className={`chip ${due === inDays(n) ? 'on' : ''}`} onClick={() => setDue(inDays(n))}>{t('lend.inDays', { count: n })}</button>)}
      </div>
      {/* Lent past someone's day (no return date counts as "until further notice"). */}
      {claims.filter(c => !due || claimStart(c) <= due).map(c => <p key={c.id} className='warn small'>{t('claim.lendClash', { name: who(c.user), when: claimWhen(c) })}</p>)}
      {related.length > 0 && <p className='muted small'>{t('related.alsoLend', { names: related.map(r => r.name).join(', ') })}</p>}
      <div className='row'>
        <button className='btn primary'>{t(borrow ? 'borrow.submit' : 'lend.submit')}</button>
        <button type='button' className='btn' onClick={onCancel}>{t('action.cancel')}</button>
      </div>
    </form>
  )
}

export default function ItemPage () {
  const { id } = useParams()
  const data = useData()
  const navigate = useNavigate()
  const [mode, setMode] = useState(null) // 'edit' | 'move' | 'tags' | 'lend'
  const [error, setError] = useState(null)
  const [viewer, setViewer] = useState(null) // { images, start }
  const [history, setHistory] = useState(null)
  const [showAllHistory, setShowAllHistory] = useState(false)
  const photoInput = useRef(null)
  const receiptInput = useRef(null)
  const [receipt, setReceipt] = useState(null) // { file, busy, result, error }
  const [pinning, setPinning] = useState(false)
  const aiEnabled = useAiEnabled()
  // Kids can add and fix things up, but trash and "gone" are for grown-ups (the server agrees).
  const me = useAuthUser()
  const kid = me?.role === 'kid'
  const members = useMembers()
  const fileInput = useRef(null)

  const item = data.itemById.get(id)
  const exists = !!item
  useEffect(() => {
    if (!exists) return
    pushRecent(id)
    // Counts as "used" for Opruimen; the server ignores repeats within 12 hours.
    pb.send(`/api/wz/items/${id}/used`, { method: 'POST' }).catch(err => console.warn('used:', err.message))
  }, [id, exists])
  const updated = item?.updated
  useEffect(() => {
    pb.collection('activity').getList(1, 30, { filter: pb.filter('item = {:id}', { id }), sort: '-created', expand: 'user,from_place,to_place' })
      .then(res => setHistory(res.items))
      .catch(err => console.warn('history:', err.message))
  }, [id, updated])
  if (!item) return <p className='muted center'>{data.loading ? t('common.loading') : t('item.gone')}</p>

  const run = async fn => {
    setError(null)
    try {
      await fn()
      await data.reload()
    } catch (err) {
      setError(err.message)
    }
  }
  const update = values => run(() => pb.collection('items').update(id, values))

  const moveItem = (place, makeHome) => run(async () => {
    const before = { place: item.place, home: item.home }
    // Putting away an unsorted item: wherever it goes first is its home.
    await pb.collection('items').update(id, { place, ...((makeHome || !item.place) && { home: place }) })
    showToast(t('move.done', { name: item.name, place: data.pathText(place) }), {
      label: t('action.undo'),
      run: () => pb.collection('items').update(id, before).then(data.reload).catch(err => showToast(t('move.undoFailed', { error: err.message })))
    })
  })

  // Copies everything including photos (re-uploaded, since files belong to one record).
  const duplicate = () => run(async () => {
    const photos = await Promise.all(item.photos.map(async f => {
      const res = await fetch(fileUrl(item, f))
      if (!res.ok) throw new Error(`${f}: ${res.status}`)
      const blob = await res.blob()
      return new File([blob], f, { type: blob.type })
    }))
    // Serial numbers are per object, so the copy leaves it empty.
    const { name, place, home, quantity, min_quantity, note, tags, price, purchase_date, warranty_until, expires, service_every_days, service_note, brand, model, owner } = item
    const copy = await pb.collection('items').create({
      name: t('item.copyName', { name }), place, home, quantity, min_quantity, note, tags, price, purchase_date, warranty_until, expires, service_every_days, service_note, brand, model, owner, photos
    })
    navigate(`/i/${copy.id}`)
  })

  const markGone = values => run(async () => {
    setMode(null)
    await pb.collection('items').update(id, values)
    navigate(item.place ? `/p/${item.place}` : '/')
    showToast(t('gone.done', { name: item.name }), {
      label: t('action.undo'),
      run: () => pb.collection('items').update(id, { gone: '', gone_reason: '', gone_note: '', ...(item.for_sale && { for_sale: item.for_sale }) }).then(data.reload).catch(err => showToast(t('move.undoFailed', { error: err.message })))
    })
  })

  // Soft delete: goes to the trash for 30 days, with an immediate Undo.
  const remove = () => run(async () => {
    await pb.collection('items').update(id, { deleted: new Date().toISOString() })
    navigate(item.place ? `/p/${item.place}` : '/unsorted')
    showToast(t('trash.moved', { name: item.name }), {
      label: t('action.undo'),
      run: () => pb.collection('items').update(id, { deleted: '' }).then(data.reload).catch(err => showToast(t('trash.undoFailed', { error: err.message })))
    })
  })

  const tags = data.tagsOf(item)
  const quantity = item.quantity ?? 0
  const low = item.min_quantity > 0 && quantity <= item.min_quantity
  const warranty = toDate(item.warranty_until)
  const attachments = item.attachments ?? []
  const hasDetails = item.purchase_date || item.price || item.warranty_until || item.expires || item.brand || item.model || item.serial || item.battery
  const battery = parseBattery(item.battery)
  const batteriesHere = battery ? batteryStock(data.items, battery.type).reduce((n, i) => n + (i.quantity ?? 0), 0) : 0

  // "Where is the drill?" answered in a message: the path in words plus a link for those with access.
  const share = async () => {
    const text = t('share.text', { name: item.name, path: data.whereText(item.place) })
    const url = `${window.location.origin}/i/${item.id}`
    if (navigator.share) {
      try {
        await navigator.share({ title: item.name, text, url })
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message)
      }
      return
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`)
      showToast(t('share.copied'))
    } catch (err) {
      setError(err.message)
    }
  }
  const expiry = data.expiryState(item)
  // Shown both ways: if the charger lists the drill, the drill shows the charger too.
  const related = data.items.filter(i => i.id !== item.id && ((item.related ?? []).includes(i.id) || (i.related ?? []).includes(item.id)))
  const nextService = data.nextService(item)
  const claims = data.claimsOf(item.id)
  const who = uid => displayName(members.find(m => m.id === uid), '?')
  const saveClaim = values => run(async () => {
    setMode(null)
    await pb.collection('reservations').create({ ...values, item: item.id, user: me.id })
    showToast(t('claim.saved', { name: item.name, when: claimWhen({ start: values.start, end: values.end }) }))
  })
  const dropClaim = c => run(() => pb.collection('reservations').delete(c.id))
  // Taking the drill: a nudge to take its charger as well.
  const take = () => run(async () => {
    await pb.collection('items').update(id, { with_user: me.id, with_since: new Date().toISOString() })
    if (related.length) showToast(t('related.alsoTake', { names: related.map(r => `${r.name} (${data.whereText(r.place)})`).join(', ') }))
  })
  const home = item.home && item.home !== item.place ? data.placeById.get(item.home) : null

  // Rarely used actions live in the ⋯ sheet; the page leads with what the item is and where it is.
  const moreActions = [
    { icon: 'share', label: t('share.action'), onClick: share },
    { icon: 'camera', label: t('item.photo'), onClick: () => photoInput.current?.click() },
    { icon: 'tag', label: t('tags.title'), onClick: () => setMode('tags') },
    !item.lent_to && !item.borrowed_from && { icon: 'handoff', label: t('lend.action'), onClick: () => setMode('lend') },
    !item.borrowed_from && !item.lent_to && { icon: 'handoff', label: t('borrow.action'), onClick: () => setMode('borrow') },
    { icon: 'star', label: t(item.essential ? 'essential.unmark' : 'essential.mark'), onClick: () => update({ essential: !item.essential }) },
    { icon: 'calendar', label: t('claim.action'), onClick: () => setMode('claim') },
    { icon: 'ask', label: t('asks.askAbout'), onClick: () => navigate(`/asks?item=${item.id}`) },
    { icon: 'link', label: t('related.action'), onClick: () => setMode('related') },
    { icon: 'file', label: t('item.attach'), onClick: () => fileInput.current?.click() },
    aiEnabled && { icon: 'sparkle', label: t('receipt.action'), onClick: () => receiptInput.current?.click() },
    { icon: 'star', label: t(item.pinned ? 'item.unpin' : 'item.pin'), onClick: () => update({ pinned: !item.pinned }) },
    { icon: 'copy', label: t('item.duplicate'), onClick: duplicate },
    { icon: 'cart', label: t(item.staple ? 'stock.removeStaple' : 'stock.makeStaple'), onClick: () => update({ staple: !item.staple }) },
    !item.needs_repair && { icon: 'wrench', label: t('repair.action'), onClick: () => setMode('repair') },
    !kid && { icon: 'gift', label: t(item.for_sale ? 'sale.edit' : 'sale.action'), onClick: () => setMode('sale') },
    !kid && { icon: 'exit', label: t('gone.action'), onClick: () => setMode('gone') },
    !kid && { icon: 'trash', label: t('action.delete'), onClick: remove, danger: true }
  ]
  const shownHistory = showAllHistory ? history : history?.slice(0, 3)

  return (
    <div className='page'>
      {item.photos.length > 0
        ? (
          <div className='gallery'>
            {item.photos.map((f, i) => (
              <figure key={f}>
                <button className='plain zoomable' onClick={() => setViewer({ images: item.photos.map(p => fileUrl(item, p)), start: i })}>
                  <img src={fileUrl(item, f)} alt='' />
                </button>
              </figure>
            ))}
            {item.photos.length > 1 && <span className='gallery-count'>{item.photos.length}</span>}
          </div>
          )
        : (
          <button className='photo-missing' onClick={() => photoInput.current?.click()}>
            <Icon name='camera' size={22} />{t('item.addPhoto')}
          </button>
          )}

      <div className='title-row'>
        <h1 className='page-title'>{item.name}{item.quantity > 1 && <em> ×{item.quantity}</em>}</h1>
        <button className={`ghost star ${item.pinned ? 'on' : ''}`} onClick={() => update({ pinned: !item.pinned })} aria-label={t(item.pinned ? 'item.unpin' : 'item.pin')} title={t(item.pinned ? 'item.unpin' : 'item.pin')}>
          <Icon name='star' size={26} />
        </button>
      </div>
      {item.aliases && <p className='owner-line'>{t('aliases.shown', { names: item.aliases })}</p>}
      {item.owner && <p className='owner-line'><Icon name='user' size={14} />{t('owner.of', { name: item.owner })}</p>}
      {tags.length > 0 && (
        <div className='tag-row'>
          {tags.map(tag => <button key={tag.id} className='plain' onClick={() => navigate(`/tags/${tag.id}`)}><TagChip tag={tag} /></button>)}
        </div>
      )}

      {!item.place && (
        <div className='banner unsorted'>
          <Icon name='inbox' />
          <span>{t('unsorted.banner')}</span>
          <button className='btn primary' onClick={() => setMode('move')}>{t('unsorted.putAway')}</button>
        </div>
      )}
      {item.place && (
        <section className='where-section'>
          <NestedWhere
            placeId={item.place}
            leaf={<><Thumb src={thumbUrl(item, item.photos?.[0])} name={item.name} className='mini' /><strong>{item.name}</strong></>}
          />
          <PlansAlongPath placeId={item.place} />
          {/* Exactly where on the shelf: a pin on the place's own photo. */}
          {data.placeById.get(item.place)?.photo && (item.pin || pinning) && (
            <PhotoPins
              place={data.placeById.get(item.place)}
              pins={item.pin ? [{ id: item.id, x: item.pin.x, y: item.pin.y, label: item.name, active: true }] : []}
              editing={pinning}
              onPlace={pin => { setPinning(false); update({ pin }) }}
            />
          )}
          {data.placeById.get(item.place)?.photo && (
            <div className='pin-tools'>
              {pinning
                ? <><span className='muted small'>{t('pin.tapHint')}</span><button className='chip' onClick={() => setPinning(false)}>{t('action.cancel')}</button></>
                : <button className='chip' onClick={() => setPinning(true)}><Icon name='pin' size={14} />{t(item.pin ? 'pin.move' : 'pin.add')}</button>}
              {item.pin && !pinning && <button className='chip' onClick={() => update({ pin: null })}>{t('pin.remove')}</button>}
            </div>
          )}
        </section>
      )}

      <div className='action-row'>
        {item.place && <button className='btn primary' onClick={() => setMode('move')}><Icon name='move' size={18} />{t('action.move')}</button>}
        <button className='btn' onClick={() => setMode('edit')}><Icon name='edit' size={18} />{t('action.edit')}</button>
        {!item.with_user && item.place && <button className='btn icon-only' onClick={take} aria-label={t('with.take')} title={t('with.take')}><Icon name='handoff' size={20} /></button>}
        <button className='btn icon-only' onClick={() => setMode('more')} aria-label={t('action.more')}><Icon name='more' size={20} /></button>
      </div>
      {error && <p className='error'>{error}</p>}

      {item.missing && (
        <div className='banner expired'>
          <Icon name='search' />
          <span>{t('missing.banner')}</span>
          <button className='btn' onClick={() => update({ missing: false, checked_at: new Date().toISOString() })}>{t('missing.found')}</button>
        </div>
      )}
      {item.missing && <WhereToLook item={item} history={history} skipHome={item.place !== item.home} />}
      {claims.map(c => (
        <div key={c.id} className='banner claim stacked'>
          <Icon name='calendar' />
          <span>
            {c.user === me?.id ? t('claim.you', { when: claimWhen(c) }) : t('claim.other', { name: who(c.user), when: claimWhen(c) })}
            {c.note && <> · {c.note}</>}
            {conflicts(item, claimStart(c) < today() ? today() : claimStart(c)).map(w => <small key={w} className='warn'>{w}</small>)}
          </span>
          {(c.user === me?.id || !kid) && (
            <div className='banner-actions'>
              <button className='btn' onClick={() => dropClaim(c)}>{t('claim.drop')}</button>
            </div>
          )}
        </div>
      ))}
      {item.needs_repair && (
        <div className='banner soon'>
          <Icon name='wrench' />
          <span>{t('repair.banner')}{item.repair_note && <>: <strong>{item.repair_note}</strong></>}</span>
          <button className='btn' onClick={() => update({ needs_repair: false, repair_note: '' })}>{t('repair.fixed')}</button>
        </div>
      )}
      {item.lent_to && (
        <div className='banner lent'>
          <Icon name='handoff' />
          <span>
            {tx('lend.with', { name: <strong>{item.lent_to}</strong> })}{item.lent_at && <> · {timeAgo(item.lent_at)}</>}
            {item.lent_due && <> · <span className={data.isOverdue(item) ? 'overdue' : ''}>{t(data.isOverdue(item) ? 'lend.overdueSince' : 'lend.dueOn', { date: formatDate(item.lent_due) })}</span></>}
          </span>
          <button className='btn' onClick={() => update({ lent_to: '', lent_at: '', lent_due: '' })}>{t('lend.returned')}</button>
        </div>
      )}
      {item.for_sale && (
        <div className='banner with stacked'>
          <Icon name='gift' />
          <span>
            {t('sale.banner', { price: item.sale_price ? formatPrice(item.sale_price) : t('sale.noPrice'), when: timeAgo(item.for_sale) })}
          </span>
          <div className='banner-actions'>
            <button className='btn' onClick={() => update({ for_sale: '' })}>{t('sale.keep')}</button>
            {!kid && <button className='btn' onClick={() => run(async () => { if (await shareListing(item) === 'copied') showToast(t('share.copied')) })}><Icon name='share' size={16} />{t('sale.share')}</button>}
            {!kid && <button className='btn primary' onClick={() => markGone({ gone: new Date().toISOString(), gone_reason: 'sold', gone_note: item.sale_price ? formatPrice(item.sale_price) : '', for_sale: '' })}>{t('sale.sold')}</button>}
          </div>
        </div>
      )}
      {item.with_user && (
        <div className='banner with stacked'>
          <Icon name='user' />
          <span>
            {item.with_user === me?.id
              ? t('with.you', { when: timeAgo(item.with_since) })
              : tx('with.other', { name: <strong>{displayName(members.find(m => m.id === item.with_user), '?')}</strong>, when: timeAgo(item.with_since) })}
            {item.place && <small className='muted'> · {t('with.belongs', { where: data.whereText(item.place) })}</small>}
          </span>
          <div className='banner-actions'>
            <button className='btn' onClick={() => update({ with_user: '', with_since: '' })}>{t('with.putBack')}</button>
          </div>
        </div>
      )}
      {item.borrowed_from && (
        <div className='banner lent stacked'>
          <Icon name='handoff' />
          <span>
            {tx('borrow.from', { name: <strong>{item.borrowed_from}</strong> })}
            {item.borrowed_due && <> · <span className={data.isBackDue(item) ? 'overdue' : ''}>{t(data.isBackDue(item) ? 'borrow.overdueSince' : 'borrow.dueOn', { date: formatDate(item.borrowed_due) })}</span></>}
          </span>
          {/* Giving it back takes it out of the house (gone, kept in history); keeping it just clears the loan. */}
          <div className='banner-actions'>
            <button className='btn ghost' onClick={() => update({ borrowed_from: '', borrowed_due: '' })}>{t('borrow.keep')}</button>
            {!kid && <button className='btn' onClick={() => markGone({ gone: new Date().toISOString(), gone_reason: 'returned', gone_note: item.borrowed_from })}>{t('borrow.returned')}</button>}
          </div>
        </div>
      )}
      {home && (
        <div className='banner misplaced'>
          <Icon name='home' />
          <span>{tx('home.normallyIn', { place: <strong>{data.pathText(home.id)}</strong> })}</span>
          <button className='btn' onClick={() => update({ place: home.id })}>{t('home.putBack')}</button>
          <button className='ghost' onClick={() => update({ home: item.place })} title={t('home.makeHome')}>{t('home.keepHere')}</button>
        </div>
      )}
      {expiry && (
        <div className={`banner ${expiry}`}>
          <Icon name='alert' />
          <span>{t(expiry === 'expired' ? 'expiry.expiredOn' : 'expiry.expiresOn', { date: formatDate(item.expires) })}</span>
        </div>
      )}

      {item.note && <p className='note'>{item.note}</p>}

      <div className={`qty ${low ? 'low' : ''}`}>
        <span>{t('item.quantity')}{low && <strong> · {t('home.low')}</strong>}</span>
        <button className='btn' onClick={() => update({ quantity: Math.max(0, quantity - 1) })} aria-label={t('item.oneLess')}>−</button>
        <strong>{quantity}</strong>
        <button className='btn' onClick={() => update({ quantity: quantity + 1 })} aria-label={t('item.oneMore')}>+</button>
      </div>

      {/* Kept mounted outside the sheets so the ⋯ menu can open them within the same tap. */}
      <input ref={photoInput} type='file' accept='image/*' capture='environment' hidden onChange={async e => { const f = e.target.files?.[0]; e.target.value = ''; f && update({ 'photos+': await resizeImage(f) }) }} />
      <input
        ref={receiptInput} type='file' accept='image/*' capture='environment' hidden
        onChange={async e => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          // Resized like photos: readable for the model, small enough to keep as an attachment.
          const file = await resizeImage(f)
          setReceipt({ file, busy: true })
          readReceipt(file, item.name)
            .then(result => setReceipt({ file, result }))
            .catch(err => setReceipt({ file, error: err.message }))
        }}
      />
      <input ref={fileInput} type='file' accept='application/pdf,image/*' hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; f && update({ 'attachments+': f }) }} />

      {receipt && (
        <ReceiptSheet
          item={item}
          {...receipt}
          onClose={() => setReceipt(null)}
          onApply={(values, keep) => { const file = receipt.file; setReceipt(null); update({ ...values, ...(keep && { 'attachments+': file }) }) }}
        />
      )}
      {mode === 'repair' && (
        <Sheet title={t('repair.title', { name: item.name })} onClose={() => setMode(null)}>
          <RepairForm onCancel={() => setMode(null)} onSave={note => { setMode(null); update({ needs_repair: true, repair_note: note }) }} />
        </Sheet>
      )}
      {mode === 'claim' && <ClaimSheet item={item} claims={claims} members={members} onSave={saveClaim} onClose={() => setMode(null)} />}
      {mode === 'gone' && <GoneSheet item={item} onSave={markGone} onClose={() => setMode(null)} />}
      {mode === 'sale' && <SaleSheet item={item} claims={claims.length} onSave={values => { update(values); setMode(null) }} onClose={() => setMode(null)} />}
      {mode === 'more' && <ActionSheet title={item.name} actions={moreActions} onClose={() => setMode(null)} />}
      {mode === 'edit' && (
        <Sheet title={t('action.edit')} onClose={() => setMode(null)}>
          <EditForm
            item={item}
            owners={data.owners}
            onCancel={() => setMode(null)}
            onSave={values => { update(values); setMode(null) }}
            onRemovePhoto={f => update({ 'photos-': f })}
            onRemoveAttachment={f => update({ 'attachments-': f })}
            // The first photo is the cover everywhere; reordering the file list keeps the files.
            onMakeCover={f => update({ photos: [f, ...item.photos.filter(p => p !== f)] })}
          />
        </Sheet>
      )}
      {mode === 'borrow' && (
        <Sheet title={t('borrow.action')} onClose={() => setMode(null)}>
          <LendForm borrow people={[...new Set([...data.borrowPeople, ...data.lendPeople])]} onCancel={() => setMode(null)} onLend={(from, due) => { update({ borrowed_from: from, borrowed_due: due }); setMode(null) }} />
        </Sheet>
      )}
      {mode === 'lend' && (
        <Sheet title={t('lend.action')} onClose={() => setMode(null)}>
          <LendForm people={data.lendPeople} claims={claims} related={related} who={who} onCancel={() => setMode(null)} onLend={(to, due) => { update({ lent_to: to, lent_at: new Date().toISOString(), lent_due: due }); setMode(null) }} />
        </Sheet>
      )}
      {mode === 'move' && (
        <PlacePicker
          title={t(item.place ? 'item.moveTo' : 'unsorted.whereTo', { name: item.name })}
          exclude={new Set([item.place])}
          homeToggle={!!item.place}
          suggestFor={item.place ? null : [item]}
          onPick={(place, { makeHome }) => { setMode(null); moveItem(place, makeHome) }}
          onClose={() => setMode(null)}
        />
      )}
      {mode === 'tags' && (
        <TagPicker title={t('item.tagsFor', { name: item.name })} selected={item.tags ?? []} onChange={ids => update({ tags: ids })} onClose={() => setMode(null)} />
      )}
      {mode === 'related' && (
        <ItemPicker
          title={t('related.title', { name: item.name })}
          exclude={item.id}
          selected={item.related ?? []}
          onChange={ids => update({ related: ids })}
          onClose={() => setMode(null)}
        />
      )}

      {related.length > 0 && (
        <section>
          <h2>{t('related.heading')}</h2>
          <ul className='rows'>{related.map(r => <ItemRow key={r.id} item={r} />)}</ul>
        </section>
      )}

      {item.service_every_days > 0 && (
        <section>
          <h2>{t('maint.heading')}</h2>
          <div className={`banner ${nextService < Date.now() ? 'expired' : 'soon'}`}>
            <Icon name='wrench' />
            <span>
              {item.service_note && <strong>{item.service_note} · </strong>}
              {t('maint.every', { count: item.service_every_days })}
              {' · '}{item.serviced_at ? t('maint.lastDone', { when: timeAgo(item.serviced_at) }) : t('maint.never')}
            </span>
            <button className='btn' onClick={() => update({ serviced_at: new Date().toISOString() })}>{t('maint.markDone')}</button>
          </div>
        </section>
      )}

      {hasDetails && (
        <section>
          <h2>{t('item.details')}</h2>
          <dl className='details'>
            {(item.brand || item.model) && <><dt>{t('item.brandModel')}</dt><dd>{[item.brand, item.model].filter(Boolean).join(' ')}</dd></>}
            {item.serial && <><dt>{t('item.serial')}</dt><dd><code className='serial'>{item.serial}</code></dd></>}
            {battery && <><dt>{t('battery.label')}</dt><dd><Link to='/batteries'>{batteryLabel(battery)}</Link> <span className={`badge ${batteriesHere ? 'ok' : 'low'}`}>{batteriesHere ? t('battery.have', { count: batteriesHere }) : t('battery.none')}</span></dd></>}
            {item.purchase_date && <><dt>{t('item.bought')}</dt><dd>{formatDate(item.purchase_date)}</dd></>}
            {item.price > 0 && <><dt>{t('item.price')}</dt><dd>{formatPrice(item.price)}</dd></>}
            {item.expires && <><dt>{t('item.expires')}</dt><dd>{formatDate(item.expires)}{expiry && <span className='badge low'>{expiry === 'expired' ? t('badge.expired') : t('badge.expiresSoon')}</span>}</dd></>}
            {warranty && (
              <><dt>{t('item.warranty')}</dt><dd>{formatDate(item.warranty_until)} <span className={`badge ${warranty < new Date() ? 'low' : 'ok'}`}>{warranty < new Date() ? t('badge.expired') : t('badge.valid')}</span></dd></>
            )}
          </dl>
        </section>
      )}

      {attachments.length > 0 && (
        <section>
          <h2>{t('item.attachments')}</h2>
          <ul className='files'>
            {attachments.map(f => (
              <li key={f}>
                {/\.(jpe?g|png|webp|heic)$/i.test(f)
                  ? <button className='plain file-link' onClick={() => setViewer({ images: [fileUrl(item, f)], start: 0 })}><Icon name='file' size={18} />{f.replace(/_[a-z0-9]{10}(\.\w+)$/, '$1')}</button>
                  : <a href={fileUrl(item, f)} target='_blank' rel='noreferrer'><Icon name='file' size={18} />{f.replace(/_[a-z0-9]{10}(\.\w+)$/, '$1')}</a>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {shownHistory?.length > 0 && (
        <section>
          <h2><Icon name='history' size={16} />{t('item.history')}</h2>
          <ul className='timeline'>
            {shownHistory.map(a => (
              <li key={a.id}>
                <p><Sentence a={a} data={data} who={<span className='who'>{displayName(a.expand?.user, t('activity.someone'))}</span>} /></p>
                <small className='muted'>{timeAgo(a.created)}</small>
              </li>
            ))}
          </ul>
          {!showAllHistory && history.length > 3 && <button className='chip' onClick={() => setShowAllHistory(true)}>{t('item.historyAll', { count: history.length })}</button>}
        </section>
      )}

      {viewer && <Lightbox images={viewer.images} start={viewer.start} onClose={() => setViewer(null)} />}

      <p className='muted small'>{t('item.addedUpdated', { added: timeAgo(item.created), updated: timeAgo(item.updated) })}</p>
    </div>
  )
}
