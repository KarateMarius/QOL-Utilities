// Baut dist/preview.html: die komplette Oberflaeche in einer einzigen Datei,
// mit erfundenen Serverantworten. Zum Anschauen per Doppelklick, ohne dass
// irgendein Server laufen muss.
//
//     node scripts/make-preview.mjs
//
// Ein Modul-Skript darf unter file:// nichts nachladen - der Browser behandelt
// jede Datei als eigene Herkunft und blockt den Import. Deshalb wird ohne
// Code-Splitting gebuendelt.
//
// Das JavaScript liegt aber NICHT in der Seite, sondern als eigene Datei
// daneben, eingebunden per <script src>. Grund: das Bundle enthaelt an
// mehreren Stellen die Zeichenfolge </script> in Zeichenketten. Inline
// beendet die erste davon das Skript-Element mitten im Code - der Rest der
// Seite wird zu Text, nichts laeuft, und im Browser steht kein Fehler,
// sondern eine leere Seite. Klassische Skripte (kein type=module) darf eine
// file://-Seite dagegen problemlos nachladen.
import { build } from "esbuild";
import { keyFor } from "../api/angebote/_history.js";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, "dist");

// Echte Angebote, falls der Angebotstracker lokal schon einmal gelaufen ist.
function sampleDeals() {
  const candidates = [
    join(root, "..", "Angebotstracker", ".local-store.json"),
    join(root, ".local-store.json"),
  ];

  for (const path of candidates) {
    if (!existsSync(path)) continue;
    const store = JSON.parse(readFileSync(path, "utf-8"));
    for (const [key, value] of Object.entries(store)) {
      // Den stabilen Produktschluessel nachtragen: der Bestand stammt aus dem
      // frueheren Angebotstracker und kennt ihn noch nicht, der echte
      // Endpunkt haengt ihn dagegen an jedes Angebot (siehe deals.js). Ohne
      // ihn zeigt die Vorschau weder den Preisverlauf noch die Vorschlaege
      // fuer die Watchlist - beides haengt daran.
      if (key.startsWith("deals:") && value?.deals?.length) {
        return value.deals.map((deal) => ({ ...deal, key: deal.key || keyFor(deal) }));
      }
    }
  }
  return [];
}

// Fuer die Tankpreise reichen erfundene Werte nicht: an ihnen haengt die
// ganze Gestaltung der Liste. Deshalb werden echte geholt, wenn erreichbar.
async function sampleStations() {
  try {
    const res = await fetch(
      "https://creativecommons.tankerkoenig.de/json/list.php?lat=51.9625&lng=7.6252" +
        "&rad=5&sort=price&type=diesel&apikey=00000000-0000-0000-0000-000000000002"
    );
    const data = await res.json();
    // Der Demo-Schluessel gibt fuer alle denselben Preis aus. Fuer die Vorschau
    // werden sie gestreut, damit man sieht, wie die Liste wirklich aussieht.
    return (data.stations || []).slice(0, 12).map((s, i) => ({
      id: s.id,
      brand: s.brand || "Freie",
      name: s.name,
      street: [s.street, s.houseNumber].filter(Boolean).join(" "),
      place: s.place,
      postCode: s.postCode,
      distance: s.dist,
      price: Math.round((1.659 + i * 0.017) * 1000) / 1000,
      open: i !== 3,
    }));
  } catch {
    return [];
  }
}

async function stub() {
  const deals = sampleDeals();
  const stations = await sampleStations();

  // Je Laden und Kategorie eine Karte, damit die Vorschau die ganze Bandbreite
  // zeigt statt vierzig Mal Katzenfutter.
  const seen = new Set();
  const picked = [];
  for (const deal of deals) {
    const key = `${deal.merchant}|${deal.category}`;
    if (seen.has(key) || !deal.image_url) continue;
    seen.add(key);
    picked.push(deal);
  }

  const korbArtikel = picked.slice(0, 5);
  const korbJson = JSON.stringify(korbArtikel);
  const doneJson = JSON.stringify(Object.fromEntries(korbArtikel.slice(0, 2).map((d) => [d.id, true])));

  const routes = {
    "/api/me": { status: 200, body: { user: { id: "vorschau" } } },
    "/api/angebote/watchlist": {
      status: 200,
      body: { plz: "48155", entries: [{ id: "w1", keyword: "hähnchen", max_price: 6, category: null }] },
    },
    "/api/angebote/push": { status: 200, body: { configured: true, public_key: "", subscriptions: 1 } },
    "/api/angebote/deals": {
      status: 200,
      body: {
        plz: "48155",
        fetched_at: Date.now() - 1000 * 60 * 42,
        from_cache: true,
        count: deals.length,
        deals: picked.slice(0, 64),
        hits: deals.filter((d) => d.name.toLowerCase().includes("hähnchen") && d.price <= 6).slice(0, 6),
      },
    },
    "/api/plans": { status: 200, body: { user: { id: "vorschau" }, plans: [] } },
    "/api/tanken/stations": {
      status: 200,
      body: { place: "Münster", type: "diesel", radius: 5, demo: false, stations, from_cache: true },
    },
  };

  return `<script>
// Nur fuer die Vorschau: ?theme=dark schaltet die Helligkeit, bevor die App
// startet - so laesst sich beides abfotografieren.
if (new URLSearchParams(location.search).get("theme") === "dark") {
  localStorage.setItem("qol_theme", "dark");
} else {
  localStorage.setItem("qol_theme", "light");
}
// Nur fuer die Vorschau: ?korb=1 legt ein paar Artikel in den Korb, zwei
// davon abgehakt - sonst laesst sich der Korb nicht abfotografieren.
if (new URLSearchParams(location.search).get("korb")) {
  const korb = ${JSON.stringify(korbJson)};
  localStorage.setItem("angebote_cart_v1", korb);
  localStorage.setItem("angebote_cart_done_v1", ${JSON.stringify(doneJson)});
}
const ROUTES = ${JSON.stringify(routes)};
window.fetch = async (url) => {
  const path = String(url).split("?")[0];
  const route = ROUTES[path] || { status: 200, body: { ok: true } };
  return new Response(JSON.stringify(route.body), {
    status: route.status,
    headers: { "Content-Type": "application/json" },
  });
};
</script>`;
}

const result = await build({
  entryPoints: [join(root, "src", "main.jsx")],
  bundle: true,
  format: "iife",
  jsx: "automatic",
  minify: true,
  write: false,
  outdir: dist,
  define: { "process.env.NODE_ENV": '"production"' },
});

const js = result.outputFiles.find((f) => f.path.endsWith(".js"))?.text ?? "";
const css = result.outputFiles.find((f) => f.path.endsWith(".css"))?.text ?? "";

if (!existsSync(dist)) mkdirSync(dist, { recursive: true });
writeFileSync(join(dist, "preview.js"), js, "utf-8");

const html = readFileSync(join(root, "index.html"), "utf-8")
  .replace('<script type="module" src="/src/main.jsx"></script>', "")
  .replace('<link rel="manifest" href="/manifest.webmanifest" />', "")
  .replace("</head>", `<style>${css}</style>\n  </head>`)
  .replace("</body>", `${await stub()}\n<script src="./preview.js"></script>\n  </body>`);

// Geraeterahmen fuer Bildaufnahmen in Handy-Breite. Headless Edge rendert
// nie schmaler als 496 CSS-Pixel; ein <iframe> bekommt aber sein eigenes
// Ansichtsfenster und damit echte 390 Pixel.
//
//   dist/geraet.html?w=390&h=844&src=.%2Fpreview.html%23angebote
writeFileSync(
  join(dist, "geraet.html"),
  `<!doctype html><html><head><meta charset="utf-8"><title>Gerät</title>
<style>html,body{margin:0;padding:0;background:#fff}iframe{display:block;border:0}</style>
</head><body><script>
const p = new URLSearchParams(location.search);
const f = document.createElement("iframe");
f.width = p.get("w") || 390;
f.height = p.get("h") || 844;
f.src = decodeURIComponent(p.get("src") || "./preview.html");
document.body.appendChild(f);
<\/script></body></html>`,
  "utf-8"
);

const target = join(dist, "preview.html");
writeFileSync(target, html, "utf-8");
console.log(`${target} + preview.js geschrieben (${((html.length + js.length) / 1024).toFixed(0)} KB)`);
