import { useEffect, useRef, useState } from "react";

// Die Anmeldung steht vor allem anderen: ohne sie gibt es keine Uebersicht und
// keine App. Das ist nicht nur Kosmetik - die Endpunkte unter /api antworten
// ohne Session mit 401, hier wird nur nicht so getan, als gaebe es etwas zu
// sehen.
//
// Dieselbe Nutzerliste wie im Trainer und in der Grundriss-App: es ist
// dieselbe Datenbank, nur ein eigenes Cookie.

export default function LoginScreen({ session }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const firstField = useRef(null);

  useEffect(() => {
    firstField.current?.focus();
  }, []);

  function handleSubmit(event) {
    event.preventDefault();
    session.login(username, password);
  }

  return (
    <div className="gate">
      <main className="gate__card">
        <p className="gate__eyebrow">QOL-Utilities</p>
        <h1 className="gate__title">Anmelden</h1>
        <p className="gate__hint">
          Dieselben Zugangsdaten wie im Trainer.
        </p>

        <form className="gate__form" onSubmit={handleSubmit}>
          <label className="gate__field">
            <span>Nutzername</span>
            <input
              ref={firstField}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck="false"
            />
          </label>

          <label className="gate__field">
            <span>Passwort</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>

          {session.error && <p className="gate__error">{session.error}</p>}

          <button
            type="submit"
            className="gate__button"
            disabled={session.busy || !username || !password}
          >
            {session.busy ? "Wird geprüft…" : "Anmelden"}
          </button>
        </form>
      </main>
    </div>
  );
}
