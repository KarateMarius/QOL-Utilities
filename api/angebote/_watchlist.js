// Watchlist und PLZ eines Nutzers.
//
// GET -> { plz, entries }
// PUT -> speichert { plz, entries }
//
// Anders als die Angebote selbst sind das persoenliche Daten, deshalb nur mit
// Anmeldung. Die PLZ steht hier, weil der Cron-Job wissen muss, welche Region
// er fuer diesen Nutzer scannen soll.
import { requireUser } from "../_auth.js";
import { DEFAULT_PLZ, readProfile, writeProfile } from "./_store.js";
import { cleanPlz } from "./_match.js";

const MAX_ENTRIES = 50;

function sanitizeEntries(raw) {
  if (!Array.isArray(raw)) return [];

  return raw.slice(0, MAX_ENTRIES).flatMap((entry) => {
    const keyword = String(entry?.keyword || "").trim().slice(0, 60);
    if (!keyword) return [];

    const maxPrice = Number(entry?.max_price);
    return [{
      id: String(entry?.id || `w-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
      keyword,
      max_price: Number.isFinite(maxPrice) && maxPrice > 0 ? maxPrice : null,
      category: entry?.category ? String(entry.category).slice(0, 30) : null,
    }];
  });
}

export default async function handler(req, res) {
  const userId = await requireUser(req, res);
  if (!userId) return undefined;

  const profile = await readProfile(userId);

  if (req.method === "GET") {
    return res.status(200).json({ plz: profile.plz, entries: profile.entries });
  }

  if (req.method === "PUT") {
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({ error: "Ungültige Anfrage" });
      }
    }

    const entries = sanitizeEntries(body?.entries);
    const plz = cleanPlz(body?.plz, profile.plz || DEFAULT_PLZ);

    // Merkposten fuer bereits gemeldete Treffer nur behalten, solange sie noch
    // zu einem Suchwort gehoeren koennen - sonst waechst die Liste ewig.
    const ok = await writeProfile(userId, { ...profile, plz, entries });
    if (!ok) return res.status(500).json({ error: "Speichern fehlgeschlagen" });

    return res.status(200).json({ plz, entries });
  }

  return res.status(405).end();
}
