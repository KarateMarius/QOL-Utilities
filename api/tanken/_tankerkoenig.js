// Spritpreise von Tankerkoenig.
//
// Tankerkoenig gibt die Meldungen der Markttransparenzstelle fuer Kraftstoffe
// weiter - also die Preise, die Tankstellen gesetzlich melden muessen. Das ist
// keine Schaetzung und kein Geschabe, sondern die amtliche Quelle.
//
// Ein eigener Schluessel ist kostenlos (tankerkoenig.de) und gehoert in
// TANKERKOENIG_APIKEY. Ohne ihn laeuft die App mit dem Demo-Schluessel aus der
// Dokumentation: Namen, Marken, Entfernungen und Oeffnungszeiten stimmen dann,
// die Preise sind aber fuer alle Stationen derselbe Platzhalter. Die Antwort
// sagt das mit `demo: true`, damit die Oberflaeche es nicht verschweigt.
import { locate } from "../_geo.js";

const LIST_URL = "https://creativecommons.tankerkoenig.de/json/list.php";
const DEMO_KEY = "00000000-0000-0000-0000-000000000002";

export const FUEL_TYPES = [
  { key: "diesel", label: "Diesel" },
  { key: "e5", label: "Super E5" },
  { key: "e10", label: "Super E10" },
];

export const RADII = [2, 5, 10, 25];

function apiKey() {
  return process.env.TANKERKOENIG_APIKEY || DEMO_KEY;
}

export function isDemo() {
  return !process.env.TANKERKOENIG_APIKEY;
}

/** Aus "Esso Station Muenster Weseler Str." wird "Esso". */
function tidyBrand(station) {
  const brand = String(station.brand || "").trim();
  if (brand) return brand;
  const name = String(station.name || "").trim();
  return name.split(/[\s,]/)[0] || "Tankstelle";
}

function tidyName(station) {
  const name = String(station.name || "").trim();
  const brand = tidyBrand(station);
  // Der Name wiederholt meist die Marke - die steht schon auf dem Schild.
  const withoutBrand = name.replace(new RegExp(`^${brand}\\s*`, "i"), "").trim();
  return withoutBrand || name || brand;
}

export async function fetchStations({ plz, type = "diesel", radius = 5 }) {
  const fuel = FUEL_TYPES.some((f) => f.key === type) ? type : "diesel";
  const rad = RADII.includes(Number(radius)) ? Number(radius) : 5;

  const { lat, lng, place } = await locate(plz);

  const url = new URL(LIST_URL);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lng", String(lng));
  url.searchParams.set("rad", String(rad));
  url.searchParams.set("sort", "price");
  url.searchParams.set("type", fuel);
  url.searchParams.set("apikey", apiKey());

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  let payload = null;
  try {
    const res = await fetch(url, { headers: { "user-agent": "QOL-Utilities" }, signal: controller.signal });
    if (res.ok) payload = await res.json();
  } catch (err) {
    console.error("[tanken] Abruf fehlgeschlagen:", err.message);
  } finally {
    clearTimeout(timer);
  }

  if (!payload?.ok) {
    return { place, type: fuel, radius: rad, demo: isDemo(), stations: [], error: payload?.message || "Keine Antwort von Tankerkönig" };
  }

  const stations = (payload.stations || [])
    .filter((s) => s.price > 0)
    .map((s) => ({
      id: s.id,
      brand: tidyBrand(s),
      name: tidyName(s),
      street: [s.street, s.houseNumber].filter(Boolean).join(" ").trim(),
      place: s.place,
      postCode: s.postCode,
      lat: s.lat,
      lng: s.lng,
      distance: s.dist,
      price: s.price,
      open: Boolean(s.isOpen),
    }))
    // Tankerkoenig sortiert bereits nach Preis; geschlossene Stationen gehoeren
    // trotzdem nach hinten - ihr Preis nuetzt gerade niemandem.
    .sort((a, b) => Number(b.open) - Number(a.open) || a.price - b.price);

  return { place, type: fuel, radius: rad, demo: isDemo(), stations };
}
