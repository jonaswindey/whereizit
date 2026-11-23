/// <reference path="../pb_data/types.d.ts" />

// Apple Shortcuts link: a per-person secret (separate from the calendar one, because this link can
// also add to the shopping list), and what was last sent so a re-run doesn't duplicate reminders.
migrate((app) => {
  const users = app.findCollectionByNameOrId('users')
  users.fields.add(new TextField({ name: 'shortcut_token', hidden: true, max: 64 }))
  users.fields.add(new JSONField({ name: 'shortcut_sent', hidden: true, maxSize: 200000 }))
  app.save(users)
}, (app) => {
  const users = app.findCollectionByNameOrId('users')
  users.fields.removeByName('shortcut_token')
  users.fields.removeByName('shortcut_sent')
  app.save(users)
})
