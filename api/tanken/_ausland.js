// Spritpreise im Ausland - als Landesdurchschnitt, nicht je Tankstelle.
//
// WARUM NUR EIN DURCHSCHNITT: In Deutschland muessen Tankstellen jede
// Preisaenderung binnen fuenf Minuten an die Markttransparenzstelle melden.
// Aus dieser Pflicht entsteht die Liste, die diese App sonst zeigt. Die
// Pflicht endet an der Grenze. Tschechien veroeffentlicht amtlich nur den
// Landesdurchschnitt, woechentlich; Preise je Station fuehren dort allein
// Sammler, die auf Meldungen von Nutzern beruhen oder Geld kosten.
//
// Also lieber die kleinere Zahl ehrlich als die groessere geraten. Der
// Durchschnitt beantwortet ohnehin die Frage, die an der Grenze zaehlt:
// lohnt der Umweg? Die Oberflaeche nennt deshalb immer mit, dass es ein
// Durchschnitt ist, aus welcher Woche er stammt und wann er geholt wurde.
//
// Quellen, beide amtlich und ohne Schluessel:
//   Preise  Tschechisches Statistikamt, Datensatz CENPHMT, woechentlich
//   Kurs    Tschechische Nationalbank, Tageskurs
import { readKey, writeKey } from "../angebote/_store.js";

const PREISE_CSV = "https://data.csu.gov.cz/opendata/sady/CENPHMT/distribuce/csv";
const KURS_TXT =
  "https://www.cnb.cz/en/financial-markets/foreign-exchange-market/central-bank-exchange-rate-fixing/central-bank-exchange-rate-fixing/daily.txt";

// Die Zahl wechselt einmal die Woche - einmal am Tag nachsehen ist reichlich.
const TTL_SECONDS = 24 * 3600;
const CACHE_KEY = "tanken:ausland:cz";

// Der Datensatz kennt drei Sorten. E5 und E10 fuehrt er nicht getrennt,
// beide bekommen deshalb den Wert fuer Natural 95 - und die Oberflaeche sagt
// das dazu, statt eine Genauigkeit vorzutaeuschen, die die Quelle nicht hat.
const SORTEN = {
  diesel: "Motorová nafta",
  e5: "Benzin automobilový bezolovnatý Natural 95 oktanu",
  e10: "Benzin automobilový bezolovnatý Natural 95 oktanu",
};

const NUR_PREIS = "6621T"; // die Indexreihe 6621TI ist ein Prozentwert

/** Eine Zeile der CSV, die Anfuehrungszeichen und Kommas darin beachtet. */
function zerlege(zeile) {
  const felder = [];
  let feld = "";
  let inAnfuehrung = false;
  for (let i = 0; i < zeile.length; i++) {
    const z = zeile[i];
    if (z === '"') {
      if (inAnfuehrung && zeile[i + 1] === '"') {
        feld += '"';
        i++;
      } else {
        inAnfuehrung = !inAnfuehrung;
      }
    } else if (z === "," && !inAnfuehrung) {
      felder.push(feld);
      feld = "";
    } else {
      feld += z;
    }
  }
  felder.push(feld);
  return felder;
}

async function holeKurs() {
  const antwort = await fetch(KURS_TXT);
  if (!antwort.ok) throw new Error(`Kurs: HTTP ${antwort.status}`);
  const text = await antwort.text();
  const zeilen = text.trim().split("\n");
  // Erste Zeile ist das Datum ("19 Aug 2026 #159"), zweite die Kopfzeile.
  const datum = zeilen[0]?.split("#")[0]?.trim() || "";
  for (const zeile of zeilen.slice(2)) {
    const spalten = zeile.split("|");
    if (spalten[3] === "EUR") {
      const menge = Number(spalten[2]) || 1;
      const kurs = Number(String(spalten[4]).replace(",", ".")) / menge;
      if (kurs > 0) return { kurs, datum };
    }
  }
  throw new Error("Kurs: kein EUR-Eintrag gefunden");
}

async function holePreise() {
  const antwort = await fetch(PREISE_CSV);
  if (!antwort.ok) throw new Error(`Preise: HTTP ${antwort.status}`);
  const text = await antwort.text();
  const zeilen = text.trim().split(/\r?\n/);
  const kopf = zerlege(zeilen[0]).map((x) => x.replace(/^"|"$/g, ""));
  const spalte = (name) => kopf.indexOf(name);
  const iArt = spalte("IndicatorType");
  const iSorte = spalte("Druh PHM");
  const iWoche = spalte("CASTPHM");
  const iWert = spalte("Hodnota");
  if (iArt < 0 || iSorte < 0 || iWoche < 0 || iWert < 0) {
    throw new Error("Preise: unerwartete Spalten");
  }

  const gefunden = new Map(); // Sorte -> { woche, kronen }
  for (const zeile of zeilen.slice(1)) {
    const f = zerlege(zeile);
    if (f[iArt] !== NUR_PREIS) continue;
    const wert = Number(String(f[iWert]).replace(",", "."));
    if (!(wert > 0)) continue;
    const bisher = gefunden.get(f[iSorte]);
    // Die neueste Woche gewinnt; die Marken sind sortierbar ("2026-W33").
    if (!bisher || f[iWoche] > bisher.woche) {
      gefunden.set(f[iSorte], { woche: f[iWoche], kronen: wert });
    }
  }
  if (!gefunden.size) throw new Error("Preise: keine Werte");
  return gefunden;
}

/** Lesbar: aus "2026-W33" wird "KW 33 / 2026". */
function wochenText(marke) {
  const treffer = /^(\d{4})-W(\d{2})$/.exec(String(marke || ""));
  return treffer ? `KW ${Number(treffer[2])} / ${treffer[1]}` : String(marke || "");
}

/**
 * Landesdurchschnitt Tschechien fuer eine Kraftstoffsorte, in Euro.
 * Gibt null zurueck, wenn die Quellen nicht antworten - eine fehlende
 * Zusatzzeile darf die Preisliste nie aufhalten.
 */
export async function tschechienSchnitt(sorte) {
  const name = SORTEN[sorte];
  if (!name) return null;

  try {
    const gespeichert = await readKey(CACHE_KEY);
    const frisch = gespeichert && Date.now() - (gespeichert.geholt || 0) < TTL_SECONDS * 1000;
    const stand = frisch ? gespeichert : null;

    let daten = stand;
    if (!daten) {
      const [preise, kurs] = await Promise.all([holePreise(), holeKurs()]);
      daten = {
        geholt: Date.now(),
        kurs: kurs.kurs,
        kursDatum: kurs.datum,
        sorten: Object.fromEntries([...preise].map(([k, v]) => [k, v])),
      };
      await writeKey(CACHE_KEY, daten, TTL_SECONDS);
    }

    const eintrag = daten.sorten?.[name];
    if (!eintrag) return null;

    return {
      land: "Tschechien",
      sorte,
      // Aufs Zehntel Cent, wie bei den Stationen auch.
      euro: Math.round((eintrag.kronen / daten.kurs) * 1000) / 1000,
      kronen: eintrag.kronen,
      woche: wochenText(eintrag.woche),
      // Natural 95 deckt E5 und E10 zugleich ab - das muss dabeistehen.
      zusammengefasst: sorte !== "diesel",
      geholt: daten.geholt,
      kurs: Math.round(daten.kurs * 1000) / 1000,
      kursDatum: daten.kursDatum,
      quelle: "Tschechisches Statistikamt (ČSÚ), Kurs: Tschechische Nationalbank",
    };
  } catch (err) {
    console.error("[tanken] ausland:", err.message);
    return null;
  }
}
