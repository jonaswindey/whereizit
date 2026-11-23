import { useState } from 'react'
import { pb } from '../lib/pb.js'
import { t } from '../lib/i18n.jsx'

export default function LoginPage () {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const submit = async e => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await pb.collection('users').authWithPassword(email.trim(), password)
    } catch (err) {
      setError(err.status === 400 ? t('login.wrong') : err.message)
      setBusy(false)
    }
  }

  return (
    <main className='login'>
      <img src='/icon.svg' alt='' width='72' height='72' />
      <h1>whereizit</h1>
      <p className='muted'>{t('login.tagline')}</p>
      <form className='panel form' onSubmit={submit}>
        <input type='email' autoComplete='username' placeholder={t('login.email')} value={email} onChange={e => setEmail(e.target.value)} required />
        <input type='password' autoComplete='current-password' placeholder={t('login.password')} value={password} onChange={e => setPassword(e.target.value)} required />
        {error && <p className='error'>{error}</p>}
        <button className='btn primary big' disabled={busy}>{busy ? t('login.signingIn') : t('login.signIn')}</button>
      </form>
      <p className='muted small'>{t('login.accounts')}</p>
    </main>
  )
}
