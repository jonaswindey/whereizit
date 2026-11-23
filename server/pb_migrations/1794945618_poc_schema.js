/// <reference path="../pb_data/types.d.ts" />

// PoC schema: places (nested), items, labels.
// Rules are "" (public) on purpose: the PoC is only reachable inside the tailnet and auth is Phase 1.
migrate((app) => {
  const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
  const autodates = [
    { name: 'created', type: 'autodate', onCreate: true },
    { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true }
  ]
  const open = { listRule: '', viewRule: '', createRule: '', updateRule: '', deleteRule: '' }

  const places = new Collection({
    type: 'base',
    name: 'places',
    ...open,
    fields: [
      { name: 'name', type: 'text', required: true, max: 200 },
      { name: 'note', type: 'text', max: 2000 },
      { name: 'photo', type: 'file', maxSelect: 1, maxSize: 10485760, mimeTypes: imageTypes, thumbs: ['400x400'] },
      ...autodates
    ]
  })
  app.save(places)

  // Self-relation needs the collection id, so it is added after the first save.
  places.fields.add(new RelationField({ name: 'parent', collectionId: places.id, maxSelect: 1 }))
  places.indexes = ['CREATE INDEX idx_places_parent ON places (parent)']
  app.save(places)

  app.save(new Collection({
    type: 'base',
    name: 'items',
    ...open,
    fields: [
      { name: 'name', type: 'text', required: true, max: 200 },
      { name: 'place', type: 'relation', collectionId: places.id, maxSelect: 1, required: true },
      { name: 'photos', type: 'file', maxSelect: 10, maxSize: 10485760, mimeTypes: imageTypes, thumbs: ['400x400'] },
      { name: 'quantity', type: 'number', min: 0, onlyInt: true },
      { name: 'note', type: 'text', max: 2000 },
      ...autodates
    ],
    indexes: ['CREATE INDEX idx_items_place ON items (place)']
  }))

  app.save(new Collection({
    type: 'base',
    name: 'labels',
    ...open,
    fields: [
      { name: 'code', type: 'text', required: true, min: 6, max: 12, pattern: '^[a-z0-9]+$' },
      { name: 'place', type: 'relation', collectionId: places.id, maxSelect: 1 },
      ...autodates
    ],
    indexes: ['CREATE UNIQUE INDEX idx_labels_code ON labels (code)']
  }))
}, (app) => {
  for (const name of ['labels', 'items', 'places']) {
    app.delete(app.findCollectionByNameOrId(name))
  }
})
