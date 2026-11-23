import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import QRCode from 'qrcode'
import Icon from '../components/Icon.jsx'
import { useData } from '../lib/data.jsx'
import { pb } from '../lib/pb.js'
import { labelUrl, randomCode } from '../lib/codes.js'
import { t } from '../lib/i18n.jsx'

function LabelCell ({ label }) {
  const data = useData()
  const [src, setSrc] = useState(null)
  useEffect(() => {
    QRCode.toDataURL(labelUrl(label.code), { margin: 1, width: 320, errorCorrectionLevel: 'M' })
      .then(setSrc)
      .catch(err => console.error('qr:', err))
  }, [label.code])
  const place = label.place && data.placeById.get(label.place)
  return (
    <div className='label-cell'>
      {src && <img src={src} alt={`QR ${label.code}`} />}
      <div>
        <strong>{place ? place.name : 'whereizit'}</strong>
        <small>{place ? data.pathText(place.parent) : t('labels.scanToSetUp')}</small>
        <code>{label.code}</code>
      </div>
    </div>
  )
}

export default function LabelsPage () {
  const [params, setParams] = useSearchParams()
  const codesParam = params.get('codes') ?? ''
  const codes = codesParam.split(',').filter(Boolean)
  const [labels, setLabels] = useState([])
  const [count, setCount] = useState(24)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const codes = codesParam.split(',').filter(Boolean)
    if (!codes.length) return setLabels([])
    const filter = codes.map((c, i) => pb.filter(`code = {:c${i}}`, { [`c${i}`]: c })).join(' || ')
    pb.collection('labels').getFullList({ filter, sort: 'created' })
      .then(setLabels)
      .catch(err => setError(err.message))
  }, [codesParam])

  const generate = async e => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const created = await Promise.all(
        Array.from({ length: count }, () => pb.collection('labels').create({ code: randomCode() }))
      )
      setParams({ codes: created.map(l => l.code).join(',') })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const host = window.location.hostname
  const local = host === 'localhost' || host === '127.0.0.1'

  return (
    <div className='page'>
      <div className='no-print'>
        <h1 className='page-title'>{t('labels.title')}</h1>
        {local && (
          <p className='error'>
            {t('labels.localWarning', { host })}
          </p>
        )}
        {!codes.length && (
          <form className='panel form' onSubmit={generate}>
            <p>{t('labels.intro')}</p>
            <label className='inline'>{t('labels.howMany')}
              <input type='number' min='1' max='96' value={count} onChange={e => setCount(Number(e.target.value))} />
            </label>
            <button className='btn primary' disabled={busy}>{busy ? t('labels.generating') : t('labels.generate')}</button>
          </form>
        )}
        {labels.length > 0 && (
          <div className='row'>
            <button className='btn primary' onClick={() => window.print()}><Icon name='print' />{t('action.print')}</button>
            <button className='btn' onClick={() => setParams({})}>{t('labels.newBatch')}</button>
          </div>
        )}
        {error && <p className='error'>{error}</p>}
      </div>
      <div className='sheet'>
        {labels.map(l => <LabelCell key={l.id} label={l} />)}
      </div>
    </div>
  )
}
