/// <reference path="../pb_data/types.d.ts" />

// Round 5: floor plans. A place can have a plan image; each child place can have a zone on its
// parent's plan ({ x, y, w, h } as fractions of the image, so it survives image resizing).
migrate((app) => {
  const places = app.findCollectionByNameOrId('places')
  places.fields.add(new FileField({
    name: 'plan',
    maxSelect: 1,
    maxSize: 15728640,
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
    thumbs: ['800x0']
  }))
  places.fields.add(new JSONField({ name: 'plan_zone', maxSize: 2000 }))
  app.save(places)
}, (app) => {
  const places = app.findCollectionByNameOrId('places')
  places.fields.removeByName('plan')
  places.fields.removeByName('plan_zone')
  app.save(places)
})
