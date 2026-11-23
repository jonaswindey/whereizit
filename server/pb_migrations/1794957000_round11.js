/// <reference path="../pb_data/types.d.ts" />

// Round 11: manual place order, repair list, one-off shopping list entries.
migrate((app) => {
  const places = app.findCollectionByNameOrId('places')
  // Floors and rooms have a natural order that isn't alphabetical (cellar, ground floor, first floor).
  places.fields.add(new NumberField({ name: 'order', onlyInt: true }))
  app.save(places)

  const items = app.findCollectionByNameOrId('items')
  items.fields.add(new BoolField({ name: 'needs_repair' }))
  items.fields.add(new TextField({ name: 'repair_note', max: 300 }))
  app.save(items)

  const authed = "@request.auth.id != ''"
  app.save(new Collection({
    type: 'base',
    name: 'shopping_extras',
    listRule: authed,
    viewRule: authed,
    createRule: authed,
    updateRule: authed,
    deleteRule: authed,
    fields: [
      { name: 'name', type: 'text', required: true, max: 120 },
      { name: 'shop', type: 'text', max: 60 },
      { name: 'created', type: 'autodate', onCreate: true },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true }
    ]
  }))
}, (app) => {
  app.delete(app.findCollectionByNameOrId('shopping_extras'))
  const places = app.findCollectionByNameOrId('places')
  places.fields.removeByName('order')
  app.save(places)
  const items = app.findCollectionByNameOrId('items')
  for (const f of ['needs_repair', 'repair_note']) items.fields.removeByName(f)
  app.save(items)
})
