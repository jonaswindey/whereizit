/// <reference path="../pb_data/types.d.ts" />

// Round 7: return-by date for lent items, brand/model/serial, and a private calendar feed token per person.
migrate((app) => {
  const items = app.findCollectionByNameOrId('items')
  items.fields.add(new DateField({ name: 'lent_due' }))
  items.fields.add(new TextField({ name: 'brand', max: 120 }))
  items.fields.add(new TextField({ name: 'model', max: 120 }))
  items.fields.add(new TextField({ name: 'serial', max: 120 }))
  app.save(items)

  // Hidden: users can list each other (names in the activity feed), so the token must never be
  // returned by the regular API. Only the calendar routes read or set it.
  const users = app.findCollectionByNameOrId('users')
  users.fields.add(new TextField({ name: 'calendar_token', hidden: true, max: 64 }))
  app.save(users)
}, (app) => {
  const items = app.findCollectionByNameOrId('items')
  for (const f of ['lent_due', 'brand', 'model', 'serial']) items.fields.removeByName(f)
  app.save(items)
  const users = app.findCollectionByNameOrId('users')
  users.fields.removeByName('calendar_token')
  app.save(users)
})
