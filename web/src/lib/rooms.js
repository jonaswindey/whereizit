// Room identity: every place gets an icon and a colour, so the house reads as rooms rather than a
// list. Explicit choices (place.icon / place.color) win; otherwise the icon comes from the name and
// the colour is inherited from the room it's in, so all kitchen cupboards share the kitchen colour.
// Storage words first: "Badkamerkast" is a cupboard, "Keukenlade" a drawer.
const ICON_WORDS = [
  ['fridge', /koelkast|frigo|fridge|diepvries|freezer/],
  ['wardrobe', /kleerkast|wardrobe|dressing|garderobe/],
  ['drawer', /lade|schuif|drawer/],
  ['cabinet', /kast|cupboard|cabinet|dressoir/],
  ['shelf', /rek|plank|shelf|rack|stelling/],
  ['box', /doos|box|bak|krat|koffer/],
  ['pot', /keuken|kitchen|kook/],
  ['sofa', /living|woonkamer|zetel|salon|lounge/],
  ['bed', /slaapkamer|bedroom|kamer van|kinderkamer|logeer/],
  ['bath', /badkamer|bathroom|douche|wc|toilet/],
  ['car', /garage|carport|oprit/],
  ['roof', /tuinhuis|shed|schuur|chalet/],
  ['layers', /verdieping|gelijkvloers|floor|etage|storey/],
  ['leaf', /tuin|garden|terras|serre|buiten/],
  ['house', /^huis|house|home|appartement/],
  ['roof', /zolder|attic|vliering/],
  ['stairs', /kelder|cellar|basement|trap/],
  ['desk', /bureau|office|werkkamer|studeer/],
  ['washer', /wasplaats|laundry|was|berging|bijkeuken/],
  ['door', /hal|gang|inkom|hall|entree/],
  ['bike', /fiets|bike/],
  ['book', /boek|book|bibliotheek/],
  ['gift', /kerst|christmas|feest/],
  ['shirt', /kleding|kleren|clothes/]
]

const PALETTE = 8
const hash = text => {
  let h = 0
  for (const ch of text.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h
}

export function placeIcon (place) {
  if (place?.icon) return place.icon
  const name = (place?.name ?? '').toLowerCase()
  return ICON_WORDS.find(([, re]) => re.test(name))?.[0] ?? 'box'
}

// Icons that mean "a room" (as opposed to a floor, a building or a cupboard).
const ROOM_KINDS = new Set(['pot', 'sofa', 'bed', 'bath', 'car', 'leaf', 'roof', 'stairs', 'desk', 'washer', 'door'])

function chainOf (data, place) {
  const chain = []
  const seen = new Set()
  for (let cur = place; cur && !seen.has(cur.id); cur = data.placeById.get(cur.parent)) {
    seen.add(cur.id)
    chain.push(cur)
  }
  return chain
}

// The room a place is in (itself if it is one); failing that the level just below the top (a floor,
// the shed), then the place itself.
export function roomOf (data, place) {
  const chain = chainOf(data, place)
  return chain.find(p => ROOM_KINDS.has(placeIcon(p))) ?? chain[chain.length - 2] ?? chain[0]
}

export function placeColor (data, place) {
  const explicit = chainOf(data, place).find(p => p.color)
  if (explicit) return explicit.color
  return `var(--room-${(hash(roomOf(data, place)?.name ?? '') % PALETTE) + 1})`
}

export const ROOM_COLORS = Array.from({ length: PALETTE }, (_, n) => `var(--room-${n + 1})`)
export const ROOM_ICONS = ['house', 'layers', 'pot', 'sofa', 'bed', 'bath', 'desk', 'washer', 'car', 'leaf', 'roof', 'stairs', 'door', 'wardrobe', 'cabinet', 'drawer', 'shelf', 'box', 'fridge', 'bike', 'book', 'gift', 'shirt']
