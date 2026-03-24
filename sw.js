// PropMap v4.2 — Service Worker
// Network-first untuk JS/CSS/HTML + Push Notification

const CACHE_VER = 'propmap-v4-2-20260324';
const SHELL = [
  './', './index.html', './manifest.json',
  './css/main.css',
  './js/config.js', './js/plan.js', './js/helpers.js', './js/auth.js',
  './js/data.js', './js/ui.js', './js/laporan.js',
  './js/kalender.js', './js/dokumen.js',
  './js/target.js', './js/push.js', './js/offline.js',
  './js/backup.js',
];

// ── INSTALL ──────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VER).then(c =>
      Promise.allSettled(SHELL.map(url => c.add(url).catch(() => {})))
    )
  );
  self.skipWaiting();
});

// ── ACTIVATE — hapus cache lama ──────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VER).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── FETCH ─────────────────────────────────────────
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // External — skip, biarkan browser handle
  const isExternal = [
    'supabase.co','supabase.io','googleapis.com',
    'gstatic.com','jsdelivr.net','cdnjs.cloudflare.com'
  ].some(h => url.hostname.includes(h));
  if (isExternal) return;

  if (e.request.method !== 'GET') return;

  const isAppFile =
    url.pathname.endsWith('.js')   ||
    url.pathname.endsWith('.css')  ||
    url.pathname.endsWith('.html') ||
    url.pathname === '/'           ||
    url.pathname.endsWith('/');

  if (isAppFile) {
    // Network-first: selalu ambil versi terbaru dari server
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            // Clone DULU sebelum dipakai — fix "body already used"
            const resClone = res.clone();
            caches.open(CACHE_VER).then(c => c.put(e.request, resClone));
          }
          return res;
        })
        .catch(() =>
          // Offline fallback
          caches.match(e.request)
            .then(cached => cached || caches.match('./index.html'))
        )
    );
  } else {
    // Cache-first untuk aset lain (gambar, font, dll)
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res.ok) {
            const resClone = res.clone();
            caches.open(CACHE_VER).then(c => c.put(e.request, resClone));
          }
          return res;
        }).catch(() => caches.match('./index.html'));
      })
    );
  }
});

// ── PUSH ─────────────────────────────────────────
self.addEventListener('push', e => {
  let d = { title: 'PropMap', body: 'Ada notifikasi baru' };
  try {
    if (e.data) {
      const text = e.data.text();
      try { d = JSON.parse(text); } catch { d.body = text; }
    }
  } catch(err) { console.warn('Push parse error:', err); }

  const options = {
    body:    d.body    || '',
    icon:    d.icon    || '/icons/icon-192.png',
    badge:   d.badge   || '/icons/icon-72.png',
    tag:     d.tag     || 'propmap-' + Date.now(),
    data:    d.data    || {},
    vibrate: [200, 100, 200],
    requireInteraction: false,
    actions: d.data?.konsumenId ? [
      { action: 'open',    title: 'Lihat Detail' },
      { action: 'dismiss', title: 'Tutup' },
    ] : [],
  };

  e.waitUntil(
    self.registration.showNotification(d.title || 'PropMap', options)
  );
});

// ── NOTIFICATION CLICK ────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();

  if (e.action === 'dismiss') return;

  const konsumenId = e.notification.data?.konsumenId;

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(list => {
        // Cari tab yang sudah terbuka
        for (const c of list) {
          if (c.url.includes(self.registration.scope)) {
            c.focus();
            if (konsumenId) c.postMessage({ type: 'NOTIFICATION_CLICK', konsumenId });
            return;
          }
        }
        // Buka tab baru
        return clients.openWindow('/');
      })
  );
});

// ── MESSAGE FROM PAGE ─────────────────────────────
self.addEventListener('message', e => {
  if (e.data?.type === 'SHOW_NOTIFICATION') {
    const d = e.data;
    self.registration.showNotification(d.title || 'PropMap', {
      body:    d.body    || '',
      icon:    d.icon    || '/icons/icon-192.png',
      badge:   d.badge   || '/icons/icon-72.png',
      tag:     d.tag     || 'propmap-' + Date.now(),
      data:    { konsumenId: d.data?.konsumenId, url: d.url },
      vibrate: [200, 100, 200],
    });
  }
  if (e.data?.type === 'SYNC_NOW') {
    self.registration.sync?.register('sync-queue').catch(() => {});
  }
});

// ── BACKGROUND SYNC ───────────────────────────────
self.addEventListener('sync', e => {
  if (e.tag === 'sync-queue') {
    e.waitUntil(
      clients.matchAll({ type: 'window' }).then(list =>
        list.forEach(c => c.postMessage({ type: 'DO_SYNC' }))
      )
    );
  }
});
