const CACHE = 'calo-ngay-v4'
const PRECACHE = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg']

async function precache() {
  const cache = await caches.open(CACHE)
  await cache.addAll(PRECACHE).catch(() => undefined)

  // Vite sinh tên file có hash, nên đọc HTML để biết cần cache những asset nào.
  try {
    const res = await fetch('/index.html', { cache: 'reload' })
    if (!res.ok) return
    const html = await res.text()
    const urls = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1])
    await Promise.allSettled(urls.map((url) => cache.add(url).catch(() => undefined)))
  } catch {
    // Lần cài đầu không có mạng thì bỏ qua, lần online sau sẽ cache lại.
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key.startsWith('calo-ngay-') && key !== CACHE).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // API luôn đi thẳng ra mạng: không cache dữ liệu riêng của tài khoản.
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copy))
        }
        return response
      })
      .catch(() =>
        caches.match(request, { ignoreVary: true }).then((cached) => {
          if (cached) return cached
          if (request.mode === 'navigate') return caches.match('/index.html', { ignoreVary: true })
          return Response.error()
        }),
      ),
  )
})
