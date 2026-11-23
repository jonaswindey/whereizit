/// <reference path="../pb_data/types.d.ts" />

// Round 14: the "wanted" board. Someone asks the household for a thing ("who has the scissors?"),
// anyone (kids too) answers with where it was. Open asks show on everyone's home screen.
migrate((app) => {
  const authed = "@request.auth.id != ''"
  const users = app.findCollectionByNameOrId('users')
  const items = app.findCollectionByNameOrId('items')
  const places = app.findCollectionByNameOrId('places')
  app.save(new Collection({
    type: 'base',
    name: 'asks',
    listRule: authed,
    viewRule: authed,
    createRule: `${authed} && @request.body.author = @request.auth.id`,
    updateRule: `${authed} && @request.body.author:isset = false`,
    // The asker can withdraw it; grown-ups can tidy up any.
    deleteRule: `${authed} && (author = @request.auth.id || @request.auth.role != 'kid')`,
    fields: [
      { name: 'text', type: 'text', required: true, max: 200 },
      { name: 'item', type: 'relation', collectionId: items.id, maxSelect: 1, cascadeDelete: false },
      { name: 'author', type: 'relation', collectionId: users.id, maxSelect: 1, required: true, cascadeDelete: true },
      { name: 'answered', type: 'date' },
      { name: 'answered_by', type: 'relation', collectionId: users.id, maxSelect: 1, cascadeDelete: false },
      { name: 'answer_place', type: 'relation', collectionId: places.id, maxSelect: 1, cascadeDelete: false },
      { name: 'answer_note', type: 'text', max: 200 },
      { name: 'created', type: 'autodate', onCreate: true },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true }
    ],
    indexes: ['CREATE INDEX idx_asks_answered ON asks (answered)']
  }))
}, (app) => {
  app.delete(app.findCollectionByNameOrId('asks'))
})
