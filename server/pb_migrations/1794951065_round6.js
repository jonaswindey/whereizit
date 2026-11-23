/// <reference path="../pb_data/types.d.ts" />

// Round 6: nightly backups (database + uploaded files, last 14 kept in pb_data/backups) and gather lists.
migrate((app) => {
  const settings = app.settings()
  settings.backups.cron = '30 3 * * *'
  settings.backups.cronMaxKeep = 14
  app.save(settings)

  const authed = "@request.auth.id != ''"
  const items = app.findCollectionByNameOrId('items')
  app.save(new Collection({
    type: 'base',
    name: 'lists',
    listRule: authed,
    viewRule: authed,
    createRule: authed,
    updateRule: authed,
    deleteRule: authed,
    fields: [
      { name: 'name', type: 'text', required: true, max: 120 },
      { name: 'note', type: 'text', max: 1000 },
      { name: 'items', type: 'relation', collectionId: items.id, maxSelect: 500 },
      // Ids of items already gathered; kept separate so the list can be reset and reused.
      { name: 'done', type: 'json', maxSize: 20000 },
      { name: 'created', type: 'autodate', onCreate: true },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true }
    ]
  }))
}, (app) => {
  app.delete(app.findCollectionByNameOrId('lists'))
  const settings = app.settings()
  settings.backups.cron = ''
  app.save(settings)
})
