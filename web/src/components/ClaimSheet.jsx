import { useState } from 'react'
import Sheet from './Sheet.jsx'
import { displayName } from '../lib/auth.js'
import { claimWhen, conflicts, inDays, nextSaturday, overlaps, today } from '../lib/claims.js'
import { t } from '../lib/i18n.jsx'

// "I need it on…": a day (or a few) and what for. Shows who else already claimed it, and what would
// get in the way (lent out, for sale, missing), before it is saved rather than on the day itself.
export default function ClaimSheet ({ item, claims, members, onSave, onClose }) {
  const [start, setStart] = useState(inDays(1))
  const [end, setEnd] = useState('')
  const [note, setNote] = useState('')
  const to = end > start ? end : start
  const clash = claims.filter(c => overlaps(c, start, to))
  const warnings = conflicts(item, start)
  const who = id => displayName(members.find(m => m.id === id), '?')
  const shortcuts = [[today(), 'claim.today'], [inDays(1), 'claim.tomorrow'], [nextSaturday(), 'claim.saturday']]
    .filter(([day], n, all) => all.findIndex(([d]) => d === day) === n)

  return (
    <Sheet title={t('claim.title', { name: item.name })} onClose={onClose}>
      <form className='panel form' onSubmit={e => { e.preventDefault(); onSave({ start, end: end > start ? end : '', note: note.trim() }) }}>
        <div className='chips'>
          {shortcuts.map(([day, key]) => <button key={day} type='button' className={`chip ${start === day ? 'on' : ''}`} onClick={() => setStart(day)}>{t(key)}</button>)}
        </div>
        <div className='two'>
          <label className='field'>{t('claim.from')}<input type='date' required min={today()} value={start} onChange={e => setStart(e.target.value)} /></label>
          <label className='field'>{t('claim.until')}<input type='date' min={start} value={end} onChange={e => setEnd(e.target.value)} /></label>
        </div>
        <label className='field'>{t('claim.note')}<input value={note} maxLength={120} onChange={e => setNote(e.target.value)} placeholder={t('claim.notePlaceholder')} /></label>
        {clash.map(c => <p key={c.id} className='warn small'>{t('claim.clash', { name: who(c.user), when: claimWhen(c) })}</p>)}
        {warnings.map(w => <p key={w} className='warn small'>{w}</p>)}
        <div className='row form-actions'>
          <button className='btn primary'>{t('claim.save')}</button>
          <button type='button' className='btn' onClick={onClose}>{t('action.cancel')}</button>
        </div>
      </form>
    </Sheet>
  )
}
