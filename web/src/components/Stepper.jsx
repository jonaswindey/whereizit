import { t } from '../lib/i18n.jsx'

export default function Stepper ({ value, onChange, suffix }) {
  return (
    <div className='row-side stepper'>
      <button type='button' className='btn' onClick={() => onChange(Math.max(0, value - 1))} aria-label={t('item.oneLess')}>−</button>
      <strong>{value}{suffix && <small className='muted'>{suffix}</small>}</strong>
      <button type='button' className='btn' onClick={() => onChange(value + 1)} aria-label={t('item.oneMore')}>+</button>
    </div>
  )
}
