import { useCallback, useEffect, useRef, useState } from "react";
import Eintragsliste from "./Eintragsliste.jsx";
import "./styles.css";

// Kommen und Gehen, ein Knopf.
//
// Der Bildschirm beantwortet eine Frage - laeuft gerade etwas oder nicht -
// und bietet genau eine Handlung an. Alles Weitere (Summen, Liste,
// Berichtigungen) steht darunter und stoert die Handlung nicht.
//
// Der schnellste Weg fuehrt gar nicht hierher: das Sprungziel im Manifest
// oeffnet /?stempeln=1#arbeitszeit, dann bucht die App beim Aufwachen selbst
// und zeigt nur noch, was passiert ist. Langes Druecken aufs App-Symbol,
// einmal tippen, fertig.

const WOCHENTAGE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

function uhr(iso) {
  return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

/** Millisekunden als 7 h 48 min - Sekunden interessieren bei Arbeitszeit nicht. */
function dauer(ms) {
  if (ms < 0) ms = 0;
  const minuten = Math.floor(ms / 60000);
  const stunden = Math.floor(minuten / 60);
  return stunden ? `${stunden} h ${String(minuten % 60).padStart(2, "0")} min` : `${minuten} min`;
}

function tagesSchluessel(datum) {
  return new Date(datum).toLocaleDateString("sv-SE"); // sv-SE liefert 2026-08-20
}

/** Montag 00:00 der Woche, in der das Datum liegt. */
function wochenBeginn(datum) {
  const d = new Date(datum);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

/** Summe der abgeschlossenen Zeiten ab einer Grenze, plus die laufende. */
function summe(eintraege, abZeit, jetzt) {
  let ms = 0;
  for (const e of eintraege) {
    const beginn = Date.parse(e.beginn);
    if (beginn < abZeit) continue;
    ms += (e.ende ? Date.parse(e.ende) : jetzt) - beginn;
  }
  return ms;
}

export default function ArbeitszeitApp() {
  const [daten, setDaten] = useState(null);
  const [fehler, setFehler] = useState("");
  const [laedt, setLaedt] = useState(false);
  const [jetzt, setJetzt] = useState(() => Date.now());
  const gestempelt = useRef(false);
  const [meldung, setMeldung] = useState("");

  const holen = useCallback(async (monat) => {
    const res = await fetch("/api/arbeitszeit" + (monat ? `?monat=${monat}` : ""));
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent("qol:unauthorized"));
      return null;
    }
    const inhalt = await res.json();
    if (inhalt.error) {
      setFehler(inhalt.error);
      return null;
    }
    setFehler("");
    setDaten(inhalt);
    return inhalt;
  }, []);

  const stempeln = useCallback(async () => {
    setLaedt(true);
    try {
      const res = await fetch("/api/arbeitszeit", { method: "POST" });
      if (res.status === 401) {
        window.dispatchEvent(new CustomEvent("qol:unauthorized"));
        return;
      }
      const inhalt = await res.json();
      if (inhalt.error) {
        setFehler(inhalt.error);
        return;
      }
      setDaten(inhalt);
      setFehler("");
      setMeldung(
        inhalt.gebucht === "kommen"
          ? `Angefangen um ${uhr(inhalt.zeit)}.`
          : `Feierabend um ${uhr(inhalt.zeit)}.`
      );
    } catch {
      setFehler("Keine Verbindung. Nichts gebucht.");
    } finally {
      setLaedt(false);
    }
  }, []);

  // Beim Aufwachen: erst laden, und falls das Sprungziel es verlangt, buchen.
  //
  // Der Merker verhindert das zweite Buchen, wenn React die Wirkung ein
  // zweites Mal ausfuehrt; die Adresse wird sofort bereinigt, damit ein
  // Neuladen oder ein Lesezeichen nicht erneut stempelt.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const soll = params.get("stempeln") === "1";
    if (soll && !gestempelt.current) {
      gestempelt.current = true;
      window.history.replaceState(null, "", window.location.pathname + window.location.hash);
      stempeln();
      return;
    }
    holen();
  }, [holen, stempeln]);

  // Die laufende Zeit muss mitlaufen, sonst steht eine Zahl da, die schon
  // beim Hinsehen falsch ist. Jede halbe Minute genuegt - angezeigt werden
  // ohnehin nur Minuten.
  useEffect(() => {
    if (!daten?.laeuft) return undefined;
    const timer = setInterval(() => setJetzt(Date.now()), 30000);
    return () => clearInterval(timer);
  }, [daten?.laeuft]);

  if (!daten && fehler) {
    return (
      <div className="arbeitszeit-app">
        <p className="az-fehler">{fehler}</p>
      </div>
    );
  }

  if (!daten) {
    return (
      <div className="arbeitszeit-app">
        <p className="az-warten">Einen Moment…</p>
      </div>
    );
  }

  const laeuft = daten.laeuft;
  const heuteAb = new Date(jetzt);
  heuteAb.setHours(0, 0, 0, 0);

  const alle = daten.eintraege;
  const heute = summe(alle, heuteAb.getTime(), jetzt);
  const woche = summe(alle, wochenBeginn(jetzt).getTime(), jetzt);
  const monat = summe(alle, 0, jetzt);

  return (
    <div className="arbeitszeit-app">
      <button
        type="button"
        className={`az-knopf${laeuft ? " az-knopf--laeuft" : ""}`}
        onClick={stempeln}
        disabled={laedt}
      >
        {laeuft ? (
          <>
            <span className="az-knopf__lage">
              läuft seit {uhr(laeuft.beginn)} · {dauer(jetzt - Date.parse(laeuft.beginn))}
            </span>
            <span className="az-knopf__wort">Feierabend</span>
          </>
        ) : (
          <>
            <span className="az-knopf__lage">
              {heute > 0 ? `heute schon ${dauer(heute)}` : "heute noch nichts"}
            </span>
            <span className="az-knopf__wort">Angefangen</span>
          </>
        )}
      </button>

      {meldung && <p className="az-meldung">{meldung}</p>}
      {fehler && <p className="az-fehler">{fehler}</p>}

      <div className="az-summen">
        <div className="az-summe">
          <span className="az-summe__wert">{dauer(heute)}</span>
          <span className="az-summe__marke">heute</span>
        </div>
        <div className="az-summe">
          <span className="az-summe__wert">{dauer(woche)}</span>
          <span className="az-summe__marke">diese Woche</span>
        </div>
        <div className="az-summe">
          <span className="az-summe__wert">{dauer(monat)}</span>
          <span className="az-summe__marke">
            {new Date(daten.monat + "-02").toLocaleDateString("de-DE", { month: "long" })}
          </span>
        </div>
      </div>

      <Eintragsliste
        daten={daten}
        setDaten={setDaten}
        setFehler={setFehler}
        wochentage={WOCHENTAGE}
        uhr={uhr}
        dauer={dauer}
        tagesSchluessel={tagesSchluessel}
      />
    </div>
  );
}
