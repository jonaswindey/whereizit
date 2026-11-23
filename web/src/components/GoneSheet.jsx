import { useState } from 'react'
import Sheet from './Sheet.jsx'
import { t } from '../lib/i18n.jsx'

export const GONE_REASONS = ['given', 'sold', 'thrown', 'other']

// Leaving the house is different from deleting: the item and its history stay findable under "Gone".
export default function GoneSheet ({ item, onSave, onClose }) {
  const [reason, setReason] = useState('given')
  const [note, setNote] = useState('')
  return (
    <Sheet title={t('gone.title', { name: item.name })} onClose={onClose}>
      <form className='panel form' onSubmit={e => { e.preventDefault(); onSave({ gone: new Date().toISOString(), gone_reason: reason, gone_note: note.trim() }) }}>
        <div className='chips'>
          {GONE_REASONS.map(r => <button key={r} type='button' className={`chip ${reason === r ? 'on' : ''}`} onClick={() => setReason(r)}>{t(`gone.reason.${r}`)}</button>)}
        </div>
        <input placeholder={t(`gone.notePlaceholder.${reason}`)} value={note} onChange={e => setNote(e.target.value)} />
        <div className='row form-actions'>
          <button className='btn primary'>{t('gone.save')}</button>
          <button type='button' className='btn' onClick={onClose}>{t('action.cancel')}</button>
        </div>
      </form>
    </Sheet>
  )
}
