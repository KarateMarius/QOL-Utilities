import { Suspense, useEffect, useState } from "react";
import { APPS, getApp } from "./apps.jsx";
import LoginScreen from "./LoginScreen.jsx";
import AppErrorBoundary from "./AppErrorBoundary.jsx";
import { useSession } from "./useSession.js";
import { useTheme } from "./useTheme.js";

// Vor allem steht die Anmeldung: ohne Session gibt es weder Uebersicht noch
// App. Die Endpunkte unter /api antworten ohnehin mit 401, hier wird nur nicht
// so getan, als waere etwas zu sehen.
//
// Danach zwei Ansichten, mehr nicht: die Uebersicht und die geoeffnete App.
// Keine Fenster, kein Fensterwechsel - eine App laeuft, oder man ist in der
// Uebersicht. Zurueck raeumt sie ab, so wie das Verlassen einer Seite.
//
// Welche App offen ist, steht in der Adresse (#angebote). Damit funktioniert
// der Zurueck-Knopf des Browsers, und ein Lesezeichen fuehrt direkt in die App.

function appIdFromHash() {
  const id = window.location.hash.replace(/^#/, "");
  return getApp(id) ? id : null;
}

export default function Shell() {
  const session = useSession();
  const { theme, toggle: toggleTheme } = useTheme();
  const [activeId, setActiveId] = useState(appIdFromHash);

  useEffect(() => {
    const onHashChange = () => setActiveId(appIdFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  function open(id) {
    window.location.hash = id;
  }

  function goHome() {
    // Kein history.back(): wer ueber ein Lesezeichen direkt in der App landet,
    // haette sonst keinen Weg zur Uebersicht.
    window.location.hash = "";
  }

  // Solange der Server noch nicht geantwortet hat, waere sowohl der
  // Anmeldebildschirm als auch die Uebersicht geraten. Also nichts davon.
  if (session.status === "loading") {
    return (
      <div className="gate">
        <p className="gate__waiting">Einen Moment…</p>
      </div>
    );
  }

  if (session.status !== "ready") return <LoginScreen session={session} />;

  const app = activeId ? getApp(activeId) : null;

  if (app) {
    const { Component, Icon } = app;
    return (
      <div className="app-view" style={{ "--app-accent": app.accent }}>
        <header className="app-bar">
          <button type="button" className="app-bar__back" onClick={goHome}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M10 3L5 8l5 5" />
            </svg>
            Übersicht
          </button>

          <span className="app-bar__icon" aria-hidden="true">
            <Icon />
          </span>
          <h1 className="app-bar__title">{app.name}</h1>
        </header>

        <main className="app-view__body">
          <AppErrorBoundary key={app.id} appName={app.name} onHome={goHome}>
            <Suspense fallback={<p className="app-view__loading">{app.name} wird geladen…</p>}>
              <Component />
            </Suspense>
          </AppErrorBoundary>
        </main>
      </div>
    );
  }

  return (
    <div className="home">
      <div className="home__inner">
        <header className="home__head">
          <p className="home__eyebrow">QOL-Utilities</p>
          <h1 className="home__title">Womit möchtest du arbeiten?</h1>
          <button
            type="button"
            className="home__theme"
            onClick={toggleTheme}
            aria-label="Darstellung wechseln"
          >
            {theme === "dark" ? "Hell" : "Dunkel"}
          </button>
        </header>

        <ul className="home__grid">
          {APPS.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                className="tile"
                style={{ "--app-accent": entry.accent }}
                onClick={() => open(entry.id)}
              >
                <span className="tile__icon" aria-hidden="true">
                  <entry.Icon />
                </span>
                <span className="tile__name">{entry.name}</span>
                <span className="tile__tagline">{entry.tagline}</span>
              </button>
            </li>
          ))}
        </ul>

        <footer className="home__foot">
          <span>
            Angemeldet als <b>{session.user.id}</b>
          </span>
          <button
            type="button"
            className="home__link"
            onClick={session.logout}
            disabled={session.busy}
          >
            Abmelden
          </button>
        </footer>
      </div>
    </div>
  );
}
