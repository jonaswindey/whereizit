// Recently viewed items, per device. Storage can be unavailable (private mode), so every access is guarded.
const KEY = 'whereizit.recent'
const MAX = 12

const PLACES_KEY = 'whereizit.recentPlaces'

function read (key) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? []
  } catch {
    return []
  }
}

function push (key, id) {
  try {
    localStorage.setItem(key, JSON.stringify([id, ...read(key).filter(x => x !== id)].slice(0, MAX)))
  } catch {}
}

export const getRecent = () => read(KEY)
export const pushRecent = id => push(KEY, id)
// Places opened recently, so the home screen can jump back to the cupboard you were sorting.
export const getRecentPlaces = () => read(PLACES_KEY)
export const pushRecentPlace = id => push(PLACES_KEY, id)

// Where items were last added; offered on the home screen for a while afterwards.
const LAST_ADD_HOURS = 3
export function setLastAdd (placeId) {
  try {
    localStorage.setItem('whereizit.lastAdd', JSON.stringify({ id: placeId, at: Date.now() }))
  } catch {}
}
export function getLastAdd () {
  try {
    const v = JSON.parse(localStorage.getItem('whereizit.lastAdd'))
    return v && Date.now() - v.at < LAST_ADD_HOURS * 3600000 ? v.id : null
  } catch {
    return null
  }
}

export function getPref (key, fallback) {
  try {
    return localStorage.getItem(`whereizit.${key}`) ?? fallback
  } catch {
    return fallback
  }
}

export function setPref (key, value) {
  try {
    localStorage.setItem(`whereizit.${key}`, value)
  } catch {}
}
