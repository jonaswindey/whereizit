/// <reference path="../pb_data/types.d.ts" />

// Items stay in the trash for 30 days, then are removed for good (photos included).
cronAdd('purge-trash', '15 3 * * *', () => {
  const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().replace('T', ' ')
  const old = $app.findRecordsByFilter('items', "deleted != '' && deleted < {:cutoff}", '', 500, 0, { cutoff })
  for (const record of old) {
    try {
      $app.delete(record)
    } catch (err) {
      $app.logger().error('trash purge failed', 'id', record.id, 'error', String(err))
    }
  }
})
