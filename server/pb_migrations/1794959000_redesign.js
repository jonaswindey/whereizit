/// <reference path="../pb_data/types.d.ts" />

// Redesign: room identity (colour, icon), cataloguing progress (done, assignee), capture-first
// photos waiting for a name, and kid accounts that can add and find but not remove.
migrate((app) => {
  const users = app.findCollectionByNameOrId('users')
  // Empty = adult. Only adults change it, through /api/wz/members (users can't edit their own role).
  users.fields.add(new SelectField({ name: 'role', maxSelect: 1, values: ['kid'] }))
  users.updateRule = "id = @request.auth.id && @request.body.role:isset = false"
  app.save(users)

  const places = app.findCollectionByNameOrId('places')
  places.fields.add(new TextField({ name: 'color', max: 20 }))
  places.fields.add(new TextField({ name: 'icon', max: 30 }))
  // A storage spot someone has gone through completely ("this drawer is done").
  places.fields.add(new BoolField({ name: 'done' }))
  places.fields.add(new RelationField({ name: 'assignee', collectionId: users.id, maxSelect: 1 }))
  const authed = "@request.auth.id != ''"
  const adult = "@request.auth.role != 'kid'"
  places.deleteRule = `${authed} && ${adult}`
  // Kids may tick a cupboard as done or rename a box, but not move rooms around.
  places.updateRule = `${authed} && (${adult} || @request.body.parent:isset = false)`
  app.save(places)

  const items = app.findCollectionByNameOrId('items')
  // Photographed in a sweep, named later in the naming queue.
  items.fields.add(new BoolField({ name: 'needs_name' }))
  items.deleteRule = `${authed} && ${adult}`
  // Trash and "gone" are updates, so they're blocked field by field.
  items.updateRule = `${authed} && (${adult} || (@request.body.deleted:isset = false && @request.body.gone:isset = false))`
  app.save(items)

  const tags = app.findCollectionByNameOrId('tags')
  tags.deleteRule = `${authed} && ${adult}`
  app.save(tags)
}, (app) => {
  const authed = "@request.auth.id != ''"
  const users = app.findCollectionByNameOrId('users')
  users.fields.removeByName('role')
  users.updateRule = 'id = @request.auth.id'
  app.save(users)
  const places = app.findCollectionByNameOrId('places')
  for (const f of ['color', 'icon', 'done', 'assignee']) places.fields.removeByName(f)
  places.deleteRule = authed
  places.updateRule = authed
  app.save(places)
  const items = app.findCollectionByNameOrId('items')
  items.fields.removeByName('needs_name')
  items.deleteRule = authed
  items.updateRule = authed
  app.save(items)
  const tags = app.findCollectionByNameOrId('tags')
  tags.deleteRule = authed
  app.save(tags)
})
