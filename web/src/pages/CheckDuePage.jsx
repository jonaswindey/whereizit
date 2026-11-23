import { Link } from 'react-router'
import Icon from '../components/Icon.jsx'
import { useData } from '../lib/data.jsx'
import { plural, timeAgo } from '../lib/format.js'
import { t } from '../lib/i18n.jsx'

// Stocktake planner: places whose contents were checked longest ago (or never) come first.
export default function CheckDuePage () {
  const data = useData()
  return (
    <div className='page'>
      <h1 className='page-title'>{t('checkDue.title')}</h1>
      <p className='muted'>{t('checkDue.intro')}</p>
      {!data.checkDue.length && <p className='empty'>{t('checkDue.empty')}</p>}
      <ul className='rows'>
        {data.checkDue.map(({ place, count, checked }) => (
          <li key={place.id} className='row-card'>
            <Link to={`/p/${place.id}`} className='row-main'>
              <div>
                <strong>{place.name}</strong>
                <small>{[data.pathText(place.parent), plural(count, 'item')].filter(Boolean).join(' · ')}</small>
              </div>
            </Link>
            <div className='row-side'>
              <small className='muted'>{checked ? t('check.lastChecked', { when: timeAgo(checked) }) : t('check.never')}</small>
              <Link className='btn' to={`/check/${place.id}`}><Icon name='check' size={18} />{t('checkDue.start')}</Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
