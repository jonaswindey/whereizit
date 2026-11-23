/// <reference path="../pb_data/types.d.ts" />

// Round 16: essentials for the emergency card (fuse box, first-aid kit, water main), and "with me"
// for things someone has taken along (the drill in the car), so search doesn't send you to an
// empty cupboard.
migrate((app) => {
  const users = app.findCollectionByNameOrId('users')
  const items = app.findCollectionByNameOrId('items')
  items.fields.add(new BoolField({ name: 'essential' }))
  items.fields.add(new RelationField({ name: 'with_user', collectionId: users.id, maxSelect: 1, cascadeDelete: false }))
  items.fields.add(new DateField({ name: 'with_since' }))
  app.save(items)
}, (app) => {
  const items = app.findCollectionByNameOrId('items')
  for (const f of ['essential', 'with_user', 'with_since']) items.fields.removeByName(f)
  app.save(items)
})
