import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import Icon from '../components/Icon.jsx'
import { useData } from '../lib/data.jsx'
import { pb } from '../lib/pb.js'
import { t } from '../lib/i18n.jsx'

export default function ListsPage () {
  const data = useData()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [error, setError] = useState(null)

  const create = async e => {
    e.preventDefault()
    if (!name.trim()) return
    setError(null)
    try {
      const list = await pb.collection('lists').create({ name: name.trim(), items: [], done: [] })
      await data.reload()
      navigate(`/lists/${list.id}`)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className='page'>
      <h1 className='page-title'>{t('lists.title')}</h1>
      <p className='muted'>{t('lists.intro')}</p>
      <form className='panel form row' onSubmit={create}>
        <input placeholder={t('lists.newPlaceholder')} value={name} onChange={e => setName(e.target.value)} />
        <button className='btn primary'><Icon name='plus' />{t('lists.create')}</button>
      </form>
      {error && <p className='error'>{error}</p>}
      {data.lists.length > 0 && (
        <ul className='menu'>
          {data.lists.map(l => {
            const total = (l.items ?? []).filter(id => data.itemById.has(id)).length
            const done = (l.done ?? []).filter(id => data.itemById.has(id)).length
            return (
              <li key={l.id}>
                <Link to={`/lists/${l.id}`}>
                  <Icon name='check' />
                  <span>{l.name}</span>
                  <span className='count'>{done}/{total}</span>
                  <Icon name='chevron' size={16} />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
