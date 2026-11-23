// Shared by activity.pb.js. JSVM handlers run in isolated scopes, so helpers live in a module.
module.exports = {
  log (app, auth, data) {
    try {
      const record = new Record(app.findCollectionByNameOrId('activity'))
      record.load(Object.assign({ user: auth ? auth.id : '' }, data))
      app.save(record)
    } catch (err) {
      // The user's change already succeeded; a missing feed entry must not turn it into an error.
      app.logger().error('activity log failed', 'error', String(err))
    }
  }
}
