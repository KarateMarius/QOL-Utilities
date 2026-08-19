import { useCallback, useEffect, useState } from "react";
import { fetchDeals } from "../lib/api.js";

// Laedt die Angebote einer PLZ. Bewusst ohne Query-Bibliothek: es sind zwei
// Zustaende und ein Neuladen-Knopf, dafuer braucht es keine 45 KB.
//
// Der Server cached sechs Stunden. `refresh` uebergeht diesen Cache - das ist
// der einzige Weg, einen neuen Prospekt sofort zu sehen.

export function useDeals(plz) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(
    async (force) => {
      if (force) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        setData(await fetchDeals(plz, force));
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [plz]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  return { data, loading, refreshing, error, refresh: () => load(true) };
}
