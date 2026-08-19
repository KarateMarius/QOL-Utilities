// Holt Wochenangebote von Marktguru und Kaufda.
//
// Keine offiziellen APIs - beide Endpunkte sind die, die auch die jeweilige
// Website benutzt. Aendert sich dort etwas, bricht der Scraper; deshalb faengt
// jeder Aufruf einzeln ab und liefert im Zweifel eine leere Liste, statt die
// ganze Antwort scheitern zu lassen.
import { categorize } from "./_categorize.js";
import { basePriceFromText, normalizeReferencePrice, parseBaseUnitString } from "./_pricing.js";

const MARKTGURU_APIKEY_DEFAULT = "8Kk+pmbf7TgJ9nVj2cXeA7P5zBGv8iuutVVMRfOfvNE=";
const MARKTGURU_API_URL = "https://api.marktguru.de/api/v1/offers/publishers";
const MARKTGURU_LOCATIONS_URL = "https://api.marktguru.de/api/v1/locations";
const MARKTGURU_CDN = "https://cdn.marktguru.de/api/v1/offers/{id}/images/default/0/small.webp";

const KAUFDA_SEARCH_URL = "https://www.kaufda.de/api/search";
const KAUFDA_OFFERS_URL = "https://www.kaufda.de/api/personalisedOffers";
const KAUFDA_BONIAL_ID_DEFAULT = "a95ce853-04f4-49ef-bbce-65aabdad4768";

const TARGET_UNIQUE_NAMES = new Set([
  "rewe", "lidl", "edeka", "dm-drogerie-markt", "netto-marken-discount",
  "kaufland", "penny", "aldi-sued", "rossmann", "mueller-drogeriemarkt",
  "norma", "globus", "tegut", "hit", "famila", "denns-biomarkt", "alnatura",
]);

const TARGET_SUPERMARKETS = [
  "rewe", "lidl", "edeka", "dm", "netto", "kaufland", "penny",
  "aldi", "rossmann", "müller", "norma", "globus", "tegut",
  "hit", "famila", "denns", "alnatura", "marktkauf", "e center",
];

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const FALLBACK_LAT_LNG = [51.9625, 7.6252]; // Muenster

// Kaufda wird pro Prospekt abgefragt. Ohne Deckel liefen die parallelen
// Requests in den Function-Timeout.
const KAUFDA_CONCURRENCY = 8;

function marktguruHeaders() {
  return {
    "x-apikey": process.env.MARKTGURU_APIKEY || MARKTGURU_APIKEY_DEFAULT,
    "user-agent": USER_AGENT,
    referer: "https://www.marktguru.de/",
    accept: "application/json",
    "content-type": "application/json",
  };
}

function kaufdaHeaders() {
  return {
    "user-agent": USER_AGENT,
    referer: "https://www.kaufda.de/",
    accept: "application/json",
  };
}

async function getJson(url, { headers, params, timeout = 15000 }) {
  const target = new URL(url);
  for (const [key, value] of Object.entries(params || {})) {
    target.searchParams.set(key, String(value));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(target, { headers, signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function normalizeMerchant(storeName) {
  const s = String(storeName || "").toLowerCase();
  if (s.includes("rewe")) return "REWE";
  if (s.includes("lidl")) return "Lidl";
  if (s.includes("edeka") || s.includes("e center")) return "EDEKA";
  if (s.includes("dm")) return "dm";
  if (s.includes("netto")) return "Netto";
  if (s.includes("aldi")) return s.includes("nord") ? "ALDI Nord" : "ALDI Süd";
  if (s.includes("kaufland")) return "Kaufland";
  if (s.includes("penny")) return "Penny";
  if (s.includes("rossmann")) return "Rossmann";
  if (s.includes("müller") || s.includes("mueller")) return "Müller";
  if (s.includes("norma")) return "Norma";
  if (s.includes("globus")) return "Globus";
  if (s.includes("tegut")) return "Tegut";
  if (s.includes("alnatura")) return "Alnatura";
  if (s.includes("denn")) return "Denns";
  if (s.includes("marktkauf")) return "Marktkauf";
  if (s.includes("hit")) return "HIT";
  return storeName;
}

function toNumber(value) {
  if (typeof value === "number" && value > 0) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(",", "."));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }
  return 0;
}

function firstPrice(source, keys) {
  for (const key of keys) {
    const value = toNumber(source?.[key]);
    if (value) return value;
  }
  return 0;
}

const HINT_MARKER = "HINWEIS:";

// Marktguru klebt Treuehinweise mitten in den Beschreibungstext:
// "HINWEIS: MIT APP 0,10 € REWE BONUS versch. Sorten, je 60-g-Schale".
function splitHint(description) {
  if (!description.toUpperCase().includes(HINT_MARKER)) return [description, ""];

  const idx = description.toUpperCase().indexOf(HINT_MARKER);
  const prefix = description.slice(0, idx).trim();
  const rest = description.slice(idx + HINT_MARKER.length).trim();

  // Der Hinweis laeuft, bis der eigentliche Angebotstext wieder anfaengt.
  const match = /\s(?=(?:versch\.|je\b|Ursprung|Herkunft|Klasse\b|[a-zäöüß]))/.exec(rest);
  const note = match ? rest.slice(0, match.index).trim() : rest;
  const tail = match ? rest.slice(match.index + 1).trim() : "";

  return [[prefix, tail].filter(Boolean).join(" ").trim(), note];
}

function buildDeal({
  id, title, description, merchant, price, oldPrice,
  validFrom, validUntil, imageUrl, baseHint, note, priceRange,
}) {
  title = String(title || "").trim();
  description = String(description || "").trim();
  if (description.toLowerCase() === title.toLowerCase()) description = "";

  const [cleanDescription, hintNote] = splitHint(description);
  description = cleanDescription;
  note = String(note || hintNote || "").trim();

  const name = title && description ? `${title} – ${description}` : title || description;
  if (!name) return null;

  const discount = oldPrice && price && oldPrice > price
    ? Math.round((1 - price / oldPrice) * 100)
    : 0;

  const base = baseHint || basePriceFromText(price, description || title);

  return {
    id,
    name,
    title: title || description,
    subtitle: description,
    note,
    merchant,
    price,
    old_price: oldPrice,
    discount_pct: discount,
    price_range: Boolean(priceRange),
    unit: description,
    base_price: base ? base.price : null,
    base_unit: base ? base.unit : null,
    category: categorize(name),
    valid_from: validFrom || "",
    valid_until: validUntil || "",
    image_url: imageUrl || "",
  };
}

async function getLatLng(plz) {
  const data = await getJson(MARKTGURU_LOCATIONS_URL, {
    headers: marktguruHeaders(),
    params: { as: "mobile", limit: 1, q: plz },
    timeout: 8000,
  });
  const hit = data?.results?.[0];
  if (hit) return [Number(hit.latitude), Number(hit.longitude)];
  return FALLBACK_LAT_LNG;
}

async function fetchMarktguru(plz) {
  const data = await getJson(MARKTGURU_API_URL, {
    headers: marktguruHeaders(),
    params: { as: "mobile", limit: 50, offerLimit: 100, zipCode: plz },
    timeout: 20000,
  });
  if (!data?.results) return [];

  const deals = [];
  for (const publisher of data.results) {
    if (!TARGET_UNIQUE_NAMES.has(publisher.uniqueName || "")) continue;
    const merchant = normalizeMerchant(publisher.name || publisher.uniqueName || "");

    for (const [index, offer] of (publisher.offers || []).entries()) {
      const offerId = offer.id ?? index;

      let validFrom = "";
      let validUntil = "";
      const validity = offer.validityDates?.[0];
      if (validity) {
        const asDay = (raw) => {
          const date = new Date(raw);
          return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
        };
        if (validity.from) validFrom = asDay(validity.from);
        if (validity.to) validUntil = asDay(validity.to);
      }

      const deal = buildDeal({
        id: `mg-${offerId}`,
        title: offer.product?.name || offer.description || "",
        description: offer.description || "",
        merchant,
        price: toNumber(offer.price),
        oldPrice: firstPrice(offer, ["oldPrice", "crossedOutPrice"]),
        validFrom,
        validUntil,
        imageUrl: MARKTGURU_CDN.replace("{id}", offerId),
        baseHint: normalizeReferencePrice(toNumber(offer.referencePrice), offer.unit?.shortName),
      });
      if (deal) deals.push(deal);
    }
  }
  return deals;
}

// Kaufda-Bedingungen enthalten meist nur "je" - interessant sind Hinweise
// wie "Mit Lidl Plus".
function kaufdaNote(conditions) {
  if (!Array.isArray(conditions)) return "";
  for (const entry of conditions) {
    const text = String(entry?.other || "").trim();
    if (text.length > 3 && !["je topf", "je stück"].includes(text.toLowerCase())) return text;
  }
  return "";
}

async function kaufdaBrochures(plz) {
  const [lat, lng] = await getLatLng(plz);
  const queries = ["Supermarkt", "Discounter", "Drogerie", "Aldi", "Lidl",
                   "Kaufland", "Rewe", "Edeka", "Penny", "Netto"];

  const results = await Promise.all(
    queries.map((query) =>
      getJson(KAUFDA_SEARCH_URL, {
        headers: kaufdaHeaders(),
        params: { query, lat: String(lat), lng: String(lng) },
        timeout: 12000,
      })
    )
  );

  const brochures = new Map();
  for (const data of results) {
    for (const entry of data?.searchResults?.contents?.brochures || []) {
      const content = entry.content;
      if (!content || content.type !== "BROCHURE") continue;
      const publisher = String(content.publisher?.name || "").toLowerCase();
      if (TARGET_SUPERMARKETS.some((target) => publisher.includes(target))) {
        brochures.set(content.id, content);
      }
    }
  }
  return [...brochures.values()];
}

async function fetchKaufda(plz) {
  const brochures = await kaufdaBrochures(plz);
  if (!brochures.length) return [];

  const bonialId = process.env.KAUFDA_BONIAL_ID || KAUFDA_BONIAL_ID_DEFAULT;
  const deals = [];
  let cursor = 0;

  async function worker() {
    while (cursor < brochures.length) {
      const content = brochures[cursor++];
      const merchant = normalizeMerchant(content.publisher?.name || "");

      const data = await getJson(KAUFDA_OFFERS_URL, {
        headers: kaufdaHeaders(),
        params: {
          brochureId: content.id,
          size: 100,
          bonialAccountId: bonialId,
          userPlatformCategory: "desktop.web.browser",
        },
        timeout: 15000,
      });

      for (const [index, offer] of (data?.contents || []).entries()) {
        const prices = offer.prices || {};
        const images = offer.offerImages?.url || {};

        // secondaryPrice ist nur dann ein Vorher-Preis, wenn er als UVP
        // markiert ist - sonst ist es die Obergrenze einer Preisspanne.
        const oldPrice = prices.secondaryPriceIsUVP ? toNumber(prices.secondaryPrice) : 0;

        const deal = buildDeal({
          id: `kd-${offer.id ?? index}`,
          title: offer.title || "",
          description: offer.description || "",
          merchant,
          price: toNumber(prices.mainPrice),
          oldPrice,
          validFrom: String(offer.validFrom || "").slice(0, 10),
          validUntil: String(offer.validUntil || "").slice(0, 10),
          imageUrl: images.normal || images.thumbnail || "",
          baseHint: parseBaseUnitString(prices.priceByBaseUnit || ""),
          note: kaufdaNote(prices.conditions),
          priceRange: prices.priceRange,
        });
        if (deal) deals.push(deal);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(KAUFDA_CONCURRENCY, brochures.length) }, worker)
  );
  return deals;
}

/** Beide Quellen parallel abfragen und Doppelte entfernen. */
export async function scrape(plz) {
  const [marktguru, kaufda] = await Promise.all([fetchMarktguru(plz), fetchKaufda(plz)]);

  const seen = new Set();
  const deals = [];
  for (const deal of [...marktguru, ...kaufda]) {
    const key = `${deal.name.toLowerCase()}|${deal.merchant.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deals.push(deal);
  }

  console.log(
    `[scrape] ${plz}: ${marktguru.length} mg + ${kaufda.length} kd -> ${deals.length} unique`
  );
  return deals;
}
