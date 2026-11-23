import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import QRCode from 'qrcode'
import Icon from '../components/Icon.jsx'
import { useData } from '../lib/data.jsx'
import { formatPrice, plural } from '../lib/format.js'
import { getLang, t } from '../lib/i18n.jsx'

// Packing list / contents sheet: tape it to the box, or keep it for insurance (with prices).
export default function PrintPage () {
  const { id } = useParams()
  const data = useData()
  const [qr, setQr] = useState(null)
  const [withPrices, setWithPrices] = useState(false)
  const place = data.placeById.get(id)

  useEffect(() => {
    QRCode.toDataURL(`${window.location.origin}/p/${id}`, { margin: 1, width: 240 })
      .then(setQr)
      .catch(err => console.error('qr:', err))
  }, [id])

  if (!place) return <p className='muted center'>{data.loading ? t('common.loading') : t('place.unknown')}</p>

  // Depth-first: this place's items, then each sub-place's, so the sheet reads top to bottom.
  const sections = []
  const walk = (pid, depth) => {
    const items = data.itemsOf(pid)
    if (items.length || pid === id) sections.push({ place: data.placeById.get(pid), depth, items })
    for (const c of data.childrenOf(pid)) walk(c.id, depth + 1)
  }
  walk(id, 0)
  const count = sections.reduce((n, s) => n + s.items.length, 0)
  const value = data.totalValue(id)

  return (
    <div className='page print-sheet'>
      <div className='no-print row'>
        <button className='btn primary' onClick={() => window.print()}><Icon name='print' />{t('action.print')}</button>
        <label className='check'><input type='checkbox' checked={withPrices} onChange={e => setWithPrices(e.target.checked)} />{t('print.withPrices')}</label>
      </div>
      <header className='sheet-head'>
        <div>
          <small>{data.pathText(place.parent)}</small>
          <h1>{place.name}</h1>
          <p>{plural(count, 'item')}{withPrices && value > 0 && ` · ${t('print.total', { value: formatPrice(value) })}`} · {t('print.printed', { date: new Date().toLocaleDateString(getLang()) })}</p>
        </div>
        {qr && <img src={qr} alt='' />}
      </header>
      {sections.map(s => (
        <section key={s.place.id} style={{ '--depth': s.depth }}>
          {s.depth > 0 && <h2>{data.path(s.place.id).slice(data.path(id).length).map(p => p.name).join(' › ')}</h2>}
          <table>
            <tbody>
              {s.items.map(i => (
                <tr key={i.id}>
                  <td className='box'>☐</td>
                  <td>{i.name}{i.note && <small> — {i.note}</small>}</td>
                  <td className='num'>{i.quantity > 1 ? `×${i.quantity}` : ''}</td>
                  {withPrices && <td className='num'>{formatPrice(i.price)}</td>}
                </tr>
              ))}
              {!s.items.length && <tr><td colSpan={4} className='muted'>{t('print.noneDirect')}</td></tr>}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  )
}
