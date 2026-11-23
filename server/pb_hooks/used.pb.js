/// <reference path="../pb_data/types.d.ts" />

// Opening an item counts as using it. Written with plain SQL so it doesn't bump `updated`, log
// activity or push a realtime change to everyone; at most once per 12 hours per item.
routerAdd('POST', '/api/wz/items/{id}/used', (e) => {
  const id = e.request.pathValue('id')
  let item
  try {
    item = e.app.findRecordById('items', id)
  } catch (_) {
    throw new NotFoundError()
  }
  const last = item.getDateTime('used_at')
  if (!last.isZero() && Date.now() - last.time().unixMilli() < 12 * 3600 * 1000) return e.noContent(204)
  e.app.db().newQuery('UPDATE items SET used_at = {:now} WHERE id = {:id}')
    .bind({ now: new DateTime().string(), id })
    .execute()
  return e.noContent(204)
}, $apis.requireAuth('users'))
