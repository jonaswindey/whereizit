import { useEffect, useState } from 'react'
import Icon from './Icon.jsx'
import Sheet from './Sheet.jsx'
import { pb } from '../lib/pb.js'
import { labelUrl, randomCode } from '../lib/codes.js'
import { showToast } from '../lib/toast.js'
import { t } from '../lib/i18n.jsx'

// The sticker holds the same /l/<code> link as the QR label, so it keeps working if the label is
// later re-linked to another place. Phones open the link natively when held against the sticker.
// Writing from the browser only exists in Chrome on Android (Web NFC); iPhones need an NFC app.
const canWrite = typeof window !== 'undefined' && 'NDEFReader' in window

export default function NfcSheet ({ place, onClose }) {
  const [url, setUrl] = useState(null)
  const [state, setState] = useState(null) // null | 'waiting' | 'done'
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      const existing = await pb.collection('labels').getList(1, 1, { filter: pb.filter('place = {:id}', { id: place.id }) })
      const label = existing.items[0] ?? await pb.collection('labels').create({ code: randomCode(), place: place.id })
      if (active) setUrl(labelUrl(label.code))
    })().catch(err => active && setError(err.message))
    return () => { active = false }
  }, [place.id])

  const copy = () => navigator.clipboard.writeText(url).then(() => showToast(t('share.copied')), err => setError(err.message))

  const write = async () => {
    setError(null)
    setState('waiting')
    try {
      await new window.NDEFReader().write({ records: [{ recordType: 'url', data: url }] })
      setState('done')
    } catch (err) {
      setState(null)
      setError(err.name === 'NotAllowedError' ? t('nfc.notAllowed') : err.message)
    }
  }

  return (
    <Sheet title={t('nfc.title', { name: place.name })} onClose={onClose}>
      <div className='panel form nfc'>
        <p className='muted small'>{t('nfc.intro')}</p>
        {!url && !error && <p className='muted'>{t('common.loading')}</p>}
        {url && canWrite && (
          <>
            {state === 'done'
              ? <p className='nfc-done'><Icon name='check' />{t('nfc.written')}</p>
              : (
                <button className='btn primary big' onClick={write} disabled={state === 'waiting'}>
                  <Icon name='nfc' />{state === 'waiting' ? t('nfc.holdNow') : t('nfc.write')}
                </button>
                )}
          </>
        )}
        {url && !canWrite && (
          <ol className='nfc-steps'>
            <li>{t('nfc.step1')}</li>
            <li>{t('nfc.step2')}</li>
            <li>{t('nfc.step3')}</li>
          </ol>
        )}
        {url && (
          <>
            <input className='calendar-url' readOnly value={url} onFocus={e => e.target.select()} />
            <div className='row'>
              <button className={`btn ${canWrite ? '' : 'primary'}`} onClick={copy}><Icon name='copy' size={18} />{t('nfc.copy')}</button>
            </div>
            <p className='muted small'>{t('nfc.tips')}</p>
          </>
        )}
        {error && <p className='error'>{error}</p>}
      </div>
    </Sheet>
  )
}
