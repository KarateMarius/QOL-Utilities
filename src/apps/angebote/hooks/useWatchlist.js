import { useCallback, useEffect, useState } from "react";
import { NOT_AUTHENTICATED, fetchWatchlist, saveWatchlist } from "../lib/api.js";

// Watchlist und die dazugehoerige PLZ. Beides gehoert zum Konto, deshalb ist
// `signedIn === false` hier ein normaler Zustand und kein Fehler.

const FALLBACK_PLZ = "48155";

export function useWatchlist() {
  const [entries, setEntries] = useState([]);
  const [plz, setPlz] = useState(() => localStorage.getItem("angebote_plz") || FALLBACK_PLZ);
  const [signedIn, setSignedIn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const result = await fetchWatchlist();
        if (cancelled) return;

        if (result === NOT_AUTHENTICATED) {
          setSignedIn(false);
        } else {
          setSignedIn(true);
          setEntries(result.entries || []);
          if (result.plz) setPlz(result.plz);
        }
      } catch {
        // Ohne Backend bleibt die App nutzbar, nur eben ohne Watchlist.
        setSignedIn(false);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Die PLZ merkt sich auch der Browser: beim naechsten Besuch stehen die
  // richtigen Prospekte da, bevor der Server geantwortet hat.
  const persist = useCallback(
    async (nextEntries, nextPlz) => {
      setEntries(nextEntries);
      setPlz(nextPlz);
      localStorage.setItem("angebote_plz", nextPlz);

      if (!signedIn) return;
      setSaving(true);
      try {
        await saveWatchlist({ plz: nextPlz, entries: nextEntries });
      } catch (e) {
        console.error("Watchlist speichern:", e.message);
      } finally {
        setSaving(false);
      }
    },
    [signedIn]
  );

  return {
    entries,
    plz,
    signedIn,
    saving,
    ready,
    setEntries: (next) => persist(next, plz),
    setPlz: (next) => persist(entries, next),
  };
}
