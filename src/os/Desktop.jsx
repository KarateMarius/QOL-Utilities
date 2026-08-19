import { useEffect, useState } from "react";
import { APPS, getApp } from "./apps.jsx";
import Window from "./Window.jsx";
import Taskbar from "./Taskbar.jsx";
import LoginDialog from "./LoginDialog.jsx";
import { useWindows } from "./useWindows.js";
import { useSession } from "./useSession.js";
import { useTheme } from "./useTheme.js";

const COMPACT_QUERY = "(max-width: 820px)";

function useCompact() {
  const [compact, setCompact] = useState(() => window.matchMedia(COMPACT_QUERY).matches);

  useEffect(() => {
    const query = window.matchMedia(COMPACT_QUERY);
    const update = (event) => setCompact(event.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return compact;
}

export default function Desktop() {
  const desk = useWindows();
  const session = useSession();
  const { theme, toggle: toggleTheme } = useTheme();
  const compact = useCompact();
  const [loginOpen, setLoginOpen] = useState(false);

  // Auf schmalen Bildschirmen laeuft immer nur eine App im Vordergrund; alle
  // anderen werden weggelegt, damit sich nichts ueberlagert.
  const { activeId, windows, minimize } = desk;
  useEffect(() => {
    if (!compact || !activeId) return;
    for (const win of windows) {
      if (win.appId !== activeId && !win.minimized) minimize(win.appId);
    }
  }, [compact, activeId, windows, minimize]);

  const showLauncher = !desk.activeId;

  return (
    <div className={`desktop${compact ? " desktop--compact" : ""}`}>
      {showLauncher && (
        <main className="launcher">
          <header className="launcher__head">
            <p className="launcher__eyebrow">QOL-Utilities</p>
            <h1 className="launcher__title">Womit möchtest du arbeiten?</h1>
            <button
              type="button"
              className="launcher__theme"
              onClick={toggleTheme}
              aria-label="Darstellung wechseln"
            >
              {theme === "dark" ? "Hell" : "Dunkel"}
            </button>
          </header>

          <ul className="launcher__grid">
            {APPS.map((app) => {
              const running = desk.windows.some((win) => win.appId === app.id);
              return (
                <li key={app.id}>
                  <button
                    type="button"
                    className="tile"
                    style={{ "--app-accent": app.accent }}
                    onClick={() => (running ? desk.focus(app.id) : desk.open(app.id))}
                  >
                    <span className="tile__icon" aria-hidden="true">
                      <app.Icon />
                    </span>
                    <span className="tile__name">{app.name}</span>
                    <span className="tile__tagline">{app.tagline}</span>
                    <span className="tile__status">{running ? "läuft" : "öffnen"}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          <p className="launcher__foot">
            {session.status === "ready"
              ? `Angemeldet als ${session.user.id}`
              : "Nicht angemeldet — Grundrisse speichern und Angebots-Benachrichtigungen brauchen ein Konto."}
          </p>
        </main>
      )}

      {desk.windows.map((win) => {
        const app = getApp(win.appId);
        if (!app) return null;
        return (
          <Window
            // Beim Wechsel des Kontos neu aufbauen: sonst zeigt eine App noch
            // die Daten des vorigen Nutzers.
            key={`${app.id}:${session.user?.id ?? "anon"}`}
            app={app}
            win={win}
            active={desk.activeId === app.id}
            compact={compact}
            onFocus={() => desk.focus(app.id)}
            onClose={() => desk.close(app.id)}
            onMinimize={() => desk.minimize(app.id)}
            onToggleMaximize={() => desk.toggleMaximize(app.id)}
            onMove={(position) => desk.move(app.id, position)}
            onResize={(size) => desk.resize(app.id, size)}
          />
        );
      })}

      <Taskbar
        windows={desk.windows}
        activeId={desk.activeId}
        onSelect={desk.toggle}
        onHome={() => desk.windows.forEach((win) => desk.minimize(win.appId))}
        session={session}
        onLogin={() => setLoginOpen(true)}
        onLogout={session.logout}
      />

      {loginOpen && (
        <LoginDialog
          session={session}
          onClose={() => {
            session.clearError();
            setLoginOpen(false);
          }}
        />
      )}
    </div>
  );
}
