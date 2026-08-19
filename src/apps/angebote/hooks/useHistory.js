import { useCallback, useEffect, useRef, useState } from "react";
import { NOT_AUTHENTICATED, fetchHistory } from "../lib/api.js";

// Preisverlauf der Produkte, die den Nutzer angehen: was im Korb liegt, was
// die Watchlist trifft, und was er schon einmal gekauft hat.
//
// Fuer alle 2000 Prospektartikel waere das sinnlos - niemand liest 2000
// Verlaeufe, und aufgezeichnet wird ohnehin nur das Beobachtete.

export function useHistory(keys) {
  const [history, setHistory] = useState({});
  const pendingAdds = useRef([]);
  const lastQuery = useRef("");

  const load = useCallback(async (wanted, added) => {
    if (!wanted.length && !added.length) return;
    try {
      const result = await fetchHistory(wanted, added);
      if (result !== NOT_AUTHENTICATED && result?.history) {
        setHistory((current) => ({ ...current, ...result.history }));
      }
    } catch {
      // Ohne Verlauf zeigt die Karte einfach nur den aktuellen Preis.
    }
  }, []);

  useEffect(() => {
    const signature = keys.slice().sort().join("|");
    if (signature === lastQuery.current) return;
    lastQuery.current = signature;

    const added = pendingAdds.current;
    pendingAdds.current = [];
    load(keys, added);
  }, [keys, load]);

  /** Meldet einen Korb-Zugang; er faehrt mit der naechsten Abfrage mit. */
  const noteAdded = useCallback((deal) => {
    if (deal?.key) pendingAdds.current.push({ key: deal.key, label: deal.title });
  }, []);

  return { history, noteAdded };
}
