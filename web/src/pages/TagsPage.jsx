import { useState } from 'react'
import { Link } from 'react-router'
import Icon from '../components/Icon.jsx'
import { useData } from '../lib/data.jsx'
import { pb } from '../lib/pb.js'
import { TAG_COLORS } from '../lib/format.js'
import { t } from '../lib/i18n.jsx'

function TagList ({ tags }) {
  const data = useData()
  return (
    <ul className='menu'>
      {tags.map(t => (
        <li key={t.id}>
          <Link to={`/tags/${t.id}`}>
            <span className='dot' style={{ background: t.color || 'var(--muted)' }} />
            <span>{t.name}</span>
            <span className='count'>{data.itemsWithTag(t.id).length}</span>
            <Icon name='chevron' size={16} />
          </Link>
        </li>
      ))}
    </ul>
  )
}

export default function TagsPage () {
  const data = useData()
  const [name, setName] = useState('')
  const [seasonal, setSeasonal] = useState(false)
  const [error, setError] = useState(null)
  const seasons = data.tags.filter(t => t.seasonal)
  const others = data.tags.filter(t => !t.seasonal)

  const create = async e => {
    e.preventDefault()
    if (!name.trim()) return
    setError(null)
    try {
      await pb.collection('tags').create({ name: name.trim(), seasonal, color: TAG_COLORS[data.tags.length % TAG_COLORS.length] })
      setName('')
      setSeasonal(false)
      await data.reload()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className='page'>
      <h1 className='page-title'>{t('tags.pageTitle')}</h1>
      <form className='panel form' onSubmit={create}>
        <input placeholder={t('tags.newPlaceholder')} value={name} onChange={e => setName(e.target.value)} />
        <label className='check'><input type='checkbox' checked={seasonal} onChange={e => setSeasonal(e.target.checked)} />{t('tags.seasonalLong')}</label>
        {error && <p className='error'>{error}</p>}
        <button className='btn primary'>{t('tags.add')}</button>
      </form>
      {seasons.length > 0 && <><h2><Icon name='sun' size={16} />{t('tags.seasons')}</h2><TagList tags={seasons} /></>}
      {others.length > 0 && <><h2><Icon name='tag' size={16} />{t('tags.title')}</h2><TagList tags={others} /></>}
    </div>
  )
}
