import { APPS } from "./apps.jsx";

// Die Taskleiste zeigt nur, was laeuft. Zum Starten gibt es den
// Startbildschirm - eine Leiste, die alle installierten Apps auflistet, waere
// bei zwei Eintraegen ein zweiter Startbildschirm.

export default function Taskbar({ windows, activeId, onSelect, onHome, session, onLogin, onLogout }) {
  const running = windows
    .map((win) => ({ win, app: APPS.find((app) => app.id === win.appId) }))
    .filter((entry) => entry.app);

  return (
    <footer className="taskbar">
      <button
        type="button"
        className="taskbar__home"
        onClick={onHome}
        aria-label="Zum Startbildschirm"
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <rect x="1.5" y="1.5" width="5.5" height="5.5" />
          <rect x="9" y="1.5" width="5.5" height="5.5" />
          <rect x="1.5" y="9" width="5.5" height="5.5" />
          <rect x="9" y="9" width="5.5" height="5.5" />
        </svg>
        <span>Start</span>
      </button>

      <div className="taskbar__running">
        {running.map(({ win, app }) => (
          <button
            key={app.id}
            type="button"
            className={`taskbar__app${activeId === app.id ? " taskbar__app--active" : ""}${
              win.minimized ? " taskbar__app--minimized" : ""
            }`}
            style={{ "--app-accent": app.accent }}
            onClick={() => onSelect(app.id)}
            aria-pressed={activeId === app.id}
          >
            <span className="taskbar__app-icon" aria-hidden="true">
              <app.Icon />
            </span>
            <span className="taskbar__app-name">{app.name}</span>
          </button>
        ))}
      </div>

      <div className="taskbar__session">
        {session.status === "ready" ? (
          <>
            <span className="taskbar__user" title={`Angemeldet als ${session.user.id}`}>
              {session.user.id}
            </span>
            <button type="button" className="taskbar__link" onClick={onLogout} disabled={session.busy}>
              Abmelden
            </button>
          </>
        ) : (
          <button
            type="button"
            className="taskbar__link"
            onClick={onLogin}
            disabled={session.status === "loading"}
          >
            {session.status === "loading" ? "…" : "Anmelden"}
          </button>
        )}
      </div>
    </footer>
  );
}
