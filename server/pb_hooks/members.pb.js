/// <reference path="../pb_data/types.d.ts" />

// Household members add each other from the app (public sign-up stays off). Everyone signed in is
// trusted with the shared inventory already, so any member may add another.
routerAdd('POST', '/api/wz/members', (e) => {
  if (e.auth.getString('role') === 'kid') throw new ForbiddenError('Ask a grown-up to add members.')
  const body = e.requestInfo().body
  const name = String(body.name || '').trim().slice(0, 100)
  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')
  if (!name) throw new BadRequestError('Name is required.')
  if (!/^[^@\s]+@[^@\s]+$/.test(email)) throw new BadRequestError('A valid email is required.')
  if (password.length < 10) throw new BadRequestError('The password needs at least 10 characters.')
  const users = e.app.findCollectionByNameOrId('users')
  const record = new Record(users)
  record.set('name', name)
  record.set('email', email)
  record.set('role', body.kid ? 'kid' : '')
  record.setPassword(password)
  record.setVerified(true)
  try {
    e.app.save(record)
  } catch (err) {
    throw new BadRequestError(`Could not add this member: ${err}`)
  }
  return e.json(200, { id: record.id, name, email })
}, $apis.requireAuth('users'))

// Adults switch a member between kid and adult (the users collection itself won't let anyone change
// their own role).
routerAdd('POST', '/api/wz/members/{id}/role', (e) => {
  if (e.auth.getString('role') === 'kid') throw new ForbiddenError('Only adults can change this.')
  const user = e.app.findRecordById('users', e.request.pathValue('id'))
  const kid = !!e.requestInfo().body.kid
  if (kid && user.id === e.auth.id) throw new BadRequestError("You can't make yourself a kid account.")
  user.set('role', kid ? 'kid' : '')
  e.app.save(user)
  return e.json(200, { id: user.id, role: user.getString('role') })
}, $apis.requireAuth('users'))
