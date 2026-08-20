// Was kostet der Sprit jenseits der Grenze?
//
// Hier steht bewusst kein Stationspreis, sondern der Landesdurchschnitt - und
// die Zeile sagt das an drei Stellen: in der Ueberschrift, im Fliesstext und
// im Hinweis darunter. Der Grund steht in api/tanken/_ausland.js: Preise je
// Station gibt es dort amtlich nicht, und eine geratene Zahl waere an der
// Zapfsaeule schlimmer als gar keine.
//
// Genannt wird ausserdem, aus welcher Woche der Wert stammt, wann er geholt
// wurde und mit welchem Kurs umgerechnet - ohne das ist ein Preis in einer
// fremden Waehrung nicht nachvollziehbar.

function preisText(euro) {
  return `${euro.toFixed(3).replace(".", ",")} €`;
}

function kronenText(kronen) {
  return `${kronen.toFixed(2).replace(".", ",")} Kč`;
}

function geholtText(zeitstempel) {
  if (!zeitstempel) return "";
  const minuten = Math.round((Date.now() - zeitstempel) / 60000);
  if (minuten < 1) return "gerade eben geholt";
  if (minuten < 60) return `vor ${minuten} Min. geholt`;
  const stunden = Math.round(minuten / 60);
  if (stunden < 24) return `vor ${stunden} Std. geholt`;
  return `vor ${Math.round(stunden / 24)} Tagen geholt`;
}

export default function AuslandSchnitt({ ausland, bestpreis }) {
  if (!ausland?.euro) return null;

  // Der Vergleich ist der eigentliche Zweck: lohnt der Umweg?
  const unterschied = bestpreis > 0 ? Math.round((ausland.euro - bestpreis) * 100) : null;

  return (
    <section className="ausland">
      <p className="ausland__kopf">
        <span className="ausland__land">{ausland.land}</span>
        <span className="ausland__marke">Landesdurchschnitt</span>
      </p>

      <p className="ausland__preis">
        {preisText(ausland.euro)}
        <span className="ausland__je">je Liter</span>
        {unterschied !== null && unterschied !== 0 && (
          <span className={`ausland__diff${unterschied < 0 ? " ausland__diff--billiger" : ""}`}>
            {unterschied < 0
              ? `${Math.abs(unterschied)} ct günstiger als hier`
              : `${unterschied} ct teurer als hier`}
          </span>
        )}
      </p>

      <p className="ausland__fuss">
        <strong>Durchschnitt über das ganze Land</strong>, kein Preis einer einzelnen Tankstelle.
        Erhebungswoche {ausland.woche}, {geholtText(ausland.geholt)}. Quelle: {ausland.quelle}.
        Umgerechnet aus {kronenText(ausland.kronen)} mit{" "}
        {ausland.kurs.toFixed(3).replace(".", ",")} Kč je Euro (Kurs vom {ausland.kursDatum}).
        {ausland.zusammengefasst &&
          " Die Quelle führt E5 und E10 nicht getrennt; der Wert gilt für Natural 95."}
      </p>
    </section>
  );
}
