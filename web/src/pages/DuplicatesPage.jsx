import { useState } from 'react'
import { ItemRow } from '../components/Cards.jsx'
import Icon from '../components/Icon.jsx'
import { useData } from '../lib/data.jsx'
import { pb } from '../lib/pb.js'
import { showToast } from '../lib/toast.js'
import { t } from '../lib/i18n.jsx'

// "Do we already have one?" Same names in several records, often in different places.
// Merging is only offered when they sit in the same place: elsewhere they're usually really two.
export default function DuplicatesPage () {
  const data = useData()
  const [error, setError] = useState(null)

  const merge = async group => {
    setError(null)
    // Keep the one with the most photos (then the oldest); the others go to the trash with Undo.
    const [keep, ...rest] = [...group].sort((a, b) => (b.photos?.length ?? 0) - (a.photos?.length ?? 0) || a.created.localeCompare(b.created))
    const before = { quantity: keep.quantity, tags: keep.tags }
    const quantity = group.reduce((n, i) => n + (i.quantity || 1), 0)
    const tags = [...new Set(group.flatMap(i => i.tags ?? []))]
    const note = [keep.note, ...rest.map(i => i.note)].filter(Boolean).filter((n, i, all) => all.indexOf(n) === i).join('\n')
    try {
      await pb.collection('items').update(keep.id, { quantity, tags, note })
      const stamp = new Date().toISOString()
      await Promise.all(rest.map(i => pb.collection('items').update(i.id, { deleted: stamp })))
      await data.reload()
      showToast(t('dups.merged', { name: keep.name, count: quantity }), {
        label: t('action.undo'),
        run: () => Promise.all([
          pb.collection('items').update(keep.id, { ...before, note: keep.note }),
          ...rest.map(i => pb.collection('items').update(i.id, { deleted: '' }))
        ]).then(data.reload).catch(err => showToast(t('move.undoFailed', { error: err.message })))
      })
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className='page'>
      <h1 className='page-title'>{t('dups.title')}</h1>
      <p className='muted'>{t('dups.intro')}</p>
      {error && <p className='error'>{error}</p>}
      {!data.duplicates.length && <p className='empty'>{t('dups.empty')}</p>}
      {data.duplicates.map(group => {
        const samePlace = group.every(i => i.place === group[0].place)
        return (
          <section key={group[0].id}>
            <h2>
              {group[0].name} <span className='count'>{group.reduce((n, i) => n + (i.quantity || 1), 0)}</span>
              {samePlace && <button className='chip push' onClick={() => merge(group)}><Icon name='copy' size={14} />{t('dups.merge')}</button>}
            </h2>
            <ul className='rows'>{group.map(i => <ItemRow key={i.id} item={i} />)}</ul>
          </section>
        )
      })}
    </div>
  )
}
