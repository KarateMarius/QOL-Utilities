// Preisverlauf beobachteter Produkte.
//
// Wozu: Ein Rabatt sagt fuer sich genommen wenig. "-30%" auf einen vorher
// angehobenen Preis ist kein Angebot. Erst der Tiefstpreis der letzten Wochen
// zeigt, ob sich Zugreifen lohnt.
//
// Beobachtet wird bewusst nicht alles: nur was im Einkaufskorb liegt, auf der
// Watchlist trifft oder aus einem Shop kommt. 2000 Prospektartikel taeglich
// mitzuschreiben waere teuer und fuer niemanden von Nutzen.
//
// WICHTIG: Der Verlauf beginnt an dem Tag, an dem ein Produkt zum ersten Mal
// beobachtet wird. Vorher gibt es keine Daten - rueckwirkend laesst sich das
// nirgends beschaffen. Deshalb nennt die Auswertung immer mit, ueber wie viele
// Tage sie ueberhaupt blickt.
import { readKey, writeKey } from "./_store.js";

const KEEP_DAYS = 60;
const WINDOW_DAYS = 30;
const TTL_SECONDS = 90 * 24 * 3600;

const historyKey = (key) => `angebote:hist:${key}`;

export const today = () => new Date().toISOString().slice(0, 10);

function daysBetween(isoA, isoB) {
  return Math.round((Date.parse(isoB) - Date.parse(isoA)) / 86400000);
}

// Mengenangaben, Sortenzusaetze und Satzzeichen fliegen raus: "Hähnchenbrust
// 400g" und "Hähnchenbrust, je 400-g-Packung" sind dasselbe Produkt.
const NOISE =
  /\b(\d+[.,]?\d*\s*-?\s*(kg|g|ml|l|st|stk|stück|wl|tab)\b|je\b|ca\.|versch\.|sorten|packung|pckg\.?|btl\.?|beutel|schale|dose|glas|flasche|fl\.?|becher|tafel|karton|kiste|probe|angebot)/gi;

/**
 * Stabiler Schluessel fuer ein Produkt.
 *
 * Shop-Artikel haben eine feste Varianten-ID - die bleibt. Prospekt-Angebote
 * bekommen jede Woche neue IDs, dort muss der Name herhalten.
 */
export function keyFor(deal) {
  if (!deal) return "";
  if (String(deal.id || "").startsWith("shop-")) return deal.id;

  const name = String(deal.title || deal.name || "")
    .toLowerCase()
    .replace(NOISE, " ")
    .replace(/[^a-zäöüß0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 48);

  if (!name) return "";
  return `${String(deal.merchant || "").toLowerCase()}|${name}`;
}

/** Ein Preis pro Tag und Produkt - der niedrigste des Tages zaehlt. */
export async function record(key, label, rawPrice, day = today()) {
  // Auf Cent runden: sonst sammeln sich Fliesskomma-Reste wie 0.44999999996 an.
  const price = Math.round(rawPrice * 100) / 100;
  if (!key || !(price > 0)) return false;

  const stored = (await readKey(historyKey(key))) || { points: [] };
  const points = Array.isArray(stored.points) ? stored.points : [];

  const existing = points.find((p) => p.d === day);
  if (existing) {
    if (price >= existing.p) return false;
    existing.p = price;
  } else {
    points.push({ d: day, p: price });
  }

  points.sort((a, b) => a.d.localeCompare(b.d));
  const trimmed = points.slice(-KEEP_DAYS);

  return writeKey(historyKey(key), { key, label, points: trimmed }, TTL_SECONDS);
}

// Jedes Produkt kostet ein Lesen und ein Schreiben. Streng nacheinander waeren
// das bei 150 beobachteten Artikeln 300 Rundreisen zur Datenbank - der
// Cron-Lauf liefe in den Function-Timeout. Gedeckelt parallel bleibt es
// schnell, ohne Upstash zu ueberfahren.
const RECORD_CONCURRENCY = 12;

/** Mehrere Produkte auf einmal aufzeichnen. */
export async function recordAll(entries) {
  const day = today();
  const seen = new Set();
  const todo = entries.filter((entry) => {
    if (!entry?.key || seen.has(entry.key)) return false;
    seen.add(entry.key);
    return true;
  });

  let written = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < todo.length) {
      const entry = todo[cursor++];
      if (await record(entry.key, entry.label, entry.price, day)) written++;
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(RECORD_CONCURRENCY, todo.length) }, worker)
  );
  return written;
}

/**
 * Auswertung fuer ein Produkt: Tiefstpreis im Fenster, wann er galt und ueber
 * wie viele Tage ueberhaupt Daten vorliegen.
 */
export async function summarize(key) {
  const stored = await readKey(historyKey(key));
  const points = stored?.points;
  if (!Array.isArray(points) || !points.length) return null;

  const cutoff = new Date(Date.now() - WINDOW_DAYS * 86400000).toISOString().slice(0, 10);
  const window = points.filter((p) => p.d >= cutoff);
  if (!window.length) return null;

  const low = window.reduce((best, p) => (p.p < best.p ? p : best), window[0]);
  const first = window[0].d;

  return {
    low: low.p,
    low_date: low.d,
    // Ueber wie viele Tage der Verlauf tatsaechlich reicht. Nach zwei Tagen
    // Beobachtung ist ein "Tiefstpreis" noch keine Aussage.
    days: daysBetween(first, today()) + 1,
    points: window,
  };
}

export async function summarizeAll(keys) {
  const unique = [...new Set(keys.filter(Boolean))].slice(0, 120);
  const results = await Promise.all(
    unique.map(async (key) => [key, await summarize(key)])
  );
  return Object.fromEntries(results.filter(([, value]) => value));
}
