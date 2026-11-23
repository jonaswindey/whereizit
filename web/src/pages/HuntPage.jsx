import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import Icon from '../components/Icon.jsx'
import Scanner from '../components/Scanner.jsx'
import { RoomBadge } from '../components/Room.jsx'
import { useData } from '../lib/data.jsx'
import { fileUrl, pb } from '../lib/pb.js'
import { useAuthUser } from '../lib/auth.js'
import { celebrate } from '../lib/celebrate.js'
import { t } from '../lib/i18n.jsx'

const scoreKey = id => `whereizit.hunt.${id}`
const readScore = id => {
  try {
    return JSON.parse(localStorage.getItem(scoreKey(id))) ?? { points: 0, found: 0, streak: 0 }
  } catch {
    return { points: 0, found: 0, streak: 0 }
  }
}

// Treasure hunt: a photo, a hint about the room, go find it, then scan the label of the cupboard it's
// in. Every find is also a stocktake: the item is marked as seen there today.
export default function HuntPage () {
  const data = useData()
  const user = useAuthUser()
  const [score, setScore] = useState(() => readScore(user?.id))
  const [round, setRound] = useState(0)
  const [hint, setHint] = useState(0) // 0 = room only, 1 = full path
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState(null) // { ok, place? }
  const [error, setError] = useState(null)

  // Items with a photo in a labelled place come first (they can be proven); least recently seen first.
  const target = useMemo(() => {
    const pool = data.items.filter(i => i.photos?.length && i.place && !i.lent_to && !i.missing)
    if (!pool.length) return null
    const weight = i => (i.checked_at || i.created || '')
    const sorted = [...pool].sort((a, b) => weight(a).localeCompare(weight(b))).slice(0, 12)
    return sorted[Math.floor(Math.random() * sorted.length)]
  }, [data.items.length, round]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = next => {
    setScore(next)
    try { localStorage.setItem(scoreKey(user?.id), JSON.stringify(next)) } catch {}
  }

  const nextRound = () => {
    setRound(r => r + 1)
    setHint(0)
    setResult(null)
    setError(null)
  }

  const found = async () => {
    const points = hint ? 1 : 3
    save({ points: score.points + points, found: score.found + 1, streak: score.streak + 1 })
    setResult({ ok: true, points })
    celebrate()
    try {
      await pb.collection('items').update(target.id, { checked_at: new Date().toISOString(), missing: false })
      await data.reload()
    } catch (err) {
      setError(err.message)
    }
  }

  const onCode = async raw => {
    setScanning(false)
    const code = raw.match(/\/l\/([^/?#]+)/)?.[1] ?? raw.trim()
    try {
      const label = await pb.collection('labels').getFirstListItem(pb.filter('code = {:code}', { code }))
      if (label.place === target.place) return found()
      setResult({ ok: false, place: data.placeById.get(label.place) })
    } catch {
      setError(t('hunt.unknownLabel'))
    }
  }

  const movedHere = async () => {
    try {
      await pb.collection('items').update(target.id, { place: result.place.id, checked_at: new Date().toISOString() })
      await data.reload()
      save({ ...score, points: score.points + 1, found: score.found + 1 })
      setResult({ ok: true, points: 1, moved: true })
    } catch (err) {
      setError(err.message)
    }
  }

  if (!target) {
    return (
      <div className='page'>
        <h1 className='page-title'>{t('hunt.title')}</h1>
        <p className='empty'>{t('hunt.empty')}</p>
      </div>
    )
  }

  const path = data.path(target.place)
  const room = path.find(p => data.missionRooms.includes(p)) ?? path.at(-2) ?? path.at(-1)

  return (
    <div className='page hunt'>
      <div className='hunt-score'>
        <span><Icon name='trophy' size={18} /><strong>{score.points}</strong> {t('hunt.points')}</span>
        <span><strong>{score.found}</strong> {t('hunt.found')}</span>
        {score.streak > 1 && <span><Icon name='bolt' size={16} /><strong>{score.streak}</strong> {t('hunt.streak')}</span>}
      </div>
      <h1 className='page-title'>{t('hunt.whereIs')}</h1>
      <figure className='name-card hunt-card'>
        <img src={fileUrl(target, target.photos[0])} alt='' />
        <figcaption>
          <strong>{target.name}</strong>
          {room && <span className='hint'><RoomBadge place={room} size={24} />{hint ? data.pathText(target.place) : t('hunt.somewhereIn', { room: room.name })}</span>}
        </figcaption>
      </figure>

      {!result && (
        <>
          <button className='btn primary big' onClick={() => setScanning(true)}><Icon name='qr' />{t('hunt.scan')}</button>
          <div className='row'>
            {!hint && <button className='btn' onClick={() => setHint(1)}><Icon name='search' size={18} />{t('hunt.hint')}</button>}
            <button className='btn' onClick={() => { save({ ...score, streak: 0 }); nextRound() }}>{t('hunt.skip')}</button>
          </div>
          <button className='ghost hunt-noscan' onClick={found}>{t('hunt.noLabel')}</button>
        </>
      )}

      {result?.ok && (
        <div className='hunt-result ok'>
          <Icon name='trophy' size={28} />
          <strong className='display'>{result.moved ? t('hunt.moved') : t('hunt.yes', { points: result.points })}</strong>
          <button className='btn primary big' onClick={nextRound}>{t('hunt.next')}</button>
        </div>
      )}
      {result && !result.ok && (
        <div className='hunt-result'>
          <p>{t('hunt.notHere', { place: result.place?.name ?? '?' })}</p>
          <div className='row'>
            <button className='btn' onClick={() => setResult(null)}>{t('hunt.keepLooking')}</button>
            {result.place && <button className='btn primary' onClick={movedHere}>{t('hunt.itIsHere')}</button>}
          </div>
        </div>
      )}
      {error && <p className='error'>{error}</p>}
      {scanning && <Scanner title={t('hunt.scanTitle')} onCode={onCode} onClose={() => setScanning(false)} />}
      <p className='muted small center-text'><Link to='/missions'>{t('missions.title')}</Link> · <Link to='/quiz'>{t('quiz.title')}</Link></p>
    </div>
  )
}
