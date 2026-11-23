import { Link } from 'react-router'
import Thumb from './Thumb.jsx'
import { thumbUrl } from '../lib/pb.js'
import { useData } from '../lib/data.jsx'

// "House > 1st floor > Bedroom > Cabinet" drawn as boxes inside boxes, innermost = the thing itself.
export default function NestedWhere ({ placeId, leaf }) {
  const data = useData()
  const trail = data.path(placeId)
  let inner = leaf ? <div className='nest-leaf'>{leaf}</div> : null
  for (let i = trail.length - 1; i >= 0; i--) {
    const p = trail[i]
    inner = (
      <div className='nest' style={{ '--depth': i }}>
        <Link to={`/p/${p.id}`} className='nest-head'>
          <Thumb src={thumbUrl(p, p.photo)} name={p.name} className='mini' />
          <span>{p.name}</span>
        </Link>
        {inner}
      </div>
    )
  }
  return <div className='nest-root'>{inner}</div>
}
