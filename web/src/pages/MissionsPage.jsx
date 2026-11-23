import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import Icon from '../components/Icon.jsx'
import Avatar from '../components/Avatar.jsx'
import { ProgressBar, ProgressRing, RoomBadge } from '../components/Room.jsx'
import { useData } from '../lib/data.jsx'
import { pb } from '../lib/pb.js'
import { displayName, useAuthUser } from '../lib/auth.js'
import { placeColor } from '../lib/rooms.js'
import { t } from '../lib/i18n.jsx'

// Who does which room. Each room shows how many of its cupboards are done; "Start" opens a sweep
// at the first cupboard that isn't.
export default function MissionsPage () {
  const data = useData()
  const user = useAuthUser()
  const navigate = useNavigate()
  const [members, setMembers] = useState([])
  const [mine, setMine] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    pb.collection('users').getFullList({ sort: 'name' }).then(setMembers).catch(err => setError(err.message))
  }, [])

  const all = data.progress(null)
  const rooms = data.missionRooms
    .filter(r => !mine || r.assignee === user?.id)
    .map(r => ({ room: r, prog: data.progress(r.id) }))
    .sort((a, b) => (a.prog.pct === 100) - (b.prog.pct === 100) || data.pathText(a.room.id).localeCompare(data.pathText(b.room.id)))

  const assign = async (room, assignee) => {
    setError(null)
    try {
      await pb.collection('places').update(room.id, { assignee })
      await data.reload()
    } catch (err) {
      setError(err.message)
    }
  }

  const start = room => {
    const spot = data.childrenOf(room.id).find(c => !c.done)
    navigate(spot ? `/sweep/${spot.id}` : `/p/${room.id}`)
  }

  const perPerson = members.map(m => {
    const theirs = data.missionRooms.filter(r => r.assignee === m.id)
    const done = theirs.filter(r => data.progress(r.id).pct === 100).length
    return { m, count: theirs.length, done }
  }).filter(x => x.count)

  return (
    <div className='page missions'>
      <h1 className='page-title'>{t('missions.title')}</h1>
      <div className='panel household-progress'>
        <div className='hp-top'>
          <strong className='display'>{t('missions.house', { pct: all.pct })}</strong>
          <span className='muted small'>{t('progress.label', all)}</span>
        </div>
        <ProgressBar pct={all.pct} />
        {perPerson.length > 0 && (
          <div className='people'>
            {perPerson.map(({ m, count, done }) => (
              <span key={m.id} className='person'>
                <Avatar user={m} size={26} />
                {displayName(m, '?')} <small className='muted'>{t('missions.personDone', { done, count })}</small>
              </span>
            ))}
          </div>
        )}
      </div>

      {!data.missionRooms.length && (
        <div className='empty'>
          <p>{t('missions.none')}</p>
          <Link className='btn primary' to='/setup'><Icon name='house' size={18} />{t('setup.start')}</Link>
        </div>
      )}
      {data.missionRooms.some(r => r.assignee === user?.id) && (
        <div className='segmented left'>
          <button className={!mine ? 'on' : ''} onClick={() => setMine(false)}>{t('missions.all')}</button>
          <button className={mine ? 'on' : ''} onClick={() => setMine(true)}>{t('missions.mine')}</button>
        </div>
      )}
      {error && <p className='error'>{error}</p>}

      <ul className='mission-list'>
        {rooms.map(({ room, prog }) => (
          <li key={room.id} className={`mission ${prog.pct === 100 ? 'complete' : ''}`} style={{ '--room': placeColor(data, room) }}>
            <Link to={`/p/${room.id}`} className='mission-main'>
              <RoomBadge place={room} size={46} />
              <span className='row-text'>
                <strong>{room.name}</strong>
                <small>{[data.placeById.get(room.parent)?.name, t('progress.label', prog)].filter(Boolean).join(' · ')}</small>
              </span>
              <ProgressRing pct={prog.pct} color={placeColor(data, room)} label={t('progress.label', prog)} size={40} />
            </Link>
            <div className='mission-foot'>
              <select value={room.assignee || ''} onChange={e => assign(room, e.target.value)} aria-label={t('missions.who')}>
                <option value=''>{t('missions.nobody')}</option>
                {members.map(m => <option key={m.id} value={m.id}>{displayName(m, '?')}</option>)}
              </select>
              {prog.pct < 100
                ? <button className='btn primary' onClick={() => start(room)}><Icon name='camera' size={18} />{t('missions.start')}</button>
                : <span className='done-label'><Icon name='trophy' size={18} />{t('missions.complete')}</span>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
