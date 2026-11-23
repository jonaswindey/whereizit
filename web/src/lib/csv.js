// Minimal RFC 4180 parser: quoted fields, doubled quotes, newlines inside quotes.
// The delimiter is guessed from the header line, because Excel with Dutch/Belgian settings saves with ';'.
export function parseCsv (text) {
  const clean = text.replace(/^﻿/, '')
  const firstLine = clean.split(/\r?\n/, 1)[0]
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') { field += '"'; i++ } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === delim) { row.push(field); field = '' } else if (c === '\n' || c === '\r') {
      if (c === '\r' && clean[i + 1] === '\n') i++
      row.push(field); rows.push(row); row = []; field = ''
    } else field += c
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows.filter(r => r.some(cell => cell.trim()))
}

// Header aliases (English export columns + Dutch) → item field.
const COLUMNS = {
  name: ['name', 'naam', 'item', 'voorwerp'],
  quantity: ['quantity', 'aantal', 'qty'],
  min_quantity: ['min_quantity', 'minimum', 'warn below', 'waarschuw onder'],
  location: ['location', 'locatie', 'plek', 'place', 'waar', 'where'],
  tags: ['tags', 'labels', 'label', 'tag'],
  note: ['note', 'notitie', 'notes', 'opmerking'],
  lent_to: ['lent_to', 'uitgeleend aan', 'lent to'],
  purchase_date: ['purchase_date', 'gekocht op', 'bought on', 'aankoopdatum'],
  price: ['price', 'prijs'],
  warranty_until: ['warranty_until', 'garantie tot', 'warranty until'],
  expires: ['expires', 'vervalt', 'vervaldatum'],
  brand: ['brand', 'merk'],
  model: ['model'],
  serial: ['serial', 'serienummer', 'serial number'],
  owner: ['owner', 'eigenaar', 'van wie']
}

export function mapRows (rows) {
  const header = rows[0].map(h => h.trim().toLowerCase())
  const index = {}
  for (const [field, names] of Object.entries(COLUMNS)) {
    const i = header.findIndex(h => names.includes(h))
    if (i !== -1) index[field] = i
  }
  if (index.name === undefined) return { error: 'noName', items: [] }
  const items = rows.slice(1).map(r => {
    const get = f => (index[f] === undefined ? '' : (r[index[f]] ?? '').trim())
    // Locations accept "House › Kitchen", "House > Kitchen" or "House / Kitchen".
    const path = get('location').split(/\s*[›>/]\s*/).map(s => s.trim()).filter(Boolean)
    // Prices may use a decimal comma ("12,50").
    const price = Number(get('price').replace(/[^\d,.-]/g, '').replace(',', '.')) || 0
    return {
      name: get('name'),
      quantity: Math.max(0, parseInt(get('quantity'), 10) || 1),
      min_quantity: parseInt(get('min_quantity'), 10) || 0,
      path,
      tags: get('tags').split(/\s*[;,]\s*/).filter(Boolean),
      note: get('note'),
      lent_to: get('lent_to'),
      purchase_date: get('purchase_date'),
      price,
      warranty_until: get('warranty_until'),
      expires: get('expires'),
      brand: get('brand'),
      model: get('model'),
      serial: get('serial'),
      owner: get('owner')
    }
  }).filter(i => i.name)
  return { items, columns: Object.keys(index) }
}
