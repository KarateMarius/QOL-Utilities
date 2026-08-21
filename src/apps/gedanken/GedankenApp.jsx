import { useCallback, useEffect, useRef, useState } from "react";
import "./styles.css";

// Gedanken: ein einseitiger Chat mit sich selbst.
//
// Der Zweck ist nicht die Liste, sondern das Loswerden. Wer einen Gedanken
// hat, hat ihn jetzt und nicht gleich - deshalb steht das Eingabefeld da,
// bevor irgendetwas geladen ist. Der Verlauf darueber darf nachkommen; das
// Schreiben wartet nicht auf ihn.
//
// Warum eine Meldung fuer etwas, das man selbst gerade geschrieben hat: damit
// der Zettel auf dem Sperrbildschirm liegt statt in einer App, die man
// aufmachen muesste. Aufschreiben ist das eine, wiederfinden das andere.
//
// Wer einen Tag anhaengt, bekommt die Meldung im taeglichen Lauf am Morgen.
// Genauer geht es nicht, und die Oberflaeche sagt das auch, statt eine
// Uhrzeit zu versprechen, die niemand einhaelt.

const TAGE = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

function uhr(iso) {
  return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function tagesSchluessel(iso) {
  return new Date(iso).toLocaleDateString("sv-SE"); // sv-SE liefert 2026-08-21
}

/** "Heute", "Gestern" oder "Dienstag, 12. August". */
function tagesTitel(iso) {
  const tag = tagesSchluessel(iso);
  const heute = new Date();
  const gestern = new Date(heute.getTime() - 86400000);
  if (tag === tagesSchluessel(heute)) return "Heute";
  if (tag === tagesSchluessel(gestern)) return "Gestern";
  const d = new Date(iso);
  return `${TAGE[d.getDay()]}, ${d.toLocaleDateString("de-DE", { day: "numeric", month: "long" })}`;
}

/** "am 3. September" aus einem YYYY-MM-DD. */
function alsTag(tag) {
  return new Date(tag + "T12:00:00").toLocaleDateString("de-DE", { day: "numeric", month: "long" });
}

function morgen() {
  const d = new Date(Date.now() + 86400000);
  return d.toLocaleDateString("sv-SE");
}

export default function GedankenApp() {
  // null heisst: noch nicht geladen. Das ist etwas anderes als [] - leer
  // waere eine Aussage, und die faellt erst, wenn der Server geantwortet hat.
  const [gedanken, setGedanken] = useState(null);
  const [text, setText] = useState("");
  const [faellig, setFaellig] = useState("");
  const [tagOffen, setTagOffen] = useState(false);
  const [fehler, setFehler] = useState("");
  const [sendet, setSendet] = useState(false);
  const [offen, setOffen] = useState(null);
  const ende = useRef(null);
  const feld = useRef(null);

  const verarbeiten = useCallback(async (res) => {
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent("qol:unauthorized"));
      return false;
    }
    const inhalt = await res.json().catch(() => null);
    if (!inhalt) {
      setFehler("Keine Verbindung.");
      return false;
    }
    if (inhalt.error) {
      setFehler(inhalt.error);
      return false;
    }
    setFehler("");
    setGedanken(inhalt.gedanken);
    return true;
  }, []);

  useEffect(() => {
    let abgemeldet = false;
    fetch("/api/gedanken")
      .then((res) => {
        if (!abgemeldet) return verarbeiten(res);
        return false;
      })
      .catch(() => {
        if (!abgemeldet) setFehler("Keine Verbindung.");
      });
    return () => {
      abgemeldet = true;
    };
  }, [verarbeiten]);

  // Ans Ende springen, wie ein Chat es tut. Nur wenn es etwas gibt - sonst
  // ruckelt es beim ersten Rendern ohne Grund.
  useEffect(() => {
    if (gedanken?.length) ende.current?.scrollIntoView({ block: "end" });
  }, [gedanken?.length]);

  async function senden(ereignis) {
    ereignis.preventDefault();
    const inhalt = text.trim();
    if (!inhalt || sendet) return;

    setSendet(true);
    try {
      const res = await fetch("/api/gedanken", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inhalt, faellig: faellig || undefined }),
      });
      if (await verarbeiten(res)) {
        setText("");
        setFaellig("");
        setTagOffen(false);
      }
    } catch {
      setFehler("Keine Verbindung. Nichts geschrieben.");
    } finally {
      setSendet(false);
      feld.current?.focus();
    }
  }

  async function loeschen(id) {
    try {
      await verarbeiten(await fetch(`/api/gedanken?id=${id}`, { method: "DELETE" }));
    } catch {
      setFehler("Keine Verbindung.");
    }
    setOffen(null);
  }

  let letzterTag = null;

  return (
    <div className="gedanken-app">
      <div className="gedanken-verlauf">
        {gedanken === null && <p className="gd-hinweis">Der Verlauf wird geladen…</p>}
        {gedanken?.length === 0 && (
          <p className="gd-hinweis">
            Noch nichts aufgeschrieben. Was hier steht, liegt gleich auch auf dem
            Sperrbildschirm.
          </p>
        )}

        {gedanken?.map((gedanke) => {
          const tag = tagesSchluessel(gedanke.zeit);
          const neuerTag = tag !== letzterTag;
          letzterTag = tag;

          return (
            <div key={gedanke.id}>
              {neuerTag && <p className="gd-tag">{tagesTitel(gedanke.zeit)}</p>}
              <button
                type="button"
                className={`gd-blase${offen === gedanke.id ? " gd-blase--offen" : ""}`}
                onClick={() => setOffen(offen === gedanke.id ? null : gedanke.id)}
              >
                <span className="gd-blase__text">{gedanke.text}</span>
                <span className="gd-blase__fuss">
                  {uhr(gedanke.zeit)}
                  {gedanke.faellig && !gedanke.gemeldet && ` · meldet sich ${alsTag(gedanke.faellig)}`}
                  {gedanke.faellig && gedanke.gemeldet && " · gemeldet"}
                </span>
              </button>
              {offen === gedanke.id && (
                <div className="gd-werkzeug">
                  <button type="button" className="gd-loeschen" onClick={() => loeschen(gedanke.id)}>
                    Löschen
                  </button>
                </div>
              )}
            </div>
          );
        })}
        <div ref={ende} />
      </div>

      {fehler && <p className="gd-fehler">{fehler}</p>}

      <form className="gd-schreiben" onSubmit={senden}>
        {tagOffen && (
          <div className="gd-wann">
            <label className="gd-wann__feld">
              Melden am
              <input
                type="date"
                value={faellig}
                min={morgen()}
                onChange={(e) => setFaellig(e.target.value)}
              />
            </label>
            <span className="gd-wann__hinweis">Die Meldung kommt morgens, nicht zur Uhrzeit.</span>
          </div>
        )}

        <div className="gd-zeile">
          <textarea
            ref={feld}
            className="gd-feld"
            rows={1}
            placeholder="Was ist der Gedanke?"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            type="button"
            className={`gd-wann__knopf${faellig ? " gd-wann__knopf--gesetzt" : ""}`}
            onClick={() => {
              if (faellig) {
                setFaellig("");
                setTagOffen(false);
              } else {
                setTagOffen(!tagOffen);
              }
            }}
            aria-label={faellig ? "Tag entfernen" : "Für einen Tag vormerken"}
          >
            {faellig ? alsTag(faellig) : "später"}
          </button>
          <button type="submit" className="gd-senden" disabled={!text.trim() || sendet}>
            {faellig ? "Vormerken" : "Melden"}
          </button>
        </div>
      </form>
    </div>
  );
}
