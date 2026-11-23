/// <reference path="../pb_data/types.d.ts" />

// Round 20: for sale (when it was listed, asking price; 0 = offers). Selling ends as gone/sold.
migrate((app) => {
  const items = app.findCollectionByNameOrId('items')
  items.fields.add(new DateField({ name: 'for_sale' }))
  items.fields.add(new NumberField({ name: 'sale_price', min: 0 }))
  app.save(items)
}, (app) => {
  const items = app.findCollectionByNameOrId('items')
  items.fields.removeByName('for_sale')
  items.fields.removeByName('sale_price')
  app.save(items)
})
