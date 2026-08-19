// Baut dist/preview.html: die komplette Oberflaeche in einer einzigen Datei,
// mit erfundenen Serverantworten. Zum Anschauen per Doppelklick, ohne dass
// irgendein Server laufen muss.
//
//     node scripts/make-preview.mjs
//
// Warum alles inline: ein Modul-Skript darf unter file:// nichts nachladen -
// der Browser behandelt jede Datei als eigene Herkunft und blockt den Import.
// Deshalb wird hier ohne Code-Splitting gebuendelt und JS wie CSS direkt in
// die Seite geschrieben.
import { build } from "esbuild";
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
      if (key.startsWith("deals:") && value?.deals?.length) return value.deals;
    }
  }
  return [];
}

function stub() {
  const deals = sampleDeals();

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
  };

  return `<script>
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

const html = readFileSync(join(root, "index.html"), "utf-8")
  .replace('<script type="module" src="/src/main.jsx"></script>', "")
  .replace('<link rel="manifest" href="/manifest.webmanifest" />', "")
  .replace("</head>", `<style>${css}</style>\n  </head>`)
  .replace("</body>", `${stub()}\n<script>${js}</script>\n  </body>`);

if (!existsSync(dist)) mkdirSync(dist, { recursive: true });
const target = join(dist, "preview.html");
writeFileSync(target, html, "utf-8");
console.log(`${target} geschrieben (${(html.length / 1024).toFixed(0)} KB)`);
