import { useCallback, useEffect, useState } from "react";

// Anmeldung fuer das gesamte System. Die Apps fragen den Status nicht selbst
// ab, sondern bekommen ihn vom Desktop - so gibt es genau eine Wahrheit
// darueber, wer angemeldet ist.
//
// Das Session-Cookie ist HttpOnly, wird also vom Browser mitgeschickt und ist
// fuer JavaScript unsichtbar. Deshalb fragt /api/me den Server.

async function request(url, options) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) throw new Error(payload?.error || `Serverfehler (${res.status})`);
  return payload;
}

export function useSession() {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | anonymous | ready
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/me");
      if (!res.ok) {
        setUser(null);
        setStatus("anonymous");
        return;
      }
      const payload = await res.json();
      setUser(payload.user);
      setStatus("ready");
    } catch {
      // Kein Backend erreichbar (z.B. `vite dev` ohne `vercel dev`): die Apps
      // bleiben nutzbar, nur eben ohne alles, was eine Anmeldung braucht.
      setUser(null);
      setStatus("anonymous");
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
        await request("/api/login", {
          method: "POST",
          body: JSON.stringify({ username, password }),
        });
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
      await request("/api/login", { method: "DELETE" });
    } catch {
      /* auch bei Serverfehler lokal abmelden */
    }
    setUser(null);
    setStatus("anonymous");
    setBusy(false);
  }, []);

  return { user, status, error, busy, login, logout, clearError: () => setError(null) };
}
