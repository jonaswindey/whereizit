import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import Breadcrumb from '../components/Breadcrumb.jsx'
import BulkPlaces from '../components/BulkPlaces.jsx'
import { Grid, ItemCard, PlacesSection } from '../components/Cards.jsx'
import Fab from '../components/Fab.jsx'
import ItemPicker from '../components/ItemPicker.jsx'
import Icon from '../components/Icon.jsx'
import Lightbox from '../components/Lightbox.jsx'
import PhotoPins from '../components/PhotoPins.jsx'
import { ProgressRing, RoomBadge } from '../components/Room.jsx'
import { placeColor } from '../lib/rooms.js'
import { displayName, useAuthUser } from '../lib/auth.js'
import { useMembers } from '../lib/members.js'
import { celebrate } from '../lib/celebrate.js'
import NfcSheet from '../components/NfcSheet.jsx'
import PhotoButton from '../components/PhotoButton.jsx'
import PlaceForm from '../components/PlaceForm.jsx'
import PlacePicker from '../components/PlacePicker.jsx'
import PlanEditor from '../components/PlanEditor.jsx'
import Sheet, { ActionSheet } from '../components/Sheet.jsx'
import TagPicker from '../components/TagPicker.jsx'
import { useAiEnabled } from '../lib/ai.js'
import { useData } from '../lib/data.jsx'
import { pb, fileUrl } from '../lib/pb.js'
import { randomCode } from '../lib/codes.js'
import { formatPrice, plural } from '../lib/format.js'
import { getPref, pushRecentPlace, setPref } from '../lib/recent.js'
import { showToast } from '../lib/toast.js'
import { t } from '../lib/i18n.jsx'

export default function PlacePage () {
  const { id } = useParams()
  const data = useData()
  const navigate = useNavigate()
  // 'add' | 'edit' | 'move' | 'empty' | 'more' | 'bulk-move' | 'bulk-tag'
  const [mode, setMode] = useState(null)
  const [selected, setSelected] = useState(null) // null = not selecting, else Set of item ids
  const [bulkTags, setBulkTags] = useState([])
  const [viewing, setViewing] = useState(false)
  const [planEditing, setPlanEditing] = useState(false)
  const [sort, setSort] = useState(() => getPref('itemSort', 'name'))
  const aiEnabled = useAiEnabled()
  const [error, setError] = useState(null)
  const [several, setSeveral] = useState(false)
  const [bringing, setBringing] = useState([])
  const [showPins, setShowPins] = useState(false)
  const user = useAuthUser()
  const members = useMembers()
  const kid = user?.role === 'kid'

  const place = data.placeById.get(id)
  const known = !!place
  useEffect(() => { if (known) pushRecentPlace(id) }, [id, known])
  const subPlaces = data.childrenOf(id)
  const items = useMemo(() => {
    const list = [...data.itemsOf(id)]
    return sort === 'name' ? list.sort((a, b) => a.name.localeCompare(b.name)) : list // data is newest-first already
  }, [data, id, sort])
  const exclude = useMemo(() => data.descendants(id), [data, id])

  if (!place) return <p className='muted center'>{data.loading ? t('common.loading') : t('place.gone')}</p>

  const close = () => setMode(null)
  const run = async fn => {
    setError(null)
    try {
      await fn()
      await data.reload()
    } catch (err) {
      setError(err.message)
    }
  }

  const addPlace = async values => {
    const created = await pb.collection('places').create({ ...values, parent: id })
    await data.reload()
    close()
    navigate(`/p/${created.id}`)
  }

  // Several at once: stay here so the new places show up in the "Inside" grid.
  const addPlaces = async names => {
    for (const name of names) await pb.collection('places').create({ name, parent: id })
    await data.reload()
    close()
    showToast(t('bulkPlaces.done', { count: names.length }))
  }

  const editPlace = async values => {
    await pb.collection('places').update(id, values)
    await data.reload()
    close()
  }

  // Every move gets an Undo toast that restores exactly the previous values.
  const undoable = (message, changes) => {
    showToast(message, {
      label: t('action.undo'),
      run: () => Promise.all(changes.map(([col, recId, before]) => pb.collection(col).update(recId, before)))
        .then(data.reload)
        .catch(err => showToast(t('move.undoFailed', { error: err.message })))
    })
  }

  // "The drill is now here": pick existing items and move them into this place (home follows).
  const bringHere = () => run(async () => {
    const ids = bringing.filter(i => data.itemById.get(i)?.place !== id)
    setBringing([])
    close()
    if (!ids.length) return
    const changes = ids.map(i => ['items', i, { place: data.itemById.get(i).place, home: data.itemById.get(i).home }])
    await Promise.all(ids.map(i => pb.collection('items').update(i, { place: id, home: id })))
    undoable(t('move.bulkDone', { count: ids.length, place: place.name }), changes)
  })

  const movePlace = target => run(async () => {
    close()
    const before = place.parent
    await pb.collection('places').update(id, { parent: target ?? '' })
    undoable(t('move.done', { name: place.name, place: target ? data.pathText(target) : t('picker.topLevel') }), [['places', id, { parent: before }]])
  })

  // Moves this place's direct items and sub-places into another place (which also merges two places).
  const emptyInto = target => run(async () => {
    close()
    const changes = [
      ...data.itemsOf(id).map(i => ['items', i.id, { place: i.place, home: i.home }]),
      ...data.childrenOf(id).map(c => ['places', c.id, { parent: c.parent }])
    ]
    await Promise.all([
      ...data.itemsOf(id).map(i => pb.collection('items').update(i.id, { place: target, ...(i.home === id && { home: target }) })),
      ...data.childrenOf(id).map(c => pb.collection('places').update(c.id, { parent: target }))
    ])
    undoable(t('move.emptied', { name: place.name, place: data.pathText(target) }), changes)
  })

  const deletePlace = () => run(async () => {
    // Trashed items still reference this place; they go with it.
    const trashed = await pb.collection('items').getFullList({ filter: pb.filter("place = {:id} && deleted != ''", { id }) })
    const extra = trashed.length ? ` ${t('place.deleteTrashed', { count: trashed.length })}` : ''
    if (!window.confirm(`${t('confirm.delete', { name: place.name })}${extra}`)) return
    await Promise.all(trashed.map(i => pb.collection('items').delete(i.id)))
    await pb.collection('places').delete(id)
    navigate(place.parent ? `/p/${place.parent}` : '/')
  })

  const printLabel = () => run(async () => {
    const existing = await pb.collection('labels').getList(1, 1, { filter: pb.filter('place = {:id}', { id }) })
    const label = existing.items[0] ?? await pb.collection('labels').create({ code: randomCode(), place: id })
    navigate(`/labels?codes=${label.code}`)
  })

  // "What's in box 3?" as a message: sub-places and items, with quantities, for moving or lending.
  const shareContents = async () => {
    const lines = [`${data.pathText(id)}`]
    for (const p of subPlaces) lines.push(`▸ ${p.name} (${t('count.item', { count: data.totalItems(p.id) })})`)
    for (const i of items) lines.push(`- ${i.quantity > 1 ? `${i.quantity}× ` : ''}${i.name}`)
    const text = lines.join('\n')
    try {
      if (navigator.share) await navigator.share({ title: place.name, text })
      else {
        await navigator.clipboard.writeText(text)
        showToast(t('share.copied'))
      }
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message)
    }
  }

  // One sticker sheet for a whole room: this place and everything directly inside it.
  const printLabelsInside = () => run(async () => {
    const targets = [place, ...subPlaces]
    const existing = await pb.collection('labels').getFullList({ filter: targets.map(p => pb.filter('place = {:id}', { id: p.id })).join(' || ') })
    const codes = []
    for (const p of targets) {
      const label = existing.find(l => l.place === p.id) ?? await pb.collection('labels').create({ code: randomCode(), place: p.id })
      codes.push(label.code)
    }
    navigate(`/labels?codes=${codes.join(',')}`)
  })

  const setPhoto = photo => run(() => pb.collection('places').update(id, { photo }))

  const toggle = itemId => setSelected(prev => {
    const next = new Set(prev)
    next.has(itemId) ? next.delete(itemId) : next.add(itemId)
    return next
  })
  const bulk = (values, undoMessage) => run(async () => {
    close()
    const ids = [...selected]
    const changes = ids.map(itemId => {
      const i = data.itemById.get(itemId)
      return ['items', itemId, { place: i.place, home: i.home, tags: i.tags }]
    })
    await Promise.all(ids.map(itemId => pb.collection('items').update(itemId, values)))
    setSelected(null)
    if (undoMessage) undoable(undoMessage, changes)
  })
  const applyBulkTags = () => {
    if (bulkTags.length) bulk({ 'tags+': bulkTags })
    else close()
    setBulkTags([])
  }

  const pinned = place.photo ? items.filter(i => i.pin) : []
  const color = placeColor(data, place)
  const isSpot = subPlaces.length === 0
  const prog = data.progress(id)
  const nextSpot = [...data.descendants(id)].map(pid => data.placeById.get(pid)).find(p => p && p.id !== id && !data.childrenOf(p.id).length && !p.done)
  const drafts = data.draftsIn(id).length
  const assigneeRec = members.find(m => m.id === place.assignee)
  const assignee = assigneeRec ? displayName(assigneeRec, '?') : null
  const toggleDone = () => run(async () => {
    await pb.collection('places').update(id, { done: !place.done })
    if (!place.done && place.parent) {
      const parent = data.progress(place.parent)
      if (parent.done + 1 >= parent.total) celebrate()
    }
  })
  const isEmpty = subPlaces.length === 0 && items.length === 0
  const total = data.totalItems(id)
  const value = data.totalValue(id)

  // Rarely used actions live in the ⋯ sheet so the contents start near the top of the screen.
  const moreActions = [
    { icon: 'print', label: t('place.contentsSheet'), onClick: () => navigate(`/print/${id}`) },
    items.length > 0 && { icon: 'check', label: t('check.action'), onClick: () => navigate(`/check/${id}`) },
    { icon: 'box', label: t(place.full ? 'place.notFull' : 'place.markFull'), onClick: () => run(() => pb.collection('places').update(id, { full: !place.full })) },
    { icon: 'share', label: t('place.shareContents'), onClick: shareContents },
    { icon: 'qr', label: t('place.label'), onClick: printLabel },
    subPlaces.length > 0 && { icon: 'qr', label: t('place.labelsInside', { count: subPlaces.length + 1 }), onClick: printLabelsInside },
    { icon: 'nfc', label: t('nfc.action'), onClick: () => setMode('nfc') },
    subPlaces.length > 0 && { icon: 'map', label: place.plan ? t('plan.edit') : t('plan.add'), onClick: () => setPlanEditing(true) },
    !isEmpty && !kid && { icon: 'move', label: t('place.emptyInto'), onClick: () => setMode('empty') },
    isEmpty && !kid && { icon: 'trash', label: t('action.delete'), onClick: deletePlace, danger: true }
  ]

  return (
    <div className='page'>
      <Breadcrumb placeId={id} />

      {place.photo
        ? (
          <section className='hero'>
            <button className='plain zoomable' onClick={() => setViewing(true)}><img src={fileUrl(place, place.photo)} alt='' /></button>
            <div className='hero-text'>
              <h1>{place.name}</h1>
              {place.note && <p>{place.note}</p>}
            </div>
          </section>
          )
        : (
          <section className='place-head'>
            <RoomBadge place={place} size={56} />
            <div>
              <h1 className='page-title'>{place.name}</h1>
              {place.note && <p className='muted'>{place.note}</p>}
            </div>
            <PhotoButton onPhoto={setPhoto} className='btn icon-only photo-add'>
              <Icon name='camera' size={20} /><span className='sr-only'>{t('form.addPhoto')}</span>
            </PhotoButton>
          </section>
          )}

      {/* Cataloguing: a storage spot is swept and ticked off; a room shows how far its spots are. */}
      <div className='catalogue-row' style={{ '--room': color }}>
        {isSpot
          ? (
            <>
              <Link className='btn primary big' to={`/sweep/${id}`}><Icon name='camera' />{t('sweep.cta')}</Link>
              <button className={`btn done-toggle ${place.done ? 'on' : ''}`} onClick={toggleDone} aria-pressed={place.done}>
                <Icon name='check' />{place.done ? t('place.isDone') : t('place.markDone')}
              </button>
            </>
            )
          : prog.total > 0 && (
            <div className='room-progress'>
              <ProgressRing pct={prog.pct} color={color} size={46} stroke={5} label={t('progress.label', prog)} />
              <span className='row-text'><strong>{t('progress.label', prog)}</strong>{assignee && <small>{t('missions.assignedTo', { name: assignee })}</small>}</span>
              {prog.pct < 100 && <Link className='btn primary' to={`/sweep/${nextSpot?.id ?? id}`}><Icon name='camera' size={18} />{t('missions.start')}</Link>}
            </div>
            )}
        {drafts > 0 && <Link className='chip draft-chip' to={`/name?place=${id}`}><Icon name='edit' size={14} />{t('drafts.nameNow', { count: drafts })}</Link>}
      </div>

      <div className='place-meta'>
        <span className='muted small'>
          {[total && t('count.item', { count: total }), subPlaces.length && t('place.inside', { count: subPlaces.length }), value > 0 && t('place.worth', { value: formatPrice(value) }), place.full && t('place.fullBadge')].filter(Boolean).join(' · ') || t('place.empty')}
        </span>
        <div className='action-row'>
          <button className='chip' onClick={() => setMode('edit')}><Icon name='edit' size={16} />{t('action.edit')}</button>
          {!kid && <button className='chip' onClick={() => setMode('move')}><Icon name='move' size={16} />{t('action.move')}</button>}
          {subPlaces.length > 0 && <Link className='chip' to={`/map/${id}`} viewTransition><Icon name='map' size={16} />{t('tab.map')}</Link>}
          {pinned.length > 0 && <button className='chip' onClick={() => setShowPins(true)}><Icon name='pin' size={16} />{pinned.length}</button>}
          <button className='chip icon-only' onClick={() => setMode('more')} aria-label={t('action.more')}><Icon name='more' size={18} /></button>
        </div>
      </div>

      {error && <p className='error'>{error}</p>}

      {subPlaces.length > 0 && <PlacesSection title={t('place.insideTitle')} places={subPlaces} />}

      {/* The plan maps the sub-places, so it follows the "Inside" grid. */}
      <PlanEditor place={place} editing={planEditing} onEditingChange={setPlanEditing} />

      {items.length > 0 && (
        <section>
          <h2>
            {t('place.itemsTitle')} <span className='count'>{items.length}</span>
            <button className='chip push' onClick={() => { const next = sort === 'name' ? 'new' : 'name'; setSort(next); setPref('itemSort', next) }}>{t(sort === 'name' ? 'sort.az' : 'sort.newest')}</button>
            <button className={`chip ${selected ? 'on' : ''}`} onClick={() => setSelected(selected ? null : new Set())}>{selected ? t('action.cancel') : t('action.select')}</button>
          </h2>
          <Grid>
            {items.map(i => (
              <ItemCard key={i.id} item={i} selectable={!!selected} selected={selected?.has(i.id)} onToggle={toggle} />
            ))}
          </Grid>
        </section>
      )}

      {isEmpty && !data.loading && <p className='empty'>{t('place.emptyHint')}</p>}

      {!selected && (
        <Fab actions={[
          { icon: 'camera', label: t('place.addItems'), hint: t('fab.addItemsHint'), onClick: () => navigate(`/add/${id}`) },
          aiEnabled && { icon: 'sparkle', label: t('ai.addButton'), hint: t('fab.aiHint'), onClick: () => navigate(`/ai-add/${id}`) },
          { icon: 'move', label: t('place.bringHere'), hint: t('place.bringHereHint'), onClick: () => setMode('bring') },
          { icon: 'box', label: t('place.placeInside'), hint: t('fab.placeHint', { name: place.name }), onClick: () => setMode('add') }
        ]}
        />
      )}

      {selected?.size > 0 && (
        <div className='bulk-bar'>
          <span>{plural(selected.size, 'item')}</span>
          <button className='btn' onClick={() => setMode('bulk-tag')}><Icon name='tag' size={18} />{t('action.tag')}</button>
          <button className='btn primary' onClick={() => setMode('bulk-move')}><Icon name='move' size={18} />{t('action.move')}</button>
        </div>
      )}

      {viewing && <Lightbox images={[fileUrl(place, place.photo)]} onClose={() => setViewing(false)} />}
      {mode === 'bring' && <ItemPicker title={t('place.bringHereTitle', { name: place.name })} selected={bringing} onChange={setBringing} onClose={bringHere} />}
      {showPins && (
        <Sheet title={t('pin.onPhoto', { name: place.name })} onClose={() => setShowPins(false)}>
          <PhotoPins place={place} pins={pinned.map(i => ({ id: i.id, x: i.pin.x, y: i.pin.y, label: i.name }))} onOpen={itemId => navigate(`/i/${itemId}`)} />
        </Sheet>
      )}
      {mode === 'nfc' && <NfcSheet place={place} onClose={close} />}
      {mode === 'more' && <ActionSheet title={place.name} actions={moreActions} onClose={close} />}
      {mode === 'edit' && (
        <Sheet title={t('action.edit')} onClose={close}>
          <PlaceForm initial={place} submitLabel={t('action.save')} onSubmit={editPlace} onCancel={close} />
        </Sheet>
      )}
      {mode === 'add' && (
        <Sheet title={t('place.addInside', { name: place.name })} onClose={close}>
          <div className='segmented left' role='group'>
            <button className={!several ? 'on' : ''} onClick={() => setSeveral(false)}>{t('bulkPlaces.one')}</button>
            <button className={several ? 'on' : ''} onClick={() => setSeveral(true)}>{t('bulkPlaces.several')}</button>
          </div>
          {several
            ? <BulkPlaces onSubmit={addPlaces} onCancel={close} />
            : <PlaceForm submitLabel={t('place.add')} onSubmit={addPlace} onCancel={close} />}
        </Sheet>
      )}
      {mode === 'move' && (
        <PlacePicker title={t('place.moveInto', { name: place.name })} exclude={exclude} allowTop onPick={movePlace} onClose={close} />
      )}
      {mode === 'empty' && (
        <PlacePicker title={t('place.emptyIntoTitle', { name: place.name })} exclude={exclude} onPick={emptyInto} onClose={close} />
      )}
      {mode === 'bulk-move' && (
        <PlacePicker
          title={t('bulk.moveTo', { count: selected.size })}
          exclude={new Set([id])}
          homeToggle
          onPick={(target, { makeHome }) => bulk({ place: target, ...(makeHome && { home: target }) }, t('move.bulkDone', { count: selected.size, place: data.pathText(target) }))}
          onClose={close}
        />
      )}
      {mode === 'bulk-tag' && (
        <TagPicker title={t('bulk.tag', { count: selected.size })} selected={bulkTags} onChange={setBulkTags} onClose={applyBulkTags} />
      )}
    </div>
  )
}
