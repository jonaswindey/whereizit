/// <reference path="../pb_data/types.d.ts" />

// Round 3: home location ("doesn't belong here"), expiry dates, trash (soft delete).
migrate((app) => {
  const places = app.findCollectionByNameOrId('places')
  const items = app.findCollectionByNameOrId('items')
  items.fields.add(new RelationField({ name: 'home', collectionId: places.id, maxSelect: 1 }))
  items.fields.add(new DateField({ name: 'expires' }))
  items.fields.add(new DateField({ name: 'deleted' }))
  items.indexes = [...items.indexes, 'CREATE INDEX idx_items_deleted ON items (deleted)']
  app.save(items)

  // Existing items live where they are now.
  app.db().newQuery("UPDATE items SET home = place WHERE home = '' OR home IS NULL").execute()

  const activity = app.findCollectionByNameOrId('activity')
  const action = activity.fields.getByName('action')
  action.values = [...action.values, 'restored']
  app.save(activity)
}, (app) => {
  const items = app.findCollectionByNameOrId('items')
  for (const f of ['home', 'expires', 'deleted']) items.fields.removeByName(f)
  items.indexes = items.indexes.filter(i => !i.includes('idx_items_deleted'))
  app.save(items)
  const activity = app.findCollectionByNameOrId('activity')
  const action = activity.fields.getByName('action')
  action.values = action.values.filter(v => v !== 'restored')
  app.save(activity)
})
