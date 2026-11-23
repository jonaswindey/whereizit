import { Link } from 'react-router'
import Icon from '../components/Icon.jsx'
import Thumb from '../components/Thumb.jsx'
import { useData } from '../lib/data.jsx'
import { pb, thumbUrl } from '../lib/pb.js'
import { sameWord, words } from '../lib/suggest.js'
import { showToast } from '../lib/toast.js'
import { getLang, t } from '../lib/i18n.jsx'

// What a babysitter, a guest or a sleepy parent at 3am needs to find without asking. [nl, en]
const SUGGESTED = [
  ['EHBO-kit', 'First-aid kit'],
  ['Brandblusser', 'Fire extinguisher'],
  ['Branddeken', 'Fire blanket'],
  ['Zekeringkast', 'Fuse box'],
  ['Hoofdkraan water', 'Water main'],
  ['Gasmeter', 'Gas meter'],
  ['Zaklamp', 'Torch'],
  ['Reservesleutels', 'Spare keys'],
  ['Paspoorten', 'Passports'],
  ['Kaarsen en lucifers', 'Candles and matches']
]

// Another word in the suggestion's name (ignoring "and"/"en") matches a word of the item's name.
const SKIP = new Set(['and', 'en', 'kit'])
const matches = (suggestion, name) => {
  const mine = words(suggestion).filter(w => !SKIP.has(w))
  return words(name).some(w => mine.some(m => sameWord(m, w)))
}

// The emergency card: essentials with photos and exact places, one page, printable for the fridge.
export default function EssentialsPage () {
  const data = useData()
  const nl = getLang() === 'nl'
  const items = [...data.essentials].sort((a, b) => data.whereText(a.place).localeCompare(data.whereText(b.place)))

  const mark = async item => {
    try {
      await pb.collection('items').update(item.id, { essential: true })
      await data.reload()
    } catch (err) {
      showToast(err.message)
    }
  }

  const missing = SUGGESTED.map(pair => (nl ? pair[0] : pair[1]))
    .filter(name => !items.some(i => matches(name, i.name)))
    .map(name => ({ name, existing: data.items.find(i => matches(name, i.name)) }))

  return (
    <div className='page essentials'>
      <div className='title-row'>
        <h1 className='page-title'>{t('essential.title')}</h1>
        {items.length > 0 && <button className='btn no-print push' onClick={() => window.print()}><Icon name='print' size={18} />{t('essential.print')}</button>}
      </div>
      <p className='muted'>{t('essential.intro')}</p>

      {!items.length && <p className='empty'>{t('essential.empty')}</p>}
      <ul className='essential-list'>
        {items.map(i => (
          <li key={i.id}>
            <Link to={`/i/${i.id}`}>
              <Thumb src={thumbUrl(i, i.photos?.[0])} name={i.name} />
              <span className='row-text'>
                <strong>{i.name}</strong>
                <span>{data.whereText(i.place)}</span>
                {i.note && <small className='muted'>{i.note}</small>}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {missing.length > 0 && (
        <section className='no-print'>
          <h2>{t('essential.suggestions')}</h2>
          <ul className='rows'>
            {missing.map(m => (
              <li key={m.name} className='row-card essential-suggest'>
                <span className='row-text'>
                  <strong>{m.name}</strong>
                  {m.existing && <small className='muted'>{t('essential.found', { name: m.existing.name, where: data.whereText(m.existing.place) })}</small>}
                </span>
                {m.existing
                  ? <button className='btn' onClick={() => mark(m.existing)}><Icon name='star' size={16} />{t('essential.add')}</button>
                  : <Link className='btn' to={`/add/unsorted?name=${encodeURIComponent(m.name)}&essential=1`}><Icon name='plus' size={16} />{t('essential.new')}</Link>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
