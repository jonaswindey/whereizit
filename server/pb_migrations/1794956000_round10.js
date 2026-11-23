/// <reference path="../pb_data/types.d.ts" />

// Round 10: stock history for supplies, so the app can estimate when something runs out.
migrate((app) => {
  const items = app.findCollectionByNameOrId('items')
  // [[iso date, quantity], …], newest last, capped by the hook.
  items.fields.add(new JSONField({ name: 'stock_log', maxSize: 4000 }))
  app.save(items)
}, (app) => {
  const items = app.findCollectionByNameOrId('items')
  items.fields.removeByName('stock_log')
  app.save(items)
})
