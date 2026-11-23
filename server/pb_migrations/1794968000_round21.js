/// <reference path="../pb_data/types.d.ts" />

// Round 21: "I need it on Saturday". Someone claims a shared thing (the tent, the ladder, the drill)
// for a day or a few, so nobody lends, sells or packs it away in between. Kids can claim too; a claim
// is removed by whoever made it or by a grown-up.
migrate((app) => {
  const authed = "@request.auth.id != ''"
  const users = app.findCollectionByNameOrId('users')
  const items = app.findCollectionByNameOrId('items')
  app.save(new Collection({
    type: 'base',
    name: 'reservations',
    listRule: authed,
    viewRule: authed,
    createRule: `${authed} && user = @request.auth.id`,
    updateRule: `${authed} && (user = @request.auth.id || @request.auth.role != 'kid') && @request.body.user:isset = false`,
    deleteRule: `${authed} && (user = @request.auth.id || @request.auth.role != 'kid')`,
    fields: [
      { name: 'item', type: 'relation', collectionId: items.id, maxSelect: 1, required: true, cascadeDelete: true },
      { name: 'user', type: 'relation', collectionId: users.id, maxSelect: 1, required: true, cascadeDelete: true },
      { name: 'start', type: 'date', required: true },
      { name: 'end', type: 'date' },
      { name: 'note', type: 'text', max: 120 },
      { name: 'created', type: 'autodate', onCreate: true },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true }
    ],
    indexes: ['CREATE INDEX idx_reservations_item ON reservations (item)', 'CREATE INDEX idx_reservations_start ON reservations (start)']
  }))
}, (app) => {
  app.delete(app.findCollectionByNameOrId('reservations'))
})
