import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import Icon from '../components/Icon.jsx'
import { hue } from '../components/Thumb.jsx'
import { useData } from '../lib/data.jsx'
import { thumbUrl } from '../lib/pb.js'
import { squarify } from '../lib/treemap.js'
import { plural } from '../lib/format.js'
import { getPref, setPref } from '../lib/recent.js'
import FloorPlan from '../components/FloorPlan.jsx'
import { t } from '../lib/i18n.jsx'

const GAP = 4
const HEAD = 30 // px for a tile's title row when it shows its children inside
const MAX_DEPTH = 2 // levels drawn inside the top-level tiles: House > Floor > Room in one view

// 'equal': every child gets the same share, so the map reads as the house's structure.
// 'items': share follows how much is stored there (+1 keeps empty places tappable).
function nodesFor (data, id, sizing) {
  const weight = p => (sizing === 'items' ? 1 + data.totalItems(p.id) : 1 + data.childrenOf(p.id).length * 0.25)
  const nodes = data.childrenOf(id).map(p => ({ kind: 'place', place: p, value: weight(p) }))
  const loose = id ? data.itemsOf(id) : []
  if (loose.length) nodes.push({ kind: 'items', items: loose, value: sizing === 'items' ? loose.length : 1 })
  return nodes
}

function useSize (ref) {
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ w: width, h: height })
    })
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [ref])
  return size
}

function TileThumb ({ data, node }) {
  if (node.kind === 'items') return <span className='tile-icon'><Icon name='box' size={14} /></span>
  const p = node.place
  const [first] = p.photo ? [] : data.mosaic(p.id, 1)
  const src = p.photo ? thumbUrl(p, p.photo) : first ? thumbUrl(first, first.photos[0]) : null
  return src ? <img className='tile-thumb' src={src} alt='' /> : null
}

function Tile ({ data, rect, node, parentId, depth, sizing }) {
  const style = {
    left: rect.x + GAP / 2,
    top: rect.y + GAP / 2,
    width: Math.max(0, rect.w - GAP),
    height: Math.max(0, rect.h - GAP)
  }
  const tiny = style.width < 40 || style.height < 26

  if (node.kind === 'items') {
    return (
      <Link to={`/p/${parentId}`} className={`tile loose ${tiny ? 'tiny' : ''}`} style={style}>
        {!tiny && <span className='tile-title'><TileThumb data={data} node={node} /><span>{plural(node.items.length, 'item')}</span></span>}
        {!tiny && style.height > 60 && <span className='loose-names'>{node.items.map(i => i.name).join(' · ')}</span>}
      </Link>
    )
  }

  const p = node.place
  const kids = depth < MAX_DEPTH ? nodesFor(data, p.id, sizing) : []
  const nest = kids.length > 0 && style.width > 120 && style.height > 100
  const total = data.totalItems(p.id)
  const inner = nest ? squarify(kids, 0, 0, style.width - 10, style.height - HEAD - 8) : []

  return (
    <div className={`tile depth-${depth} ${nest ? 'nested' : ''} ${tiny ? 'tiny' : ''}`} style={{ ...style, '--h': hue(p.name) }}>
      <Link to={`/map/${p.id}`} viewTransition className='tile-hit' aria-label={t('map.zoomInto', { name: p.name })} />
      {!tiny && (
        <span className='tile-title'>
          <TileThumb data={data} node={node} />
          <span>
            <strong>{p.name}</strong>
            {!nest && <small>{total ? plural(total, 'item') : t('map.empty')}</small>}
          </span>
        </span>
      )}
      {nest && (
        <div className='tile-inner' style={{ top: HEAD }}>
          {inner.map((r, i) => (
            <Tile key={r.node.place?.id ?? `items-${i}`} data={data} rect={r} node={r.node} parentId={p.id} depth={depth + 1} sizing={sizing} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function MapPage () {
  const { id = null } = useParams()
  const data = useData()
  const canvas = useRef(null)
  const { w, h } = useSize(canvas)
  const [sizing, setSizing] = useState(() => getPref('mapSizing', 'equal'))
  const [view, setView] = useState('plan')
  const place = id ? data.placeById.get(id) : null
  const nodes = useMemo(() => nodesFor(data, id, sizing), [data, id, sizing])
  const rects = useMemo(() => squarify(nodes, 0, 0, w, h), [nodes, w, h])
  const trail = id ? data.path(id) : []

  const choose = value => {
    setSizing(value)
    setPref('mapSizing', value)
  }

  return (
    <div className='page map-page'>
      <nav className='crumbs' aria-label={t('map.location')}>
        <Link to='/map' viewTransition className='crumb'><Icon name='map' size={16} />{t('map.all')}</Link>
        {trail.map(p => (
          <span key={p.id} className='crumb-wrap'>
            <Icon name='chevron' size={14} />
            <Link to={`/map/${p.id}`} viewTransition className='crumb'>{p.name}</Link>
          </span>
        ))}
        {place && <Link to={`/p/${id}`} className='chip open-place'>{t('map.open')}<Icon name='chevron' size={14} /></Link>}
      </nav>
      {place?.plan && (
        <div className='segmented' role='group' aria-label={t('plan.view')}>
          <button className={view === 'plan' ? 'on' : ''} onClick={() => setView('plan')}>{t('plan.title')}</button>
          <button className={view === 'tiles' ? 'on' : ''} onClick={() => setView('tiles')}>{t('plan.tiles')}</button>
        </div>
      )}
      {place?.plan && view === 'plan' && <FloorPlan place={place} />}
      <div className='map-canvas' ref={canvas} hidden={!!place?.plan && view === 'plan'}>
        {rects.map((r, i) => (
          <Tile key={r.node.place?.id ?? `items-${i}`} data={data} rect={r} node={r.node} parentId={id} depth={0} sizing={sizing} />
        ))}
        {!nodes.length && !data.loading && (
          <div className='map-empty'>
            <p>{place ? t('map.nothingInside', { name: place.name }) : t('map.noPlaces')}</p>
            <Link to={place ? `/p/${id}` : '/'} className='btn primary'>{t('map.goAdd')}</Link>
          </div>
        )}
      </div>
      <div className='segmented' role='group' aria-label={t('map.tileSize')} hidden={!!place?.plan && view === 'plan'}>
        <span className='muted small'>{t('map.tileSize')}</span>
        <button className={sizing === 'equal' ? 'on' : ''} onClick={() => choose('equal')}>{t('map.equal')}</button>
        <button className={sizing === 'items' ? 'on' : ''} onClick={() => choose('items')}>{t('map.byItems')}</button>
      </div>
    </div>
  )
}
