/// <reference path="../pb_data/types.d.ts" />

onRecordCreateRequest((e) => {
  const isItem = e.collection.name === 'items'
  // An item's home defaults to where it was first put.
  if (isItem && !e.record.getString('home')) e.record.set('home', e.record.getString('place'))
  e.next()
  const { log } = require(`${__hooks}/activity.js`)
  log(e.app, e.auth, {
    action: 'created',
    kind: isItem ? 'item' : 'place',
    name: e.record.getString('name'),
    item: isItem ? e.record.id : '',
    place: isItem ? '' : e.record.id,
    to_place: e.record.getString(isItem ? 'place' : 'parent')
  })
}, 'items', 'places')

onRecordUpdateRequest((e) => {
  const before = e.record.original()
  e.next()
  const { log } = require(`${__hooks}/activity.js`)
  const isItem = e.collection.name === 'items'
  const base = {
    kind: isItem ? 'item' : 'place',
    name: e.record.getString('name'),
    item: isItem ? e.record.id : '',
    place: isItem ? '' : e.record.id
  }

  if (isItem) {
    // Trash is a soft delete: log it as delete/restore, and nothing else for that update.
    const wasDeleted = !before.getDateTime('deleted').isZero()
    const isDeleted = !e.record.getDateTime('deleted').isZero()
    if (!wasDeleted && isDeleted) return log(e.app, e.auth, Object.assign({ action: 'deleted', from_place: e.record.getString('place') }, base))
    if (wasDeleted && !isDeleted) return log(e.app, e.auth, Object.assign({ action: 'restored', to_place: e.record.getString('place') }, base))

    // Gone (given away, sold, thrown out): logged with the reason/note, nothing else for that update.
    const wasGone = !before.getDateTime('gone').isZero()
    const isGone = !e.record.getDateTime('gone').isZero()
    if (!wasGone && isGone) {
      const detail = [e.record.getString('gone_reason'), e.record.getString('gone_note')].filter(Boolean).join(': ')
      return log(e.app, e.auth, Object.assign({ action: 'gone', detail, from_place: e.record.getString('place') }, base))
    }
    if (wasGone && !isGone) return log(e.app, e.auth, Object.assign({ action: 'back', to_place: e.record.getString('place') }, base))
  }

  const parentField = isItem ? 'place' : 'parent'
  const from = before.getString(parentField)
  const to = e.record.getString(parentField)
  if (from !== to) log(e.app, e.auth, Object.assign({ action: 'moved', from_place: from, to_place: to }, base))

  if (before.getString('name') !== e.record.getString('name')) {
    log(e.app, e.auth, Object.assign({ action: 'renamed', detail: before.getString('name') }, base))
  }

  if (isItem) {
    const lentBefore = before.getString('lent_to')
    const lentNow = e.record.getString('lent_to')
    if (!lentBefore && lentNow) log(e.app, e.auth, Object.assign({ action: 'lent', detail: lentNow }, base))
    if (lentBefore && !lentNow) log(e.app, e.auth, Object.assign({ action: 'returned', detail: lentBefore }, base))

    const missingBefore = before.getBool('missing')
    const missingNow = e.record.getBool('missing')
    if (!missingBefore && missingNow) log(e.app, e.auth, Object.assign({ action: 'missing' }, base))
    if (missingBefore && !missingNow) log(e.app, e.auth, Object.assign({ action: 'found' }, base))

    const servicedBefore = before.getDateTime('serviced_at')
    const servicedNow = e.record.getDateTime('serviced_at')
    if (!servicedNow.isZero() && !servicedNow.equal(servicedBefore)) {
      log(e.app, e.auth, Object.assign({ action: 'serviced', detail: e.record.getString('service_note') }, base))
    }
  }
}, 'items', 'places')

onRecordDeleteRequest((e) => {
  const isItem = e.collection.name === 'items'
  // Purging from the trash was already logged when it went into the trash.
  const alreadyTrashed = isItem && !e.record.getDateTime('deleted').isZero()
  const name = e.record.getString('name')
  const from = e.record.getString(isItem ? 'place' : 'parent')
  e.next()
  if (alreadyTrashed) return
  const { log } = require(`${__hooks}/activity.js`)
  log(e.app, e.auth, { action: 'deleted', kind: isItem ? 'item' : 'place', name, from_place: from })
}, 'items', 'places')
