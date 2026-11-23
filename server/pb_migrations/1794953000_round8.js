/// <reference path="../pb_data/types.d.ts" />

// Round 8: "gone" items (given away, sold, thrown out) leave the inventory but keep their history.
migrate((app) => {
  const items = app.findCollectionByNameOrId('items')
  items.fields.add(new DateField({ name: 'gone' }))
  items.fields.add(new SelectField({ name: 'gone_reason', maxSelect: 1, values: ['given', 'sold', 'thrown', 'other'] }))
  items.fields.add(new TextField({ name: 'gone_note', max: 300 }))
  app.save(items)

  const activity = app.findCollectionByNameOrId('activity')
  const action = activity.fields.getByName('action')
  action.values = [...action.values, 'gone', 'back']
  app.save(activity)
}, (app) => {
  const items = app.findCollectionByNameOrId('items')
  for (const f of ['gone', 'gone_reason', 'gone_note']) items.fields.removeByName(f)
  app.save(items)
  const activity = app.findCollectionByNameOrId('activity')
  const action = activity.fields.getByName('action')
  action.values = action.values.filter(v => !['gone', 'back'].includes(v))
  app.save(activity)
})
