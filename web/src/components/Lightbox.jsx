import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'
import { t } from '../lib/i18n.jsx'

// Fullscreen photo viewer: swipe (or arrow keys) between photos, tap backdrop / Esc to close.
export default function Lightbox ({ images, start = 0, onClose }) {
  const track = useRef(null)
  const [index, setIndex] = useState(start)

  useLayoutEffect(() => {
    track.current.scrollLeft = start * track.current.clientWidth
  }, [start])

  useEffect(() => {
    const go = delta => track.current.scrollBy({ left: delta * track.current.clientWidth, behavior: 'smooth' })
    const onKey = e => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose])

  const onScroll = e => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))

  return (
    <div className='lightbox' role='dialog' aria-modal='true' onClick={onClose}>
      <div className='lightbox-track' ref={track} onScroll={onScroll}>
        {images.map(src => (
          <div className='lightbox-slide' key={src}>
            <img src={src} alt='' onClick={e => e.stopPropagation()} />
          </div>
        ))}
      </div>
      <button className='lightbox-close' onClick={onClose} aria-label={t('action.close')}><Icon name='close' size={24} /></button>
      {images.length > 1 && <span className='lightbox-count'>{index + 1} / {images.length}</span>}
    </div>
  )
}
