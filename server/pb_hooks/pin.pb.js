/// <reference path="../pb_data/types.d.ts" />

// A pin marks a spot on the photo of the place the item is in; after a move it would point at a
// spot on the wrong photo, so it goes unless the same update sets a new one. A move also means the
// thing was put down somewhere, so "with <person>" ends.
onRecordUpdateRequest((e) => {
  const before = e.record.original()
  const moved = before.getString('place') !== e.record.getString('place')
  const pinChanged = before.getString('pin') !== e.record.getString('pin')
  if (moved && !pinChanged) e.record.set('pin', null)
  if (moved && before.getString('with_user') === e.record.getString('with_user')) {
    e.record.set('with_user', '')
    e.record.set('with_since', '')
  }
  e.next()
}, 'items')

// A new photo of the place makes the old pins meaningless.
onRecordUpdateRequest((e) => {
  const photoChanged = e.record.original().getString('photo') !== e.record.getString('photo')
  e.next()
  if (!photoChanged) return
  const pinned = e.app.findRecordsByFilter('items', "place = {:id} && pin != null && pin != ''", '', 0, 0, { id: e.record.id })
  for (const item of pinned) {
    item.set('pin', null)
    e.app.save(item)
  }
}, 'places')
