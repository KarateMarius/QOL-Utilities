import { useState } from "react";
import { IconClose } from "../../../icons.jsx";
import { CATEGORIES, NOT_AUTHENTICATED, sendTestPush } from "../lib/api.js";

// Watchlist: Suchwoerter, die beim taeglichen Scan gemeldet werden.

const PUSH_COPY = {
  on: "Benachrichtigungen sind an. Der tägliche Scan meldet neue Treffer.",
  off: "Benachrichtigungen sind aus. Ohne sie siehst du Treffer nur hier in der App.",
  anonymous: "Melde dich an, um Watchlist und Benachrichtigungen zu nutzen — Geräte hängen am Konto.",
  denied: "Der Browser blockiert Benachrichtigungen für diese Seite. Erlaube sie in den Website-Einstellungen.",
  unsupported: "Dieser Browser kann keine Web-Push-Benachrichtigungen empfangen.",
  insecure: "Push braucht HTTPS. Über http:// im lokalen Netz lässt der Browser es nicht zu.",
  unconfigured: "Auf dem Server fehlen die VAPID-Schlüssel — siehe README.",
};

export default function WatchlistDrawer({
  entries,
  plz,
  pushState,
  saving,
  signedIn,
  onSave,
  onClose,
  onEnablePush,
  onDisablePush,
}) {
  const [keyword, setKeyword] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [category, setCategory] = useState("");
  const [testStatus, setTestStatus] = useState("");

  function add(event) {
    event.preventDefault();
    const trimmed = keyword.trim();
    if (!trimmed) return;

    const parsed = Number.parseFloat(maxPrice.replace(",", "."));
    onSave([
      ...entries,
      {
        id: `w-${Date.now()}`,
        keyword: trimmed,
        max_price: Number.isFinite(parsed) ? parsed : null,
        category: category || null,
      },
    ]);
    setKeyword("");
    setMaxPrice("");
    setCategory("");
  }

  async function test() {
    setTestStatus("");
    try {
      const result = await sendTestPush();
      if (result === NOT_AUTHENTICATED) setTestStatus("Dafür musst du angemeldet sein.");
      else if (result.error) setTestStatus(`Nicht gesendet: ${result.error}`);
      else setTestStatus(`An ${result.sent} Geräte gesendet.`);
    } catch (error) {
      setTestStatus(`Nicht gesendet: ${error.message}`);
    }
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label="Watchlist">
        <header className="drawer-head">
          <h2>Watchlist</h2>
          <button type="button" className="ang-icon-button" onClick={onClose} aria-label="Schließen">
            <IconClose />
          </button>
        </header>

        <div className="drawer-body">
          {signedIn ? (
            <>
              <p className="hint">
                Ein Suchwort trifft, sobald es im Angebotstext vorkommt — <code>hähnchen</code>{" "}
                findet auch „Hähnchenbrustfilet". Preisgrenze und Kategorie schränken zusätzlich
                ein. Gescannt wird PLZ <code>{plz}</code>.
              </p>

              <form className="watch-form" onSubmit={add}>
                <input
                  className="keyword"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Suchwort, z. B. Skyr"
                  aria-label="Suchwort"
                />
                <input
                  className="price"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="max. €"
                  inputMode="decimal"
                  aria-label="Höchstpreis"
                />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  aria-label="Kategorie"
                >
                  <option value="">Alle Kategorien</option>
                  {CATEGORIES.map((entry) => (
                    <option key={entry.key} value={entry.key}>
                      {entry.label}
                    </option>
                  ))}
                </select>
                <button type="submit" className="button" disabled={saving || !keyword.trim()}>
                  Hinzufügen
                </button>
              </form>

              {entries.length === 0 ? (
                <div className="empty">
                  <strong>Leer</strong>
                  Trag ein, was du regelmäßig kaufst — du bekommst Bescheid, sobald es im Prospekt
                  steht.
                </div>
              ) : (
                entries.map((entry) => (
                  <div className="watch-entry" key={entry.id}>
                    <span className="keyword">{entry.keyword}</span>
                    <span className="rule">
                      {entry.max_price != null && `≤ ${entry.max_price.toFixed(2)} €`}
                      {entry.max_price != null && entry.category && " · "}
                      {entry.category &&
                        (CATEGORIES.find((c) => c.key === entry.category)?.label ?? entry.category)}
                    </span>
                    <button
                      type="button"
                      className="remove"
                      onClick={() => onSave(entries.filter((e) => e.id !== entry.id))}
                      aria-label={`${entry.keyword} entfernen`}
                    >
                      <IconClose />
                    </button>
                  </div>
                ))
              )}
            </>
          ) : (
            <div className="empty">
              <strong>Anmeldung nötig</strong>
              Die Watchlist gehört zu deinem Konto. Melde dich unten in der Taskleiste an, dann
              kannst du Suchwörter anlegen.
            </div>
          )}
        </div>

        <footer className="drawer-foot">
          <p className="status">{PUSH_COPY[pushState]}</p>
          <div className="button-row">
            {pushState === "on" ? (
              <>
                <button type="button" className="button" onClick={test}>
                  Test senden
                </button>
                <button type="button" className="button" onClick={onDisablePush}>
                  Ausschalten
                </button>
              </>
            ) : (
              <button
                type="button"
                className="button primary"
                onClick={onEnablePush}
                disabled={pushState !== "off"}
              >
                Benachrichtigungen einschalten
              </button>
            )}
          </div>
          {testStatus && <p className="status">{testStatus}</p>}
        </footer>
      </aside>
    </>
  );
}
