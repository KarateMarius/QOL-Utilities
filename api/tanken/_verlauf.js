// Tagesverlauf der Spritpreise.
//
// Sprit ist morgens teuer und abends billiger - aber um wie viel, und wann
// genau, unterscheidet sich je Ort. Diese Datei sammelt die Antwort.
//
// WOHER DIE DATEN KOMMEN: nicht aus einem stuendlichen Job. Der Hobby-Tarif
// erlaubt genau einen Cron-Lauf pro Tag, damit laesst sich kein Tagesverlauf
// aufzeichnen. Stattdessen wird jedes Mal mitgeschrieben, wenn die Liste
// ohnehin frisch geholt wird - also immer dann, wenn jemand die App oeffnet.
//
// Daraus folgt eine Eigenschaft, die die Oberflaeche auch benennt: der
// Verlauf kennt nur die Stunden, in denen jemand hingesehen hat. Wer nie um
// fuenf Uhr morgens tankt, hat dort keine Werte - und die App behauptet dann
// auch keine.
//
// Je Stunde wird der guenstigste offene Preis gemerkt: Summe und Anzahl fuer
// den Mittelwert, dazu der niedrigste je gesehene Wert.
import { readKey, writeKey } from "../angebote/_store.js";

const TTL_SECONDS = 120 * 24 * 3600;
const verlaufKey = (plz, type) => `tanken:verlauf:${plz}:${type}`;

/** Stunde in lokaler deutscher Zeit - danach richtet sich das Tankverhalten. */
function stundeBerlin(now = new Date()) {
  const text = now.toLocaleString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", hour12: false });
  return String(Number.parseInt(text, 10)).padStart(2, "0");
}

function heute() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Schreibt den guenstigsten offenen Preis in den Stundentopf.
 * Fehler bleiben hier: ein misslungener Verlaufseintrag darf die Preisliste
 * nicht aufhalten.
 */
export async function notiere(plz, type, stations) {
  try {
    const offen = (stations || []).filter((s) => s.open && s.price > 0);
    if (!offen.length) return;
    const bester = offen.reduce((a, b) => (b.price < a.price ? b : a)).price;

    const key = verlaufKey(plz, type);
    const stand = (await readKey(key)) || { seit: heute(), stunden: {} };
    const stunde = stundeBerlin();
    const topf = stand.stunden[stunde] || { summe: 0, anzahl: 0, min: bester };

    stand.stunden[stunde] = {
      summe: Math.round((topf.summe + bester) * 1000) / 1000,
      anzahl: topf.anzahl + 1,
      min: Math.min(topf.min, bester),
    };
    stand.seit = stand.seit || heute();
    stand.zuletzt = heute();

    await writeKey(key, stand, TTL_SECONDS);
  } catch (err) {
    console.error("[tanken] verlauf:", err.message);
  }
}

/** Fuer die Anzeige: je Stunde der Mittelwert, plus Rahmenangaben. */
export async function lies(plz, type) {
  const stand = await readKey(verlaufKey(plz, type));
  if (!stand?.stunden) return null;

  const stunden = Object.entries(stand.stunden)
    .map(([stunde, topf]) => ({
      stunde: Number(stunde),
      mittel: Math.round((topf.summe / topf.anzahl) * 1000) / 1000,
      min: topf.min,
      anzahl: topf.anzahl,
    }))
    .sort((a, b) => a.stunde - b.stunde);

  if (!stunden.length) return null;
  return {
    seit: stand.seit,
    beobachtungen: stunden.reduce((summe, s) => summe + s.anzahl, 0),
    stunden,
  };
}
