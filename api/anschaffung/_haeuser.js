// Welche Haeuser fuer eine leere Wohnung gefragt werden.
//
// Steht hier und nicht beim Scraper: der Scraper ist das Fahrzeug, diese
// Liste ist das Ziel. Im Ordner der Angebote hatte sie nichts verloren - dort
// geht es um den Wocheneinkauf, und die beiden sollen sich nicht vermischen.
//
// Gefiltert wird ueber den Anzeigenamen und nicht ueber Marktgurus Kuerzel:
// die sind nicht zu raten - "xxxl" fuer XXXLutz, "toom-baumarkt" fuer toom,
// "moebel-inhofer" fuer Moebel Inhofer.
//
// Die letzten Eintraege sind keine Ketten, sondern Marker. Ein Prospekt von
// einem Haus, das "Moebel" oder "Wohnwelt" im Namen traegt, ist genau das,
// was gesucht wird - und faengt die regionalen Haeuser mit, die in keiner
// Liste stehen koennen. Bei "Opti Wohnwelt" und "Moebel Inhofer" hat genau
// das gegriffen.
const NAMEN = [
  "ikea", "xxxl", "lutz", "mömax", "moemax", "möbel boss", "roller", "poco",
  "höffner", "hoeffner", "segmüller", "segmueller", "porta", "sconto", "jysk",
  "dänisches bettenlager", "opti", "knuffmann", "finke", "zurbrüggen",
  "mediamarkt", "media markt", "saturn", "expert", "euronics", "medimax",
  "obi", "bauhaus", "hornbach", "toom", "hagebau", "globus baumarkt",
  "möbel", "moebel", "wohnwelt", "küchen", "kuechen", "einrichtung",
  "baumarkt", "elektro",
];

/** Zielgruppe fuer scrape() - dieselbe Form wie SUPERMAERKTE im Scraper. */
export const ANSCHAFFUNGEN = {
  name: "anschaffungen",
  mgSlugs: null,
  mgNamen: NAMEN,
  kdNamen: NAMEN,
  kdSuchen: ["Möbel", "Möbelhaus", "Küchen", "Elektronik", "Elektromarkt",
             "Baumarkt", "IKEA", "MediaMarkt", "Saturn", "XXXLutz", "Roller", "Poco"],
};
