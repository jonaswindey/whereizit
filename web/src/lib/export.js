import { fileUrl } from './pb.js'

function download (filename, type, content) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  URL.revokeObjectURL(url)
}

const stamp = () => new Date().toISOString().slice(0, 10)

export function exportJson (data) {
  const payload = {
    exportedAt: new Date().toISOString(),
    places: data.places.map(p => ({ ...p, path: data.pathText(p.id), photo: fileUrl(p, p.photo) })),
    items: data.items.map(i => ({
      ...i,
      path: data.pathText(i.place),
      tagNames: data.tagsOf(i).map(t => t.name),
      photos: i.photos.map(f => fileUrl(i, f)),
      attachments: (i.attachments ?? []).map(f => fileUrl(i, f))
    })),
    tags: data.tags
  }
  download(`whereizit-${stamp()}.json`, 'application/json', JSON.stringify(payload, null, 2))
}

const csvCell = value => {
  const s = String(value ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function csvText (data) {
  const header = ['name', 'quantity', 'min_quantity', 'location', 'tags', 'note', 'lent_to', 'purchase_date', 'price', 'warranty_until', 'expires', 'brand', 'model', 'serial', 'owner', 'photo']
  const rows = data.items.map(i => [
    i.name, i.quantity, i.min_quantity, data.pathText(i.place), data.tagsOf(i).map(t => t.name).join('; '),
    i.note, i.lent_to, i.purchase_date?.slice(0, 10), i.price || '', i.warranty_until?.slice(0, 10), i.expires?.slice(0, 10), i.brand, i.model, i.serial, i.owner, fileUrl(i, i.photos[0]) ?? ''
  ])
  return [header, ...rows].map(r => r.map(csvCell).join(',')).join('\n')
}

export function exportCsv (data) {
  download(`whereizit-${stamp()}.csv`, 'text/csv', csvText(data))
}

const safe = s => String(s).replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80) || '-'

// Everything in one file you can keep off the server: CSV, JSON and every photo and attachment,
// in folders named after where things are. Photos are already JPEG, so they're stored, not
// recompressed. fflate is loaded only when someone actually exports.
export async function exportZip (data, onProgress) {
  const { zipSync, strToU8 } = await import('fflate')
  const files = {
    'whereizit/items.csv': strToU8(csvText(data)),
    'whereizit/whereizit.json': strToU8(JSON.stringify({ exportedAt: new Date().toISOString(), places: data.places, items: data.items, tags: data.tags }, null, 2))
  }
  const jobs = []
  for (const i of data.items) {
    const folder = `whereizit/${data.whereText(i.place).split(' › ').map(safe).join('/')}`
    i.photos.forEach((f, n) => jobs.push([`${folder}/${safe(i.name)}${n ? ` ${n + 1}` : ''}.${f.split('.').pop()}`, fileUrl(i, f)]))
    ;(i.attachments ?? []).forEach(f => jobs.push([`${folder}/${safe(i.name)} - ${f.replace(/_[a-z0-9]{10}(\.\w+)$/, '$1')}`, fileUrl(i, f)]))
  }
  for (const p of data.places) {
    if (p.photo) jobs.push([`whereizit/${data.pathText(p.id).split(' › ').map(safe).join('/')}/_${safe(p.name)}.${p.photo.split('.').pop()}`, fileUrl(p, p.photo)])
  }
  let done = 0
  // A few downloads at a time: fast on the home network without flooding the server.
  const queue = [...jobs]
  const worker = async () => {
    while (queue.length) {
      const [name, url] = queue.shift()
      const res = await fetch(url)
      if (!res.ok) throw new Error(`${name}: ${res.status}`)
      let unique = name
      for (let n = 2; files[unique]; n++) unique = name.replace(/(\.\w+)?$/, ` (${n})$1`)
      files[unique] = [new Uint8Array(await res.arrayBuffer()), { level: 0 }]
      onProgress?.(++done, jobs.length)
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker))
  const zipped = zipSync(files)
  download(`whereizit-${stamp()}.zip`, 'application/zip', zipped)
}
