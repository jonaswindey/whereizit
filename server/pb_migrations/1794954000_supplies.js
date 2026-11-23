/// <reference path="../pb_data/types.d.ts" />

// Supplies: everyday things kept in stock (milk, coffee, bread), a stock-check reminder per person
// and a shopping list. Reorder level reuses min_quantity; the target is how many to have after shopping.
migrate((app) => {
  const items = app.findCollectionByNameOrId('items')
  items.fields.add(new BoolField({ name: 'staple' }))
  items.fields.add(new NumberField({ name: 'stock_target', min: 0, onlyInt: true }))
  items.fields.add(new TextField({ name: 'unit', max: 30 }))
  items.fields.add(new TextField({ name: 'shop', max: 60 }))
  items.fields.add(new URLField({ name: 'buy_url' }))
  app.save(items)

  const users = app.findCollectionByNameOrId('users')
  users.fields.add(new SelectField({ name: 'stock_check', maxSelect: 1, values: ['daily', 'twice_weekly', 'weekly', 'biweekly'] }))
  // 0 = Monday … 6 = Sunday; time as "HH:MM" in the phone's local time.
  users.fields.add(new NumberField({ name: 'stock_check_day', min: 0, max: 6, onlyInt: true }))
  users.fields.add(new TextField({ name: 'stock_check_time', max: 5, pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' }))
  app.save(users)
}, (app) => {
  const items = app.findCollectionByNameOrId('items')
  for (const f of ['staple', 'stock_target', 'unit', 'shop', 'buy_url']) items.fields.removeByName(f)
  app.save(items)
  const users = app.findCollectionByNameOrId('users')
  for (const f of ['stock_check', 'stock_check_day', 'stock_check_time']) users.fields.removeByName(f)
  app.save(users)
})
