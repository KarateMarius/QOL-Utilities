// Spritpreise in der Umgebung einer Postleitzahl.
//
// GET ?plz=48155&type=diesel&rad=5
//   -> { place, type, radius, demo, stations: [...], fetched_at }
//
// Nur mit Anmeldung - der Dienst als Ganzes steht nicht offen.
//
// Kurzer Cache mit Absicht. Tankerkoenig bittet darum, dieselbe Abfrage nicht
// oefter als alle paar Minuten zu stellen, und Preise aendern sich ohnehin
// nicht sekuendlich. Fuenf Minuten sind der Kompromiss: aktuell genug zum
// Tanken, schonend genug fuer die Quelle.
import { requireUser } from "../_auth.js";
import { readKey, writeKey } from "../angebote/_store.js";
import { fetchStations } from "./_tankerkoenig.js";

const TTL_SECONDS = 5 * 60;

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const userId = await requireUser(req, res);
  if (!userId) return undefined;

  const plz = /^\d{5}$/.test(req.query?.plz || "") ? req.query.plz : process.env.DEFAULT_PLZ || "48155";
  const type = req.query?.type || "diesel";
  const radius = Number(req.query?.rad) || 5;

  const cacheKey = `tanken:${plz}:${type}:${radius}`;
  const cached = await readKey(cacheKey);
  if (cached && Date.now() - (cached.fetched_at || 0) < TTL_SECONDS * 1000) {
    return res.status(200).json({ ...cached, from_cache: true });
  }

  const result = await fetchStations({ plz, type, radius });

  // Einen leeren Lauf nicht cachen - sonst haengt eine Stoerung fuenf Minuten
  // nach, obwohl die Quelle laengst wieder antwortet.
  if (result.stations.length) {
    await writeKey(cacheKey, { ...result, plz, fetched_at: Date.now() }, TTL_SECONDS);
  }

  return res.status(200).json({ ...result, plz, fetched_at: Date.now(), from_cache: false });
}
