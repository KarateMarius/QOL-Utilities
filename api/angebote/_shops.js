// Rabatte aus Online-Shops.
//
// Shopify-Shops geben ihren Katalog unter /products.json heraus - mit Preis,
// Streichpreis (compare_at_price), Lieferbarkeit und Gewicht. Damit sind
// Rabatte belegbar statt geraten, und aus dem Gewicht faellt der Grundpreis
// ab: bei Protein ist der Kilopreis die einzig ehrliche Zahl.
//
// Grenze des Verfahrens: erfasst werden nur Preissenkungen, die wirklich am
// Artikel haengen. Gutschein-Kampagnen ("mit Code ESN -25% auf Vitalstoffe")
// aendern den gelisteten Preis nicht und sind hier nicht zu sehen.
//
// Die Aktionstexte von der Startseite zu lesen, waere ein Irrweg: sie liegen
// dort als Vorrat in vier Sprachen, ohne Gueltigkeitszeitraum - eine laengst
// gelaufene Messeaktion ist von einer heutigen nicht zu unterscheiden. Wer
// wissen will, ob ein Preis gerade wirklich gut ist, schaut besser in die
// Preishistorie (_history.js).
import { basePriceFromText } from "./_pricing.js";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// Neuen Shop aufnehmen: Zeile ergaenzen und pruefen, ob
// <basis>/products.json antwortet. Mehr ist nicht noetig.
export const SHOPS = [
  {
    id: "esn",
    name: "ESN",
    base: "https://www.esn.com",
    // Ein Katalog ist schnell mal 1 MB; mehr als ein paar Seiten braucht
    // keiner dieser Shops.
    maxPages: 4,
  },
];

const PAGE_SIZE = 250;

function headers() {
  return { "user-agent": USER_AGENT, accept: "application/json" };
}

async function getJson(url, timeout = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { headers: headers(), signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Kilopreis aus dem Variantengewicht, sonst aus dem Titel ("1000g"). */
function basePrice(price, grams, text) {
  if (grams > 0) {
    const perKg = price / (grams / 1000);
    if (perKg > 0 && perKg < 9999) return { price: Math.round(perKg * 100) / 100, unit: "kg" };
  }
  return basePriceFromText(price, text);
}

function toDeal(shop, product, variant) {
  const price = Number.parseFloat(variant.price);
  const oldPrice = Number.parseFloat(variant.compare_at_price);
  if (!(price > 0) || !(oldPrice > price)) return null;

  const image =
    variant.featured_image?.src || product.images?.[0]?.src || product.image?.src || "";

  // Die Variante heisst z.B. "Chocolate / 1000g" - als Untertitel genau richtig.
  const subtitle = variant.title && variant.title !== "Default Title" ? variant.title : "";
  const base = basePrice(price, Number(variant.grams) || 0, subtitle || product.title);

  return {
    id: `shop-${shop.id}-${variant.id}`,
    name: `${product.title}${subtitle ? ` – ${subtitle}` : ""}`,
    title: product.title,
    subtitle,
    note: "",
    merchant: shop.name,
    price,
    old_price: oldPrice,
    discount_pct: Math.round((1 - price / oldPrice) * 100),
    price_range: false,
    unit: subtitle,
    base_price: base ? base.price : null,
    base_unit: base ? base.unit : null,
    category: "supplements",
    valid_from: "",
    valid_until: "",
    image_url: image,
    url: `${shop.base}/products/${product.handle}?variant=${variant.id}`,
    // Nur zum Aussortieren; geht nicht mit an die Oberflaeche.
    available: Boolean(variant.available),
  };
}

async function fetchShop(shop) {
  const products = [];
  for (let page = 1; page <= shop.maxPages; page++) {
    const data = await getJson(`${shop.base}/products.json?limit=${PAGE_SIZE}&page=${page}`, 20000);
    if (!data?.products?.length) break;
    products.push(...data.products);
    if (data.products.length < PAGE_SIZE) break;
  }

  if (!products.length) {
    console.log(`[shops] ${shop.id}: kein Katalog erhalten`);
    return [];
  }

  const deals = [];
  for (const product of products) {
    for (const variant of product.variants || []) {
      const deal = toDeal(shop, product, variant);
      // Ausverkauftes ist kein Angebot, sondern eine Enttaeuschung.
      if (deal && deal.available) deals.push(deal);
    }
  }

  console.log(`[shops] ${shop.id}: ${products.length} Produkte -> ${deals.length} Rabatte`);
  return deals;
}

/**
 * Rabatte aller Shops. Faellt ein Shop aus, fehlt nur er - die uebrigen
 * kommen trotzdem durch.
 */
export async function scrapeShops() {
  const results = await Promise.all(SHOPS.map((shop) => fetchShop(shop).catch(() => [])));
  return results.flat().sort((a, b) => b.discount_pct - a.discount_pct);
}
