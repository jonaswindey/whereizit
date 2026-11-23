/// <reference path="../pb_data/types.d.ts" />

// Round 17: searches that found nothing, so the gaps in the inventory become a to-do list. Written
// only by the server (one row per normalised text, counted), so typing doesn't create duplicates.
migrate((app) => {
  const authed = "@request.auth.id != ''"
  const users = app.findCollectionByNameOrId('users')
  app.save(new Collection({
    type: 'base',
    name: 'misses',
    listRule: authed,
    viewRule: authed,
    createRule: null,
    updateRule: null,
    deleteRule: `${authed} && @request.auth.role != 'kid'`,
    fields: [
      { name: 'text', type: 'text', required: true, max: 120 },
      { name: 'key', type: 'text', required: true, max: 120 },
      { name: 'count', type: 'number', onlyInt: true },
      { name: 'last', type: 'date' },
      { name: 'user', type: 'relation', collectionId: users.id, maxSelect: 1, cascadeDelete: false },
      { name: 'via', type: 'text', max: 20 },
      { name: 'created', type: 'autodate', onCreate: true },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true }
    ],
    indexes: ['CREATE UNIQUE INDEX idx_misses_key ON misses (key)']
  }))
}, (app) => {
  app.delete(app.findCollectionByNameOrId('misses'))
})
