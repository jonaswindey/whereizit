import { ItemRow } from '../components/Cards.jsx'
import { useData } from '../lib/data.jsx'
import { formatDate } from '../lib/format.js'
import { t } from '../lib/i18n.jsx'

export default function ExpiringPage () {
  const data = useData()
  return (
    <div className='page'>
      <h1 className='page-title'>{t('expiry.title')}</h1>
      <p className='muted'>{t('expiry.intro')}</p>
      {!data.expiring.length && <p className='empty'>{t('expiry.empty')}</p>}
      <ul className='rows'>
        {data.expiring.map(i => {
          const state = data.expiryState(i)
          return (
            <ItemRow key={i.id} item={i}>
              <div className='row-side'>
                <span className={`badge ${state === 'expired' ? 'low' : 'warn'}`}>{t(state === 'expired' ? 'expiry.expiredOn' : 'expiry.expiresOn', { date: formatDate(i.expires) })}</span>
              </div>
            </ItemRow>
          )
        })}
      </ul>
    </div>
  )
}
