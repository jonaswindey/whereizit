/// <reference path="../pb_data/types.d.ts" />

// Round 15: things borrowed from others (the neighbour's ladder). They live in the house like any
// item, with who they belong to and when they should go back; handing one back makes it "gone"
// with the reason "returned", so its history stays.
migrate((app) => {
  const items = app.findCollectionByNameOrId('items')
  items.fields.add(new TextField({ name: 'borrowed_from', max: 100 }))
  items.fields.add(new DateField({ name: 'borrowed_due' }))
  const reason = items.fields.getByName('gone_reason')
  reason.values = [...reason.values, 'returned']
  app.save(items)
}, (app) => {
  const items = app.findCollectionByNameOrId('items')
  for (const f of ['borrowed_from', 'borrowed_due']) items.fields.removeByName(f)
  const reason = items.fields.getByName('gone_reason')
  reason.values = reason.values.filter(v => v !== 'returned')
  app.save(items)
})
