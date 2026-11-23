import { useEffect, useState } from 'react'
import PhotoButton from './PhotoButton.jsx'
import Icon from './Icon.jsx'
import { t } from '../lib/i18n.jsx'

export default function PlaceForm ({ initial = {}, submitLabel, onSubmit, onCancel, children }) {
  const [name, setName] = useState(initial.name ?? '')
  const [note, setNote] = useState(initial.note ?? '')
  const [photo, setPhoto] = useState(null)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!photo) return setPreview(null)
    const url = URL.createObjectURL(photo)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  const submit = async e => {
    e.preventDefault()
    if (!name.trim()) return setError(t('form.needName'))
    setBusy(true)
    setError(null)
    try {
      await onSubmit({ name: name.trim(), note: note.trim(), ...(photo && { photo }) })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form className='panel form' onSubmit={submit}>
      <PhotoButton onPhoto={setPhoto} className='photo-drop'>
        {preview
          ? <img src={preview} alt='' />
          : <span><Icon name='camera' size={28} />{initial.name ? t('form.replacePhoto') : t('form.addPhoto')}</span>}
      </PhotoButton>
      <input autoFocus placeholder={t('place.namePlaceholder')} value={name} onChange={e => setName(e.target.value)} />
      <textarea placeholder={t('form.noteOptional')} rows={2} value={note} onChange={e => setNote(e.target.value)} />
      {children}
      {error && <p className='error'>{error}</p>}
      <div className='row form-actions'>
        <button type='submit' className='btn primary' disabled={busy}>{busy ? t('action.saving') : submitLabel}</button>
        {onCancel && <button type='button' className='btn' onClick={onCancel}>{t('action.cancel')}</button>}
      </div>
    </form>
  )
}
