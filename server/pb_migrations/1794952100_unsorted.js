/// <reference path="../pb_data/types.d.ts" />

// Items may be added without a place yet ("No place yet" list) and put away later.
migrate((app) => {
  const items = app.findCollectionByNameOrId('items')
  const place = items.fields.getByName('place')
  place.required = false
  app.save(items)
}, (app) => {
  // Fails while placeless items exist; give them a place first.
  const items = app.findCollectionByNameOrId('items')
  const place = items.fields.getByName('place')
  place.required = true
  app.save(items)
})
