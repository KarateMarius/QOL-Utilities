// Preisalarm fuer Sprit: unterhalb welcher Marke soll gemeldet werden?
//
// GET  -> { alarm: { plz, typ, schwelle, radius } | null, taeglich: true }
// POST { plz, typ, schwelle, radius } -> setzt
// POST { schwelle: null }             -> loescht
//
// Der Alarm liegt im selben Nutzerprofil wie die Watchlist (siehe _store.js)
// und meldet an dieselben Geraete. Geprueft wird er im taeglichen Lauf,
// /api/angebote/cron - auf dem Hobby-Tarif ist ein Lauf pro Tag die Grenze.
// Das ist keine Live-Warnung, und die Oberflaeche sagt das auch.
import { requireUser } from "../_auth.js";
import { readProfile, writeProfile } from "../angebote/_store.js";

const TYPEN = new Set(["diesel", "e5", "e10"]);

export default async function handler(req, res) {
  const userId = await requireUser(req, res);
  if (!userId) return undefined;

  const profile = await readProfile(userId);

  if (req.method === "GET") {
    return res.status(200).json({ alarm: profile.tankalarm || null });
  }

  if (req.method !== "POST") return res.status(405).end();

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};

  // Ohne Schwelle wird abgeschaltet - ein eigener Loesch-Endpunkt waere fuer
  // ein einzelnes Feld zu viel Zeremonie.
  if (body.schwelle === null || body.schwelle === undefined || body.schwelle === "") {
    await writeProfile(userId, { ...profile, tankalarm: null });
    return res.status(200).json({ alarm: null });
  }

  const schwelle = Number(body.schwelle);
  if (!Number.isFinite(schwelle) || schwelle <= 0 || schwelle > 5) {
    return res.status(400).json({ error: "Schwelle muss zwischen 0 und 5 Euro liegen." });
  }

  const alarm = {
    plz: /^\d{5}$/.test(body.plz || "") ? body.plz : profile.plz,
    typ: TYPEN.has(body.typ) ? body.typ : "diesel",
    // Auf zehntel Cent runden - feiner meldet keine Tankstelle.
    schwelle: Math.round(schwelle * 1000) / 1000,
    radius: Math.min(25, Math.max(1, Number(body.radius) || 5)),
    // Zustand der letzten Pruefung. Gemeldet wird der Uebergang nach unten,
    // nicht der Zustand: sonst kaeme jeden Morgen dieselbe Nachricht,
    // solange der Preis unten bleibt.
    unterhalb: profile.tankalarm?.unterhalb ?? false,
  };

  await writeProfile(userId, { ...profile, tankalarm: alarm });
  return res.status(200).json({ alarm });
}
