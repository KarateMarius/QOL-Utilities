import { useEffect, useRef, useState } from "react";

// Anmeldung fuers ganze System. Dieselben Zugangsdaten wie im Trainer und in
// der Grundriss-App - es ist dieselbe Nutzerliste.

export default function LoginDialog({ session, onClose }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const firstField = useRef(null);

  useEffect(() => {
    firstField.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (await session.login(username, password)) onClose();
  }

  return (
    <div className="dialog-scrim" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="login-title">
        <h2 className="dialog__title" id="login-title">
          Anmelden
        </h2>
        <p className="dialog__hint">
          Dieselben Zugangsdaten wie im Trainer. Ohne Anmeldung funktionieren die Apps weiter —
          nur Speichern in der Cloud, Watchlist und Benachrichtigungen brauchen ein Konto.
        </p>

        <form className="dialog__form" onSubmit={handleSubmit}>
          <label className="dialog__field">
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

          <label className="dialog__field">
            <span>Passwort</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>

          {session.error && <p className="dialog__error">{session.error}</p>}

          <div className="dialog__actions">
            <button type="button" className="dialog__button" onClick={onClose}>
              Abbrechen
            </button>
            <button
              type="submit"
              className="dialog__button dialog__button--primary"
              disabled={session.busy || !username || !password}
            >
              {session.busy ? "Anmelden…" : "Anmelden"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
