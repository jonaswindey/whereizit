/// <reference path="../pb_data/types.d.ts" />

// Round 4: per-person language, stocktake (checked/missing), maintenance, related items, pinned items.
migrate((app) => {
  const users = app.findCollectionByNameOrId('users')
  // Empty = follow the phone's language.
  users.fields.add(new SelectField({ name: 'language', maxSelect: 1, values: ['en', 'nl'] }))
  app.save(users)

  const items = app.findCollectionByNameOrId('items')
  items.fields.add(new DateField({ name: 'checked_at' }))
  items.fields.add(new BoolField({ name: 'missing' }))
  items.fields.add(new NumberField({ name: 'service_every_days', min: 0, onlyInt: true }))
  items.fields.add(new DateField({ name: 'serviced_at' }))
  items.fields.add(new TextField({ name: 'service_note', max: 300 }))
  items.fields.add(new RelationField({ name: 'related', collectionId: items.id, maxSelect: 20 }))
  items.fields.add(new BoolField({ name: 'pinned' }))
  app.save(items)

  const activity = app.findCollectionByNameOrId('activity')
  const action = activity.fields.getByName('action')
  action.values = [...action.values, 'missing', 'found', 'serviced']
  app.save(activity)
}, (app) => {
  const users = app.findCollectionByNameOrId('users')
  users.fields.removeByName('language')
  app.save(users)
  const items = app.findCollectionByNameOrId('items')
  for (const f of ['checked_at', 'missing', 'service_every_days', 'serviced_at', 'service_note', 'related', 'pinned']) items.fields.removeByName(f)
  app.save(items)
  const activity = app.findCollectionByNameOrId('activity')
  const action = activity.fields.getByName('action')
  action.values = action.values.filter(v => !['missing', 'found', 'serviced'].includes(v))
  app.save(activity)
})
