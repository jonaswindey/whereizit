import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import Icon from './Icon.jsx'
import { dismiss, useUploads } from '../lib/uploads.js'
import { hideToast, showToast, useToast } from '../lib/toast.js'
import { useOnline } from '../lib/online.js'
import { t } from '../lib/i18n.jsx'

export default function Header () {
  const { pending, failed } = useUploads()
  const toast = useToast()
  const online = useOnline()
  const location = useLocation()
  const navigate = useNavigate()
  // Installed as an app there's no browser back button, so deeper pages get one.
  const isTabRoot = ['/', '/map', '/search', '/activity', '/more'].includes(location.pathname)
  const back = () => (location.key !== 'default' ? navigate(-1) : navigate('/'))

  // Installed apps have no reload button or pull-to-refresh. Also picks up a new deploy: the service
  // worker checks for an update first, and the app shell is fetched network-first.
  const refresh = async () => {
    if (pending) return showToast(t('header.waitUploads'))
    try {
      await (await navigator.serviceWorker?.getRegistration())?.update()
    } catch (err) {
      console.warn('sw update:', err.message)
    }
    window.location.reload()
  }

  useEffect(() => {
    if (!pending) return
    const warn = e => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [pending])

  return (
    <header className='header'>
      {!isTabRoot && <button className='ghost back' onClick={back} aria-label={t('action.back')}><Icon name='back' size={24} /></button>}
      <Link to='/' className='brand'><img src='/icon.svg' alt='' width='28' height='28' />whereizit</Link>
      <div className='header-end'>
        {!online && <span className='pill offline'>{t('header.offline')}</span>}
        {pending > 0 && <span className='pill'>{t('header.uploading', { count: pending })}</span>}
        <button className='ghost refresh' onClick={refresh} aria-label={t('action.refresh')} title={t('action.refresh')}><Icon name='refresh' size={20} /></button>
      </div>
      {toast && (
        <div className='toast-stack'>
          <div className='toast' key={toast.id}>
            <span>{toast.message}</span>
            {toast.action && <button onClick={() => { hideToast(); toast.action.run() }}>{toast.action.label}</button>}
            <button className='ghost' onClick={hideToast} aria-label={t('action.dismiss')}><Icon name='close' size={16} /></button>
          </div>
        </div>
      )}
      {failed.length > 0 && (
        <div className='toast-stack'>
          {failed.map(f => (
            <div key={f.id} className='toast'>
              <span>{t('upload.failed', { name: f.label, error: f.message })}</span>
              <button onClick={() => { dismiss(f.id); f.retry() }}>{t('action.retry')}</button>
              <button className='ghost' onClick={() => dismiss(f.id)} aria-label={t('action.dismiss')}><Icon name='close' size={16} /></button>
            </div>
          ))}
        </div>
      )}
    </header>
  )
}
