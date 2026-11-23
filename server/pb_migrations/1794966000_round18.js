/// <reference path="../pb_data/types.d.ts" />

// Round 18: what batteries a device takes ("AA ×4", "CR2032"), free text parsed by the app.
migrate((app) => {
  const items = app.findCollectionByNameOrId('items')
  items.fields.add(new TextField({ name: 'battery', max: 40 }))
  app.save(items)
}, (app) => {
  const items = app.findCollectionByNameOrId('items')
  items.fields.removeByName('battery')
  app.save(items)
})
