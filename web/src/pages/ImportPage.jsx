import { useState } from 'react'
import { useData } from '../lib/data.jsx'
import { pb } from '../lib/pb.js'
import { mapRows, parseCsv } from '../lib/csv.js'
import { TAG_COLORS } from '../lib/format.js'
import { t } from '../lib/i18n.jsx'

const VALID_DATE = /^\d{4}-\d{2}-\d{2}/

export default function ImportPage () {
  const data = useData()
  const [parsed, setParsed] = useState(null) // { items, columns } | { error }
  const [skipExisting, setSkipExisting] = useState(true)
  const [fallbackPlace, setFallbackPlace] = useState('')
  const [progress, setProgress] = useState(null) // { done, total, errors: [] , finished }

  const onFile = async e => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setProgress(null)
    try {
      setParsed(mapRows(parseCsv(await file.text())))
    } catch (err) {
      setParsed({ error: err.message, items: [] })
    }
  }

  const existingKey = (name, placeId) => `${name.toLowerCase()}|${placeId}`
  const existing = new Set(data.items.map(i => existingKey(i.name, i.place)))

  const run = async () => {
    const rows = parsed.items
    const errors = []
    setProgress({ done: 0, total: rows.length, errors, finished: false })
    // Caches so each place/tag is looked up or created once.
    const placeByPath = new Map(data.places.map(p => [data.pathText(p.id).toLowerCase(), p.id]))
    const tagByName = new Map(data.tags.map(tag => [tag.name.toLowerCase(), tag.id]))
    let tagCount = data.tags.length

    const ensurePlace = async path => {
      let parent = ''
      for (let depth = 1; depth <= path.length; depth++) {
        const key = path.slice(0, depth).join(' › ').toLowerCase()
        if (!placeByPath.has(key)) {
          const created = await pb.collection('places').create({ name: path[depth - 1], parent })
          placeByPath.set(key, created.id)
        }
        parent = placeByPath.get(key)
      }
      return parent
    }
    const ensureTag = async name => {
      const key = name.toLowerCase()
      if (!tagByName.has(key)) {
        const created = await pb.collection('tags').create({ name, color: TAG_COLORS[tagCount++ % TAG_COLORS.length] })
        tagByName.set(key, created.id)
      }
      return tagByName.get(key)
    }

    let done = 0
    for (const row of rows) {
      try {
        const place = row.path.length ? await ensurePlace(row.path) : fallbackPlace
        if (!place) throw new Error(t('import.noPlace'))
        if (skipExisting && existing.has(existingKey(row.name, place))) {
          done++
          setProgress(p => ({ ...p, done }))
          continue
        }
        const tags = []
        for (const name of row.tags) tags.push(await ensureTag(name))
        await pb.collection('items').create({
          name: row.name,
          place,
          quantity: row.quantity,
          min_quantity: row.min_quantity,
          note: row.note,
          tags,
          lent_to: row.lent_to,
          price: row.price,
          brand: row.brand,
          model: row.model,
          serial: row.serial,
          owner: row.owner,
          ...(VALID_DATE.test(row.purchase_date) && { purchase_date: row.purchase_date }),
          ...(VALID_DATE.test(row.warranty_until) && { warranty_until: row.warranty_until }),
          ...(VALID_DATE.test(row.expires) && { expires: row.expires })
        })
        existing.add(existingKey(row.name, place))
      } catch (err) {
        errors.push(`${row.name}: ${err.message}`)
      }
      done++
      setProgress(p => ({ ...p, done }))
    }
    setProgress(p => ({ ...p, finished: true }))
    await data.reload()
  }

  const withoutPlace = parsed?.items?.filter(i => !i.path.length).length ?? 0

  return (
    <div className='page'>
      <h1 className='page-title'>{t('import.title')}</h1>
      <p className='muted'>{t('import.intro')}</p>
      <label className='btn'>
        <input type='file' accept='.csv,text/csv' hidden onChange={onFile} />
        {t('import.choose')}
      </label>

      {parsed?.error && <p className='error'>{parsed.error === 'noName' ? t('import.noNameColumn') : parsed.error}</p>}
      {parsed?.items?.length > 0 && !progress && (
        <div className='panel form'>
          <p>{t('import.found', { count: parsed.items.length })}</p>
          <p className='muted small'>{t('import.columns', { columns: parsed.columns.join(', ') })}</p>
          <ul className='import-preview'>
            {parsed.items.slice(0, 5).map((i, n) => <li key={n}><strong>{i.name}</strong> <small className='muted'>{i.path.join(' › ')}</small></li>)}
          </ul>
          {withoutPlace > 0 && (
            <label className='field'>{t('import.fallback', { count: withoutPlace })}
              <select value={fallbackPlace} onChange={e => setFallbackPlace(e.target.value)}>
                <option value=''>—</option>
                {data.places.map(p => <option key={p.id} value={p.id}>{data.pathText(p.id)}</option>)}
              </select>
            </label>
          )}
          <label className='check'><input type='checkbox' checked={skipExisting} onChange={e => setSkipExisting(e.target.checked)} />{t('import.skipExisting')}</label>
          <button className='btn primary' onClick={run}>{t('import.run', { count: parsed.items.length })}</button>
        </div>
      )}
      {progress && (
        <div className='panel'>
          <p>{progress.finished ? t('import.finished') : t('import.progress', { done: progress.done, total: progress.total })}</p>
          <progress max={progress.total} value={progress.done} />
          {progress.errors.length > 0 && (
            <ul className='error small'>{progress.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
          )}
        </div>
      )}
    </div>
  )
}
