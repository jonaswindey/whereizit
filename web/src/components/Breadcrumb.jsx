import { Link } from 'react-router'
import Icon from './Icon.jsx'
import Thumb from './Thumb.jsx'
import { thumbUrl } from '../lib/pb.js'
import { useData } from '../lib/data.jsx'
import { t } from '../lib/i18n.jsx'

export default function Breadcrumb ({ placeId, includeLast = false }) {
  const data = useData()
  const trail = data.path(placeId)
  const shown = includeLast ? trail : trail.slice(0, -1)
  // A lone home icon adds nothing next to the header's back button.
  if (!shown.length) return null
  return (
    <nav className='crumbs' aria-label={t('item.where')}>
      <Link to='/' className='crumb'><Icon name='home' size={16} /></Link>
      {shown.map(p => (
        <span key={p.id} className='crumb-wrap'>
          <Icon name='chevron' size={14} />
          <Link to={`/p/${p.id}`} className='crumb'>
            <Thumb src={thumbUrl(p, p.photo)} name={p.name} className='mini' />
            {p.name}
          </Link>
        </span>
      ))}
    </nav>
  )
}
