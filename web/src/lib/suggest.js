// Where should this go? Places that already hold similar things: same tags, or a shared word in the
// name ("AA batteries" next to "AAA batteries"). Full places are skipped. Client-side only.
export const words = name => name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .split(/[^a-z0-9]+/).filter(w => w.length >= 3)

// "batterij" and "batterijen", "lamp" and "lampen": a shared start of 4+ letters counts as the same word.
export const sameWord = (a, b) => a === b || (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a)))

export function suggestPlaces (data, things, { exclude = new Set(), limit = 3 } = {}) {
  const ids = new Set(things.map(x => x.id).filter(Boolean))
  const scores = new Map() // placeId → { score, examples }
  const add = (placeId, score, example) => {
    const place = data.placeById.get(placeId)
    if (!place || place.full || exclude.has(placeId)) return
    const s = scores.get(placeId) ?? { score: 0, examples: [] }
    s.score += score
    if (example && !s.examples.includes(example) && s.examples.length < 2) s.examples.push(example)
    scores.set(placeId, s)
  }
  for (const thing of things) {
    const myWords = words(thing.name ?? '')
    const myTags = new Set(thing.tags ?? [])
    for (const other of data.items) {
      if (ids.has(other.id) || !other.place) continue
      const sharedTags = (other.tags ?? []).filter(id => myTags.has(id)).length
      const sharedWords = words(other.name).filter(w => myWords.some(m => sameWord(m, w))).length
      if (sharedTags || sharedWords) add(other.place, sharedTags * 2 + sharedWords * 3, other.name)
    }
  }
  return [...scores.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, limit)
    .map(([placeId, s]) => ({ place: data.placeById.get(placeId), examples: s.examples }))
}

// Tags that similar items (a shared word in the name) carry, most common first.
export function suggestTags (data, name, skip = [], limit = 3) {
  const mine = new Set(words(name))
  if (!mine.size) return []
  const counts = new Map()
  for (const item of data.items) {
    if (!words(item.name).some(w => mine.has(w))) continue
    for (const id of item.tags ?? []) if (!skip.includes(id)) counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => data.tagById.get(id)).filter(Boolean)
}

// Things already in the house that look like `name` (every word matches), so nobody buys a second
// roll of tape. Supplies that are low don't count: that's why they're on the list.
// Short words ("9V", "AA") must match exactly, so 9V batteries aren't "already there" as AA ones.
const allWords = name => name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter(Boolean)
const looksLike = (m, w) => sameWord(m, w) || (m.length >= 4 && w.includes(m)) // "tape" in "ducttape"
export function alreadyHave (data, name, limit = 2) {
  const mine = allWords(name)
  if (!mine.some(m => m.length >= 3)) return []
  const low = new Set(data.lowStock.map(i => i.id))
  return data.items
    .filter(i => !low.has(i.id) && !i.lent_to && mine.every(m => allWords(`${i.name} ${i.aliases ?? ''}`).some(w => looksLike(m, w))))
    .slice(0, limit)
}
