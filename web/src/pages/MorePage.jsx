import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import Icon from '../components/Icon.jsx'
import Household from '../components/Household.jsx'
import Avatar from '../components/Avatar.jsx'
import { useData } from '../lib/data.jsx'
import { pb } from '../lib/pb.js'
import { displayName, useAuthUser } from '../lib/auth.js'
import { exportCsv, exportJson, exportZip } from '../lib/export.js'
import { formatPrice } from '../lib/format.js'
import { LANGUAGES, t } from '../lib/i18n.jsx'
import { getPref, setPref } from '../lib/recent.js'
import { useAiEnabled } from '../lib/ai.js'
import { play } from '../lib/sound.js'
import { showToast } from '../lib/toast.js'

function applyTheme (theme) {
  if (theme === 'auto') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = theme
}

// Private feed URL: anyone with it can read the dates, so it can be reset.
function CalendarFeed () {
  const [token, setToken] = useState(null)
  const [error, setError] = useState(null)
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (!show || token) return
    pb.send('/api/wz/calendar/token', {}).then(r => setToken(r.token)).catch(err => setError(err.message))
  }, [show, token])
  const url = token && `${window.location.origin}/api/wz/ics/${token}`
  const copy = () => navigator.clipboard.writeText(url).then(() => showToast(t('share.copied')), err => setError(err.message))
  const reset = () => {
    if (!window.confirm(t('calendar.resetConfirm'))) return
    pb.send('/api/wz/calendar/token', { method: 'POST' }).then(r => setToken(r.token)).catch(err => setError(err.message))
  }
  return (
    <div className='panel form'>
      <p className='muted small'>{t('calendar.intro')}</p>
      {!show && <button className='btn' onClick={() => setShow(true)}><Icon name='calendar' size={18} />{t('calendar.show')}</button>}
      {url && (
        <>
          <input className='calendar-url' readOnly value={url} onFocus={e => e.target.select()} />
          <div className='row'>
            <a className='btn primary' href={url.replace(/^https?:/, 'webcal:')}><Icon name='calendar' size={18} />{t('calendar.subscribe')}</a>
            <button className='btn' onClick={copy}><Icon name='copy' size={18} />{t('calendar.copy')}</button>
            <button className='ghost' onClick={reset}>{t('calendar.reset')}</button>
          </div>
          <p className='muted small'>{t('calendar.howto')}</p>
        </>
      )}
      {error && <p className='error'>{error}</p>}
    </div>
  )
}

// Apple Reminders has no API for web apps; a Shortcut fetches this link and adds each line as a
// reminder, and a second one posts dictated text back. Own secret, resettable.
function RemindersShortcut () {
  const [token, setToken] = useState(null)
  const [error, setError] = useState(null)
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (!show || token) return
    pb.send('/api/wz/shortcut/token', {}).then(r => setToken(r.token)).catch(err => setError(err.message))
  }, [show, token])
  const base = token && `${window.location.origin}/api/wz/shortcut/${token}/shopping`
  const whereUrl = token && `${window.location.origin}/api/wz/shortcut/${token}/where?q=`
  const copy = text => navigator.clipboard.writeText(text).then(() => showToast(t('share.copied')), err => setError(err.message))
  const reset = () => {
    if (!window.confirm(t('shortcut.resetConfirm'))) return
    pb.send('/api/wz/shortcut/token', { method: 'POST' }).then(r => setToken(r.token)).catch(err => setError(err.message))
  }
  const steps = (prefix, count) => <ol className='steps'>{Array.from({ length: count }, (_, n) => <li key={n}>{t(`${prefix}.${n + 1}`)}</li>)}</ol>
  return (
    <div className='panel form'>
      <p className='muted small'>{t('shortcut.intro')}</p>
      {!show && <button className='btn' onClick={() => setShow(true)}><Icon name='list' size={18} />{t('shortcut.show')}</button>}
      {base && (
        <>
          <h3>{t('shortcut.getTitle')}</h3>
          <input className='calendar-url' readOnly value={`${base}?new=1`} onFocus={e => e.target.select()} />
          <button className='btn primary' onClick={() => copy(`${base}?new=1`)}><Icon name='copy' size={18} />{t('shortcut.copyGet')}</button>
          {steps('shortcut.get', 6)}
          <h3>{t('shortcut.addTitle')}</h3>
          <input className='calendar-url' readOnly value={base} onFocus={e => e.target.select()} />
          <button className='btn' onClick={() => copy(base)}><Icon name='copy' size={18} />{t('shortcut.copyAdd')}</button>
          {steps('shortcut.add', 4)}
          <h3>{t('shortcut.whereTitle')}</h3>
          <input className='calendar-url' readOnly value={whereUrl} onFocus={e => e.target.select()} />
          <button className='btn' onClick={() => copy(whereUrl)}><Icon name='copy' size={18} />{t('shortcut.copyWhere')}</button>
          {steps('shortcut.where', 4)}
          <p className='muted small'>{t('shortcut.note')}</p>
          <button className='ghost' onClick={reset}>{t('shortcut.reset')}</button>
        </>
      )}
      {error && <p className='error'>{error}</p>}
    </div>
  )
}

function Menu ({ links }) {
  return (
      <ul className='menu'>
        {links.map(l => (
          <li key={l.to}>
            <Link to={l.to}>
              <Icon name={l.icon} />
              <span>{l.label}{l.hint && <small className='muted'> · {l.hint}</small>}</span>
              {l.count > 0 && <span className='count'>{l.count}</span>}
              <Icon name='chevron' size={16} />
            </Link>
          </li>
        ))}
      </ul>
  )
}

export default function MorePage () {
  const data = useData()
  const user = useAuthUser()
  const [error, setError] = useState(null)
  const [theme, setTheme] = useState(() => getPref('theme', 'auto'))
  const [zipping, setZipping] = useState(null) // { done, total } while exporting
  const [textSize, setTextSize] = useState(() => getPref('textSize', '100%'))
  const [sounds, setSounds] = useState(() => getPref('sounds', '0') === '1')
  const aiEnabled = useAiEnabled()
  const seasonal = data.tags.filter(tag => tag.seasonal).length

  // Grouped: things that may need doing, and tools for organising.
  const overviews = [
    { to: '/asks', icon: 'ask', label: t('asks.title'), count: data.openAsks.length },
    { to: '/essentials', icon: 'alert', label: t('essential.title'), count: data.essentials.length },
    { to: '/misses', icon: 'search', label: t('misses.title') },
    { to: '/quiz', icon: 'target', label: t('quiz.title') },
    { to: '/unsorted', icon: 'inbox', label: t('unsorted.title'), count: data.unsorted.length },
    { to: '/lent', icon: 'handoff', label: t('lent.title'), count: data.lent.length + data.borrowed.length },
    { to: '/claims', icon: 'calendar', label: t('claim.pageTitle'), count: data.claims.length },
    { to: '/shopping', icon: 'cart', label: t('shop.title'), count: data.lowStock.length + data.extras.length },
    { to: '/misplaced', icon: 'home', label: t('misplaced.title'), count: data.misplaced.length },
    { to: '/expiring', icon: 'alert', label: t('expiry.title'), count: data.expiring.length },
    { to: '/repairs', icon: 'wrench', label: t('repair.pageTitle'), count: data.repairs.length },
    { to: '/maintenance', icon: 'wrench', label: t('maint.title'), count: data.maintenanceDue.length },
    { to: '/missing', icon: 'search', label: t('missing.title'), count: data.missing.length },
    { to: '/checks', icon: 'check', label: t('checkDue.title') },
    { to: '/duplicates', icon: 'copy', label: t('dups.title'), count: data.duplicates.length },
    { to: '/search?f=nophoto', icon: 'camera', label: t('more.needsPhoto'), count: data.items.filter(i => !i.photos?.length).length }
  ]
  const tools = [
    // The wizard keeps what exists and only adds, so it doubles as "add rooms and storage spots later".
    { to: '/setup', icon: 'house', label: t('setup.start'), hint: t('more.setupHint') },
    { to: '/stock', icon: 'cart', label: t('stock.title'), count: data.staples.length },
    { to: '/batteries', icon: 'bolt', label: t('battery.title') },
    { to: '/stats', icon: 'chart', label: t('stats.title') },
    { to: '/declutter', icon: 'box', label: t('declutter.title') },
    { to: '/sale', icon: 'gift', label: t('sale.pageTitle'), count: data.forSale.length },
    { to: '/gone', icon: 'exit', label: t('gone.pageTitle') },
    { to: '/lists', icon: 'check', label: t('lists.title'), count: data.lists.length },
    { to: '/tags', icon: 'tag', label: t('tags.pageTitle'), count: data.tags.length, hint: seasonal ? t('tags.seasonalCount', { count: seasonal }) : null },
    { to: '/labels', icon: 'qr', label: t('labels.printQr') },
    { to: '/import', icon: 'file', label: t('import.title') },
    { to: '/trash', icon: 'trash', label: t('trash.title') }
  ]

  const setLanguage = async language => {
    setError(null)
    try {
      await pb.collection('users').update(user.id, { language })
      await pb.collection('users').authRefresh()
    } catch (err) {
      setError(err.message)
    }
  }

  const chooseTheme = value => {
    setTheme(value)
    setPref('theme', value)
    applyTheme(value)
  }

  const signOut = () => {
    navigator.serviceWorker?.controller?.postMessage('logout')
    pb.authStore.clear()
  }

  return (
    <div className='page'>
      <h1 className='page-title'>{t('tab.more')}</h1>
      <h2>{t('more.overviews')}</h2>
      <Menu links={overviews} />
      <h2>{t('more.organise')}</h2>
      <Menu links={tools} />

      {data.totalValue() > 0 && (
        <p className='muted'>{t('more.totalValue', { value: formatPrice(data.totalValue()) })}</p>
      )}

      <h2>{t('more.settings')}</h2>
      <div className='panel form'>
        <div className='segmented left' role='group' aria-label={t('more.language')}>
          <span className='muted small'>{t('more.language')}</span>
          <button className={!user?.language ? 'on' : ''} onClick={() => setLanguage('')}>{t('more.auto')}</button>
          {LANGUAGES.map(l => (
            <button key={l.code} className={user?.language === l.code ? 'on' : ''} onClick={() => setLanguage(l.code)}>{l.name}</button>
          ))}
        </div>
        <div className='segmented left' role='group' aria-label={t('more.theme')}>
          <span className='muted small'>{t('more.theme')}</span>
          {['auto', 'light', 'dark'].map(v => (
            <button key={v} className={theme === v ? 'on' : ''} onClick={() => chooseTheme(v)}>{t(`more.theme.${v}`)}</button>
          ))}
        </div>
        <div className='segmented left' role='group' aria-label={t('more.textSize')}>
          <span className='muted small'>{t('more.textSize')}</span>
          {[['100%', 'normal'], ['112.5%', 'large'], ['125%', 'larger']].map(([v, k]) => (
            <button key={v} className={textSize === v ? 'on' : ''} onClick={() => { setTextSize(v); setPref('textSize', v); document.documentElement.style.fontSize = v }}>{t(`more.text.${k}`)}</button>
          ))}
        </div>
        <label className='check'>
          <input type='checkbox' checked={sounds} onChange={e => { setSounds(e.target.checked); setPref('sounds', e.target.checked ? '1' : '0'); if (e.target.checked) play('done', true) }} />
          {t('more.sounds')}
        </label>
        {error && <p className='error'>{error}</p>}
      </div>

      <h2>{t('calendar.title')}</h2>
      <CalendarFeed />

      <h2>{t('shortcut.title')}</h2>
      <RemindersShortcut />

      <h2>{t('ai.settingsTitle')}</h2>
      <p className='muted small'>{aiEnabled ? t('ai.statusOn') : t('ai.statusOff')}</p>

      <h2>{t('more.export')}</h2>
      <div className='row'>
        <button className='btn' onClick={() => exportCsv(data)}><Icon name='download' />{t('more.exportCsv')}</button>
        <button className='btn' onClick={() => exportJson(data)}><Icon name='download' />{t('more.exportJson')}</button>
      </div>
      <button
        className='btn wide'
        disabled={!!zipping}
        onClick={() => {
          setError(null)
          setZipping({ done: 0, total: 0 })
          exportZip(data, (done, total) => setZipping({ done, total }))
            .catch(err => setError(err.message))
            .finally(() => setZipping(null))
        }}
      >
        <Icon name='download' />{zipping ? t('more.zipProgress', { done: zipping.done, total: zipping.total }) : t('more.exportZip')}
      </button>
      <p className='muted small'>{t('more.exportNote')} {t('more.backupNote')}</p>

      <h2>{t('members.title')}</h2>
      <Household />

      <h2>{t('more.account')}</h2>
      <div className='panel account'>
        <Link to='/me'><Avatar user={user} size={40} /></Link>
        <div>
          <strong>{displayName(user, '?')}</strong>
          <small className='muted'>{user?.email}</small>
        </div>
        <button className='btn' onClick={signOut}><Icon name='logout' size={18} />{t('more.signOut')}</button>
      </div>
    </div>
  )
}
