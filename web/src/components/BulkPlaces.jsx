import { useState } from 'react'
import { t } from '../lib/i18n.jsx'

// Cataloguing a kitchen means "Drawer 1" to "Drawer 6" and a few cupboards: type them all at once,
// one per line, or let the numbering helper fill the list.
export default function BulkPlaces ({ onSubmit, onCancel }) {
  const [text, setText] = useState('')
  const [prefix, setPrefix] = useState('')
  const [count, setCount] = useState(4)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const names = text.split('\n').map(s => s.trim()).filter(Boolean)

  const fill = () => {
    const base = prefix.trim()
    if (!base) return
    const lines = Array.from({ length: Math.max(1, Math.min(50, Number(count) || 1)) }, (_, i) => `${base} ${i + 1}`)
    setText(prev => [...prev.split('\n').filter(s => s.trim()), ...lines].join('\n'))
  }

  const submit = async e => {
    e.preventDefault()
    if (!names.length) return
    setBusy(true)
    setError(null)
    try {
      await onSubmit(names)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form className='panel form' onSubmit={submit}>
      <textarea rows={6} value={text} onChange={e => setText(e.target.value)} placeholder={t('bulkPlaces.placeholder')} autoFocus />
      <div className='bulk-number'>
        <input value={prefix} onChange={e => setPrefix(e.target.value)} placeholder={t('bulkPlaces.prefix')} />
        <input type='number' min='1' max='50' value={count} onChange={e => setCount(e.target.value)} aria-label={t('bulkPlaces.count')} />
        <button type='button' className='btn' onClick={fill} disabled={!prefix.trim()}>{t('bulkPlaces.fill')}</button>
      </div>
      {error && <p className='error'>{error}</p>}
      <div className='row form-actions'>
        <button className='btn primary' disabled={busy || !names.length}>{t('bulkPlaces.submit', { count: names.length })}</button>
        <button type='button' className='btn' onClick={onCancel}>{t('action.cancel')}</button>
      </div>
    </form>
  )
}
