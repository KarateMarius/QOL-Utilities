// Prueft im gebauten CSS, ob die tragenden Layout-Regeln noch da sind.
//
//     npm run build && node scripts/check-layout.mjs
//
// Anlass: Bei der Umstellung auf gemeinsame Gestaltungstoken hat eine zu weit
// gefasste Ersetzung die Layout-Regel von .angebote-app mitverschluckt. Uebrig
// blieben nur die Variablen. Ergebnis: der Scrollbereich hatte kein begrenztes
// Elternteil mehr und die Angebotsseite liess sich nicht mehr scrollen.
//
// Weder der Build noch ein serverseitiger Testlauf faellt darueber - beide
// pruefen Markup, nicht die Kaskade. Diese Datei schliesst die Luecke fuer die
// paar Regeln, ohne die etwas offensichtlich kaputt ist.
//
// Bewusst nicht Teil von `npm run build`: die Muster passen auf minifizierte
// Ausgabe und koennten sich mit einer neuen Vite-Fassung aendern. Ein
// blockierter Deploy wegen eines veralteten Musters waere schlimmer als der
// Fehler, den er verhindern soll.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dist = join(dirname(dirname(fileURLToPath(import.meta.url))), "dist", "assets");

const CHECKS = [
  ["Rahmen: App-Ansicht füllt die Höhe", /\.app-view\{[^}]*display:flex[^}]*height:100%/],
  ["Rahmen: App-Bereich dehnt sich", /\.app-view__body\{[^}]*flex:1/],
  ["Rahmen: Übersicht scrollt", /\.home\{[^}]*overflow-y:auto/],
  ["Angebote: füllt die Höhe", /\.angebote-app\{[^}]*display:flex[^}]*height:100%/],
  ["Angebote: Liste scrollt", /\.angebote-app \.scroll\{[^}]*overflow-y:auto/],
  ["Grundriss: füllt die Höhe", /\.app-shell\{[^}]*display:flex[^}]*height:100%/],
  ["Grundriss: Zeichenfläche dehnt sich", /\.app-main\{[^}]*flex:1/],
  ["Tanken: füllt die Höhe", /\.tanken-app\{[^}]*display:flex[^}]*height:100%/],
  ["Tanken: Liste scrollt", /\.tanken-scroll\{[^}]*overflow-y:auto/],
  ["Gedanken: füllt die Höhe", /\.gedanken-app\{[^}]*display:flex[^}]*height:100%/],
  ["Gedanken: Verlauf scrollt", /\.gedanken-verlauf\{[^}]*overflow-y:auto/],
  ["Anschaffungen: füllt die Höhe", /\.anschaffung-app\{[^}]*display:flex[^}]*height:100%/],
  ["Anschaffungen: Liste scrollt", /\.as-liste\{[^}]*overflow-y:auto/],
];

let css = "";
try {
  css = readdirSync(dist)
    .filter((file) => file.endsWith(".css"))
    .map((file) => readFileSync(join(dist, file), "utf-8"))
    .join("\n");
} catch {
  console.error("Kein Build gefunden - erst `npm run build` ausführen.");
  process.exit(1);
}

const missing = CHECKS.filter(([, pattern]) => !pattern.test(css)).map(([name]) => name);

for (const [name, pattern] of CHECKS) {
  console.log(`${pattern.test(css) ? "  ok    " : "  FEHLT "}${name}`);
}

if (missing.length) {
  console.error(`\n${missing.length} tragende Regel(n) fehlen im Build.`);
  process.exit(1);
}
console.log("\nAlle tragenden Layout-Regeln vorhanden.");
