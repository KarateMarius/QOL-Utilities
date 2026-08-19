// Service Worker: Web Push und die App-Huelle.
//
// Die Trennung ist der springende Punkt:
//
//   /api/*   wird NIE abgelegt. Angebote, Spritpreise und Watchlist muessen
//            frisch sein; aus dem Speicher waeren sie schlimmer als gar
//            keine. (Den zuletzt geholten Prospekt haelt die App selbst im
//            localStorage - siehe hooks/useDeals.js. Das ist etwas anderes:
//            dort weiss die Oberflaeche, wie alt er ist, und sagt es.)
//
//   /assets/ wird abgelegt und zuerst aus dem Speicher bedient. Die Dateien
//            tragen einen Hash im Namen, ein neuer Build hat also neue
//            Adressen - ein veralteter Stand kann gar nicht erst entstehen.
//
//   die Seite selbst kommt zuerst aus dem Netz und nur ersatzweise aus dem
//            Speicher. Andersherum wuerde ein neuer Build erst beim zweiten
//            Start sichtbar.
//
// Wozu: die Einkaufsliste liegt im Browser und ist genau dort gefragt, wo das
// Netz nicht ist - im Laden, im Keller, hinter der Kuehltheke. Ohne
// abgelegte Huelle startet die installierte App dort gar nicht erst.
const CACHE = 'qol-huelle-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Speicher frueherer Fassungen aufraeumen.
      const namen = await caches.keys();
      await Promise.all(namen.filter((name) => name !== CACHE).map((name) => caches.delete(name)));
      await self.clients.claim();
    })()
  );
});

function darfAbgelegtWerden(url) {
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith('/api/')) return false;
  return (
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.webmanifest')
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Die Seite: erst Netz, ersatzweise Speicher.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const antwort = await fetch(request);
          const speicher = await caches.open(CACHE);
          speicher.put(request, antwort.clone());
          return antwort;
        } catch {
          const abgelegt = await caches.match(request);
          return abgelegt || caches.match('/');
        }
      })()
    );
    return;
  }

  if (!darfAbgelegtWerden(url)) return;

  // Gehashte Dateien: erst Speicher, sonst Netz.
  event.respondWith(
    (async () => {
      const abgelegt = await caches.match(request);
      if (abgelegt) return abgelegt;
      const antwort = await fetch(request);
      if (antwort.ok) {
        const speicher = await caches.open(CACHE);
        speicher.put(request, antwort.clone());
      }
      return antwort;
    })()
  );
});

self.addEventListener('push', (event) => {
  let payload = { title: 'Angebotstracker', body: '', tag: 'default' };
  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      lang: 'de',
      renotify: true,
      data: { url: payload.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
