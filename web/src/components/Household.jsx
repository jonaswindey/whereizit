import { useEffect, useState } from 'react'
import Icon from './Icon.jsx'
import Sheet from './Sheet.jsx'
import Avatar from './Avatar.jsx'
import { pb } from '../lib/pb.js'
import { displayName, useAuthUser } from '../lib/auth.js'
import { showToast } from '../lib/toast.js'
import { t } from '../lib/i18n.jsx'

// No 0/O/1/l/I: the password is read off a screen and typed on another phone.
const newPassword = () => {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(14))
  return [...bytes].map(b => chars[b % chars.length]).join('')
}

function AddMember ({ onDone, onCancel }) {
  const [form, setForm] = useState({ name: '', email: '', password: newPassword(), kid: false })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const set = key => e => setForm({ ...form, [key]: e.target.value })
  const submit = async e => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await pb.send('/api/wz/members', { method: 'POST', body: form })
      onDone(form)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }
  return (
    <form className='panel form' onSubmit={submit}>
      <label className='field'>{t('members.name')}<input value={form.name} onChange={set('name')} required autoFocus /></label>
      <label className='field'>{t('members.email')}<input type='email' value={form.email} onChange={set('email')} required autoCapitalize='none' /></label>
      <label className='field'>{t('members.password')}<input value={form.password} onChange={set('password')} minLength={10} required spellCheck={false} autoCapitalize='none' className='mono' /></label>
      <label className='check'><input type='checkbox' checked={form.kid} onChange={e => setForm({ ...form, kid: e.target.checked })} />{t('members.kid')}</label>
      <p className='muted small'>{t('members.passwordHint')}</p>
      {error && <p className='error'>{error}</p>}
      <div className='row form-actions'>
        <button className='btn primary' disabled={busy}>{t('members.add')}</button>
        <button type='button' className='btn' onClick={onCancel}>{t('action.cancel')}</button>
      </div>
    </form>
  )
}

function ChangePassword ({ user, onDone, onCancel }) {
  const [old, setOld] = useState('')
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const submit = async e => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await pb.collection('users').update(user.id, { oldPassword: old, password: next, passwordConfirm: next })
      // Changing the password ends the session; sign straight back in with the new one.
      await pb.collection('users').authWithPassword(user.email, next)
      onDone()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }
  return (
    <form className='panel form' onSubmit={submit}>
      <label className='field'>{t('members.oldPassword')}<input type='password' value={old} onChange={e => setOld(e.target.value)} required autoComplete='current-password' autoFocus /></label>
      <label className='field'>{t('members.newPassword')}<input type='password' value={next} onChange={e => setNext(e.target.value)} minLength={10} required autoComplete='new-password' /></label>
      {error && <p className='error'>{error}</p>}
      <div className='row form-actions'>
        <button className='btn primary' disabled={busy}>{t('action.save')}</button>
        <button type='button' className='btn' onClick={onCancel}>{t('action.cancel')}</button>
      </div>
    </form>
  )
}

export default function Household () {
  const user = useAuthUser()
  const [members, setMembers] = useState(null)
  const [mode, setMode] = useState(null) // 'add' | 'password'
  const [added, setAdded] = useState(null)

  const setRole = (m, kid) => pb.send(`/api/wz/members/${m.id}/role`, { method: 'POST', body: { kid } }).then(load).catch(err => showToast(err.message))

  const load = () => pb.collection('users').getFullList({ sort: 'name' }).then(setMembers).catch(err => console.warn('members:', err.message))
  useEffect(() => { load() }, [])

  return (
    <>
      <ul className='rows members'>
        {members?.map(m => (
          <li key={m.id} className='row-card'>
            <div className='row-main'>
              <Avatar user={m} size={40} />
              <div><strong>{displayName(m, '?')}{m.id === user?.id && <small className='muted'> · {t('members.you')}</small>}</strong><small>{m.email}</small></div>
            </div>
            {user?.role !== 'kid' && m.id !== user?.id && (
              <div className='row-side'>
                <button className={`chip ${m.role === 'kid' ? 'on' : ''}`} onClick={() => setRole(m, m.role !== 'kid')}>{t('members.kidShort')}</button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {added && (
        <div className='banner lent'>
          <Icon name='user' />
          <span>{t('members.added', { name: added.name, email: added.email, password: added.password })}</span>
          <button className='ghost' onClick={() => setAdded(null)} aria-label={t('action.dismiss')}><Icon name='close' size={16} /></button>
        </div>
      )}
      <div className='row'>
        {user?.role !== 'kid' && <button className='btn' onClick={() => setMode('add')}><Icon name='plus' size={18} />{t('members.add')}</button>}
        <button className='btn' onClick={() => setMode('password')}>{t('members.changePassword')}</button>
      </div>
      {mode === 'add' && (
        <Sheet title={t('members.add')} onClose={() => setMode(null)}>
          <AddMember onCancel={() => setMode(null)} onDone={form => { setMode(null); setAdded(form); load() }} />
        </Sheet>
      )}
      {mode === 'password' && (
        <Sheet title={t('members.changePassword')} onClose={() => setMode(null)}>
          <ChangePassword user={user} onCancel={() => setMode(null)} onDone={() => { setMode(null); showToast(t('members.passwordChanged')) }} />
        </Sheet>
      )}
    </>
  )
}
