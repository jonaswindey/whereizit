import { useState } from 'react'
import Sheet from './Sheet.jsx'
import { formatDate, formatPrice } from '../lib/format.js'
import { t } from '../lib/i18n.jsx'

const addMonths = (ymd, months) => {
  const d = new Date(`${ymd}T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + months)
  return d.toISOString().slice(0, 10)
}

// What the AI read, field by field, to confirm before anything is saved. Fields the item already
// has are unticked by default so a blurry receipt can't overwrite good data.
export default function ReceiptSheet ({ item, result, busy, error, onApply, onClose }) {
  const warranty = result?.purchase_date && result.warranty_months ? addMonths(result.purchase_date, result.warranty_months) : ''
  const fields = result
    ? [
        result.purchase_date && { key: 'purchase_date', label: t('item.boughtOn'), value: result.purchase_date, shown: formatDate(result.purchase_date), had: item.purchase_date },
        result.price > 0 && { key: 'price', label: t('item.price'), value: result.price, shown: formatPrice(result.price), had: item.price },
        warranty && { key: 'warranty_until', label: t('item.warrantyUntil'), value: warranty, shown: `${formatDate(warranty)} (${t('receipt.months', { count: result.warranty_months })})`, had: item.warranty_until },
        result.brand && { key: 'brand', label: t('item.brand'), value: result.brand, shown: result.brand, had: item.brand },
        result.model && { key: 'model', label: t('item.model'), value: result.model, shown: result.model, had: item.model },
        result.serial && { key: 'serial', label: t('item.serial'), value: result.serial, shown: result.serial, had: item.serial }
      ].filter(Boolean)
    : []
  const [ticked, setTicked] = useState(null)
  const isOn = f => (ticked ?? Object.fromEntries(fields.map(x => [x.key, !x.had])))[f.key]
  const toggle = f => setTicked(prev => ({ ...(prev ?? Object.fromEntries(fields.map(x => [x.key, !x.had]))), [f.key]: !isOn(f) }))
  const [keep, setKeep] = useState(true)

  const apply = () => onApply(Object.fromEntries(fields.filter(isOn).map(f => [f.key, f.value])), keep)

  return (
    <Sheet title={t('receipt.title')} onClose={onClose}>
      <div className='panel form'>
        {busy && <p className='muted'>{t('receipt.reading')}</p>}
        {error && <p className='error'>{error}</p>}
        {result && !result.is_receipt && <p className='muted'>{t('receipt.notReceipt')}</p>}
        {result?.shop && <p className='muted small'>{t('receipt.shop', { shop: result.shop })}</p>}
        {result?.is_receipt && !fields.length && <p className='muted'>{t('receipt.nothing')}</p>}
        {fields.map(f => (
          <label key={f.key} className='check receipt-field'>
            <input type='checkbox' checked={!!isOn(f)} onChange={() => toggle(f)} />
            <span><small className='muted'>{f.label}</small><strong>{f.shown}</strong></span>
          </label>
        ))}
        {result?.is_receipt && (
          <label className='check'><input type='checkbox' checked={keep} onChange={e => setKeep(e.target.checked)} />{t('receipt.keep')}</label>
        )}
        <div className='row form-actions'>
          {result?.is_receipt && <button className='btn primary' onClick={apply}>{t('receipt.apply')}</button>}
          <button type='button' className='btn' onClick={onClose}>{t('action.cancel')}</button>
        </div>
      </div>
    </Sheet>
  )
}
