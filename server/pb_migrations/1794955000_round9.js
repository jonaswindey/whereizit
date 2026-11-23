/// <reference path="../pb_data/types.d.ts" />

// Round 9: places can be marked full (left out of put-away suggestions); items get an owner.
migrate((app) => {
  const places = app.findCollectionByNameOrId('places')
  places.fields.add(new BoolField({ name: 'full' }))
  app.save(places)
  const items = app.findCollectionByNameOrId('items')
  // Free text, not a user relation: children and guests own things too and have no account.
  items.fields.add(new TextField({ name: 'owner', max: 60 }))
  app.save(items)
}, (app) => {
  const places = app.findCollectionByNameOrId('places')
  places.fields.removeByName('full')
  app.save(places)
  const items = app.findCollectionByNameOrId('items')
  items.fields.removeByName('owner')
  app.save(items)
})
