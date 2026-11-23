import { useMemo, useState } from 'react'
import WhereToLook from '../components/WhereToLook.jsx'
import { Link, useSearchParams } from 'react-router'
import Avatar from '../components/Avatar.jsx'
import Icon from '../components/Icon.jsx'
import PlacePicker from '../components/PlacePicker.jsx'
import Thumb from '../components/Thumb.jsx'
import { useData } from '../lib/data.jsx'
import { displayName, useAuthUser } from '../lib/auth.js'
import { useMembers } from '../lib/members.js'
import { pb, thumbUrl } from '../lib/pb.js'
import { timeAgo } from '../lib/format.js'
import { celebrate } from '../lib/celebrate.js'
import { showToast } from '../lib/toast.js'
import { useItemSearch } from './SearchPage.jsx'
import { t } from '../lib/i18n.jsx'

// "Who has the scissors?" Asking the house is often quicker than searching, and answering is a small
// win anyone can have, kids included. While typing, things already in the app are offered first,
// because the answer is often already written down.
export default function AsksPage () {
  const data = useData()
  const user = useAuthUser()
  const members = useMembers()
  const fuse = useItemSearch()
  const [params] = useSearchParams()
  const [text, setText] = useState(params.get('text') ?? '')
  const [item, setItem] = useState(params.get('item') ?? '')
  const [answering, setAnswering] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const kid = user?.role === 'kid'

  const memberById = useMemo(() => new Map(members.map(m => [m.id, m])), [members])
  const linked = data.itemById.get(item)
  const hints = text.trim().length >= 3 && !linked
    ? fuse.search(text.trim()).filter(r => r.item.kind === 'item').slice(0, 3).map(r => r.item.record)
    : []

  const post = async e => {
    e.preventDefault()
    if (!text.trim() && !linked) return
    // Asking twice for the same thing just keeps the open ask.
    const wanted = (text.trim() || linked.name).toLowerCase()
    if (data.openAsks.some(a => a.text.toLowerCase() === wanted || (linked && a.item === linked.id))) {
      setText('')
      setItem('')
      return showToast(t('asks.already'))
    }
    setBusy(true)
    setError(null)
    try {
      await pb.collection('asks').create({ text: text.trim() || linked.name, item: linked?.id ?? '', author: user.id })
      setText('')
      setItem('')
      await data.reload()
      showToast(t('asks.posted'))
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  const answer = async (ask, placeId) => {
    setAnswering(null)
    setError(null)
    try {
      await pb.collection('asks').update(ask.id, { answered: new Date().toISOString(), answered_by: user.id, answer_place: placeId })
      // A linked thing moves to where it was found, so the app is right next time.
      const thing = data.itemById.get(ask.item)
      if (thing && placeId && thing.place !== placeId) await pb.collection('items').update(thing.id, { place: placeId })
      await data.reload()
      celebrate()
      showToast(t('asks.thanks'))
    } catch (err) {
      setError(err.message)
    }
  }

  const withdraw = async ask => {
    setError(null)
    try {
      await pb.collection('asks').delete(ask.id)
      await data.reload()
    } catch (err) {
      setError(err.message)
    }
  }

  const answered = data.asks.filter(a => a.answered)

  return (
    <div className='page asks'>
      <h1 className='page-title'>{t('asks.title')}</h1>
      <p className='muted'>{t('asks.intro')}</p>

      <form className='panel ask-form' onSubmit={post}>
        {linked
          ? (
            <div className='ask-linked'>
              <Thumb src={thumbUrl(linked, linked.photos?.[0])} name={linked.name} className='mini' />
              <span className='row-text'><strong>{linked.name}</strong><small className='muted'>{t('asks.lastSeen', { where: data.whereText(linked.place) })}</small></span>
              <button type='button' className='ghost' onClick={() => setItem('')} aria-label={t('action.remove')}><Icon name='close' size={18} /></button>
            </div>
            )
          : null}
        <input placeholder={t('asks.placeholder')} value={text} onChange={e => setText(e.target.value)} maxLength={200} />
        {hints.length > 0 && (
          <div className='ask-hints'>
            <p className='pick-heading'>{t('asks.maybe')}</p>
            {hints.map(h => (
              <Link key={h.id} to={`/i/${h.id}`} className='ask-hint'>
                <Thumb src={thumbUrl(h, h.photos?.[0])} name={h.name} className='mini' />
                <span className='row-text'><strong>{h.name}</strong><small className='muted'>{data.whereText(h.place)}</small></span>
              </Link>
            ))}
          </div>
        )}
        {error && <p className='error'>{error}</p>}
        <button className='btn primary' disabled={busy || (!text.trim() && !linked)}><Icon name='ask' size={18} />{t('asks.post')}</button>
      </form>

      <section>
        <h2>{t('asks.open')}</h2>
        {!data.openAsks.length && <p className='empty'>{t('asks.none')}</p>}
        <ul className='ask-list'>
          {data.openAsks.map(a => {
            const author = memberById.get(a.author)
            const thing = data.itemById.get(a.item)
            const mine = a.author === user?.id
            return (
              <li key={a.id} className='ask-card'>
                <div className='ask-top'>
                  <Avatar user={author} size={36} />
                  <span className='row-text'>
                    <strong>{a.text}</strong>
                    <small className='muted'>{t('asks.by', { name: mine ? t('asks.you') : displayName(author, '?'), when: timeAgo(a.created) })}</small>
                    {thing && <small className='muted'>{t('asks.lastSeen', { where: data.whereText(thing.place) })}</small>}
                  </span>
                </div>
                {thing && <WhereToLook item={thing} limit={2} />}
                <div className='ask-actions'>
                  {(mine || !kid) && <button className='btn' onClick={() => withdraw(a)}>{mine ? t('asks.withdraw') : t('action.remove')}</button>}
                  <button className='btn primary' onClick={() => setAnswering(a)}><Icon name='check' size={18} />{mine ? t('asks.foundMyself') : t('asks.found')}</button>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      {answered.length > 0 && (
        <section>
          <h2>{t('asks.recent')}</h2>
          <ul className='ask-list done'>
            {answered.map(a => {
              const finder = memberById.get(a.answered_by)
              const where = a.answer_place && data.placeById.has(a.answer_place) ? data.pathText(a.answer_place) : null
              return (
                <li key={a.id} className='ask-card'>
                  <div className='ask-top'>
                    <Avatar user={finder} size={36} />
                    <span className='row-text'>
                      <strong>{a.text}</strong>
                      <small className='muted'>{where ? t('asks.foundIn', { name: displayName(finder, '?'), where }) : t('asks.foundBy', { name: displayName(finder, '?') })} · {timeAgo(a.answered)}</small>
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {answering && (
        <PlacePicker
          title={t('asks.whereWasIt', { name: answering.text })}
          suggestFor={[data.itemById.get(answering.item) ?? { name: answering.text }]}
          onPick={id => answer(answering, id)}
          onClose={() => setAnswering(null)}
        />
      )}
    </div>
  )
}
