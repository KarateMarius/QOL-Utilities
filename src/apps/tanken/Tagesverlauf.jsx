// Wann ist es hier billig? Ein Balken je Stunde.
//
// Gezeigt werden alle 24 Stunden, auch die ohne Daten - gerade sie sind eine
// Auskunft: der Verlauf entsteht aus den Abrufen der App (siehe
// api/tanken/_verlauf.js), er kennt also nur Stunden, in denen jemand
// hingesehen hat. Eine Luecke als schmalen Strich zu zeigen ist ehrlicher,
// als 24 Balken zu zeichnen und drei davon zu erfinden.

const MIN_STUNDEN = 3;

function preisText(preis) {
  return `${preis.toFixed(3).replace(".", ",")} €`;
}

function tagText(iso) {
  if (!iso) return "";
  const datum = new Date(iso);
  return Number.isNaN(datum.getTime())
    ? ""
    : datum.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

export default function Tagesverlauf({ verlauf }) {
  // Aus einer einzigen Stunde laesst sich kein Verlauf ablesen. Lieber nichts
  // zeigen als eine Linie, die nichts bedeutet.
  if (!verlauf?.stunden?.length || verlauf.stunden.length < MIN_STUNDEN) return null;

  const werte = verlauf.stunden.map((s) => s.mittel);
  const tief = Math.min(...werte);
  const hoch = Math.max(...werte);
  const spanne = hoch - tief;
  const guenstigste = verlauf.stunden.find((s) => s.mittel === tief);
  const nachStunde = new Map(verlauf.stunden.map((s) => [s.stunde, s]));

  return (
    <section className="tanken-verlauf">
      <p className="tanken-verlauf__kopf">
        Am günstigsten bisher gegen <strong>{String(guenstigste.stunde).padStart(2, "0")} Uhr</strong>
        {spanne > 0 && (
          <>
            {" "}
            — im Schnitt {preisText(tief)}, zur teuersten Stunde {preisText(hoch)} (
            {Math.round(spanne * 100)} ct Unterschied)
          </>
        )}
      </p>

      <div className="tanken-verlauf__balken" role="img" aria-label="Preis je Tagesstunde">
        {Array.from({ length: 24 }, (_, stunde) => {
          const eintrag = nachStunde.get(stunde);
          // Ohne Spanne (alle Werte gleich) waere jede Hoehe willkuerlich -
          // dann stehen alle Balken gleich hoch.
          const anteil = eintrag && spanne > 0 ? (eintrag.mittel - tief) / spanne : eintrag ? 0.5 : 0;
          return (
            <span
              key={stunde}
              className={`tanken-verlauf__stunde${eintrag ? "" : " tanken-verlauf__stunde--leer"}`}
              title={
                eintrag
                  ? `${String(stunde).padStart(2, "0")} Uhr: im Schnitt ${preisText(eintrag.mittel)}, günstigster ${preisText(eintrag.min)} (${eintrag.anzahl} Beobachtungen)`
                  : `${String(stunde).padStart(2, "0")} Uhr: noch keine Beobachtung`
              }
            >
              <span
                className="tanken-verlauf__saeule"
                style={{ height: `${eintrag ? 15 + anteil * 85 : 3}%` }}
              />
            </span>
          );
        })}
      </div>

      <div className="tanken-verlauf__achse">
        <span>0</span>
        <span>6</span>
        <span>12</span>
        <span>18</span>
        <span>23</span>
      </div>

      <p className="tanken-verlauf__fuss">
        {verlauf.beobachtungen} Beobachtungen seit {tagText(verlauf.seit)}. Aufgezeichnet wird beim
        Abruf der Liste — Stunden ohne Balken hat noch niemand nachgesehen.
      </p>
    </section>
  );
}
