import { getLang } from './i18n.jsx'

// Starting points for the setup wizard. Each entry is [Dutch, English]; `on` = ticked by default.
// The household unticks what it doesn't have; nothing here is created without a review step.
const L = ([nl, en]) => (getLang() === 'nl' ? nl : en)

export const AREAS = [
  { key: 'house', name: ['Huis', 'House'], on: true },
  { key: 'garden', name: ['Tuin', 'Garden'] },
  { key: 'shed', name: ['Tuinhuis', 'Shed'] },
  { key: 'garage', name: ['Garage', 'Garage'] }
]

export const FLOORS = [
  { key: 'cellar', name: ['Kelder', 'Cellar'] },
  { key: 'ground', name: ['Gelijkvloers', 'Ground floor'], on: true },
  { key: 'first', name: ['Eerste verdieping', 'First floor'], on: true },
  { key: 'second', name: ['Tweede verdieping', 'Second floor'] },
  { key: 'attic', name: ['Zolder', 'Attic'] }
]

// Rooms suggested per floor; anything can be added by name too.
export const ROOMS = {
  cellar: [['Kelder', 'Cellar']],
  ground: [['Keuken', 'Kitchen'], ['Living', 'Living room'], ['Eetkamer', 'Dining room'], ['Toilet', 'Toilet'], ['Hal', 'Hall'], ['Berging', 'Storage room'], ['Wasplaats', 'Laundry room'], ['Bureau', 'Office']],
  first: [['Slaapkamer', 'Bedroom'], ['Slaapkamer 2', 'Bedroom 2'], ['Slaapkamer 3', 'Bedroom 3'], ['Badkamer', 'Bathroom'], ['Toilet boven', 'Upstairs toilet'], ['Bureau', 'Office'], ['Speelkamer', 'Playroom']],
  second: [['Slaapkamer', 'Bedroom'], ['Badkamer', 'Bathroom'], ['Zolderkamer', 'Loft room']],
  attic: [['Zolder', 'Attic']],
  house: [['Keuken', 'Kitchen'], ['Living', 'Living room'], ['Badkamer', 'Bathroom'], ['Slaapkamer', 'Bedroom'], ['Berging', 'Storage room']]
}
export const ROOMS_ON = { ground: 3, first: 2, second: 1, cellar: 1, attic: 1, house: 3 }

// Storage spots per kind of room, matched on the room name.
const SPOTS = [
  [/keuken|kitchen/i, [['Lade 1', 'Drawer 1'], ['Lade 2', 'Drawer 2'], ['Lade 3', 'Drawer 3'], ['Bovenkasten', 'Upper cupboards'], ['Onderkasten', 'Lower cupboards'], ['Kast onder de gootsteen', 'Under the sink'], ['Voorraadkast', 'Pantry'], ['Koelkast', 'Fridge'], ['Diepvries', 'Freezer']], 6],
  [/living|woon|zetel/i, [['Tv-meubel', 'TV unit'], ['Boekenkast', 'Bookcase'], ['Dressoir', 'Sideboard'], ['Salontafel', 'Coffee table']], 2],
  [/eetkamer|dining/i, [['Dressoir', 'Sideboard'], ['Buffetkast', 'Cabinet']], 1],
  [/slaapkamer|bedroom|zolderkamer|loft/i, [['Kleerkast', 'Wardrobe'], ['Nachtkastje', 'Bedside table'], ['Ladekast', 'Chest of drawers'], ['Onder het bed', 'Under the bed']], 2],
  [/badkamer|bathroom/i, [['Badkamerkast', 'Bathroom cabinet'], ['Lade onder de lavabo', 'Drawer under the sink'], ['Spiegelkast', 'Mirror cabinet']], 2],
  [/toilet/i, [['Kastje', 'Small cabinet']], 1],
  [/bureau|office/i, [['Bureaulades', 'Desk drawers'], ['Boekenkast', 'Bookcase'], ['Archiefkast', 'Filing cabinet']], 2],
  [/wasplaats|laundry/i, [['Rek', 'Shelving'], ['Kast', 'Cupboard'], ['Wasmand', 'Laundry basket']], 2],
  [/berging|storage/i, [['Rek 1', 'Shelving 1'], ['Rek 2', 'Shelving 2'], ['Kast', 'Cupboard']], 2],
  [/hal|hall/i, [['Kapstok', 'Coat rack'], ['Schoenenkast', 'Shoe cabinet']], 2],
  [/speelkamer|playroom/i, [['Speelgoedkast', 'Toy cupboard'], ['Bakken', 'Bins']], 2],
  [/garage/i, [['Werkbank', 'Workbench'], ['Rek 1', 'Shelving 1'], ['Rek 2', 'Shelving 2'], ['Gereedschapskast', 'Tool cabinet'], ['Wandbord', 'Pegboard']], 3],
  [/tuinhuis|shed/i, [['Rek', 'Shelving'], ['Werkbank', 'Workbench'], ['Haken aan de wand', 'Wall hooks']], 2],
  [/tuin|garden/i, [['Tuinkast', 'Garden storage'], ['Kas', 'Greenhouse']], 1],
  [/zolder|attic/i, [['Dozen links', 'Boxes left'], ['Dozen rechts', 'Boxes right'], ['Rek', 'Shelving']], 2],
  [/kelder|cellar/i, [['Voorraadrek', 'Pantry shelving'], ['Rek', 'Shelving'], ['Wijnrek', 'Wine rack']], 2]
]

export const localName = L

export function spotsFor (roomName) {
  const hit = SPOTS.find(([re]) => re.test(roomName))
  if (!hit) return { names: [['Kast', 'Cupboard'], ['Rek', 'Shelving']].map(L), on: 1 }
  return { names: hit[1].map(L), on: hit[2] }
}
