import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import Fuse from 'fuse.js'
import Icon from '../components/Icon.jsx'
import Thumb from '../components/Thumb.jsx'
import { ItemRow } from '../components/Cards.jsx'
import { useData } from '../lib/data.jsx'
import { suggestPlaces } from '../lib/suggest.js'
import { getRecent } from '../lib/recent.js'
import { useMembers } from '../lib/members.js'
import { displayName } from '../lib/auth.js'
import PlacePicker from '../components/PlacePicker.jsx'
import TagPicker from '../components/TagPicker.jsx'
import { pb, thumbUrl } from '../lib/pb.js'
import { plural } from '../lib/format.js'
import { showToast } from '../lib/toast.js'
import { askInventory, useAiEnabled } from '../lib/ai.js'
import { getLang, t } from '../lib/i18n.jsx'

const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition

// "Where is the drill?" / "Waar is de boormachine?" → the noun, so fuzzy matching isn't thrown off.
// Both languages at once: people mix them, and a stray English word in Dutch speech is harmless.
const FILLER = /^(where('s| is| are)?|find|show( me)?|the|my|a|an|our|waar|is|zijn|ligt|liggen|staat|staan|hangt|zit|vind|zoek|toon|de|het|een|mijn|onze|ons)\s+/i
const clean = text => {
  let s = text.trim().replace(/[?.!]+$/, '')
  let prev
  do { prev = s; s = s.replace(FILLER, '') } while (s !== prev)
  return s
}

export function useItemSearch () {
  const data = useData()
  return useMemo(() => {
    const docs = [
      ...data.items.map(i => ({ kind: 'item', record: i, name: i.name, note: i.note, path: data.whereText(i.place), tags: data.tagsOf(i).map(t => t.name).join(' '), lent: i.lent_to, ids: [i.brand, i.model, i.serial].filter(Boolean).join(' '), owner: i.owner, aliases: i.aliases })),
      ...data.places.map(p => ({ kind: 'place', record: p, name: p.name, note: p.note, path: data.pathText(p.parent) }))
    ]
    return new Fuse(docs, {
      keys: [{ name: 'name', weight: 3 }, { name: 'tags', weight: 1.5 }, { name: 'note', weight: 1 }, { name: 'path', weight: 1 }, { name: 'lent', weight: 1 }, { name: 'ids', weight: 1.5 }, { name: 'owner', weight: 1 }, { name: 'aliases', weight: 2.5 }],
      threshold: 0.38,
      ignoreLocation: true,
      includeScore: true
    })
  }, [data])
}

export default function SearchPage () {
  const data = useData()
  const fuse = useItemSearch()
  const [params, setParams] = useSearchParams()
  const [listening, setListening] = useState(false)
  const [voiceError, setVoiceError] = useState(null)
  const [picking, setPicking] = useState(false)
  const [ai, setAi] = useState(null) // { q, busy, matches, error }
  const aiEnabled = useAiEnabled()
  // Select search results ("all batteries") and move or tag them together.
  const [selected, setSelected] = useState(null)
  const [bulkMode, setBulkMode] = useState(null) // 'move' | 'tag'
  const [bulkTags, setBulkTags] = useState([])
  const [bulkError, setBulkError] = useState(null)
  // The box keeps its own state; the URL only mirrors it (a URL-controlled input drops fast keystrokes).
  const [q, setQState] = useState(() => params.get('q') ?? '')
  // Filters live in the URL so "Needs a photo" etc. can be linked to and survive a reload.
  const flags = new Set((params.get('f') ?? '').split(',').filter(Boolean))
  const tagFilter = params.get('tag') ?? ''
  const inFilter = params.get('in') ?? ''
  // Functional update: keystrokes arrive faster than re-renders, so never build from a stale copy.
  const setParam = (key, value) => setParams(prev => {
    const next = new URLSearchParams(prev)
    value ? next.set(key, value) : next.delete(key)
    return next
  }, { replace: true })
  const setQ = value => {
    setQState(value)
    setParam('q', value)
  }
  const toggleFlag = flag => {
    const next = new Set(flags)
    next.has(flag) ? next.delete(flag) : next.add(flag)
    setParam('f', [...next].join(','))
  }

  const filtering = flags.size > 0 || tagFilter || inFilter
  const within = inFilter ? data.descendants(inFilter) : null
  const passes = item =>
    (!flags.has('lent') || item.lent_to) &&
    (!flags.has('missing') || item.missing) &&
    (!flags.has('nophoto') || !item.photos?.length) &&
    (!tagFilter || item.tags?.includes(tagFilter)) &&
    (!within || within.has(item.place))

  const results = q.trim()
    ? fuse.search(q.trim(), { limit: 50 }).filter(r => !filtering || (r.item.kind === 'item' && passes(r.item.record)))
    : []
  const filtered = !q.trim() && filtering ? data.items.filter(passes) : []

  // Asked out loud, answered out loud: after a voice search the best match is read back, so you can
  // keep your hands in the cupboard. Only once per spoken question.
  const spoken = useRef(null)
  const members = useMembers()
  const memberName = id => displayName(members.find(m => m.id === id), '?').split(' ')[0]
  const top = results[0]?.item
  useEffect(() => {
    if (!spoken.current || spoken.current !== q || !top || !('speechSynthesis' in window)) return
    spoken.current = null
    const r = top.record
    const text = top.kind === 'item'
      ? r.with_user ? t('voice.answerWith', { name: r.name, who: memberName(r.with_user) })
        : r.lent_to ? t('voice.answerLent', { name: r.name, who: r.lent_to }) : t('voice.answer', { name: r.name, where: top.path })
      : t('voice.answerPlace', { name: r.name, where: top.path || t('picker.topLevel') })
    const say = new SpeechSynthesisUtterance(text.replaceAll(' › ', ', '))
    say.lang = getLang() === 'nl' ? 'nl-BE' : 'en-GB'
    speechSynthesis.cancel()
    speechSynthesis.speak(say)
  }, [q, top])
  const recent = q.trim() || filtering ? [] : getRecent().map(id => data.itemById.get(id)).filter(Boolean)

  const selectableIds = [...results.filter(r => r.item.kind === 'item').map(r => r.item.record.id), ...filtered.map(i => i.id)]
  const toggle = id => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const bulk = async (values, undoMessage) => {
    setBulkMode(null)
    setBulkError(null)
    const ids = [...selected]
    const before = ids.map(id => [id, (({ place, home, tags }) => ({ place, home, tags }))(data.itemById.get(id))])
    try {
      await Promise.all(ids.map(id => pb.collection('items').update(id, values)))
      setSelected(null)
      await data.reload()
      if (undoMessage) {
        showToast(undoMessage, {
          label: t('action.undo'),
          run: () => Promise.all(before.map(([id, v]) => pb.collection('items').update(id, v))).then(data.reload)
            .catch(err => showToast(t('move.undoFailed', { error: err.message })))
        })
      }
    } catch (err) {
      setBulkError(err.message)
    }
  }
  const selectRow = (item, children) => (
    <li key={item.id} className='row-card'>
      <button type='button' className={`row-main plain select-row ${selected.has(item.id) ? 'on' : ''}`} onClick={() => toggle(item.id)}>
        <span className={`select-dot ${selected.has(item.id) ? 'on' : ''}`}>{selected.has(item.id) && <Icon name='check' size={16} />}</span>
        <Thumb src={thumbUrl(item, item.photos?.[0])} name={item.name} />
        <div><strong>{item.name}</strong><small>{data.whereText(item.place)}</small></div>
      </button>
      {children}
    </li>
  )

  const askAi = async () => {
    const question = q.trim()
    setAi({ q: question, busy: true })
    try {
      setAi({ q: question, matches: await askInventory(question) })
    } catch (err) {
      setAi({ q: question, error: err.message })
    }
  }

  const listen = () => {
    setVoiceError(null)
    const rec = new Recognition()
    // Recognise in the app's language; keep the phone's regional variant (nl-BE vs nl-NL) when it matches.
    const phone = navigator.language || ''
    rec.lang = phone.toLowerCase().startsWith(getLang()) ? phone : getLang() === 'nl' ? 'nl-NL' : 'en-US'
    rec.interimResults = false
    rec.onresult = e => {
      const heard = clean(e.results[0][0].transcript)
      spoken.current = heard
      setQ(heard)
    }
    rec.onerror = e => setVoiceError(e.error === 'not-allowed' ? t('voice.blocked') : t('voice.failed', { error: e.error }))
    rec.onend = () => setListening(false)
    setListening(true)
    rec.start()
  }

  return (
    <div className='page'>
      <div className='search-bar'>
        <input
          className='search-input'
          type='search'
          autoFocus
          placeholder={t('search.placeholder')}
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        {Recognition && (
          <button className={`btn mic ${listening ? 'on' : ''}`} onClick={listen} disabled={listening} aria-label={t('voice.button')}>
            <Icon name='mic' />
          </button>
        )}
      </div>
      <div className='filter-row'>
        {['lent', 'missing', 'nophoto'].map(f => (
          <button key={f} className={`chip ${flags.has(f) ? 'on' : ''}`} onClick={() => toggleFlag(f)}>{t(`filter.${f}`)}</button>
        ))}
        {data.tags.length > 0 && (
          <select className={`chip ${tagFilter ? 'on' : ''}`} value={tagFilter} onChange={e => setParam('tag', e.target.value)} aria-label={t('tags.title')}>
            <option value=''>{t('filter.anyTag')}</option>
            {data.tags.map(tag => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
          </select>
        )}
        <button className={`chip ${inFilter ? 'on' : ''}`} onClick={() => (inFilter ? setParam('in', '') : setPicking(true))}>
          {inFilter ? t('filter.inPlace', { name: data.placeById.get(inFilter)?.name ?? '?' }) : t('filter.anywhere')}
        </button>
      </div>
      {picking && <PlacePicker title={t('filter.pickPlace')} onPick={id => { setPicking(false); setParam('in', id) }} onClose={() => setPicking(false)} />}

      {aiEnabled && q.trim() && ai?.q !== q.trim() && (
        <button className='btn ai-ask' onClick={askAi}><Icon name='sparkle' size={18} />{t('ai.ask')}</button>
      )}
      {ai?.q === q.trim() && (
        <section className='ai-answer'>
          <h2><Icon name='sparkle' size={16} />{t('ai.answerTitle')}</h2>
          {ai.busy && <p className='muted'>{t('ai.thinking')}</p>}
          {ai.error && <p className='error'>{ai.error}</p>}
          {ai.matches && !ai.matches.length && <p className='muted'>{t('ai.noMatch')}</p>}
          {ai.matches?.length > 0 && (
            <ul className='rows'>
              {ai.matches.map(m => data.itemById.get(m.id) && (
                <ItemRow key={m.id} item={data.itemById.get(m.id)}><small className='ai-reason'>{m.reason}</small></ItemRow>
              ))}
            </ul>
          )}
        </section>
      )}

      {selectableIds.length > 1 && (
        <div className='select-toolbar'>
          <button className={`chip ${selected ? 'on' : ''}`} onClick={() => setSelected(selected ? null : new Set())}>{selected ? t('action.cancel') : t('action.select')}</button>
          {selected && <button className='chip' onClick={() => setSelected(new Set(selectableIds))}>{t('unsorted.selectAll')}</button>}
        </div>
      )}
      {bulkError && <p className='error'>{bulkError}</p>}

      {listening && <p className='muted'>{t('voice.listening')}</p>}
      {voiceError && <p className='error'>{voiceError}</p>}

      <ul className='results'>
        {results.map(({ item: doc }) => {
          const r = doc.record
          const isItem = doc.kind === 'item'
          if (selected && !isItem) return null
          if (selected) return selectRow(r)
          return (
            <li key={r.id}>
              <Link to={isItem ? `/i/${r.id}` : `/p/${r.id}`}>
                <Thumb src={thumbUrl(r, isItem ? r.photos?.[0] : r.photo)} name={r.name} />
                <div>
                  <strong>{r.name}{isItem && r.quantity > 1 && <em> ×{r.quantity}</em>}</strong>
                  <small>{isItem ? doc.path : doc.path ? t('search.placeIn', { path: doc.path }) : t('search.place')}</small>
                  {isItem && r.lent_to && <small className='lent-note'>{t('search.lentTo', { name: r.lent_to })}</small>}
                  {isItem && r.with_user && <small className='lent-note'>{t('with.searchNote', { name: memberName(r.with_user) })}</small>}
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
      {q.trim() && results.length === 0 && !(ai?.q === q.trim() && ai.matches?.length) && <NotFound q={q.trim()} />}

      {filtering && !q.trim() && (
        <section>
          <h2>{t('filter.results', { count: filtered.length })}</h2>
          <ul className='rows'>{filtered.map(i => (selected ? selectRow(i) : <ItemRow key={i.id} item={i} />))}</ul>
        </section>
      )}

      {selected?.size > 0 && (
        <div className='bulk-bar'>
          <span>{plural(selected.size, 'item')}</span>
          <button className='btn' onClick={() => setBulkMode('tag')}><Icon name='tag' size={18} />{t('action.tag')}</button>
          <button className='btn primary' onClick={() => setBulkMode('move')}><Icon name='move' size={18} />{t('action.move')}</button>
        </div>
      )}
      {bulkMode === 'move' && (
        <PlacePicker
          title={t('bulk.moveTo', { count: selected.size })}
          homeToggle
          onPick={(target, { makeHome }) => bulk({ place: target, ...(makeHome && { home: target }) }, t('move.bulkDone', { count: selected.size, place: data.pathText(target) }))}
          onClose={() => setBulkMode(null)}
        />
      )}
      {bulkMode === 'tag' && (
        <TagPicker title={t('bulk.tag', { count: selected.size })} selected={bulkTags} onChange={setBulkTags} onClose={() => { bulkTags.length ? bulk({ 'tags+': bulkTags }) : setBulkMode(null); setBulkTags([]) }} />
      )}

      {recent.length > 0 && !selected && (
        <section>
          <h2>{t('search.recent')}</h2>
          <ul className='rows'>{recent.map(i => <ItemRow key={i.id} item={i} />)}</ul>
        </section>
      )}
    </div>
  )
}

// Nothing found: either it isn't in the app yet (offer the places that hold similar things) or it
// is somewhere nobody wrote down (ask the household).
// Reported once per text per session, after the empty result stood for a few seconds (so not
// every half-typed word).
const reported = new Set()

function NotFound ({ q }) {
  const data = useData()
  useEffect(() => {
    const key = q.toLowerCase()
    if (key.length < 3 || reported.has(key)) return
    const timer = setTimeout(() => {
      reported.add(key)
      pb.send('/api/wz/misses', { method: 'POST', body: { text: q } }).catch(err => console.warn('miss:', err.message))
    }, 4000)
    return () => clearTimeout(timer)
  }, [q])
  const spots = suggestPlaces(data, [{ name: q }], { limit: 3 })
  return (
    <section className='not-found'>
      <p className='empty'>{t('search.none', { q })}</p>
      <Link className='btn' to={`/asks?text=${encodeURIComponent(q)}`}><Icon name='ask' size={18} />{t('asks.askHouse')}</Link>
      {spots.length > 0 && (
        <>
          <p className='pick-heading'>{t('search.putItIn', { q })}</p>
          <ul className='pick-list suggested'>
            {spots.map(({ place, examples }) => (
              <li key={place.id}>
                <Link to={`/add/${place.id}?name=${encodeURIComponent(q)}`}>
                  <Thumb src={thumbUrl(place, place.photo)} name={place.name} className='mini' />
                  <span className='pick-text'><strong>{data.pathText(place.id)}</strong><small className='muted'>{t('suggest.because', { names: examples.join(', ') })}</small></span>
                  <Icon name='plus' size={16} />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
