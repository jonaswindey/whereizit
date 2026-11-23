import { useState } from 'react'
import { ItemRow } from '../components/Cards.jsx'
import { useData } from '../lib/data.jsx'
import { displayName, useAuthUser } from '../lib/auth.js'
import { useMembers } from '../lib/members.js'
import { pb } from '../lib/pb.js'
import { claimStart, claimWhen, conflicts, dayLabel, today } from '../lib/claims.js'
import { t } from '../lib/i18n.jsx'

// Everything someone said they need, by day: what the family has planned for the shared things.
export default function ClaimsPage () {
  const data = useData()
  const user = useAuthUser()
  const members = useMembers()
  const kid = user?.role === 'kid'
  const [error, setError] = useState(null)
  const who = id => (id === user?.id ? t('claim.me') : displayName(members.find(m => m.id === id), '?'))

  const days = new Map()
  for (const c of data.claims) {
    const day = claimStart(c) < today() ? today() : claimStart(c)
    if (!days.has(day)) days.set(day, [])
    days.get(day).push(c)
  }

  const drop = async c => {
    setError(null)
    try {
      await pb.collection('reservations').delete(c.id)
      await data.reload()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className='page'>
      <h1 className='page-title'>{t('claim.pageTitle')}</h1>
      <p className='muted'>{t('claim.intro')}</p>
      {error && <p className='error'>{error}</p>}
      {!data.claims.length && <p className='empty'>{t('claim.empty')}</p>}
      {[...days].map(([day, claims]) => (
        <section key={day}>
          <h2>{dayLabel(day)}</h2>
          <ul className='rows'>
            {claims.map(c => {
              const item = data.itemById.get(c.item)
              const issue = conflicts(item, day)[0]
              return (
                <ItemRow key={c.id} item={item}>
                  <div className='row-side claim-side'>
                    <small><strong>{who(c.user)}</strong>{claimWhen(c) !== dayLabel(day) && <> · {claimWhen(c)}</>}</small>
                    {c.note && <small className='muted'>{c.note}</small>}
                    {issue && <small className='warn'>{issue}</small>}
                    {(c.user === user?.id || !kid) && <button className='chip' onClick={() => drop(c)}>{t('claim.drop')}</button>}
                  </div>
                </ItemRow>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
