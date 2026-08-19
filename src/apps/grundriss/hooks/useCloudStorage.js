import { useCallback, useEffect, useState } from "react";
import * as cloud from "../io/cloud.js";

// Die Liste der gespeicherten Grundrisse.
//
// Der Status wird nicht geraten, sondern beim Start per GET /api/plans
// ermittelt: 401 bedeutet, dass die Sitzung abgelaufen ist. An- und Abmelden
// gehoeren dem Rahmen und stehen deshalb nicht mehr hier.
export function useCloudStorage() {
  const [user, setUser] = useState(null);
  const [plans, setPlans] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | anonymous | ready
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const result = await cloud.fetchPlans();
      if (result === cloud.NOT_AUTHENTICATED) {
        setUser(null);
        setPlans([]);
        setStatus("anonymous");
        // Die Anmeldung steht vor dem ganzen Dienst - ein 401 heisst hier
        // also, dass die Sitzung abgelaufen ist. Der Rahmen holt daraufhin
        // den Anmeldebildschirm zurueck; diese App hat kein eigenes Formular
        // mehr dafuer.
        window.dispatchEvent(new CustomEvent("qol:unauthorized"));
        return;
      }
      setUser(result.user);
      setPlans(result.plans || []);
      setStatus("ready");
    } catch (e) {
      // Kein Backend erreichbar (z.B. `vite dev` ohne `vercel dev`): die App
      // bleibt nutzbar, nur eben ohne Speichern in der Cloud.
      setStatus("anonymous");
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback(
    async ({ id, name, floorPlan }) => {
      setBusy(true);
      setError(null);
      try {
        const result = await cloud.savePlan({ id, name, floorPlan });
        await refresh();
        return result?.id || null;
      } catch (e) {
        setError(e.message);
        return null;
      } finally {
        setBusy(false);
      }
    },
    [refresh]
  );

  const remove = useCallback(
    async (id) => {
      setBusy(true);
      setError(null);
      try {
        await cloud.deletePlan(id);
        await refresh();
      } catch (e) {
        setError(e.message);
      } finally {
        setBusy(false);
      }
    },
    [refresh]
  );

  return { user, plans, status, error, busy, save, remove, clearError: () => setError(null) };
}
