import { useCallback, useEffect, useState } from "react";
import * as cloud from "../io/cloud.js";

// Kapselt Anmeldung und die Liste der gespeicherten Grundrisse.
//
// Der Login-Status wird nicht geraten, sondern beim Start einmal per
// GET /api/plans ermittelt: 401 bedeutet "nicht angemeldet". Damit gibt es
// keinen zweiten Endpunkt nur zum Statusabfragen.
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

  const login = useCallback(
    async (username, password) => {
      setBusy(true);
      setError(null);
      try {
        await cloud.login(username, password);
        await refresh();
        return true;
      } catch (e) {
        setError(e.message);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [refresh]
  );

  const logout = useCallback(async () => {
    setBusy(true);
    try {
      await cloud.logout();
    } catch {
      /* auch bei Fehler lokal abmelden */
    }
    setUser(null);
    setPlans([]);
    setStatus("anonymous");
    setBusy(false);
  }, []);

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

  return { user, plans, status, error, busy, login, logout, save, remove, clearError: () => setError(null) };
}
