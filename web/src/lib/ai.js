import { useEffect, useState } from 'react'
import { pb } from './pb.js'
import { getLang } from './i18n.jsx'

// Whether the server has an API key; checked once per page load.
let statusPromise
export function useAiEnabled () {
  const [enabled, setEnabled] = useState(false)
  useEffect(() => {
    statusPromise ??= pb.send('/api/wz/ai/status', {}).then(r => !!r.enabled).catch(() => false)
    let active = true
    statusPromise.then(v => active && setEnabled(v))
    return () => { active = false }
  }, [])
  return enabled
}

const toBase64 = file => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result).split(',')[1])
  reader.onerror = () => reject(reader.error)
  reader.readAsDataURL(file)
})

export async function recognisePhoto (file, { place, tags }) {
  const res = await pb.send('/api/wz/ai/photo', {
    method: 'POST',
    body: { image: await toBase64(file), media_type: file.type || 'image/jpeg', place, tags, lang: getLang() }
  })
  return res.items
}

export async function readReceipt (file, item) {
  return pb.send('/api/wz/ai/receipt', {
    method: 'POST',
    body: { image: await toBase64(file), media_type: file.type || 'image/jpeg', item, lang: getLang() }
  })
}

export async function askInventory (query) {
  const res = await pb.send('/api/wz/ai/search', { method: 'POST', body: { query, lang: getLang() } })
  return res.matches
}

// Cut one object out of the shelf photo. Boxes are approximate, so pad generously; a box that's
// tiny or degenerate falls back to the whole photo rather than a useless sliver.
export async function cropToBox (file, box, pad = 0.08) {
  if (!box || box.w < 0.03 || box.h < 0.03) return file
  const bitmap = await createImageBitmap(file)
  const x = Math.max(0, box.x - pad) * bitmap.width
  const y = Math.max(0, box.y - pad) * bitmap.height
  const w = Math.min(1, box.x + box.w + pad) * bitmap.width - x
  const h = Math.min(1, box.y + box.h + pad) * bitmap.height - y
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w)
  canvas.height = Math.round(h)
  canvas.getContext('2d').drawImage(bitmap, x, y, w, h, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('crop failed'))), 'image/jpeg', 0.85)
  )
  return new File([blob], 'photo.jpg', { type: 'image/jpeg' })
}
