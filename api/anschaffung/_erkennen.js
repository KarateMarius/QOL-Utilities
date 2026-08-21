// Was ist eine Anschaffung?
//
// Nicht "alles aus einem Moebelhaus". Ein Baumarktprospekt besteht zur
// Haelfte aus Rasentrimmern, Motoroel und Terrassenueberdachungen - richtig
// fuer den Garten, falsch fuer einen Umzug. Deshalb eine Positivliste: es
// zaehlt, was in eine leere Wohnung gehoert, egal aus welchem Prospekt es
// kommt.
//
// Das schneidet in beide Richtungen: der Kuehlschrank im Lidl-Prospekt wird
// mitgenommen, die Heckenschere bei toom nicht. Die Haendlerliste sagt, wo
// gesucht wird; diese Datei sagt, was zaehlt.
//
// Es bleibt eine Schaetzung nach Stichworten. Sie faengt das Meiste und wird
// gelegentlich danebenliegen - lieber das, als eine Liste, die so tut, als
// waere sie vollstaendig.
//
// Geprueft wird nur der Produktname - das, was vor dem Gedankenstrich steht.
// Dahinter steht die Beschreibung, und die redet ueber alles Moegliche: eine
// "Bettanlage - mit 2 Nachtkonsolen" wurde zur Spielkonsole, eine
// "Wohnlandschaft - Kaltschaum, Staubsauger-geeignet" zum Staubsauger, und
// aus "Langzeiturlaub Gran Canaria" wurde ein Grossgeraet, weil die
// Ferienwohnung eine Kueche hat. Der Name ist das Ding, der Rest ist Prosa
// darueber.

const GRUPPEN = [
  ["grossgeraet", [
    "waschmaschine", "waschtrockner", "wäschetrockner", "trockner",
    "geschirrspüler", "spülmaschine", "kühlschrank", "gefrierschrank",
    "gefriertruhe", "kühl-gefrier", "kühlgefrier", "einbauherd", "herdset",
    "backofen", "ceranfeld", "kochfeld", "dunstabzug", "einbauküche",
    "einbaukuche", "küche", "küchen", "marken-einbau",
  ]],
  ["technik", [
    "fernseher", "smart tv", " tv ", "oled", "qled", "laptop", "notebook",
    "tablet", "monitor", "drucker", "kopfhörer", "soundbar", "lautsprecher",
    "konsole", "playstation", "xbox", "nintendo", "smartphone", "router",
    "repeater", "staubsauger", "saugroboter", "kaffeevollautomat",
    "kaffeemaschine", "mikrowelle", "wasserkocher", "toaster", "luftreiniger",
  ]],
  ["moebel", [
    "sofa", "couch", "garnitur", "polsterecke", "wohnlandschaft", "sessel", "hocker",
    "esstisch", "couchtisch", "beistelltisch", "schreibtisch", "stuhl",
    "bett", "boxspring", "matratze", "lattenrost", "kleiderschrank",
    "schrank", "kommode", "sideboard", "regal", "bücherregal", "vitrine",
    "wohnwand", "nachttisch", "nachtkonsole", "garderobe", "schuhschrank",
    "esszimmer", "schlafzimmer", "jugendzimmer", "badkombination",
    "badmöbel", "waschtisch",
  ]],
  ["einrichtung", [
    "teppich", "läufer", "lampe", "leuchte", "spiegel", "vorhang", "gardine",
    "rollo", "plissee", "jalousie", "bettwäsche", "kissen", "decke ",
    "wäschespinne", "wäscheständer",
  ]],
  ["bau", [
    "laminat", "vinylboden", "parkett", "bodendiele", "teppichboden",
    "wandfarbe", "tapete", "duschkabine", "duschsystem", "wand-wc",
    "waschbecken", "armatur", "rauchmelder",
  ]],
];

// Draussen, unterwegs, oder nur Pflegemittel dafuer: alles richtig, nur
// nicht fuer eine leere Wohnung. Steht vor den Gruppen, damit die
// "Gartensitzgruppe" nicht als Sitzgruppe durchgeht.
const NICHT = [
  "garten", "terrasse", "balkon", "camping", "zelt", "urlaub", "reise",
  "hotel", "ferien", "auto", "pkw", "reifen", "fahrrad", "e-bike",
  "reiniger", "pflege", "ersatz", "zubehör", "aufsatz",
];

// Unter dieser Marke ist es Zubehoer, kein Moebelstueck: "Kissen 3,99" oder
// "Wischtuch-Set" gehoeren nicht auf eine Umzugsliste.
const MINDESTPREIS = 15;

// Grosse Stuecke, bei denen Moebelhaeuser mit der Monatsrate werben - und der
// Prospekt die Rate an die Stelle des Preises setzt. Gemessen: ein Ecksofa
// von 284 x 169 cm bei Hoeffner fuer "19 Euro", eines bei XXXLutz fuer
// "19,90", ein Big-Sofa bei Zurbrueggen fuer "34,99".
//
// Ein Angebot, das ein Sofa fuer 19 Euro verspricht, ist schlimmer als gar
// keines: es steht wegen des Preises ganz oben und wird als "im Budget"
// gruen. Was hier nicht plausibel ist, wird deshalb weggelassen - lieber ein
// Treffer weniger als einer, auf den man sich nicht verlassen kann.
//
// Nur Polstermoebel und grosse Kastenmoebel, und nur innerhalb der Gruppe
// "moebel". Der erste Versuch nahm auch "schrank" und "matratze" - und warf
// damit den Netto-Kuehlschrank fuer 149,99 raus, weil "Kuehlschrank" das Wort
// "schrank" enthaelt, und die Emma-Matratze fuer 139, die es wirklich gibt.
const GROSSE_STUECKE = [
  "sofa", "couch", "garnitur", "wohnlandschaft", "polsterecke", "boxspring",
  "wohnwand", "kleiderschrank", "esstisch",
];
const MINDESTPREIS_GROSS = 150;

/** Der Teil vor dem ersten freistehenden Gedankenstrich. Bindestriche
    mitten im Wort bleiben unangetastet - "Kuehl-Gefrier-Kombination" ist ein
    Name, "Sofa - mit Bettkasten" sind zwei Dinge. */
function produktName(roh) {
  return String(roh || "").split(/\s[–—-]\s/)[0].toLowerCase().trim();
}

/** Gruppe eines Angebots, oder null wenn es keine Anschaffung ist. */
export function gruppeVon(deal) {
  if (!(deal?.price >= MINDESTPREIS)) return null;
  const name = produktName(deal.name);
  if (NICHT.some((wort) => name.includes(wort))) return null;

  for (const [gruppe, worte] of GRUPPEN) {
    if (!worte.some((wort) => name.includes(wort))) continue;
    if (
      gruppe === "moebel" &&
      deal.price < MINDESTPREIS_GROSS &&
      GROSSE_STUECKE.some((w) => name.includes(w))
    ) {
      return null;
    }
    return gruppe;
  }
  return null;
}

/** Aus einer beliebigen Angebotsliste die Anschaffungen herausziehen. */
export function nurAnschaffungen(deals) {
  const treffer = [];
  for (const deal of deals || []) {
    const gruppe = gruppeVon(deal);
    if (gruppe) treffer.push({ ...deal, gruppe });
  }
  return treffer;
}

export const GRUPPEN_NAMEN = GRUPPEN.map(([name]) => name);
