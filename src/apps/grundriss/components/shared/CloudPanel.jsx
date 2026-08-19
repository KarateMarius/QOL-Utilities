import { useState } from "react";

function formatDate(ms) {
  if (!ms) return "";
  return new Date(ms).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CloudPanel({
  cloud,
  currentPlanName,
  currentPlanId,
  onSave,
  onLoad,
  onClose,
}) {
  const { user, plans, status, error, busy, remove } = cloud;
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  return (
    <div className="cloud-panel__backdrop" onPointerDown={onClose}>
      <div className="cloud-panel" onPointerDown={(e) => e.stopPropagation()}>
        <div className="cloud-panel__head">
          <strong>Gespeicherte Grundrisse</strong>
          <button type="button" className="cloud-panel__close" onClick={onClose} aria-label="Schließen">
            ✕
          </button>
        </div>

        {status === "loading" && <p className="cloud-panel__hint">Lade…</p>}

        {/* "anonymous" kommt hier nicht mehr vor: ohne Anmeldung gibt es die
            App gar nicht. Laeuft die Sitzung waehrend der Arbeit ab, holt der
            Rahmen den Anmeldebildschirm zurueck. */}
        {status === "ready" && (
          <>
            <div className="cloud-panel__user">
              Angemeldet als <strong>{user?.id}</strong>
            </div>

            <button type="button" className="cloud-panel__primary" onClick={onSave} disabled={busy}>
              {currentPlanId ? `„${currentPlanName}" aktualisieren` : `„${currentPlanName}" neu speichern`}
            </button>

            {error && <div className="cloud-panel__error">{error}</div>}

            {plans.length === 0 ? (
              <p className="cloud-panel__hint">Noch nichts gespeichert.</p>
            ) : (
              <ul className="cloud-panel__list">
                {plans.map((plan) => (
                  <li key={plan.id} className={plan.id === currentPlanId ? "is-current" : ""}>
                    <div className="cloud-panel__item-main">
                      <span className="cloud-panel__item-name">{plan.name}</span>
                      <span className="cloud-panel__item-date">{formatDate(plan.updatedAt)}</span>
                    </div>
                    <div className="cloud-panel__item-actions">
                      <button type="button" onClick={() => onLoad(plan)} disabled={busy}>
                        Öffnen
                      </button>
                      {confirmDeleteId === plan.id ? (
                        <button
                          type="button"
                          className="is-danger"
                          onClick={() => {
                            remove(plan.id);
                            setConfirmDeleteId(null);
                          }}
                          disabled={busy}
                        >
                          Wirklich?
                        </button>
                      ) : (
                        <button type="button" onClick={() => setConfirmDeleteId(plan.id)} disabled={busy}>
                          Löschen
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
