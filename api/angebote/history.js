// Preisverlauf der Produkte, die den Nutzer interessieren.
//
// POST { keys: [...], added: [{key, label}] }
//   -> { history: { key: { low, low_date, days, points } }, tracked: n }
//
// Die Anfrage ist zugleich die Anmeldung zur Beobachtung: wonach jemand fragt,
// das schreibt der naechtliche Lauf ab jetzt mit. Ein zweiter Endpunkt nur zum
// Vormerken waere derselbe Vorgang mit mehr Teilen.
//
// `added` meldet, was gerade in den Korb gelegt wurde. Daraus entsteht der
// Zaehler, an dem "oefter gekauft" haengt.
import { getUserId } from "../_auth.js";
import { readProfile, writeProfile } from "./_store.js";
import { summarizeAll } from "./_history.js";

const MAX_TRACKED = 150;
const MAX_KEYS_PER_REQUEST = 120;

function parseBody(req) {
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return null;
    }
  }
  return body || {};
}

/**
 * Beobachtungsliste fortschreiben. Bleibt sie voll, fliegt raus, was am
 * laengsten nicht mehr gefragt wurde - nicht das Seltenste: ein Produkt, das
 * man zweimal im Jahr kauft, soll nicht verschwinden, nur weil man es selten
 * kauft.
 */
function mergeTracked(tracked, keys, added, labels) {
  const next = { ...(tracked || {}) };
  const now = Date.now();

  for (const key of keys) {
    const entry = next[key] || { count: 0, label: labels[key] || "" };
    entry.seen = now;
    if (labels[key]) entry.label = labels[key];
    next[key] = entry;
  }

  for (const key of added) {
    const entry = next[key] || { count: 0, label: labels[key] || "" };
    entry.count = (entry.count || 0) + 1;
    entry.seen = now;
    if (labels[key]) entry.label = labels[key];
    next[key] = entry;
  }

  const keep = Object.entries(next)
    .sort((a, b) => (b[1].seen || 0) - (a[1].seen || 0))
    .slice(0, MAX_TRACKED);

  return Object.fromEntries(keep);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const body = parseBody(req);
  if (!body) return res.status(400).json({ error: "Ungültige Anfrage" });

  const keys = (Array.isArray(body.keys) ? body.keys : [])
    .filter((k) => typeof k === "string" && k)
    .slice(0, MAX_KEYS_PER_REQUEST);

  // Ohne Anmeldung gibt es den Verlauf trotzdem - nur gemerkt wird nichts,
  // denn die Beobachtungsliste haengt am Konto.
  const history = await summarizeAll(keys);

  const userId = await getUserId(req.headers.cookie || "");
  if (!userId) return res.status(200).json({ history, tracked: 0 });

  const added = (Array.isArray(body.added) ? body.added : [])
    .map((a) => (typeof a === "string" ? a : a?.key))
    .filter(Boolean);

  const labels = {};
  for (const entry of [...(body.added || []), ...(body.labels || [])]) {
    if (entry && typeof entry === "object" && entry.key && entry.label) {
      labels[entry.key] = String(entry.label).slice(0, 80);
    }
  }

  const profile = await readProfile(userId);
  const tracked = mergeTracked(profile.tracked, keys, added, labels);
  await writeProfile(userId, { ...profile, tracked });

  return res.status(200).json({ history, tracked: Object.keys(tracked).length });
}
