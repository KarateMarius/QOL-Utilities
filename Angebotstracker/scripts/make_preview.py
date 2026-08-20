"""Render the built app to a single file that opens without any server.

    npm run build
    python scripts/make_preview.py
    # then open dist/preview.html in a browser

The page is the real build with `fetch` stubbed out, so it shows the actual
UI using offers from the local cache. Handy for a quick look at the layout
without starting the API.
"""
from __future__ import annotations

import io
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from lib.categorize import CATEGORIES, CATEGORY_LABELS  # noqa: E402

STORE = ROOT / ".local-store.json"
DIST = ROOT / "dist"


def load_deals() -> list[dict]:
    if not STORE.exists():
        raise SystemExit(
            "Kein lokaler Cache. Erst die API einmal laufen lassen:\n"
            "  npm run api   und dann http://localhost:8000/api/deals aufrufen"
        )
    store = json.loads(STORE.read_text(encoding="utf-8"))
    for key, value in store.items():
        if key.startswith("deals:") and value.get("deals"):
            return value["deals"]
    raise SystemExit("Im lokalen Cache liegen keine Angebote.")


def main() -> None:
    index = DIST / "index.html"
    if not index.exists():
        raise SystemExit("dist/index.html fehlt — vorher `npm run build` ausführen.")

    deals = load_deals()

    # one card per merchant/category combination, then fill up
    picked: list[dict] = []
    seen: set[tuple[str, str]] = set()
    for deal in deals:
        if not deal.get("image_url"):
            continue
        key = (deal["merchant"], deal["category"])
        if key in seen:
            continue
        seen.add(key)
        picked.append(deal)
    picked = picked[:64]

    hits = [d for d in deals if d.get("price") and d["price"] <= 6][:6]

    payload = {
        "/api/deals": {
            "plz": "48155",
            "fetched_at": 0,
            "from_cache": True,
            "count": len(deals),
            "deals": picked,
            "hits": hits,
        },
        "/api/categories": [{"key": k, "label": CATEGORY_LABELS[k]} for k in CATEGORIES],
        "/api/watchlist": {"entries": []},
        "/api/push/config": {"configured": False, "public_key": "", "subscriptions": 0},
    }

    html = index.read_text(encoding="utf-8")
    for absolute, relative in (
        ('src="/assets/', 'src="./assets/'),
        ('href="/assets/', 'href="./assets/'),
        ('href="/manifest.webmanifest"', 'href="./manifest.webmanifest"'),
        ('href="/icon-192.png"', 'href="./icon-192.png"'),
    ):
        html = html.replace(absolute, relative)

    stub = (
        "<script>\nconst DATA = "
        + json.dumps(payload, ensure_ascii=False)
        + ";\nwindow.fetch = async (url) => new Response("
        "JSON.stringify(DATA[String(url).split('?')[0]] ?? {status:'ok'}), "
        "{headers:{'Content-Type':'application/json'}});\n</script>"
    )
    html = html.replace('<div id="root"></div>', f"{stub}\n    <div id=\"root\"></div>")

    target = DIST / "preview.html"
    io.open(target, "w", encoding="utf-8").write(html)
    print(f"{target} geschrieben — {len(picked)} Angebote, {len(hits)} Treffer")


if __name__ == "__main__":
    main()
