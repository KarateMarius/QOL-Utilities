import { useEffect, useState } from "react";
import { IconClose } from "../../../icons.jsx";

// Rezepte als Abkuerzung beim Schreiben der Einkaufsliste: einmal "Chili con
// Carne" mit acht Zutaten anlegen, danach ein Antippen statt acht Zeilen.
//
// Bewusst ohne Mengen und ohne Zuordnung zu Prospektartikeln. Die Zutaten
// landen als eigene Zeilen im Korb - ob es die Bohnen diese Woche im Angebot
// gibt, sagt die Watchlist, nicht das Rezept.

export default function RezeptListe({ onUebernehmen }) {
  const [rezepte, setRezepte] = useState([]);
  const [geladen, setGeladen] = useState(false);
  const [offen, setOffen] = useState(false);
  const [neuName, setNeuName] = useState("");
  const [neuZutaten, setNeuZutaten] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    let abgebrochen = false;
    fetch("/api/angebote/rezepte")
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (abgebrochen || !payload) return;
        setRezepte(payload.rezepte || []);
      })
      .catch(() => undefined)
      .finally(() => !abgebrochen && setGeladen(true));
    return () => {
      abgebrochen = true;
    };
  }, []);

  async function speichern(naechste) {
    setRezepte(naechste);
    setStatus("");
    try {
      const res = await fetch("/api/angebote/rezepte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rezepte: naechste }),
      });
      if (res.status === 401) {
        setStatus("Rezepte gehören zum Konto — dafür musst du angemeldet sein.");
        return;
      }
      const payload = await res.json();
      setRezepte(payload.rezepte || []);
    } catch (e) {
      setStatus(`Nicht gespeichert: ${e.message}`);
    }
  }

  function anlegen(event) {
    event.preventDefault();
    const name = neuName.trim();
    // Zeilenumbruch oder Komma trennt - beides tippt sich natuerlich.
    const zutaten = neuZutaten
      .split(/[\n,]/)
      .map((z) => z.trim())
      .filter(Boolean);
    if (!name || !zutaten.length) {
      setStatus("Name und mindestens eine Zutat.");
      return;
    }
    speichern([...rezepte, { id: `r-${Date.now()}`, name, zutaten }]);
    setNeuName("");
    setNeuZutaten("");
    setOffen(false);
  }

  if (!geladen) return null;

  return (
    <section className="rezepte">
      <div className="rezepte__kopf">
        <h3>Rezepte</h3>
        <button type="button" className="link-button" onClick={() => setOffen((auf) => !auf)}>
          {offen ? "Abbrechen" : "Neues Rezept"}
        </button>
      </div>

      {offen && (
        <form className="rezepte__form" onSubmit={anlegen}>
          <input
            value={neuName}
            onChange={(e) => setNeuName(e.target.value)}
            placeholder="Name, z. B. Chili con Carne"
            aria-label="Name des Rezepts"
          />
          <textarea
            value={neuZutaten}
            onChange={(e) => setNeuZutaten(e.target.value)}
            placeholder={"Zutaten, eine je Zeile\nHackfleisch\nKidneybohnen\nMais"}
            rows={4}
            aria-label="Zutaten"
          />
          <button type="submit" className="button">
            Rezept sichern
          </button>
        </form>
      )}

      {rezepte.length === 0 ? (
        <p className="rezepte__leer">
          Noch keins. Ein Rezept spart beim nächsten Einkauf das Tippen der immer gleichen Zutaten.
        </p>
      ) : (
        rezepte.map((rezept) => (
          <div className="rezept" key={rezept.id}>
            <button
              type="button"
              className="rezept__nehmen"
              onClick={() => onUebernehmen(rezept.zutaten)}
              title={rezept.zutaten.join(", ")}
            >
              <span className="rezept__name">{rezept.name}</span>
              <span className="rezept__anzahl">{rezept.zutaten.length} Zutaten</span>
              <span className="rezept__aktion">Auf die Liste</span>
            </button>
            <button
              type="button"
              className="remove"
              onClick={() => speichern(rezepte.filter((r) => r.id !== rezept.id))}
              aria-label={`${rezept.name} löschen`}
            >
              <IconClose />
            </button>
          </div>
        ))
      )}

      {status && <p className="status">{status}</p>}
    </section>
  );
}
