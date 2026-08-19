import { useEffect, useState } from "react";
import { currentState, enablePush } from "../../push.js";

// Preisalarm: unterhalb welcher Marke soll gemeldet werden?
//
// Zwei Dinge sagt die Leiste offen, weil sie sonst falsche Erwartungen weckt:
// geprueft wird einmal am Tag (mehr gibt der Hobby-Tarif nicht her), und
// gemeldet wird der Uebergang nach unten - nicht jeden Morgen aufs Neue,
// solange der Preis unten bleibt.

const NAMEN = { diesel: "Diesel", e5: "Super E5", e10: "Super E10" };

function alsZahl(text) {
  const zahl = Number.parseFloat(String(text).replace(",", "."));
  return Number.isFinite(zahl) ? zahl : null;
}

function alsText(preis) {
  return preis.toFixed(3).replace(".", ",");
}

export default function AlarmLeiste({ plz, typ, radius, bestpreis }) {
  const [alarm, setAlarm] = useState(null);
  const [entwurf, setEntwurf] = useState("");
  const [offen, setOffen] = useState(false);
  const [status, setStatus] = useState("");
  const [pushZustand, setPushZustand] = useState("off");

  useEffect(() => {
    let abgebrochen = false;
    fetch("/api/tanken/alarm")
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (abgebrochen || !payload) return;
        setAlarm(payload.alarm);
        if (payload.alarm) setEntwurf(alsText(payload.alarm.schwelle));
      })
      .catch(() => undefined);
    currentState().then((z) => !abgebrochen && setPushZustand(z));
    return () => {
      abgebrochen = true;
    };
  }, []);

  async function speichern(schwelle) {
    setStatus("");
    try {
      const res = await fetch("/api/tanken/alarm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(schwelle === null ? { schwelle: null } : { plz, typ, radius, schwelle }),
      });
      if (res.status === 401) {
        setStatus("Dafür musst du angemeldet sein.");
        return;
      }
      const payload = await res.json();
      if (payload.error) {
        setStatus(payload.error);
        return;
      }
      setAlarm(payload.alarm);
      setOffen(false);
      setStatus(payload.alarm ? "Alarm gespeichert." : "Alarm ausgeschaltet.");
    } catch (e) {
      setStatus(`Nicht gespeichert: ${e.message}`);
    }
  }

  // Ohne angemeldetes Geraet gaebe es nichts, worauf die Meldung ankaeme.
  async function pushAn() {
    try {
      setPushZustand(await enablePush());
    } catch {
      setPushZustand(await currentState());
    }
  }

  if (alarm && !offen) {
    return (
      <div className="tanken-alarm">
        <span className="tanken-alarm__aktiv">
          Alarm: {NAMEN[alarm.typ] || alarm.typ} unter {alsText(alarm.schwelle)} €
        </span>
        <span className="tanken-alarm__hinweis">einmal täglich geprüft</span>
        <button type="button" className="tanken-alarm__link" onClick={() => setOffen(true)}>
          Ändern
        </button>
        <button type="button" className="tanken-alarm__link" onClick={() => speichern(null)}>
          Aus
        </button>
        {status && <span className="tanken-alarm__status">{status}</span>}
      </div>
    );
  }

  if (!offen) {
    return (
      <div className="tanken-alarm">
        <button type="button" className="tanken-alarm__link" onClick={() => setOffen(true)}>
          Preisalarm einrichten
        </button>
        {status && <span className="tanken-alarm__status">{status}</span>}
      </div>
    );
  }

  return (
    <form
      className="tanken-alarm"
      onSubmit={(e) => {
        e.preventDefault();
        const zahl = alsZahl(entwurf);
        if (zahl) speichern(zahl);
        else setStatus("Trag einen Preis ein, z. B. 1,65.");
      }}
    >
      <label className="tanken-alarm__feld">
        Melden, wenn {NAMEN[typ] || typ} unter
        <input
          value={entwurf}
          onChange={(e) => setEntwurf(e.target.value)}
          inputMode="decimal"
          placeholder={bestpreis ? alsText(bestpreis) : "1,65"}
          aria-label="Preisgrenze in Euro"
        />
        € fällt
      </label>
      <button type="submit" className="tanken-alarm__speichern">
        Speichern
      </button>
      <button type="button" className="tanken-alarm__link" onClick={() => setOffen(false)}>
        Abbrechen
      </button>
      <span className="tanken-alarm__hinweis">
        Geprüft wird einmal täglich, gemeldet nur, wenn der Preis neu darunter fällt.
      </span>
      {pushZustand !== "on" && (
        <span className="tanken-alarm__hinweis">
          {pushZustand === "off" ? (
            <>
              Ohne Benachrichtigungen kommt nichts an —{" "}
              <button type="button" className="tanken-alarm__link" onClick={pushAn}>
                einschalten
              </button>
            </>
          ) : (
            "Benachrichtigungen sind auf diesem Gerät nicht möglich — siehe Watchlist der Angebote."
          )}
        </span>
      )}
      {status && <span className="tanken-alarm__status">{status}</span>}
    </form>
  );
}
