import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import PlaceForm from '../components/PlaceForm.jsx'
import PlacePicker from '../components/PlacePicker.jsx'
import Icon from '../components/Icon.jsx'
import { useData } from '../lib/data.jsx'
import { pb } from '../lib/pb.js'
import { t } from '../lib/i18n.jsx'

// Target of every QR sticker: /l/<code>. Claimed → jump to the place; blank → "What is this?".
export default function LabelPage () {
  const { code } = useParams()
  const data = useData()
  const navigate = useNavigate()
  const [label, setLabel] = useState(undefined)
  const [error, setError] = useState(null)
  const [parent, setParent] = useState(null)
  const [picking, setPicking] = useState(null) // 'parent' | 'existing'

  useEffect(() => {
    pb.collection('labels').getFirstListItem(pb.filter('code = {:code}', { code }))
      .then(setLabel)
      .catch(err => (err.status === 404 ? setLabel(null) : setError(err.message)))
  }, [code])

  if (error) return <p className='error center'>{error}</p>
  if (label === undefined) return <p className='muted center'>{t('label.lookingUp')}</p>
  if (label === null) return <p className='empty'>{t('label.unknown', { code })}</p>
  if (label.place) return <Navigate to={`/p/${label.place}`} replace />

  const claim = async placeId => {
    await pb.collection('labels').update(label.id, { place: placeId })
    await data.reload()
    navigate(`/p/${placeId}`, { replace: true })
  }

  const createAndClaim = async values => {
    const place = await pb.collection('places').create({ ...values, parent: parent ?? '' })
    await claim(place.id)
  }

  const linkExisting = id => {
    setPicking(null)
    claim(id).catch(err => setError(err.message))
  }

  return (
    <div className='page'>
      <p className='pill'><Icon name='qr' size={14} />{t('label.new', { code })}</p>
      <h1 className='page-title'>{t('label.what')}</h1>
      <p className='muted'>{t('label.photoHint')}</p>

      <PlaceForm submitLabel={t('label.save')} onSubmit={createAndClaim}>
        <button type='button' className='btn' onClick={() => setPicking('parent')}>
          {t('label.inside')}: <strong>{parent ? data.pathText(parent) : t('picker.topLevel')}</strong>
        </button>
      </PlaceForm>

      <button className='btn' onClick={() => setPicking('existing')}>{t('label.existing')}</button>

      {picking === 'parent' && (
        <PlacePicker title={t('label.whereIsIt')} allowTop onPick={id => { setParent(id); setPicking(null) }} onClose={() => setPicking(null)} />
      )}
      {picking === 'existing' && (
        <PlacePicker title={t('label.linkTo')} onPick={linkExisting} onClose={() => setPicking(null)} />
      )}
    </div>
  )
}
