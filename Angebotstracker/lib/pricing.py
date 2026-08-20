"""Grundpreis (unit price) extraction from German offer texts.

Prospekt units look like "je 350-g-Pckg.", "je 8 x 100-g-Fl.-Pckg.",
"je 1,5-l-Fl. zzgl. 0.25 Pfand" or "je 10-St.-Pckg.".
"""
from __future__ import annotations

import re

# "zzgl. 0.25 Pfand" would otherwise be parsed as the product amount.
_PFAND = re.compile(r"zzgl\.?\s*[\d.,]+\s*(?:€|eur)?\s*pfand", re.IGNORECASE)
_AMOUNT = re.compile(
    r"(?:(\d+(?:[.,]\d+)?)\s*[x×]\s*)?"      # optional multipack "8 x"
    r"(\d+(?:[.,]\d+)?)\s*-?\s*"             # amount
    r"(kg|g|ml|l|st)\b",                     # unit
    re.IGNORECASE,
)

_TO_BASE = {
    "g": (0.001, "kg"),
    "kg": (1.0, "kg"),
    "ml": (0.001, "l"),
    "l": (1.0, "l"),
    "st": (1.0, "St."),
}


def _num(raw: str) -> float:
    return float(raw.replace(",", "."))


def base_price(price: float, text: str) -> tuple[float, str] | None:
    """Return (price per kg/l/piece, unit label) or None if not derivable."""
    if not price or price <= 0 or not text:
        return None

    cleaned = _PFAND.sub(" ", text)
    match = _AMOUNT.search(cleaned)
    if not match:
        return None

    multi_raw, amount_raw, unit_raw = match.groups()
    try:
        amount = _num(amount_raw)
        multi = _num(multi_raw) if multi_raw else 1.0
    except ValueError:
        return None
    if amount <= 0 or multi <= 0:
        return None

    factor, label = _TO_BASE[unit_raw.lower()]
    total = amount * multi * factor
    if total <= 0:
        return None

    value = price / total
    # A 5-gram spice sample would produce an absurd €/kg — not worth showing.
    if value > 999:
        return None
    return round(value, 2), label


_BASE_UNIT_STRING = re.compile(
    r"(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|st)\b\s*=\s*(\d+(?:[.,]\d+)?)",
    re.IGNORECASE,
)


def parse_base_unit_string(text: str) -> tuple[float, str] | None:
    """Parse Kaufda's `priceByBaseUnit`, e.g. "Grundpreis 1 kg = 1,58".

    Ranges ("1 kg = 2,92-2,20") keep the first value.
    """
    if not text:
        return None
    match = _BASE_UNIT_STRING.search(text)
    if not match:
        return None

    amount_raw, unit_raw, price_raw = match.groups()
    try:
        amount = _num(amount_raw)
        price = _num(price_raw)
    except ValueError:
        return None
    if amount <= 0 or price <= 0:
        return None

    factor, label = _TO_BASE[unit_raw.lower()]
    total = amount * factor
    value = price / total if total else 0
    if value <= 0 or value > 999:
        return None
    return round(value, 2), label


def normalize_reference_price(price: float, short_name: str) -> tuple[float, str] | None:
    """Marktguru delivers `referencePrice` already per base unit."""
    if not price or price <= 0 or not short_name:
        return None
    key = short_name.strip().lower()
    aliases = {"kg": "kg", "l": "l", "st": "St.", "stk": "St.", "stück": "St."}
    label = aliases.get(key)
    if not label or price > 999:
        return None
    return round(float(price), 2), label
