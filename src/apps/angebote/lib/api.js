// Client fuer die Angebots-Endpunkte unter /api/angebote.
//
// Watchlist und Push haengen am angemeldeten Nutzer und antworten ohne Session
// mit 401. Das ist kein Fehlerfall, sondern ein Zustand - deshalb gibt es
// dafuer NOT_AUTHENTICATED statt einer Ausnahme.

export const NOT_AUTHENTICATED = Symbol("notAuthenticated");

// Die Schluessel muessen zu api/angebote/_categorize.js passen; die
// Beschriftungen stehen hier, weil nur die Oberflaeche sie braucht.
export const CATEGORIES = [
  { key: "protein", label: "Protein" },
  { key: "gemüse", label: "Obst & Gemüse" },
  { key: "milch", label: "Milchprodukte" },
  { key: "getränke", label: "Getränke" },
  { key: "süßes", label: "Snacks & Süßes" },
  { key: "haushalt", label: "Drogerie & Haushalt" },
  { key: "supplements", label: "Sport & Supplements" },
  { key: "sonstige", label: "Sonstige" },
];

// Reihenfolge, in der man einen Supermarkt durchlaeuft. Danach sortiert der
// Korb innerhalb eines Ladens - wer die Liste von oben abarbeitet, laeuft
// nicht dreimal zur Kuehltheke zurueck.
//
// Eine Faustregel, kein Gesetz: Obst und Gemuese liegen fast immer am Eingang,
// Getraenke fast immer am Ende (Kaesten schleppt niemand durch den ganzen
// Laden). Dazwischen unterscheiden sich die Maerkte, die Reihenfolge ist dort
// eine vertretbare Annahme.
export const LADENWEG = [
  "gemüse",
  "milch",
  "protein",
  "süßes",
  "haushalt",
  "supplements",
  "getränke",
  "sonstige",
];

/** Platz einer Kategorie auf dem Ladenweg; Unbekanntes wandert ans Ende. */
export function ladenwegPlatz(kategorie) {
  const platz = LADENWEG.indexOf(kategorie);
  return platz === -1 ? LADENWEG.length : platz;
}

async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    ...options,
  });

  // Seit die Anmeldung vor dem ganzen Dienst steht, bedeutet ein 401 mitten
  // im Betrieb nur eins: die Sitzung ist abgelaufen. Der Rahmen hoert auf
  // dieses Ereignis und zeigt wieder den Anmeldebildschirm - sonst bliebe
  // eine leere Liste ohne Erklaerung stehen.
  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent("qol:unauthorized"));
    return NOT_AUTHENTICATED;
  }

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }
  if (!res.ok) throw new Error(payload?.error || `Serverfehler (${res.status})`);
  return payload;
}

export function fetchDeals(plz, refresh = false) {
  return request(`/api/angebote/deals?plz=${encodeURIComponent(plz)}${refresh ? "&refresh=1" : ""}`);
}

export function fetchWatchlist() {
  return request("/api/angebote/watchlist");
}

export function saveWatchlist({ plz, entries }) {
  return request("/api/angebote/watchlist", {
    method: "PUT",
    body: JSON.stringify({ plz, entries }),
  });
}

export function fetchPushConfig() {
  return request("/api/angebote/push");
}

function pushAction(action, extra = {}) {
  return request("/api/angebote/push", {
    method: "POST",
    body: JSON.stringify({ action, ...extra }),
  });
}

export const registerSubscription = (subscription) => pushAction("subscribe", { subscription });
export const removeSubscription = (endpoint) => pushAction("unsubscribe", { endpoint });
export const sendTestPush = () => pushAction("test");
export const sendCartPush = (items) => pushAction("cart", { items });

/**
 * Preisverlauf der interessanten Produkte.
 * `added` meldet, was gerade in den Korb gelegt wurde - daraus entsteht der
 * Zaehler fuer "oefter gekauft". Die Abfrage merkt die Produkte zugleich fuer
 * die naechtliche Aufzeichnung vor.
 */
export function fetchHistory(keys, added = []) {
  return request("/api/angebote/history", {
    method: "POST",
    body: JSON.stringify({ keys, added }),
  });
}
