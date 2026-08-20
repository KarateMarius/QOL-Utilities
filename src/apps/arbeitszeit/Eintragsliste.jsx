import { useState } from "react";

// Die Liste des Monats, nach Tagen gruppiert.
//
// Das Nachtragen ist hier kein Zusatz, sondern der Grund, warum die App den
// Monat ueberlebt: man vergisst den Feierabend nicht ob, sondern wann. Ein
// offener Eintrag wird deshalb nie geraten, sondern bleibt sichtbar offen -
// und laesst sich mit zwei Griffen richtigstellen.

/** Aus ISO-Zeit "07:12" fuer <input type="time">, in Ortszeit. */
function zeitFeld(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** "07:12" am Tag des Bezugsdatums zurueck in eine ISO-Zeit. */
function ausFeld(bezugIso, hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(bezugIso);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

export default function Eintragsliste({
  daten,
  setDaten,
  setFehler,
  wochentage,
  uhr,
  dauer,
  tagesSchluessel,
}) {
  const [bearbeitet, setBearbeitet] = useState(null);
  const [feldBeginn, setFeldBeginn] = useState("");
  const [feldEnde, setFeldEnde] = useState("");

  function oeffnen(eintrag) {
    setBearbeitet(eintrag.id);
    setFeldBeginn(zeitFeld(eintrag.beginn));
    setFeldEnde(zeitFeld(eintrag.ende));
  }

  async function senden(pfad, optionen) {
    const res = await fetch(pfad, optionen);
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
    setBearbeitet(null);
    return inhalt;
  }

  async function speichern(eintrag) {
    const beginn = ausFeld(eintrag.beginn, feldBeginn);
    if (!beginn) {
      setFehler("Ohne Beginn geht es nicht.");
      return;
    }
    // Ein Ende vor dem Beginn heisst: es war nach Mitternacht.
    let ende = ausFeld(eintrag.ende || eintrag.beginn, feldEnde);
    if (ende && Date.parse(ende) <= Date.parse(beginn)) {
      ende = new Date(Date.parse(ende) + 86400000).toISOString();
    }
    await senden(`/api/arbeitszeit?monat=${daten.monat}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: eintrag.id, beginn, ende }),
    });
  }

  async function loeschen(eintrag) {
    await senden(`/api/arbeitszeit?id=${encodeURIComponent(eintrag.id)}&monat=${daten.monat}`, {
      method: "DELETE",
    });
  }

  if (!daten.eintraege.length) {
    return <p className="az-leer">Für diesen Monat ist noch nichts gebucht.</p>;
  }

  const tage = new Map();
  for (const e of daten.eintraege) {
    const tag = tagesSchluessel(e.beginn);
    if (!tage.has(tag)) tage.set(tag, []);
    tage.get(tag).push(e);
  }

  return (
    <ol className="az-liste">
      {[...tage.entries()].reverse().map(([tag, eintraege]) => {
        const datum = new Date(tag + "T12:00");
        const tagesSumme = eintraege.reduce(
          (s, e) => s + (e.ende ? Date.parse(e.ende) - Date.parse(e.beginn) : 0),
          0
        );
        return (
          <li key={tag} className="az-tag">
            <div className="az-tag__kopf">
              <span className="az-tag__datum">
                {wochentage[datum.getDay()]} {datum.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
              </span>
              <span className="az-tag__summe">{tagesSumme ? dauer(tagesSumme) : "—"}</span>
            </div>

            {eintraege.map((e) =>
              bearbeitet === e.id ? (
                <div key={e.id} className="az-zeile az-zeile--offen">
                  <input
                    type="time"
                    value={feldBeginn}
                    onChange={(ev) => setFeldBeginn(ev.target.value)}
                    aria-label="Beginn"
                  />
                  <span className="az-bis">bis</span>
                  <input
                    type="time"
                    value={feldEnde}
                    onChange={(ev) => setFeldEnde(ev.target.value)}
                    aria-label="Ende"
                  />
                  <button type="button" className="az-klein" onClick={() => speichern(e)}>
                    Sichern
                  </button>
                  <button type="button" className="az-klein az-klein--weg" onClick={() => loeschen(e)}>
                    Löschen
                  </button>
                </div>
              ) : (
                <button key={e.id} type="button" className="az-zeile" onClick={() => oeffnen(e)}>
                  <span className="az-zeile__zeit">
                    {uhr(e.beginn)} bis {e.ende ? uhr(e.ende) : <em className="az-offen">offen</em>}
                  </span>
                  <span className="az-zeile__dauer">
                    {e.ende ? dauer(Date.parse(e.ende) - Date.parse(e.beginn)) : ""}
                  </span>
                </button>
              )
            )}
          </li>
        );
      })}
    </ol>
  );
}
