/// <reference path="../pb_data/types.d.ts" />

// Round 12: product barcodes for supplies, a pin on the place photo, alternative names for search.
migrate((app) => {
  const items = app.findCollectionByNameOrId('items')
  items.fields.add(new TextField({ name: 'barcode', max: 64 }))
  // { x, y } as fractions of the current place's photo; cleared by a hook when the item moves.
  items.fields.add(new JSONField({ name: 'pin', maxSize: 200 }))
  items.fields.add(new TextField({ name: 'aliases', max: 300 }))
  items.addIndex('idx_items_barcode', false, 'barcode', '')
  app.save(items)
}, (app) => {
  const items = app.findCollectionByNameOrId('items')
  items.removeIndex('idx_items_barcode')
  for (const f of ['barcode', 'pin', 'aliases']) items.fields.removeByName(f)
  app.save(items)
})
