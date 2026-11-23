import { useState } from 'react'
import { Link } from 'react-router'
import Icon from '../components/Icon.jsx'
import Thumb from '../components/Thumb.jsx'
import { useData } from '../lib/data.jsx'
import { useAuthUser, displayName } from '../lib/auth.js'
import { pb, thumbUrl } from '../lib/pb.js'
import { formatPrice, timeAgo } from '../lib/format.js'
import { shareListing } from '../lib/sale.js'
import { showToast } from '../lib/toast.js'
import { t } from '../lib/i18n.jsx'

// Everything up for sale, with a listing ready to share (text and photos) and "sold" in one tap.
// Shown to the whole family first: anyone can still say "I want to keep it".
export default function SalePage () {
  const data = useData()
  const user = useAuthUser()
  const kid = user?.role === 'kid'
  const [error, setError] = useState(null)
  const items = [...data.forSale].sort((a, b) => (a.for_sale || '').localeCompare(b.for_sale || ''))
  const total = items.reduce((n, i) => n + (i.sale_price || 0), 0)

  const run = async fn => {
    setError(null)
    try {
      await fn()
      await data.reload()
    } catch (err) {
      setError(err.message)
    }
  }
  const share = item => run(async () => {
    if (await shareListing(item) === 'copied') showToast(t('share.copied'))
  })
  const sold = item => run(async () => {
    await pb.collection('items').update(item.id, { gone: new Date().toISOString(), gone_reason: 'sold', gone_note: item.sale_price ? formatPrice(item.sale_price) : '', for_sale: '' })
    showToast(t('sale.soldDone', { name: item.name }), {
      label: t('action.undo'),
      run: () => pb.collection('items').update(item.id, { gone: '', gone_reason: '', gone_note: '', for_sale: item.for_sale }).then(data.reload)
    })
  })
  const keep = item => run(async () => {
    await pb.collection('items').update(item.id, { for_sale: '', owner: item.owner || displayName(user, '') })
    showToast(t('sale.keptDone', { name: item.name }))
  })

  return (
    <div className='page sale'>
      <h1 className='page-title'>{t('sale.pageTitle')}</h1>
      <p className='muted'>{t('sale.intro')}</p>
      {error && <p className='error'>{error}</p>}
      {!items.length && <p className='empty'>{t('sale.empty')}</p>}
      {total > 0 && <p className='sale-total'>{t('sale.total', { count: items.length, price: formatPrice(total) })}</p>}
      <ul className='ask-list'>
        {items.map(i => (
          <li key={i.id} className='ask-card sale-card'>
            <Link to={`/i/${i.id}`} className='ask-top'>
              <Thumb src={thumbUrl(i, i.photos?.[0])} name={i.name} />
              <span className='row-text'>
                <strong>{i.name}</strong>
                <span className='sale-price'>{i.sale_price ? formatPrice(i.sale_price) : t('sale.noPrice')}</span>
                <small className='muted'>{t('sale.since', { when: timeAgo(i.for_sale) })} · {data.whereText(i.place)}</small>
              </span>
            </Link>
            <div className='ask-actions'>
              <button className='btn' onClick={() => keep(i)}>{t('sale.keep')}</button>
              {!kid && <button className='btn share' onClick={() => share(i)}><Icon name='share' size={16} />{t('sale.share')}</button>}
              {!kid && <button className='btn primary' onClick={() => sold(i)}><Icon name='check' size={16} />{t('sale.sold')}</button>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
