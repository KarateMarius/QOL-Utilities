import { useCallback, useEffect, useState } from "react";
import { erinnerterNutzer, merkeNutzer } from "./angemeldet.js";

// Anmeldung fuer alle Apps gemeinsam. Sie liegt beim Rahmen und nicht in den
// Apps, damit es genau eine Wahrheit darueber gibt, wer angemeldet ist.
//
// Das Session-Cookie ist HttpOnly, wird also vom Browser mitgeschickt und ist
// fuer JavaScript unsichtbar. Deshalb fragt /api/me den Server.
//
// Wer schon einmal angemeldet war, muss darauf aber nicht warten: der Name
// steht daneben im Browser und die Oberflaeche startet damit, waehrend
// /api/me im Hintergrund nachprueft. Das ist keine Sicherheitsluecke, denn
// entschieden wird ohnehin am Server - jeder Endpunkt antwortet ohne gueltiges
// Cookie mit 401, und ein 401 aus einer App schickt uns wieder hierher.
// Gewonnen ist eine Wartezeit, die am Handy vor allem anderen stand.

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
  const [user, setUser] = useState(() => {
    const id = erinnerterNutzer();
    return id ? { id } : null;
  });
  const [status, setStatus] = useState(() => (erinnerterNutzer() ? "ready" : "loading")); // loading | anonymous | ready
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/me");
      if (!res.ok) {
        merkeNutzer(null);
        setUser(null);
        setStatus("anonymous");
        return;
      }
      const payload = await res.json();
      merkeNutzer(payload.user.id);
      setUser(payload.user);
      setStatus("ready");
    } catch {
      // Kein Backend erreichbar (z.B. `vite dev` ohne `vercel dev`): die Apps
      // bleiben nutzbar, nur eben ohne alles, was eine Anmeldung braucht.
      //
      // Eine erinnerte Anmeldung ueberlebt das aber. Ein Funkloch ist kein
      // Grund, jemanden auf den Anmeldebildschirm zu werfen - dort koennte er
      // sich ja gerade nicht anmelden.
      if (erinnerterNutzer()) return;
      setUser(null);
      setStatus("anonymous");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Meldet eine App einen 401, ist die Sitzung abgelaufen. Nachfragen statt
  // gleich abmelden: ein einzelner Fehlschlag kann auch eine Stoerung sein,
  // und ein faelschlich ausgeworfener Nutzer waere aergerlicher als ein
  // Ladevorgang zu viel.
  useEffect(() => {
    const onUnauthorized = () => refresh();
    window.addEventListener("qol:unauthorized", onUnauthorized);
    return () => window.removeEventListener("qol:unauthorized", onUnauthorized);
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
    merkeNutzer(null);
    setUser(null);
    setStatus("anonymous");
    setBusy(false);
  }, []);

  return { user, status, error, busy, login, logout, clearError: () => setError(null) };
}
