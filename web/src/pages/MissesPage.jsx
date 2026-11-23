import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import Icon from '../components/Icon.jsx'
import { useAuthUser, displayName } from '../lib/auth.js'
import { useMembers } from '../lib/members.js'
import { pb } from '../lib/pb.js'
import { timeAgo } from '../lib/format.js'
import { useItemSearch } from './SearchPage.jsx'
import { t } from '../lib/i18n.jsx'

// What the house searched for (in the app or via Siri) and didn't find: the gaps in the inventory.
// Once something by that name exists it drops off by itself.
export default function MissesPage () {
  const user = useAuthUser()
  const members = useMembers()
  const fuse = useItemSearch()
  const [misses, setMisses] = useState(null)
  const [error, setError] = useState(null)
  const kid = user?.role === 'kid'

  const load = () => pb.collection('misses').getFullList({ sort: '-last' })
    .then(setMisses)
    .catch(err => setError(err.message))
  useEffect(() => { load() }, [])

  const drop = async m => {
    try {
      await pb.collection('misses').delete(m.id)
      setMisses(list => list.filter(x => x.id !== m.id))
    } catch (err) {
      setError(err.message)
    }
  }

  const open = (misses ?? []).filter(m => !fuse.search(m.text).some(r => r.item.kind === 'item'))
  const nameOf = id => displayName(members.find(m => m.id === id), '?')

  return (
    <div className='page misses'>
      <h1 className='page-title'>{t('misses.title')}</h1>
      <p className='muted'>{t('misses.intro')}</p>
      {error && <p className='error'>{error}</p>}
      {misses && !open.length && <p className='empty'>{t('misses.none')}</p>}
      <ul className='rows'>
        {open.map(m => (
          <li key={m.id} className='row-card miss'>
            <span className='row-text'>
              <strong>{m.text}</strong>
              <small className='muted'>
                {t('misses.count', { count: m.count })} · {t('misses.last', { name: nameOf(m.user), when: timeAgo(m.last) })}{m.via === 'siri' ? ` · ${t('misses.viaSiri')}` : ''}
              </small>
            </span>
            {!kid && <button className='ghost' onClick={() => drop(m)} aria-label={t('action.remove')}><Icon name='close' size={18} /></button>}
            <div className='miss-actions'>
              <Link className='btn primary' to={`/add/unsorted?name=${encodeURIComponent(m.text)}`}><Icon name='plus' size={16} />{t('misses.add')}</Link>
              <Link className='btn' to={`/asks?text=${encodeURIComponent(m.text)}`}><Icon name='ask' size={16} />{t('asks.askHouse')}</Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
