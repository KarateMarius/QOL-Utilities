import { useCallback, useEffect, useRef, useState } from "react";
import Eintragsliste from "./Eintragsliste.jsx";
import { anfragen, liesStand, merkeStand, nimmVorlauf } from "./vorlauf.js";
import "./styles.css";

// Kommen und Gehen, ein Knopf.
//
// Der Bildschirm beantwortet eine Frage - laeuft gerade etwas oder nicht -
// und bietet genau eine Handlung an. Alles Weitere (Summen, Liste,
// Berichtigungen) steht darunter und stoert die Handlung nicht.
//
// Der schnellste Weg fuehrt gar nicht hierher: das Sprungziel im Manifest
// oeffnet /?stempeln=1#arbeitszeit, und die Buchung ist schon unterwegs,
// bevor diese Datei geladen ist (siehe vorlauf.js) - der Bildschirm zeigt
// nur noch, was passiert ist. Langes Druecken aufs App-Symbol, einmal
// tippen, fertig.

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
  // Der zuletzt gesehene Stand steht sofort da; die Anfrage dazu laeuft
  // laengst (siehe vorlauf.js) und loest ihn ab, sobald sie zurueck ist.
  const [daten, setDaten] = useState(liesStand);
  const [fehler, setFehler] = useState("");
  const [laedt, setLaedt] = useState(false);
  const [jetzt, setJetzt] = useState(() => Date.now());
  const begonnen = useRef(false);
  const [meldung, setMeldung] = useState("");

  // Jeder neue Stand geht hier durch - auch der aus der Eintragsliste -,
  // damit im Browser immer der zuletzt gesehene liegt.
  const uebernehmen = useCallback((inhalt) => {
    merkeStand(inhalt);
    setDaten(inhalt);
  }, []);

  // Eine Antwort, ein Weg: was vom Server kommt, landet hier - gleich ob es
  // aus dem Vorlauf stammt, aus dem Knopf oder aus dem ersten Laden.
  const verarbeiten = useCallback((ergebnis, buchung) => {
    if (ergebnis.status === 401) {
      window.dispatchEvent(new CustomEvent("qol:unauthorized"));
      return;
    }
    if (!ergebnis.inhalt) {
      setFehler(buchung ? "Keine Verbindung. Nichts gebucht." : "Keine Verbindung.");
      return;
    }
    if (ergebnis.inhalt.error) {
      setFehler(ergebnis.inhalt.error);
      return;
    }
    setFehler("");
    uebernehmen(ergebnis.inhalt);
    if (ergebnis.inhalt.gebucht) {
      setMeldung(
        ergebnis.inhalt.gebucht === "kommen"
          ? `Angefangen um ${uhr(ergebnis.inhalt.zeit)}.`
          : `Feierabend um ${uhr(ergebnis.inhalt.zeit)}.`
      );
    }
  }, [uebernehmen]);

  const holen = useCallback(
    async (monat) => verarbeiten(await anfragen(false, monat), false),
    [verarbeiten]
  );

  const stempeln = useCallback(async () => {
    setLaedt(true);
    try {
      verarbeiten(await anfragen(true), true);
    } finally {
      setLaedt(false);
    }
  }, [verarbeiten]);

  // Beim Aufwachen: den Vorlauf abholen, falls einer laeuft.
  //
  // Stand die App in der Adresse, ist die Anfrage laengst unterwegs (siehe
  // vorlauf.js) und hier bleibt nur das Warten auf die Antwort. Wer aus der
  // Uebersicht kommt, faengt hier an - dann gibt es nichts abzuholen.
  //
  // Der Merker deckt beides ab: kein zweites Buchen und keine zweite
  // Anfrage, wenn React die Wirkung ein zweites Mal ausfuehrt.
  useEffect(() => {
    if (begonnen.current) return;
    begonnen.current = true;

    const vorlauf = nimmVorlauf();
    if (vorlauf) {
      if (vorlauf.stempeln) setLaedt(true);
      vorlauf.ergebnis.then((ergebnis) => {
        verarbeiten(ergebnis, vorlauf.stempeln);
        if (vorlauf.stempeln) setLaedt(false);
      });
      return;
    }

    // Ohne Vorlauf kann das Sprungziel trotzdem hier ankommen: dann naemlich,
    // wenn die Adresse keine App nannte und man erst in der Uebersicht stand.
    const params = new URLSearchParams(window.location.search);
    if (params.get("stempeln") === "1") {
      window.history.replaceState(null, "", window.location.pathname + window.location.hash);
      stempeln();
      return;
    }
    holen();
  }, [holen, stempeln, verarbeiten]);

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
        setDaten={uebernehmen}
        setFehler={setFehler}
        wochentage={WOCHENTAGE}
        uhr={uhr}
        dauer={dauer}
        tagesSchluessel={tagesSchluessel}
      />
    </div>
  );
}
