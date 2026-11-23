/// <reference path="../pb_data/types.d.ts" />

// When someone last opened an item in the app. Kept apart from `updated` so looking at something
// doesn't show up as a change (activity, "recently changed") but does count for Opruimen.
migrate((app) => {
  const items = app.findCollectionByNameOrId('items')
  items.fields.add(new DateField({ name: 'used_at' }))
  app.save(items)
}, (app) => {
  const items = app.findCollectionByNameOrId('items')
  items.fields.removeByName('used_at')
  app.save(items)
})
