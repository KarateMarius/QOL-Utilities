import { useCallback, useEffect, useRef, useState } from "react";
import { fetchDeals } from "../lib/api.js";

// Laedt die Angebote einer PLZ. Bewusst ohne Query-Bibliothek: es sind zwei
// Zustaende und ein Neuladen-Knopf, dafuer braucht es keine 45 KB.
//
// Der zuletzt geholte Prospekt liegt im Browser und wird beim Oeffnen sofort
// gezeigt - die Liste steht also da, bevor der Server geantwortet hat. Erst
// danach wird nachgeladen, und auch das nur, wenn der Stand aelter ist als
// eine halbe Stunde. Wer die App achtmal in der Minute oeffnet, loest damit
// nicht achtmal dieselbe Abfrage aus.
//
// Wer es sofort will, hat den Knopf: `refresh` uebergeht beides, den
// Browser-Stand wie den Sechs-Stunden-Cache des Servers.

const CACHE_KEY = "angebote_prospekt_v1";
const MAX_ALTER_MS = 30 * 60 * 1000;
// Ein voller Prospekt sind schnell ueber 1 MB. Der Browser gibt einer Seite
// ueblicherweise 5 MB fuer alles zusammen - Korb, Watchlist-Zaehler und
// Wochenzahlen wollen auch noch hinein. Was zu gross ist, wird nicht
// abgelegt; dann verhaelt sich die App wie vorher.
const MAX_BYTES = 2_500_000;

function lesen(plz) {
  try {
    const gelesen = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (!gelesen || gelesen.plz !== plz || !gelesen.payload) return null;
    return gelesen;
  } catch {
    return null;
  }
}

function schreiben(plz, payload) {
  try {
    const text = JSON.stringify({ plz, zeit: Date.now(), payload });
    if (text.length > MAX_BYTES) return;
    localStorage.setItem(CACHE_KEY, text);
  } catch {
    // Voller Speicher kostet nur den schnellen Start.
  }
}

export function useDeals(plz) {
  const ersterStand = useRef(lesen(plz));
  const [data, setData] = useState(ersterStand.current?.payload ?? null);
  const [loading, setLoading] = useState(!ersterStand.current);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(
    async (force, imHintergrund = false) => {
      if (force || imHintergrund) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const payload = await fetchDeals(plz, force);
        setData(payload);
        schreiben(plz, payload);
      } catch (e) {
        // Wer schon eine Liste vor sich hat, soll sie nicht gegen eine
        // Fehlermeldung tauschen, weil das Nachladen im Hintergrund nicht
        // geklappt hat. Beim Knopfdruck dagegen erwartet man eine Antwort.
        if (imHintergrund) console.error("Angebote nachladen:", e.message);
        else setError(e.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [plz]
  );

  useEffect(() => {
    const stand = lesen(plz);
    if (stand) {
      setData(stand.payload);
      setLoading(false);
      // Frisch genug: gar nicht erst fragen.
      if (Date.now() - (stand.zeit || 0) < MAX_ALTER_MS) return;
      load(false, true);
      return;
    }
    setData(null);
    load(false);
  }, [plz, load]);

  return { data, loading, refreshing, error, refresh: () => load(true) };
}
