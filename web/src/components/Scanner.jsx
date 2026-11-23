import { useEffect, useRef, useState } from 'react'
import Sheet from './Sheet.jsx'
import { getDetector } from '../lib/barcode.js'
import { t } from '../lib/i18n.jsx'

// Live camera with a barcode check a few times a second. Stops the camera as soon as a code is read
// or the sheet closes (iOS keeps the green camera dot on otherwise).
export default function Scanner ({ title, onCode, onClose }) {
  const video = useRef(null)
  const [error, setError] = useState(null)
  const [manual, setManual] = useState('')
  // Latest callback without restarting the camera on every parent render.
  const onCodeRef = useRef(onCode)
  onCodeRef.current = onCode

  useEffect(() => {
    let stream
    let timer
    let stopped = false
    const stop = () => {
      stopped = true
      clearTimeout(timer)
      stream?.getTracks().forEach(tr => tr.stop())
    }
    ;(async () => {
      try {
        const detector = await getDetector()
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        if (stopped) return stop()
        video.current.srcObject = stream
        await video.current.play()
        const tick = async () => {
          if (stopped) return
          try {
            const codes = await detector.detect(video.current)
            if (codes[0]?.rawValue) {
              navigator.vibrate?.(60)
              stop()
              return onCodeRef.current(codes[0].rawValue)
            }
          } catch (err) {
            console.warn('detect:', err.message)
          }
          timer = setTimeout(tick, 250)
        }
        tick()
      } catch (err) {
        setError(err.name === 'NotAllowedError' ? t('scan.denied') : err.message)
      }
    })()
    return stop
  }, [])

  return (
    <Sheet title={title ?? t('scan.title')} onClose={onClose}>
      <div className='scanner'>
        <video ref={video} playsInline muted />
        <span className='scan-frame' />
      </div>
      {error && <p className='error'>{error}</p>}
      <p className='muted small'>{t('scan.hint')}</p>
      <form className='row' onSubmit={e => { e.preventDefault(); manual.trim() && onCode(manual.trim()) }}>
        <input inputMode='numeric' placeholder={t('scan.manual')} value={manual} onChange={e => setManual(e.target.value)} />
        <button className='btn' disabled={!manual.trim()}>{t('scan.use')}</button>
      </form>
    </Sheet>
  )
}
