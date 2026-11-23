import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import Avatar from '../components/Avatar.jsx'
import Icon from '../components/Icon.jsx'
import PhotoButton from '../components/PhotoButton.jsx'
import { useData } from '../lib/data.jsx'
import { pb } from '../lib/pb.js'
import { displayName, useAuthUser } from '../lib/auth.js'
import { t } from '../lib/i18n.jsx'

const readHunt = id => {
  try {
    return JSON.parse(localStorage.getItem(`whereizit.hunt.${id}`)) ?? { points: 0, found: 0 }
  } catch {
    return { points: 0, found: 0 }
  }
}

// Milestones are quiet on purpose: earned ones get colour, the next one says how far to go.
const BADGES = [
  { key: 'first', icon: 'camera', need: s => [s.added, 1] },
  { key: 'ten', icon: 'layers', need: s => [s.added, 10] },
  { key: 'fifty', icon: 'box', need: s => [s.added, 50] },
  { key: 'hundred', icon: 'trophy', need: s => [s.added, 100] },
  { key: 'room', icon: 'house', need: s => [s.rooms, 1] },
  { key: 'tracker', icon: 'target', need: s => [s.found, 10] },
  { key: 'week', icon: 'bolt', need: s => [s.week, 25] }
]

export default function MePage () {
  const data = useData()
  const user = useAuthUser()
  const [counts, setCounts] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) return
    const since = new Date(Date.now() - 7 * 86400000).toISOString().replace('T', ' ')
    const count = filter => pb.collection('activity').getList(1, 1, { filter: pb.filter(filter, { me: user.id, since }) }).then(r => r.totalItems)
    Promise.all([
      count("user = {:me} && action = 'created' && kind = 'item'"),
      count("user = {:me} && action = 'created' && kind = 'item' && created >= {:since}"),
      count("user = {:me} && action = 'moved'")
    ]).then(([added, week, moved]) => setCounts({ added, week, moved })).catch(err => setError(err.message))
  }, [user])

  const setAvatar = async file => {
    setError(null)
    try {
      await pb.collection('users').update(user.id, { avatar: file })
      await pb.collection('users').authRefresh()
    } catch (err) {
      setError(err.message)
    }
  }

  const hunt = readHunt(user?.id)
  const rooms = data.missionRooms.filter(r => r.assignee === user?.id && data.progress(r.id).pct === 100).length
  const stats = { ...(counts ?? { added: 0, week: 0, moved: 0 }), rooms, found: hunt.found }

  return (
    <div className='page me'>
      <div className='me-head'>
        <PhotoButton onPhoto={setAvatar} className='me-avatar'>
          <Avatar user={user} size={84} />
          <span className='me-avatar-edit'><Icon name='camera' size={14} /></span>
        </PhotoButton>
        <h1 className='page-title'>{displayName(user, '')}</h1>
        {user?.role === 'kid' && <span className='pill'>{t('members.kidShort')}</span>}
      </div>
      {error && <p className='error'>{error}</p>}

      <div className='stat-tiles'>
        <div className='stat'><strong>{stats.added}</strong><span>{t('me.added')}</span></div>
        <div className='stat'><strong>{stats.week}</strong><span>{t('me.thisWeek')}</span></div>
        <div className='stat'><strong>{stats.rooms}</strong><span>{t('me.rooms')}</span></div>
        <div className='stat'><strong>{hunt.points}</strong><span>{t('me.huntPoints')}</span></div>
      </div>

      <h2>{t('me.badges')}</h2>
      <div className='badges-grid'>
        {BADGES.map(b => {
          const [have, need] = b.need(stats)
          const earned = have >= need
          return (
            <div key={b.key} className={`badge-tile ${earned ? 'earned' : ''}`}>
              <span className='badge-icon'><Icon name={b.icon} size={22} /></span>
              <strong>{t(`me.badge.${b.key}`)}</strong>
              <small>{earned ? t('me.earned') : t('me.toGo', { count: need - have })}</small>
            </div>
          )
        })}
      </div>
      <p className='muted small center-text'><Link to='/missions'>{t('missions.title')}</Link> · <Link to='/hunt'>{t('hunt.title')}</Link></p>
    </div>
  )
}
