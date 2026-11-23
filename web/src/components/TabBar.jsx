import { NavLink } from 'react-router'
import Icon from './Icon.jsx'
import { t } from '../lib/i18n.jsx'

const tabs = [
  { to: '/', icon: 'home', label: 'tab.places', end: true },
  { to: '/map', icon: 'map', label: 'tab.map' },
  { to: '/search', icon: 'search', label: 'tab.search' },
  { to: '/activity', icon: 'activity', label: 'tab.activity' },
  { to: '/more', icon: 'more', label: 'tab.more' }
]

export default function TabBar () {
  return (
    <nav className='tabbar' aria-label={t('tab.main')}>
      {tabs.map(tab => (
        <NavLink key={tab.to} to={tab.to} end={tab.end} className='tab'>
          <Icon name={tab.icon} size={22} />
          <span>{t(tab.label)}</span>
        </NavLink>
      ))}
    </nav>
  )
}
