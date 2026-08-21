import { useCallback, useEffect, useMemo, useState } from "react";
import "./styles.css";

// Anschaffungen: was fehlt, was es kosten darf, was man dafuer gesehen hat.
//
// Der Wocheneinkauf fragt "was ist gerade billig?" - eine Routine ohne Ende.
// Ein Umzug fragt etwas anderes: "was fehlt noch, was kostet es, und kann ich
// warten?" Deshalb steht hier eine Liste und kein zweiter Angebots-Strom.
//
// Prospekt-Treffer haengen am Posten, nicht in einem eigenen Bereich. Ein
// Angebot ohne Bezug zu dem, was man sucht, ist nur Rauschen; eines neben dem
// Posten "Waschmaschine, hoechstens 400 Euro" ist eine Antwort.
//
// Die Liste ist sofort da, die Prospekte kommen nach. Sie brauchen einen
// Durchgang durch zwei fremde Server - darauf soll niemand warten, der bloss
// nachsehen will, was noch fehlt.

const GRUPPEN_TITEL = {
  moebel: "Möbel",
  grossgeraet: "Großgerät",
  technik: "Technik",
  einrichtung: "Einrichtung",
  bau: "Bau",
};

function euro(betrag) {
  if (betrag === null || betrag === undefined) return "–";
  return betrag.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function bester(posten) {
  const preise = (posten.preise || []).map((p) => p.betrag);
  return preise.length ? Math.min(...preise) : null;
}

/** Der Produktname vor dem Gedankenstrich - dahinter steht Prosa. */
function kurz(name) {
  return String(name || "").split(/\s[–—-]\s/)[0].trim();
}

/** Angebote, die zu einem Posten passen. Bewusst schlicht: jedes Wort ab vier
    Buchstaben, das im Angebotsnamen vorkommt, zaehlt. Wer "Sofa" sucht, will
    Sofas sehen und nicht die Kunst eines Rankings. */
function passende(posten, angebote) {
  const worte = posten.name.toLowerCase().split(/\s+/).filter((w) => w.length >= 4);
  if (!worte.length) return [];
  return angebote
    .filter((a) => {
      const name = kurz(a.name).toLowerCase();
      return worte.some((w) => name.includes(w));
    })
    .sort((a, b) => a.price - b.price)
    .slice(0, 3);
}

export default function AnschaffungApp() {
  const [posten, setPosten] = useState(null);
  const [angebote, setAngebote] = useState(null);
  const [fehler, setFehler] = useState("");
  const [offen, setOffen] = useState(null);
  const [name, setName] = useState("");
  const [raum, setRaum] = useState("");
  const [budget, setBudget] = useState("");
  const [busy, setBusy] = useState(false);

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
    setPosten(inhalt.posten);
    return true;
  }, []);

  useEffect(() => {
    fetch("/api/anschaffung?was=posten")
      .then(verarbeiten)
      .catch(() => setFehler("Keine Verbindung."));
    // Die Prospekte kommen nach und halten nichts auf.
    fetch("/api/anschaffung?was=prospekte")
      .then((res) => (res.ok ? res.json() : null))
      .then((inhalt) => setAngebote(inhalt?.angebote || []))
      .catch(() => setAngebote([]));
  }, [verarbeiten]);

  const schicken = useCallback(
    async (methode, koerper, anhang = "") => {
      setBusy(true);
      try {
        // Der Weg steht schon in der Adresse; alles Weitere haengt mit & an.
        await verarbeiten(
          await fetch(`/api/anschaffung?was=posten${anhang}`, {
            method: methode,
            headers: { "Content-Type": "application/json" },
            body: koerper ? JSON.stringify(koerper) : undefined,
          })
        );
      } catch {
        setFehler("Keine Verbindung.");
      } finally {
        setBusy(false);
      }
    },
    [verarbeiten]
  );

  async function anlegen(ereignis) {
    ereignis.preventDefault();
    if (!name.trim() || busy) return;
    await schicken("POST", { name, raum, budget: budget || undefined });
    setName("");
    setBudget("");
  }

  const summen = useMemo(() => {
    const liste = posten || [];
    const gesucht = liste.filter((p) => p.zustand === "gesucht");
    const geplant = gesucht.reduce((s, p) => s + (p.budget ?? bester(p) ?? 0), 0);
    const ausgegeben = liste
      .filter((p) => p.zustand === "gekauft")
      .reduce((s, p) => s + (p.gekauftFuer ?? 0), 0);
    return { offen: gesucht.length, gesamt: liste.length, geplant, ausgegeben };
  }, [posten]);

  const nachRaum = useMemo(() => {
    const map = new Map();
    for (const p of posten || []) {
      const schluessel = p.raum || "Ohne Raum";
      if (!map.has(schluessel)) map.set(schluessel, []);
      map.get(schluessel).push(p);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "de"));
  }, [posten]);

  return (
    <div className="anschaffung-app">
      <div className="as-kopf">
        <span className="as-kopf__zahl">
          {summen.offen} von {summen.gesamt} offen
        </span>
        <span className="as-kopf__geld">
          {euro(summen.geplant)} geplant · {euro(summen.ausgegeben)} ausgegeben
        </span>
      </div>

      <form className="as-neu" onSubmit={anlegen}>
        <input
          className="as-neu__name"
          placeholder="Was fehlt? z. B. Waschmaschine"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="as-neu__raum"
          placeholder="Raum"
          value={raum}
          onChange={(e) => setRaum(e.target.value)}
        />
        <input
          className="as-neu__budget"
          type="number"
          inputMode="decimal"
          placeholder="€"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
        />
        <button type="submit" className="as-neu__knopf" disabled={!name.trim() || busy}>
          Auf die Liste
        </button>
      </form>

      {fehler && <p className="as-fehler">{fehler}</p>}

      <div className="as-liste">
        {posten === null && <p className="as-hinweis">Die Liste wird geladen…</p>}
        {posten?.length === 0 && (
          <p className="as-hinweis">
            Noch nichts auf der Liste. Trag ein, was in die leere Wohnung soll — die
            Prospekte der Möbel- und Technikhäuser werden dann darauf abgeklopft.
          </p>
        )}

        {nachRaum.map(([raumName, stuecke]) => (
          <section key={raumName} className="as-raum">
            <h2 className="as-raum__titel">{raumName}</h2>
            {stuecke.map((p) => {
              const treffer = angebote ? passende(p, angebote) : [];
              const best = bester(p);
              return (
                <div
                  key={p.id}
                  className={`as-posten${p.zustand === "gekauft" ? " as-posten--fertig" : ""}`}
                >
                  <button
                    type="button"
                    className="as-posten__zeile"
                    onClick={() => setOffen(offen === p.id ? null : p.id)}
                  >
                    <span className="as-posten__name">{p.name}</span>
                    <span className="as-posten__geld">
                      {p.zustand === "gekauft"
                        ? `gekauft für ${euro(p.gekauftFuer)}`
                        : best !== null
                          ? `beste ${euro(best)}${p.budget ? ` von ${euro(p.budget)}` : ""}`
                          : p.budget
                            ? `bis ${euro(p.budget)}`
                            : "kein Budget"}
                    </span>
                  </button>

                  {p.zustand === "gesucht" && treffer.length > 0 && (
                    <ul className="as-treffer">
                      {treffer.map((a) => (
                        <li
                          key={a.id}
                          className={`as-treffer__zeile${
                            p.budget && a.price <= p.budget ? " as-treffer__zeile--gut" : ""
                          }`}
                        >
                          <span className="as-treffer__preis">{euro(a.price)}</span>
                          <span className="as-treffer__wo">{a.merchant}</span>
                          <span className="as-treffer__was">{kurz(a.name)}</span>
                          {GRUPPEN_TITEL[a.gruppe] && (
                            <span className="as-treffer__gruppe">{GRUPPEN_TITEL[a.gruppe]}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}

                  {offen === p.id && <PostenDetail posten={p} busy={busy} schicken={schicken} />}
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}

/** Das Preisgedaechtnis eines Postens - und die Handgriffe daran. */
function PostenDetail({ posten, busy, schicken }) {
  const [betrag, setBetrag] = useState("");
  const [laden, setLaden] = useState("");

  async function preisEintragen(ereignis) {
    ereignis.preventDefault();
    if (!betrag || busy) return;
    await schicken("PUT", { id: posten.id, preis: { betrag, laden } });
    setBetrag("");
    setLaden("");
  }

  return (
    <div className="as-detail">
      {posten.preise?.length > 0 && (
        <ul className="as-gedaechtnis">
          {[...posten.preise]
            .sort((a, b) => a.betrag - b.betrag)
            .map((p, i) => (
              <li key={i}>
                <span className="as-gedaechtnis__preis">{euro(p.betrag)}</span>
                <span className="as-gedaechtnis__laden">{p.laden || "ohne Laden"}</span>
                <span className="as-gedaechtnis__wann">
                  {new Date(p.zeit).toLocaleDateString("de-DE", { day: "numeric", month: "short" })}
                </span>
              </li>
            ))}
        </ul>
      )}

      <form className="as-preis" onSubmit={preisEintragen}>
        <input
          type="number"
          inputMode="decimal"
          placeholder="Preis gesehen"
          value={betrag}
          onChange={(e) => setBetrag(e.target.value)}
        />
        <input placeholder="wo?" value={laden} onChange={(e) => setLaden(e.target.value)} />
        <button type="submit" disabled={!betrag || busy}>
          Merken
        </button>
      </form>

      <div className="as-handgriffe">
        <button
          type="button"
          onClick={() =>
            schicken("PUT", {
              id: posten.id,
              zustand: posten.zustand === "gekauft" ? "gesucht" : "gekauft",
            })
          }
          disabled={busy}
        >
          {posten.zustand === "gekauft" ? "Doch noch offen" : "Gekauft"}
        </button>
        <button
          type="button"
          className="as-loeschen"
          onClick={() => schicken("DELETE", null, `&id=${posten.id}`)}
          disabled={busy}
        >
          Löschen
        </button>
      </div>
    </div>
  );
}
