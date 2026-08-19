import { useEffect, useState } from "react";
import "./styles.css";

// Spritpreise in der Umgebung. Die Liste ist nach Preis sortiert, der
// guenstigste offene Anbieter steht oben und ist hervorgehoben - mehr braucht
// die Frage "wo tanke ich jetzt" nicht.

const FUEL_TYPES = [
  { key: "diesel", label: "Diesel" },
  { key: "e5", label: "Super E5" },
  { key: "e10", label: "Super E10" },
];

const RADII = [2, 5, 10, 25];

// Dieselbe Postleitzahl wie die anderen Apps - sie steht am Ort, nicht an
// einer App.
const PLZ_KEY = "qol_plz";

function initialPlz() {
  return localStorage.getItem(PLZ_KEY) || localStorage.getItem("angebote_plz") || "48155";
}

/** 1,749 € als Preisschild: die dritte Stelle ist beim Sprit die kleine. */
function priceParts(price) {
  const [euro, cents = ""] = price.toFixed(3).split(".");
  return { main: `${euro},${cents.slice(0, 2)}`, tenth: cents.slice(2) };
}

function mapsUrl(station) {
  const query = encodeURIComponent(`${station.street}, ${station.postCode} ${station.place}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${query}`;
}

export default function TankenApp() {
  const [plz, setPlz] = useState(initialPlz);
  const [plzDraft, setPlzDraft] = useState(plz);
  const [type, setType] = useState(() => localStorage.getItem("qol_fuel") || "diesel");
  const [radius, setRadius] = useState(() => Number(localStorage.getItem("qol_fuel_radius")) || 5);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    localStorage.setItem(PLZ_KEY, plz);
    localStorage.setItem("qol_fuel", type);
    localStorage.setItem("qol_fuel_radius", String(radius));
  }, [plz, type, radius]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/tanken/stations?plz=${plz}&type=${type}&rad=${radius}`)
      .then((res) => {
        // Abgelaufene Sitzung: der Rahmen holt den Anmeldebildschirm zurueck.
        if (res.status === 401) window.dispatchEvent(new CustomEvent("qol:unauthorized"));
        return res.ok ? res.json() : Promise.reject(new Error(`Serverfehler (${res.status})`));
      })
      .then((payload) => {
        if (cancelled) return;
        setData(payload);
        if (payload.error) setError(payload.error);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [plz, type, radius]);

  function applyPlz() {
    if (plzDraft.length === 5 && plzDraft !== plz) setPlz(plzDraft);
  }

  const stations = data?.stations ?? [];
  const open = stations.filter((s) => s.open);
  const cheapest = open[0]?.price ?? stations[0]?.price ?? 0;

  return (
    <div className="tanken-app">
      <header className="tanken-bar">
        <div className="tanken-plz">
          <label htmlFor="tanken-plz">PLZ</label>
          <input
            id="tanken-plz"
            value={plzDraft}
            inputMode="numeric"
            onChange={(e) => setPlzDraft(e.target.value.replace(/\D/g, "").slice(0, 5))}
            onBlur={applyPlz}
            onKeyDown={(e) => e.key === "Enter" && applyPlz()}
          />
        </div>

        <div className="tanken-types" role="group" aria-label="Kraftstoff">
          {FUEL_TYPES.map((fuel) => (
            <button
              key={fuel.key}
              type="button"
              className="tanken-type"
              aria-pressed={type === fuel.key}
              onClick={() => setType(fuel.key)}
            >
              {fuel.label}
            </button>
          ))}
        </div>

        <select
          className="tanken-radius"
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
          aria-label="Umkreis"
        >
          {RADII.map((r) => (
            <option key={r} value={r}>
              {r} km
            </option>
          ))}
        </select>
      </header>

      <div className="tanken-scroll">
        {data?.demo && (
          <p className="tanken-note">
            <strong>Platzhalterpreise.</strong> Ohne eigenen Tankerkönig-Schlüssel liefert die
            Quelle für jede Station denselben Preis. Namen, Marken, Entfernungen und
            Öffnungszeiten stimmen. Einen kostenlosen Schlüssel gibt es auf tankerkoenig.de; er
            gehört als <code>TANKERKOENIG_APIKEY</code> in die Umgebungsvariablen.
          </p>
        )}

        {loading ? (
          <ul className="tanken-list">
            {Array.from({ length: 6 }, (_, i) => (
              <li className="tanken-skeleton" key={i} />
            ))}
          </ul>
        ) : error ? (
          <div className="tanken-empty">
            <strong>Keine Preise</strong>
            {error}
          </div>
        ) : !stations.length ? (
          <div className="tanken-empty">
            <strong>Nichts gefunden</strong>
            Im Umkreis von {radius} km meldet keine Station einen Preis. Versuch es mit einem
            größeren Umkreis.
          </div>
        ) : (
          <>
            <p className="tanken-meta">
              {stations.length} Stationen um {data.place || plz} · {open.length} offen
            </p>

            <ul className="tanken-list">
              {stations.map((station) => {
                const { main, tenth } = priceParts(station.price);
                const diff = Math.round((station.price - cheapest) * 100);
                const isBest = station.open && station.price === cheapest;

                return (
                  <li
                    key={station.id}
                    className={`tanken-card${isBest ? " tanken-card--best" : ""}${
                      station.open ? "" : " tanken-card--closed"
                    }`}
                  >
                    <div className="tanken-card__who">
                      <span className="tanken-brand">{station.brand}</span>
                      <span className="tanken-name">{station.name}</span>
                      <span className="tanken-where">
                        {station.street} · {station.distance} km
                        {!station.open && " · geschlossen"}
                      </span>
                    </div>

                    <div className="tanken-card__price">
                      <span className="tanken-price">
                        {main}
                        <sup>{tenth}</sup>
                        <span className="tanken-currency">€</span>
                      </span>
                      {isBest ? (
                        <span className="tanken-diff tanken-diff--best">günstigster</span>
                      ) : (
                        diff > 0 && <span className="tanken-diff">+{diff} ct</span>
                      )}
                    </div>

                    <a
                      className="tanken-route"
                      href={mapsUrl(station)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Route zu ${station.brand} ${station.name}`}
                    >
                      Route
                    </a>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
