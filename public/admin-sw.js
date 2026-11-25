// Az admin webapp service workere: csak a telefonos értesítésekhez (lib/push.js, components/PushToggle.jsx).
// Nem tárol semmit gyorsítótárban (az admin mindig a friss adatot kéri). Hatóköre: /admin.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data ? event.data.text() : '' }; }
  event.waitUntil(self.registration.showNotification(data.title || 'Tavern Admin', {
    body: data.body || '',
    icon: '/admin-icon-192.png',
    badge: '/admin-icon-192.png',
    tag: data.tag || undefined,
    renotify: !!data.tag,
    data: { url: data.url || '/admin' },
  }));
});

// Koppintásra: a már nyitott admin ablak odanavigál, különben új ablak nyílik
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/admin', self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const win = wins.find(w => w.url.startsWith(`${self.location.origin}/admin`));
    if (win) { await win.focus(); if ('navigate' in win) return win.navigate(url); return undefined; }
    return self.clients.openWindow(url);
  })());
});
