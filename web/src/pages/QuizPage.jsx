import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import Icon from '../components/Icon.jsx'
import Thumb from '../components/Thumb.jsx'
import { RoomBadge } from '../components/Room.jsx'
import { useData } from '../lib/data.jsx'
import { thumbUrl } from '../lib/pb.js'
import { getPref, setPref } from '../lib/recent.js'
import { placeColor, roomOf } from '../lib/rooms.js'
import { celebrate } from '../lib/celebrate.js'
import { play } from '../lib/sound.js'
import { t } from '../lib/i18n.jsx'

const ROUNDS = 10

const shuffle = list => {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// "Which room does this live in?" A photo, four rooms. Playing it is how kids (and grown-ups) learn
// where things go; a wrong answer shows the real spot, which is the useful part.
export default function QuizPage () {
  const data = useData()
  const [game, setGame] = useState(0) // bump to start over
  const [round, setRound] = useState(0)
  const [score, setScore] = useState(0)
  const [picked, setPicked] = useState(null)
  const [best, setBest] = useState(() => Number(getPref('quizBest', '0')))
  const [newBest, setNewBest] = useState(false)

  const questions = useMemo(() => {
    const withRoom = data.items
      .filter(i => i.place && i.photos?.length)
      .map(i => ({ item: i, room: roomOf(data, data.placeById.get(i.place)) }))
      .filter(q => q.room)
    const rooms = [...new Map(withRoom.map(q => [q.room.id, q.room])).values()]
    if (rooms.length < 2) return []
    return shuffle(withRoom).slice(0, ROUNDS).map(q => ({
      ...q,
      options: shuffle([q.room, ...shuffle(rooms.filter(r => r.id !== q.room.id)).slice(0, 3)])
    }))
    // A new game reshuffles; data changes mid-game (realtime) shouldn't.
  }, [game, data.loading])

  if (!questions.length) {
    return (
      <div className='page quiz'>
        <h1 className='page-title'>{t('quiz.title')}</h1>
        <p className='empty'>{t('quiz.notEnough')}</p>
      </div>
    )
  }

  const total = questions.length
  if (round >= total) {
    return (
      <div className='page quiz'>
        <h1 className='page-title'>{t('quiz.title')}</h1>
        <div className='panel quiz-end'>
          <strong className='display quiz-score'>{score} / {total}</strong>
          <p>{t(score === total ? 'quiz.perfect' : score >= total / 2 ? 'quiz.good' : 'quiz.practice')}</p>
          {newBest && <p className='muted'>{t('quiz.newBest')}</p>}
          <button className='btn primary' onClick={() => { setGame(g => g + 1); setRound(0); setScore(0); setPicked(null); setNewBest(false) }}>{t('quiz.again')}</button>
        </div>
      </div>
    )
  }

  const q = questions[round]
  const answer = room => {
    if (picked) return
    setPicked(room.id)
    if (room.id === q.room.id) {
      setScore(s => s + 1)
      play('found')
      if (round === total - 1 && score + 1 === total) celebrate()
    }
  }
  const right = picked === q.room.id
  const next = () => {
    if (round === total - 1 && score > best) {
      setPref('quizBest', String(score))
      setNewBest(best > 0)
      setBest(score)
    }
    setRound(r => r + 1)
    setPicked(null)
  }

  return (
    <div className='page quiz'>
      <div className='quiz-head'>
        <h1 className='page-title'>{t('quiz.title')}</h1>
        <span className='muted'>{round + 1} / {total} · {t('quiz.score', { count: score })}</span>
      </div>
      <figure className='quiz-photo'>
        <Thumb src={thumbUrl(q.item, q.item.photos[0])} name={q.item.name} />
        <figcaption>{t('quiz.question', { name: q.item.name })}</figcaption>
      </figure>
      <div className='quiz-options'>
        {q.options.map(room => {
          const state = !picked ? '' : room.id === q.room.id ? 'right' : room.id === picked ? 'wrong' : 'dim'
          return (
            <button key={room.id} className={`quiz-option ${state}`} style={{ '--room': placeColor(data, room) }} onClick={() => answer(room)}>
              <RoomBadge place={room} size={36} />
              <span>{room.name}</span>
            </button>
          )
        })}
      </div>
      {picked && (
        <div className={`quiz-feedback ${right ? 'right' : 'wrong'}`}>
          <p>
            <strong>{t(right ? 'quiz.right' : 'quiz.wrong')}</strong>{' '}
            <Link to={`/i/${q.item.id}`}>{t('quiz.exact', { where: data.whereText(q.item.place) })}</Link>
          </p>
          <button className='btn primary' onClick={next}>
            {round === total - 1 ? t('quiz.finish') : t('quiz.next')}<Icon name='chevron' size={16} />
          </button>
        </div>
      )}
      {best > 0 && <p className='muted small'>{t('quiz.best', { count: best })}</p>}
    </div>
  )
}
