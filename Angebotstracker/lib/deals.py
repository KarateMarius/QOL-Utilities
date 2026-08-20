"""Scrapes weekly supermarket offers from Marktguru and Kaufda."""
from __future__ import annotations

import asyncio
import os
import re
from datetime import datetime

import httpx

from .categorize import categorize
from .pricing import base_price, normalize_reference_price, parse_base_unit_string

MARKTGURU_APIKEY_DEFAULT = "8Kk+pmbf7TgJ9nVj2cXeA7P5zBGv8iuutVVMRfOfvNE="
MARKTGURU_API_URL = "https://api.marktguru.de/api/v1/offers/publishers"
MARKTGURU_LOCATIONS_URL = "https://api.marktguru.de/api/v1/locations"
MARKTGURU_CDN = "https://cdn.marktguru.de/api/v1/offers/{id}/images/default/0/small.webp"

KAUFDA_SEARCH_URL = "https://www.kaufda.de/api/search"
KAUFDA_OFFERS_URL = "https://www.kaufda.de/api/personalisedOffers"
KAUFDA_BONIAL_ID_DEFAULT = "a95ce853-04f4-49ef-bbce-65aabdad4768"

TARGET_UNIQUE_NAMES = {
    "rewe", "lidl", "edeka", "dm-drogerie-markt", "netto-marken-discount",
    "kaufland", "penny", "aldi-sued", "rossmann", "mueller-drogeriemarkt",
    "norma", "globus", "tegut", "hit", "famila", "denns-biomarkt", "alnatura",
}

TARGET_SUPERMARKETS = {
    "rewe", "lidl", "edeka", "dm", "netto", "kaufland", "penny",
    "aldi", "rossmann", "müller", "norma", "globus", "tegut",
    "hit", "famila", "denns", "alnatura", "marktkauf", "e center",
}

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)

FALLBACK_LAT_LNG = (51.9625, 7.6252)  # Münster

# Kaufda offers are fetched per brochure. Unbounded fan-out regularly ran into
# the serverless timeout, so the number of parallel requests is capped.
KAUFDA_CONCURRENCY = 8


def marktguru_headers() -> dict[str, str]:
    return {
        "x-apikey": os.getenv("MARKTGURU_APIKEY", MARKTGURU_APIKEY_DEFAULT),
        "user-agent": USER_AGENT,
        "referer": "https://www.marktguru.de/",
        "accept": "application/json",
        "content-type": "application/json",
    }


def normalize_merchant(store_name: str) -> str:
    s = store_name.lower()
    if "rewe" in s:
        return "REWE"
    if "lidl" in s:
        return "Lidl"
    if "edeka" in s or "e center" in s:
        return "EDEKA"
    if "dm" in s:
        return "dm"
    if "netto" in s:
        return "Netto"
    if "aldi" in s:
        return "ALDI Nord" if "nord" in s else "ALDI Süd"
    if "kaufland" in s:
        return "Kaufland"
    if "penny" in s:
        return "Penny"
    if "rossmann" in s:
        return "Rossmann"
    if "müller" in s or "mueller" in s:
        return "Müller"
    if "norma" in s:
        return "Norma"
    if "globus" in s:
        return "Globus"
    if "tegut" in s:
        return "Tegut"
    if "alnatura" in s:
        return "Alnatura"
    if "denn" in s:
        return "Denns"
    if "marktkauf" in s:
        return "Marktkauf"
    if "hit" in s:
        return "HIT"
    return store_name


def _to_float(value) -> float:
    if isinstance(value, (int, float)) and value > 0:
        return float(value)
    if isinstance(value, str):
        try:
            v = float(value.replace(",", "."))
            return v if v > 0 else 0.0
        except ValueError:
            return 0.0
    return 0.0


def _first_price(source: dict, keys: tuple[str, ...]) -> float:
    for key in keys:
        value = _to_float(source.get(key))
        if value:
            return value
    return 0.0


_HINT_MARKER = "HINWEIS:"


def _split_hint(description: str) -> tuple[str, str]:
    """Marktguru glues loyalty hints into the description text.

    "HINWEIS: MIT APP 0,10 € REWE BONUS versch. Sorten, je 60-g-Schale"
    becomes note "MIT APP 0,10 € REWE BONUS" and a clean description.
    """
    if _HINT_MARKER not in description.upper():
        return description, ""

    idx = description.upper().index(_HINT_MARKER)
    rest = description[idx + len(_HINT_MARKER):].strip()
    prefix = description[:idx].strip()

    # The hint runs until the offer text resumes (lowercase word, "je ...",
    # or one of the recurring uppercase section starters).
    match = re.search(r"\s(?=(?:versch\.|je\b|Ursprung|Herkunft|Klasse\b|[a-zäöüß]))", rest)
    if match:
        note, tail = rest[: match.start()].strip(), rest[match.end():].strip()
    else:
        note, tail = rest, ""

    return " ".join(part for part in (prefix, tail) if part).strip(), note


def _build_deal(
    *,
    deal_id: str,
    title: str,
    description: str,
    merchant: str,
    price: float,
    old_price: float,
    valid_from: str,
    valid_until: str,
    image_url: str,
    base_hint: tuple[float, str] | None = None,
    note: str = "",
    price_range: bool = False,
) -> dict | None:
    title = (title or "").strip()
    description = (description or "").strip()
    if description.lower() == title.lower():
        description = ""

    description, hint_note = _split_hint(description)
    note = (note or hint_note).strip()

    name = f"{title} – {description}" if title and description else (title or description)
    if not name:
        return None

    discount_pct = 0
    if old_price and price and old_price > price:
        discount_pct = round((1 - price / old_price) * 100)

    # Both APIs ship an official Grundpreis for most offers; the text parser is
    # only the fallback for the rest.
    unit_price = base_hint or base_price(price, description or title)

    return {
        "id": deal_id,
        "name": name,
        "title": title or description,
        "subtitle": description,
        "note": note,
        "merchant": merchant,
        "price": price,
        "old_price": old_price,
        "discount_pct": discount_pct,
        "price_range": price_range,
        "unit": description,
        "base_price": unit_price[0] if unit_price else None,
        "base_unit": unit_price[1] if unit_price else None,
        "category": categorize(name),
        "valid_from": valid_from,
        "valid_until": valid_until,
        "image_url": image_url,
    }


async def get_lat_lng(plz: str, client: httpx.AsyncClient) -> tuple[float, float]:
    try:
        resp = await client.get(
            MARKTGURU_LOCATIONS_URL,
            headers=marktguru_headers(),
            params={"as": "mobile", "limit": 1, "q": plz},
            timeout=8.0,
        )
        if resp.status_code == 200:
            results = resp.json().get("results", [])
            if results:
                return float(results[0]["latitude"]), float(results[0]["longitude"])
    except Exception as e:
        print(f"[geo] lookup failed for {plz}: {e}")
    return FALLBACK_LAT_LNG


async def fetch_marktguru(plz: str, client: httpx.AsyncClient) -> list[dict]:
    try:
        resp = await client.get(
            MARKTGURU_API_URL,
            headers=marktguru_headers(),
            params={"as": "mobile", "limit": 50, "offerLimit": 100, "zipCode": plz},
            timeout=20.0,
        )
    except Exception as e:
        print(f"[marktguru] request failed: {e}")
        return []

    if resp.status_code != 200:
        print(f"[marktguru] publishers HTTP {resp.status_code}")
        return []

    try:
        publishers = resp.json().get("results", [])
    except Exception as e:
        print(f"[marktguru] bad JSON: {e}")
        return []

    deals: list[dict] = []
    for pub in publishers:
        if pub.get("uniqueName", "") not in TARGET_UNIQUE_NAMES:
            continue
        merchant = normalize_merchant(pub.get("name", pub.get("uniqueName", "")))

        for idx, offer in enumerate(pub.get("offers", [])):
            offer_id = offer.get("id", idx)
            product = offer.get("product") or {}
            title = (product.get("name") or offer.get("description") or "").strip()

            valid_from = valid_until = ""
            for vd in (offer.get("validityDates") or [])[:1]:
                for raw_key, is_from in (("from", True), ("to", False)):
                    value = vd.get(raw_key)
                    if not value:
                        continue
                    try:
                        parsed = datetime.fromisoformat(
                            value.replace("Z", "+00:00")
                        ).strftime("%Y-%m-%d")
                    except Exception:
                        continue
                    if is_from:
                        valid_from = parsed
                    else:
                        valid_until = parsed

            unit_info = offer.get("unit") or {}
            base_hint = normalize_reference_price(
                _to_float(offer.get("referencePrice")),
                unit_info.get("shortName", ""),
            )

            deal = _build_deal(
                deal_id=f"mg-{offer_id}",
                title=title,
                description=(offer.get("description") or "").strip(),
                merchant=merchant,
                price=_to_float(offer.get("price")),
                old_price=_first_price(offer, ("oldPrice", "crossedOutPrice")),
                valid_from=valid_from,
                valid_until=valid_until,
                image_url=MARKTGURU_CDN.format(id=offer_id),
                base_hint=base_hint,
            )
            if deal:
                deals.append(deal)

    return deals


def _kaufda_note(conditions) -> str:
    """Kaufda conditions carry things like "Mit Lidl Plus" — but mostly just "je"."""
    if not isinstance(conditions, list):
        return ""
    for entry in conditions:
        if not isinstance(entry, dict):
            continue
        text = (entry.get("other") or "").strip()
        if len(text) > 3 and text.lower() not in ("je topf", "je stück"):
            return text
    return ""


async def _kaufda_brochures(
    plz: str, client: httpx.AsyncClient, headers: dict
) -> dict[str, dict]:
    lat, lng = await get_lat_lng(plz, client)
    queries = ["Supermarkt", "Discounter", "Drogerie", "Aldi", "Lidl",
               "Kaufland", "Rewe", "Edeka", "Penny", "Netto"]

    async def search(query: str) -> list[dict]:
        try:
            resp = await client.get(
                KAUFDA_SEARCH_URL,
                headers=headers,
                params={"query": query, "lat": str(lat), "lng": str(lng)},
                timeout=12.0,
            )
            if resp.status_code != 200:
                return []
            return (
                resp.json()
                .get("searchResults", {})
                .get("contents", {})
                .get("brochures", [])
            )
        except Exception as e:
            print(f"[kaufda] search failed for {query}: {e}")
            return []

    results = await asyncio.gather(*(search(q) for q in queries))

    brochures: dict[str, dict] = {}
    for group in results:
        for entry in group:
            content = entry.get("content") or {}
            if content.get("type") != "BROCHURE":
                continue
            publisher = (content.get("publisher") or {}).get("name", "").lower()
            if any(target in publisher for target in TARGET_SUPERMARKETS):
                brochures[content["id"]] = content
    return brochures


async def fetch_kaufda(plz: str, client: httpx.AsyncClient) -> list[dict]:
    headers = {
        "user-agent": USER_AGENT,
        "referer": "https://www.kaufda.de/",
        "accept": "application/json",
    }

    try:
        brochures = await _kaufda_brochures(plz, client, headers)
    except Exception as e:
        print(f"[kaufda] brochure discovery failed: {e}")
        return []

    if not brochures:
        print(f"[kaufda] no local brochures for {plz}")
        return []
    print(f"[kaufda] {len(brochures)} brochures for {plz}")

    bonial_id = os.getenv("KAUFDA_BONIAL_ID", KAUFDA_BONIAL_ID_DEFAULT)
    semaphore = asyncio.Semaphore(KAUFDA_CONCURRENCY)

    async def fetch_one(content: dict) -> list[dict]:
        merchant = normalize_merchant(content["publisher"]["name"])
        async with semaphore:
            try:
                resp = await client.get(
                    KAUFDA_OFFERS_URL,
                    headers=headers,
                    params={
                        "brochureId": content["id"],
                        "size": 100,
                        "bonialAccountId": bonial_id,
                        "userPlatformCategory": "desktop.web.browser",
                    },
                    timeout=15.0,
                )
            except Exception as e:
                print(f"[kaufda] offers for {merchant} failed: {e}")
                return []

        if resp.status_code != 200:
            return []

        try:
            offers = resp.json().get("contents", [])
        except Exception:
            return []

        deals: list[dict] = []
        for i, offer in enumerate(offers):
            prices = offer.get("prices") or {}
            images = (offer.get("offerImages") or {}).get("url") or {}

            # secondaryPrice is only a former price when flagged as UVP —
            # otherwise it is the upper bound of a price range.
            old_price = 0.0
            if prices.get("secondaryPriceIsUVP"):
                old_price = _to_float(prices.get("secondaryPrice"))

            deal = _build_deal(
                deal_id=f"kd-{offer.get('id', i)}",
                title=(offer.get("title") or "").strip(),
                description=(offer.get("description") or "").strip(),
                merchant=merchant,
                price=_to_float(prices.get("mainPrice")),
                old_price=old_price,
                valid_from=(offer.get("validFrom") or "")[:10],
                valid_until=(offer.get("validUntil") or "")[:10],
                image_url=images.get("normal") or images.get("thumbnail") or "",
                base_hint=parse_base_unit_string(prices.get("priceByBaseUnit") or ""),
                note=_kaufda_note(prices.get("conditions")),
                price_range=bool(prices.get("priceRange")),
            )
            if deal:
                deals.append(deal)
        return deals

    results = await asyncio.gather(*(fetch_one(b) for b in brochures.values()))
    return [deal for group in results for deal in group]


async def scrape(plz: str) -> list[dict]:
    """Fetch both sources concurrently and de-duplicate."""
    async with httpx.AsyncClient(follow_redirects=True) as client:
        marktguru, kaufda = await asyncio.gather(
            fetch_marktguru(plz, client),
            fetch_kaufda(plz, client),
        )

    seen: set[tuple[str, str]] = set()
    deals: list[dict] = []
    for deal in [*marktguru, *kaufda]:
        key = (deal["name"].lower(), deal["merchant"].lower())
        if key in seen:
            continue
        seen.add(key)
        deals.append(deal)

    print(f"[scrape] {plz}: {len(marktguru)} mg + {len(kaufda)} kd -> {len(deals)} unique")
    return deals
