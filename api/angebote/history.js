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
import { requireUser } from "../_auth.js";
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

  // Wer oefter gekauft hat, bleibt drin. Nur nach Aktualitaet zu sortieren
  // waere falsch: die Shop-Artikel werden bei jedem Seitenaufruf mitgefragt
  // und wuerden das zweimal im Jahr gekaufte Lieblingsprodukt verdraengen.
  const keep = Object.entries(next)
    .sort((a, b) => (b[1].count || 0) - (a[1].count || 0) || (b[1].seen || 0) - (a[1].seen || 0))
    .slice(0, MAX_TRACKED);

  return Object.fromEntries(keep);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const userId = await requireUser(req, res);
  if (!userId) return undefined;

  const body = parseBody(req);
  if (!body) return res.status(400).json({ error: "Ungültige Anfrage" });

  const keys = (Array.isArray(body.keys) ? body.keys : [])
    .filter((k) => typeof k === "string" && k)
    .slice(0, MAX_KEYS_PER_REQUEST);

  const history = await summarizeAll(keys);

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

  // Nur schreiben, wenn sich wirklich etwas geaendert hat. Sonst kostet jeder
  // Seitenaufruf einen Schreibvorgang, obwohl nichts Neues dazugekommen ist -
  // der reine Zeitstempel ist das nicht wert.
  const before = Object.keys(profile.tracked || {});
  const changed =
    added.length > 0 ||
    before.length !== Object.keys(tracked).length ||
    keys.some((key) => !(key in (profile.tracked || {})));

  if (changed) await writeProfile(userId, { ...profile, tracked });

  return res.status(200).json({ history, tracked: Object.keys(tracked).length });
}
