import { useEffect, useRef } from 'react'
import Icon from './Icon.jsx'
import { t } from '../lib/i18n.jsx'

// Close when a press both starts and ends on the backdrop, on pointerup rather than click. On phones
// the click is unreliable both ways: the tap that opens a modal can deliver a stray click to the
// freshly rendered backdrop (closing pickers the instant they opened), and a real backdrop tap can
// have its click retargeted to the page underneath. The click that follows the close is swallowed
// so it can't press whatever was under the backdrop.
function swallowNextClick () {
  const stop = e => { e.stopPropagation(); e.preventDefault() }
  document.addEventListener('click', stop, { capture: true, once: true })
  setTimeout(() => document.removeEventListener('click', stop, true), 500)
}

export function useBackdrop (onClose) {
  const down = useRef(false)
  return {
    onPointerDown: e => { down.current = e.target === e.currentTarget },
    onPointerUp: e => {
      if (!down.current || e.target !== e.currentTarget) return
      down.current = false
      swallowNextClick()
      onClose()
    }
  }
}

// Bottom sheet for forms and menus: keeps the page in place instead of expanding forms inline.
export default function Sheet ({ title, onClose, children }) {
  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const backdrop = useBackdrop(onClose)
  return (
    <div className='modal-backdrop' {...backdrop}>
      <div className='modal sheet' role='dialog' aria-modal='true' aria-label={title} onClick={e => e.stopPropagation()}>
        <span className='sheet-handle' aria-hidden='true' />
        <div className='modal-head'>
          <h2>{title}</h2>
          <button className='ghost' onClick={onClose} aria-label={t('action.close')}><Icon name='close' /></button>
        </div>
        <div className='sheet-body'>{children}</div>
      </div>
    </div>
  )
}

// actions: [{ icon, label, onClick, danger, hint }]; falsy entries are skipped so callers can inline conditions.
export function ActionSheet ({ title, actions, onClose }) {
  return (
    <Sheet title={title} onClose={onClose}>
      <ul className='action-list'>
        {actions.filter(Boolean).map(a => (
          <li key={a.label}>
            <button className={a.danger ? 'danger' : ''} onClick={() => { onClose(); a.onClick() }}>
              <Icon name={a.icon} />
              <span>{a.label}{a.hint && <small className='muted'>{a.hint}</small>}</span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}
