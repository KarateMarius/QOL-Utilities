"""Angebotstracker API — FastAPI on Vercel serverless functions."""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

# Vercel bundles the function without the project root on sys.path.
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

try:  # local development only — on Vercel the env comes from the platform
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env")
except ImportError:
    pass

from fastapi import FastAPI, Header, HTTPException, Query  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402

from lib import deals as deals_lib  # noqa: E402
from lib import push, storage  # noqa: E402
from lib.categorize import CATEGORIES, CATEGORY_LABELS  # noqa: E402

CACHE_TTL_SECONDS = 6 * 3600
DEFAULT_PLZ = os.getenv("DEFAULT_PLZ", "48155")

app = FastAPI(title="Angebotstracker")

# The frontend is served from the same origin in production; CORS only matters
# for `npm run dev` against a local API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── models ────────────────────────────────────────────────────────────────────

class WatchEntry(BaseModel):
    id: str
    keyword: str
    max_price: float | None = None
    category: str | None = None


class WatchlistPayload(BaseModel):
    entries: list[WatchEntry] = Field(default_factory=list)


class SettingsPayload(BaseModel):
    plz: str


class SubscriptionPayload(BaseModel):
    subscription: dict


class UnsubscribePayload(BaseModel):
    endpoint: str


class CartItem(BaseModel):
    name: str
    merchant: str = ""
    price: float = 0.0


class CartPayload(BaseModel):
    items: list[CartItem] = Field(default_factory=list)


# ── helpers ───────────────────────────────────────────────────────────────────

def _clean_plz(plz: str | None) -> str:
    if plz and plz.isdigit() and len(plz) == 5:
        return plz
    return DEFAULT_PLZ


async def _cached_deals(plz: str, force: bool = False) -> tuple[list[dict], float, bool]:
    """Return (deals, fetched_at, from_cache)."""
    key = f"deals:{plz}"
    if not force:
        cached = await storage.get(key)
        if cached and time.time() - cached.get("timestamp", 0) < CACHE_TTL_SECONDS:
            return cached.get("deals", []), cached.get("timestamp", 0), True

    fresh = await deals_lib.scrape(plz)
    if not fresh:
        # Never throw away a usable cache because one scrape run failed.
        cached = await storage.get(key)
        if cached and cached.get("deals"):
            return cached["deals"], cached.get("timestamp", 0), True
        return [], 0.0, False

    now = time.time()
    await storage.set(key, {"timestamp": now, "plz": plz, "deals": fresh})
    return fresh, now, False


def matches(deal: dict, entry: dict) -> bool:
    keyword = (entry.get("keyword") or "").strip().lower()
    if not keyword or keyword not in deal.get("name", "").lower():
        return False

    max_price = entry.get("max_price")
    if max_price is not None:
        price = deal.get("price") or 0
        if not price or price > max_price:
            return False

    category = entry.get("category")
    if category and deal.get("category") != category:
        return False

    return True


def find_matches(deals: list[dict], entries: list[dict]) -> list[dict]:
    hits: list[dict] = []
    seen_ids: set[str] = set()
    for entry in entries:
        for deal in deals:
            if deal["id"] in seen_ids or not matches(deal, entry):
                continue
            seen_ids.add(deal["id"])
            hits.append({**deal, "matched_keyword": entry.get("keyword", "")})
    hits.sort(key=lambda d: d.get("price") or 0)
    return hits


# ── routes ────────────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "storage": "upstash" if storage.is_remote() else "local-file",
        "push_configured": push.is_configured(),
        "default_plz": DEFAULT_PLZ,
    }


@app.get("/api/categories")
async def categories():
    return [{"key": key, "label": CATEGORY_LABELS[key]} for key in CATEGORIES]


@app.get("/api/deals")
async def get_deals(plz: str | None = None, refresh: bool = Query(False)):
    postal_code = _clean_plz(plz)
    items, fetched_at, from_cache = await _cached_deals(postal_code, force=refresh)
    watchlist = await storage.get("watchlist", []) or []
    return {
        "plz": postal_code,
        "fetched_at": fetched_at,
        "from_cache": from_cache,
        "count": len(items),
        "deals": items,
        "hits": find_matches(items, watchlist),
    }


@app.delete("/api/deals/cache")
async def clear_cache(plz: str | None = None):
    await storage.delete(f"deals:{_clean_plz(plz)}")
    return {"status": "cleared"}


@app.get("/api/settings")
async def get_settings():
    return await storage.get("settings", {"plz": DEFAULT_PLZ})


@app.put("/api/settings")
async def put_settings(payload: SettingsPayload):
    settings = {"plz": _clean_plz(payload.plz)}
    await storage.set("settings", settings)
    return settings


@app.get("/api/watchlist")
async def get_watchlist():
    return {"entries": await storage.get("watchlist", []) or []}


@app.put("/api/watchlist")
async def put_watchlist(payload: WatchlistPayload):
    entries = [entry.model_dump() for entry in payload.entries]
    await storage.set("watchlist", entries)
    return {"entries": entries}


@app.get("/api/push/config")
async def push_config():
    return {
        "configured": push.is_configured(),
        "public_key": push.vapid_public_key(),
        "subscriptions": len(await push.list_subscriptions()),
    }


@app.post("/api/push/subscribe")
async def subscribe(payload: SubscriptionPayload):
    if not payload.subscription.get("endpoint"):
        raise HTTPException(status_code=400, detail="subscription.endpoint fehlt")
    count = await push.add_subscription(payload.subscription)
    return {"status": "ok", "subscriptions": count}


@app.post("/api/push/unsubscribe")
async def unsubscribe(payload: UnsubscribePayload):
    count = await push.remove_subscription(payload.endpoint)
    return {"status": "ok", "subscriptions": count}


@app.post("/api/push/test")
async def push_test():
    return await push.send_to_all({
        "title": "Angebotstracker",
        "body": "Test-Benachrichtigung — Push funktioniert.",
        "tag": "test",
    })


@app.post("/api/push/cart")
async def push_cart(payload: CartPayload):
    if not payload.items:
        raise HTTPException(status_code=400, detail="Einkaufskorb ist leer")

    total = sum(item.price for item in payload.items)
    by_merchant: dict[str, list[str]] = {}
    for item in payload.items:
        by_merchant.setdefault(item.merchant or "Sonstige", []).append(item.name)

    lines = [
        f"{merchant}: " + ", ".join(names)
        for merchant, names in sorted(by_merchant.items())
    ]
    body = "\n".join(lines)
    if len(body) > 600:
        body = body[:597] + "..."

    return await push.send_to_all({
        "title": f"Einkaufskorb — {len(payload.items)} Artikel, {total:.2f} €".replace(".", ","),
        "body": body,
        "tag": "cart",
    })


@app.get("/api/cron/refresh")
async def cron_refresh(authorization: str | None = Header(default=None)):
    """Daily scan: refresh offers and push new watchlist hits.

    Vercel sends `Authorization: Bearer $CRON_SECRET`.
    """
    secret = os.getenv("CRON_SECRET")
    if secret and authorization != f"Bearer {secret}":
        raise HTTPException(status_code=401, detail="unauthorized")

    settings = await storage.get("settings", {"plz": DEFAULT_PLZ})
    plz = _clean_plz(settings.get("plz"))

    items, _, _ = await _cached_deals(plz, force=True)
    watchlist = await storage.get("watchlist", []) or []
    hits = find_matches(items, watchlist)

    already_pushed = set(await storage.get("watchlist:pushed", []) or [])
    new_hits = [hit for hit in hits if hit["id"] not in already_pushed]

    result = {"plz": plz, "deals": len(items), "hits": len(hits), "new_hits": len(new_hits)}

    if new_hits:
        preview = ", ".join(
            f"{hit['title']} {hit['price']:.2f} €".replace(".", ",")
            for hit in new_hits[:4]
        )
        if len(new_hits) > 4:
            preview += f" +{len(new_hits) - 4} weitere"
        result["push"] = await push.send_to_all({
            "title": f"{len(new_hits)} neue Treffer auf deiner Watchlist",
            "body": preview,
            "tag": "watchlist",
        })

    # Only remember hits from the current run, so returning offers notify again
    # in a later week.
    await storage.set("watchlist:pushed", [hit["id"] for hit in hits])
    return result
