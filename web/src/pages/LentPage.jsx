import { useState } from 'react'
import { useNavigate } from 'react-router'
import { displayName, useAuthUser } from '../lib/auth.js'
import { useMembers } from '../lib/members.js'
import { showToast } from '../lib/toast.js'
import { ItemRow } from '../components/Cards.jsx'
import { useData } from '../lib/data.jsx'
import { pb } from '../lib/pb.js'
import { formatDate, timeAgo } from '../lib/format.js'
import { t } from '../lib/i18n.jsx'

// Grouped per person, so "what does Tom still have?" is one glance; overdue people first.
export default function LentPage () {
  const data = useData()
  const [error, setError] = useState(null)
  const byPerson = new Map()
  for (const i of data.lent) {
    if (!byPerson.has(i.lent_to)) byPerson.set(i.lent_to, [])
    byPerson.get(i.lent_to).push(i)
  }
  const groups = [...byPerson.entries()]
    .map(([person, items]) => ({ person, items: items.sort((a, b) => (a.lent_at || '').localeCompare(b.lent_at || '')), overdue: items.some(data.isOverdue) }))
    .sort((a, b) => b.overdue - a.overdue || a.person.localeCompare(b.person))

  const giveBack = async items => {
    setError(null)
    try {
      await Promise.all(items.map(i => pb.collection('items').update(i.id, { lent_to: '', lent_at: '', lent_due: '' })))
      await data.reload()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className='page'>
      <h1 className='page-title'>{t('lent.title')}</h1>
      {error && <p className='error'>{error}</p>}
      {!groups.length && <p className='empty'>{t('lent.empty')}</p>}
      <Carried />
      {groups.map(g => (
        <section key={g.person}>
          <h2>
            {g.person} <span className='count'>{g.items.length}</span>
            {g.items.length > 1 && <button className='chip push' onClick={() => giveBack(g.items)}>{t('lent.allReturned')}</button>}
          </h2>
          <ul className='rows'>
            {g.items.map(i => (
              <ItemRow key={i.id} item={i}>
                <div className='row-side'>
                  <small className={data.isOverdue(i) ? 'overdue' : 'muted'}>
                    {i.lent_due
                      ? t(data.isOverdue(i) ? 'lend.overdueSince' : 'lend.dueOn', { date: formatDate(i.lent_due) })
                      : i.lent_at && timeAgo(i.lent_at)}
                  </small>
                  <button className='btn' onClick={() => giveBack([i])}>{t('lend.returned')}</button>
                </div>
              </ItemRow>
            ))}
          </ul>
        </section>
      ))}
      <Borrowed />
    </div>
  )
}

// The other direction: things in the house that belong to someone else, oldest due first.
function Borrowed () {
  const data = useData()
  const navigate = useNavigate()
  const kid = useAuthUser()?.role === 'kid'
  const [error, setError] = useState(null)
  if (!data.borrowed.length) return <p className='muted small borrow-hint'>{t('borrow.hint')}</p>
  const items = [...data.borrowed].sort((a, b) => (a.borrowed_due || '9').localeCompare(b.borrowed_due || '9'))
  const giveBack = async i => {
    setError(null)
    try {
      await pb.collection('items').update(i.id, { gone: new Date().toISOString(), gone_reason: 'returned', gone_note: i.borrowed_from })
      await data.reload()
      showToast(t('gone.done', { name: i.name }), { label: t('action.undo'), run: () => pb.collection('items').update(i.id, { gone: '', gone_reason: '', gone_note: '' }).then(data.reload) })
    } catch (err) {
      setError(err.message)
    }
  }
  return (
    <section>
      <h2>{t('borrow.title')} <span className='count'>{items.length}</span></h2>
      {error && <p className='error'>{error}</p>}
      <ul className='rows'>
        {items.map(i => (
          <ItemRow key={i.id} item={i}>
            <div className='row-side'>
              <small className={data.isBackDue(i) ? 'overdue' : 'muted'}>
                {t('borrow.fromShort', { name: i.borrowed_from })}
                {i.borrowed_due && <> · {t(data.isBackDue(i) ? 'borrow.overdueSince' : 'borrow.dueOn', { date: formatDate(i.borrowed_due) })}</>}
              </small>
              {kid
                ? <button className='btn' onClick={() => navigate(`/i/${i.id}`)}>{t('action.open')}</button>
                : <button className='btn' onClick={() => giveBack(i)}>{t('borrow.returned')}</button>}
            </div>
          </ItemRow>
        ))}
      </ul>
    </section>
  )
}

// Inside the house: "I'm taking it" (to the garden, to school, to a bedroom). Oldest first, because
// those are the ones that never came back.
function Carried () {
  const data = useData()
  const members = useMembers()
  const me = useAuthUser()
  const [error, setError] = useState(null)
  if (!data.carried.length) return null
  const items = [...data.carried].sort((a, b) => (a.with_since || '').localeCompare(b.with_since || ''))
  const long = new Set(data.carriedLong.map(i => i.id))
  const nameOf = id => (id === me?.id ? t('asks.you') : displayName(members.find(m => m.id === id), '?'))
  const putBack = async i => {
    setError(null)
    try {
      await pb.collection('items').update(i.id, { with_user: '', with_since: '' })
      await data.reload()
      showToast(t('with.putBackDone', { name: i.name, where: data.whereText(i.place) }))
    } catch (err) {
      setError(err.message)
    }
  }
  return (
    <section>
      <h2>{t('with.pageTitle')} <span className='count'>{items.length}</span></h2>
      {error && <p className='error'>{error}</p>}
      <ul className='rows'>
        {items.map(i => (
          <ItemRow key={i.id} item={i}>
            <div className='row-side'>
              <small className={long.has(i.id) ? 'overdue' : 'muted'}>{t('with.byShort', { name: nameOf(i.with_user), when: timeAgo(i.with_since) })}</small>
              <button className='btn' onClick={() => putBack(i)}>{t('with.putBack')}</button>
            </div>
          </ItemRow>
        ))}
      </ul>
    </section>
  )
}
