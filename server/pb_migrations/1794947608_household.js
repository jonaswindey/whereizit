/// <reference path="../pb_data/types.d.ts" />

// Phase 1/2: logins, tags, lending, consumables, item details, attachments, activity log.
migrate((app) => {
  const authed = "@request.auth.id != ''"
  const members = { listRule: authed, viewRule: authed, createRule: authed, updateRule: authed, deleteRule: authed }

  // Household accounts are created by the admin; no public sign-up.
  const users = app.findCollectionByNameOrId('users')
  users.listRule = authed
  users.viewRule = authed
  users.createRule = null
  app.save(users)

  for (const name of ['places', 'items', 'labels']) {
    const c = app.findCollectionByNameOrId(name)
    Object.assign(c, members)
    app.save(c)
  }

  const tags = new Collection({
    type: 'base',
    name: 'tags',
    ...members,
    fields: [
      { name: 'name', type: 'text', required: true, max: 60 },
      { name: 'color', type: 'text', max: 9, pattern: '^#[0-9a-fA-F]{6}$' },
      { name: 'seasonal', type: 'bool' },
      { name: 'created', type: 'autodate', onCreate: true },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true }
    ],
    indexes: ['CREATE UNIQUE INDEX idx_tags_name ON tags (name COLLATE NOCASE)']
  })
  app.save(tags)

  const items = app.findCollectionByNameOrId('items')
  items.fields.add(new RelationField({ name: 'tags', collectionId: tags.id, maxSelect: 50 }))
  items.fields.add(new NumberField({ name: 'min_quantity', min: 0, onlyInt: true }))
  items.fields.add(new TextField({ name: 'lent_to', max: 120 }))
  items.fields.add(new DateField({ name: 'lent_at' }))
  items.fields.add(new DateField({ name: 'purchase_date' }))
  items.fields.add(new NumberField({ name: 'price', min: 0 }))
  items.fields.add(new DateField({ name: 'warranty_until' }))
  items.fields.add(new FileField({
    name: 'attachments',
    maxSelect: 20,
    maxSize: 26214400,
    mimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']
  }))
  app.save(items)

  const places = app.findCollectionByNameOrId('places')
  // Activity is written only by pb_hooks (createRule null), so the feed can't be forged from the client.
  app.save(new Collection({
    type: 'base',
    name: 'activity',
    listRule: authed,
    viewRule: authed,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: 'user', type: 'relation', collectionId: users.id, maxSelect: 1 },
      { name: 'action', type: 'select', required: true, maxSelect: 1, values: ['created', 'moved', 'lent', 'returned', 'deleted', 'renamed'] },
      { name: 'kind', type: 'select', required: true, maxSelect: 1, values: ['item', 'place'] },
      // Name snapshot: the record may be deleted later, the feed should still read well.
      { name: 'name', type: 'text', max: 200 },
      { name: 'item', type: 'relation', collectionId: items.id, maxSelect: 1 },
      { name: 'place', type: 'relation', collectionId: places.id, maxSelect: 1 },
      { name: 'from_place', type: 'relation', collectionId: places.id, maxSelect: 1 },
      { name: 'to_place', type: 'relation', collectionId: places.id, maxSelect: 1 },
      { name: 'detail', type: 'text', max: 200 },
      { name: 'created', type: 'autodate', onCreate: true }
    ],
    indexes: ['CREATE INDEX idx_activity_created ON activity (created)']
  }))
}, (app) => {
  app.delete(app.findCollectionByNameOrId('activity'))
  const items = app.findCollectionByNameOrId('items')
  for (const f of ['tags', 'min_quantity', 'lent_to', 'lent_at', 'purchase_date', 'price', 'warranty_until', 'attachments']) {
    items.fields.removeByName(f)
  }
  app.save(items)
  app.delete(app.findCollectionByNameOrId('tags'))
  for (const name of ['places', 'items', 'labels']) {
    const c = app.findCollectionByNameOrId(name)
    Object.assign(c, { listRule: '', viewRule: '', createRule: '', updateRule: '', deleteRule: '' })
    app.save(c)
  }
})
