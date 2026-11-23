import { useState } from 'react'
import Sheet from './Sheet.jsx'
import { formatPrice } from '../lib/format.js'
import { suggestPrice } from '../lib/sale.js'
import { t } from '../lib/i18n.jsx'

// Put something up for sale: an asking price (a suggestion when the purchase price is known).
export default function SaleSheet ({ item, claims = 0, onSave, onClose }) {
  const suggested = suggestPrice(item)
  const [price, setPrice] = useState(item.sale_price || suggested || '')
  return (
    <Sheet title={t('sale.title', { name: item.name })} onClose={onClose}>
      <form className='panel form' onSubmit={e => { e.preventDefault(); onSave({ for_sale: item.for_sale || new Date().toISOString(), sale_price: Number(price) || 0 }) }}>
        <label className='field'>{t('sale.price')}
          <input type='number' min='0' step='1' inputMode='decimal' value={price} onChange={e => setPrice(e.target.value)} placeholder={t('sale.pricePlaceholder')} />
        </label>
        {suggested && <p className='muted small'>{t('sale.suggested', { price: formatPrice(suggested), paid: formatPrice(item.price) })}</p>}
        <p className='muted small'>{t('sale.hint')}</p>
        {claims > 0 && <p className='warn small'>{t('claim.saleClash', { count: claims })}</p>}
        <div className='row form-actions'>
          <button className='btn primary'>{t(item.for_sale ? 'action.save' : 'sale.list')}</button>
          <button type='button' className='btn' onClick={onClose}>{t('action.cancel')}</button>
        </div>
      </form>
    </Sheet>
  )
}
