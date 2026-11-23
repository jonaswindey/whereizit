import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { pb } from './pb.js'
import { toDate } from './format.js'
import { today } from './claims.js'
import { t } from './i18n.jsx'

const SOON_DAYS = 60

// PoC: the whole household inventory is loaded into memory. At a few thousand records this is
// fast, makes paths/counts/search trivial, and is the read model offline mode will need anyway.
const DataContext = createContext(null)

function buildIndex (places, items, tags, lists, extras, drafts = []) {
  const placeById = new Map(places.map(p => [p.id, p]))
  // Drafts (photographed, not named yet) are reachable by id but stay out of every list.
  const itemById = new Map([...items, ...drafts].map(i => [i.id, i]))
  const tagById = new Map(tags.map(t => [t.id, t]))
  const children = new Map()
  for (const p of places) {
    const key = p.parent || ''
    if (!children.has(key)) children.set(key, [])
    children.get(key).push(p)
  }
  const itemsByPlace = new Map()
  for (const i of items) {
    if (!itemsByPlace.has(i.place)) itemsByPlace.set(i.place, [])
    itemsByPlace.get(i.place).push(i)
  }

  const childrenOf = id => children.get(id ?? '') ?? []
  const itemsOf = id => itemsByPlace.get(id) ?? []

  const path = id => {
    const out = []
    const seen = new Set()
    let cur = placeById.get(id)
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id)
      out.unshift(cur)
      cur = placeById.get(cur.parent)
    }
    return out
  }

  const descendants = id => {
    const out = new Set([id])
    const stack = [id]
    while (stack.length) {
      for (const c of childrenOf(stack.pop())) {
        if (!out.has(c.id)) {
          out.add(c.id)
          stack.push(c.id)
        }
      }
    }
    return out
  }

  const totalItems = id => {
    let n = 0
    for (const pid of descendants(id)) n += itemsOf(pid).length
    return n
  }

  // Photos of what's inside, for places that have no photo of their own.
  const mosaic = (id, n = 4) => {
    const ids = descendants(id)
    const out = []
    for (const i of items) {
      if (ids.has(i.place) && i.photos?.length) out.push(i)
      if (out.length === n) break
    }
    return out
  }

  const totalValue = id => {
    let sum = 0
    const ids = id ? descendants(id) : null
    for (const i of items) if (!ids || ids.has(i.place)) sum += i.price || 0
    return sum
  }

  const now = Date.now()
  const soon = now + SOON_DAYS * 86400000
  const expiryState = item => {
    const t = toDate(item.expires)?.getTime()
    if (!t) return null
    return t < now ? 'expired' : t < soon ? 'soon' : null
  }

  // Due when the interval has passed since the last service (or it was never done).
  const nextService = item => {
    if (!(item.service_every_days > 0)) return null
    const last = toDate(item.serviced_at)?.getTime()
    return last ? last + item.service_every_days * 86400000 : now
  }

  const today = new Date().toISOString().slice(0, 10)
  const isOverdue = item => !!(item.lent_to && item.lent_due && item.lent_due.slice(0, 10) < today)
  // Borrowed from someone else and past the date it should go back.
  const isBackDue = item => !!(item.borrowed_from && item.borrowed_due && item.borrowed_due.slice(0, 10) < today)

  // Same name (ignoring case, accents and a trailing "(copy)") in more than one record.
  const dupKey = name => name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s*\((copy|kopie)\)$/, '').replace(/\s+/g, ' ').trim()
  const groups = new Map()
  for (const i of items) {
    const k = dupKey(i.name)
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k).push(i)
  }
  const duplicates = [...groups.values()].filter(g => g.length > 1).sort((a, b) => b.length - a.length || a[0].name.localeCompare(b[0].name))

  // Places with items directly inside, oldest check first; a place counts as checked when every item in it is.
  const checkDue = places.map(p => {
    const inside = itemsByPlace.get(p.id) ?? []
    if (!inside.length) return null
    const stamps = inside.map(i => i.checked_at || '')
    const oldest = stamps.includes('') ? '' : stamps.sort()[0]
    return { place: p, count: inside.length, checked: oldest }
  }).filter(Boolean).sort((a, b) => a.checked.localeCompare(b.checked) || b.count - a.count)

  // Days until a supply runs out, from its recent use (decreases in the stock log, last 4 weeks).
  // Null until there's enough history to say anything (two drops over at least two days).
  const runsOutIn = item => {
    const log = Array.isArray(item.stock_log) ? item.stock_log : []
    const since = now - 28 * 86400000
    const recent = log.filter(([at]) => new Date(at).getTime() >= since)
    if (recent.length < 3) return null
    let used = 0
    let drops = 0
    for (let n = 1; n < recent.length; n++) {
      const diff = recent[n - 1][1] - recent[n][1]
      if (diff > 0) { used += diff; drops++ }
    }
    const days = (now - new Date(recent[0][0]).getTime()) / 86400000
    if (drops < 2 || days < 2 || !used) return null
    return Math.round((item.quantity ?? 0) / (used / days))
  }

  // Cataloguing progress: the storage spots (places without sub-places) inside, and how many are
  // marked done. A spot with no children counts as itself.
  const progress = id => {
    const ids = descendants(id)
    let total = 0
    let done = 0
    for (const pid of ids) {
      if (childrenOf(pid).length) continue
      total++
      if (placeById.get(pid)?.done) done++
    }
    return { done, total, pct: total ? Math.round((done / total) * 100) : 0 }
  }

  // Mission-sized rooms: places whose children are all storage spots (a kitchen with its drawers).
  const missionRooms = places.filter(p => {
    const kids = childrenOf(p.id)
    return kids.length > 0 && kids.every(c => !childrenOf(c.id).length)
  })

  return {
    places,
    missionRooms,
    extras,
    drafts,
    progress,
    draftsIn: id => { const ids = descendants(id); return drafts.filter(d => ids.has(d.place)) },
    repairs: items.filter(i => i.needs_repair),
    isOverdue,
    overdue: items.filter(isOverdue),
    owners: [...new Set(items.map(i => i.owner).filter(Boolean))].sort(),
    lendPeople: [...new Set(items.map(i => i.lent_to).filter(Boolean))].sort(),
    duplicates,
    checkDue,
    items,
    tags,
    lists,
    totalValue,
    nextService,
    // Shown from two weeks before it's due.
    maintenanceDue: items.filter(i => nextService(i) !== null && nextService(i) <= now + 14 * 86400000)
      .sort((a, b) => nextService(a) - nextService(b)),
    missing: items.filter(i => i.missing),
    pinned: items.filter(i => i.pinned),
    expiryState,
    expiring: items.filter(i => expiryState(i)).sort((a, b) => a.expires.localeCompare(b.expires)),
    // Items whose home was deleted (home cleared) are not "misplaced", they just have no home.
    misplaced: items.filter(i => i.place && i.home && i.home !== i.place && placeById.has(i.home)),
    // Added without a place, to be put away later.
    unsorted: items.filter(i => !i.place),
    tagById,
    tagsOf: item => (item.tags ?? []).map(id => tagById.get(id)).filter(Boolean),
    itemsWithTag: id => items.filter(i => i.tags?.includes(id)),
    lent: items.filter(i => i.lent_to),
    borrowed: items.filter(i => i.borrowed_from),
    essentials: items.filter(i => i.essential),
    carried: items.filter(i => i.with_user),
    forSale: items.filter(i => i.for_sale),
    // Taken along days ago and still not back: probably left in a bag, a car or a bedroom.
    carriedLong: items.filter(i => i.with_user && i.with_since && Date.now() - new Date(i.with_since.replace(' ', 'T')).getTime() > 3 * 864e5),
    isBackDue,
    borrowPeople: [...new Set(items.map(i => i.borrowed_from).filter(Boolean))].sort(),
    // Supplies (staples) count as low at their reorder level, which is 0 ("out") unless set.
    lowStock: items.filter(i => (i.min_quantity > 0 || i.staple) && (i.quantity ?? 0) <= (i.min_quantity || 0)),
    staples: items.filter(i => i.staple).sort((a, b) => a.name.localeCompare(b.name)),
    // How many to buy: up to the target, or one more than the reorder level when no target is set.
    toBuy: i => Math.max((i.stock_target || (i.min_quantity || 0) + 1) - (i.quantity ?? 0), 1),
    // A stock check marks every staple as checked, so the newest check time is the last check.
    runsOutIn,
    lastStockCheck: items.filter(i => i.staple && i.checked_at).map(i => i.checked_at).sort().pop() ?? null,
    mosaic,
    placeById,
    itemById,
    childrenOf,
    itemsOf,
    path,
    pathText: id => path(id).map(p => p.name).join(' › '),
    whereText: id => path(id).map(p => p.name).join(' › ') || t('unsorted.noPlace'),
    descendants,
    totalItems
  }
}

export function DataProvider ({ children }) {
  const [state, setState] = useState({ places: [], items: [], drafts: [], tags: [], lists: [], extras: [], asks: [], claims: [], loading: true, error: null })

  const reload = useCallback(async () => {
    try {
      // Asks: open ones, plus answers from the last two weeks so the board shows who found what.
      const since = new Date(Date.now() - 14 * 864e5).toISOString().replace('T', ' ')
      const day = today()
      const [places, items, tags, lists, extras, asks, claims] = await Promise.all([
        // Manual order first (floors: cellar, ground, first), then alphabetical for the rest.
        pb.collection('places').getFullList({ sort: 'order,name' }),
        // Trashed and gone (given away, sold…) items are left out; their own pages ask for them.
        pb.collection('items').getFullList({ sort: '-created', filter: "deleted = '' && gone = ''" }),
        pb.collection('tags').getFullList({ sort: 'name' }),
        pb.collection('lists').getFullList({ sort: '-updated' }),
        pb.collection('shopping_extras').getFullList({ sort: 'created' }),
        pb.collection('asks').getFullList({ sort: '-created', filter: pb.filter("answered = '' || answered >= {:since}", { since }) }),
        // Claims that are still ahead or running ("I need the tent on Saturday").
        pb.collection('reservations').getFullList({ sort: 'start,created', filter: pb.filter('start >= {:day} || end >= {:day}', { day }) })
      ])
      setState({ places, items: items.filter(i => !i.needs_name), drafts: items.filter(i => i.needs_name), tags, lists, extras, asks, claims, loading: false, error: null })
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: err.message }))
    }
  }, [])

  useEffect(() => { reload() }, [reload])

  // Realtime keeps two phones in sync while cataloguing together.
  useEffect(() => {
    let active = true
    let timer
    const unsubs = []
    const onChange = () => {
      clearTimeout(timer)
      timer = setTimeout(reload, 300)
    }
    for (const name of ['places', 'items', 'tags', 'lists', 'shopping_extras', 'asks', 'reservations']) {
      pb.collection(name).subscribe('*', onChange)
        .then(unsub => (active ? unsubs.push(unsub) : unsub()))
        .catch(err => console.warn(`realtime ${name}:`, err.message))
    }
    return () => {
      active = false
      clearTimeout(timer)
      unsubs.forEach(u => u())
    }
  }, [reload])

  const value = useMemo(() => ({
    ...buildIndex(state.places, state.items, state.tags, state.lists, state.extras, state.drafts),
    asks: state.asks,
    openAsks: state.asks.filter(a => !a.answered),
    // Claims on things that are gone or in the trash are left out.
    claims: state.claims.filter(c => state.items.some(i => i.id === c.item)),
    claimsOf: id => state.claims.filter(c => c.item === id),
    loading: state.loading,
    error: state.error,
    reload
  }), [state, reload])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export const useData = () => useContext(DataContext)
