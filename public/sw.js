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
//   die Seite selbst kommt aus dem Speicher, und erst danach wird im
//            Hintergrund nachgesehen, ob es eine neue gibt. Frueher war es
//            andersherum - Netz zuerst -, damit ein neuer Build sofort
//            sichtbar ist. Das kostete aber vor allem anderen eine volle
//            Runde uebers Netz, und zwar jedes Mal: bevor die Seite da war,
//            konnte nichts anderes anfangen, auch nicht das Buendel und auch
//            nicht die erste Anfrage. Am Handy war das die Wartezeit, die man
//            als "Einen Moment" gelesen hat.
//
//            Der Preis ist, dass ein neuer Build erst beim naechsten Start
//            sichtbar wird. Er ist tragbar, weil die Dateien Hashes tragen:
//            die alte Seite laedt weiterhin genau die Dateien, zu denen sie
//            gehoert, ein halb erneuerter Stand kann also nicht entstehen.
//
// Wozu: die Einkaufsliste liegt im Browser und ist genau dort gefragt, wo das
// Netz nicht ist - im Laden, im Keller, hinter der Kuehltheke. Ohne
// abgelegte Huelle startet die installierte App dort gar nicht erst.
const CACHE = 'qol-huelle-v1';
const SEITE = '/';

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

  // Die Seite: erst Speicher, dann im Hintergrund erneuern.
  //
  // Abgelegt wird immer unter '/', nie unter der aufgerufenen Adresse. Die
  // Anwendung merkt sich ihren Ort im Rautenteil (#arbeitszeit), und
  // /?stempeln=1 liefert dieselbe Seite wie / - es gibt also nur eine, und
  // sie soll auch nur einmal dastehen.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const speicher = await caches.open(CACHE);
        const abgelegt = await speicher.match(SEITE);

        const ausDemNetz = fetch(request)
          .then((antwort) => {
            if (antwort.ok) speicher.put(SEITE, antwort.clone());
            return antwort;
          })
          .catch(() => null);

        // Liegt sie da, geht sie sofort raus; das Nachsehen laeuft weiter,
        // auch wenn die Antwort schon unterwegs ist.
        if (abgelegt) {
          event.waitUntil(ausDemNetz);
          return abgelegt;
        }
        return (await ausDemNetz) || Response.error();
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
