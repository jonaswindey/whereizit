// Offline support: the app opens and shows the last-synced inventory and photos without a connection.
// Writes still need the server (failed uploads stay in the in-app retry queue).
const SHELL = 'shell-v1'
const FILES = 'files-v1'
const API = 'api-v1'
const NETWORK_TIMEOUT = 4000 // when the Mac is asleep, requests hang rather than fail fast

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(['/', '/manifest.webmanifest', '/icon.svg'])))
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (![SHELL, FILES, API].includes(key)) await caches.delete(key)
    }
    await self.clients.claim()
  })())
})

// Cached API responses belong to the signed-in household member; drop them on sign-out.
self.addEventListener('message', e => {
  if (e.data === 'logout') e.waitUntil(caches.delete(API))
})

self.addEventListener('fetch', e => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/realtime') || url.pathname.startsWith('/_/')) return
  // Uploaded file names carry a random suffix, so a cached copy never goes stale.
  if (url.pathname.startsWith('/api/files/')) return e.respondWith(cacheFirst(req, FILES))
  if (url.pathname.startsWith('/api/')) return e.respondWith(networkFirst(req, API))
  if (req.mode === 'navigate') return e.respondWith(networkFirst(req, SHELL, '/'))
  if (url.pathname.startsWith('/assets/')) return e.respondWith(cacheFirst(req, SHELL))
})

async function cacheFirst (req, name) {
  const cache = await caches.open(name)
  const hit = await cache.match(req)
  if (hit) return hit
  const res = await fetch(req)
  if (res.ok) cache.put(req, res.clone())
  return res
}

async function networkFirst (req, name, key = req) {
  const cache = await caches.open(name)
  const network = fetch(req).then(res => {
    if (res.ok) cache.put(key, res.clone())
    return res
  })
  network.catch(() => {}) // handled below; avoid an unhandled rejection when the timeout wins
  try {
    const res = await Promise.race([network, new Promise(resolve => setTimeout(resolve, NETWORK_TIMEOUT, null))])
    if (res) return res
    return (await cache.match(key)) ?? network
  } catch (err) {
    const hit = await cache.match(key)
    if (hit) return hit
    throw err
  }
}
