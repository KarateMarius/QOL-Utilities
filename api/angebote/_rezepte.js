// Rezepte eines Nutzers: Name plus Zutatenliste, mehr nicht.
//
// GET  -> { rezepte: [{ id, name, zutaten: [] }] }
// POST { rezepte: [...] } -> ersetzt die Liste
//
// Bewusst ohne Mengen, ohne Portionen, ohne Zuordnung zu Produkten. Der Zweck
// ist eine Abkuerzung beim Schreiben der Einkaufsliste - "Chili con Carne"
// antippen statt acht Zeilen tippen. Alles Weitere waere eine Rezeptdatenbank,
// und die zu pflegen ist mehr Arbeit als der Nutzen.
//
// Liegt im selben Profil wie Watchlist und Tankalarm (siehe _store.js).
import { requireUser } from "../_auth.js";
import { readProfile, writeProfile } from "./_store.js";

const MAX_REZEPTE = 60;
const MAX_ZUTATEN = 40;

function saeubere(rohe) {
  if (!Array.isArray(rohe)) return [];
  return rohe
    .slice(0, MAX_REZEPTE)
    .map((rezept) => ({
      id: String(rezept?.id || `r-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`).slice(0, 64),
      name: String(rezept?.name || "").trim().slice(0, 80),
      zutaten: (Array.isArray(rezept?.zutaten) ? rezept.zutaten : [])
        .map((z) => String(z || "").trim().slice(0, 80))
        .filter(Boolean)
        .slice(0, MAX_ZUTATEN),
    }))
    .filter((rezept) => rezept.name && rezept.zutaten.length);
}

export default async function handler(req, res) {
  const userId = await requireUser(req, res);
  if (!userId) return undefined;

  const profile = await readProfile(userId);

  if (req.method === "GET") {
    return res.status(200).json({ rezepte: profile.rezepte || [] });
  }

  if (req.method !== "POST") return res.status(405).end();

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const rezepte = saeubere(body.rezepte);

  await writeProfile(userId, { ...profile, rezepte });
  return res.status(200).json({ rezepte });
}
