// Grundpreis-Ermittlung (Preis je kg, Liter oder Stueck).
//
// Beide Quellen liefern meist einen offiziellen Grundpreis mit. Nur wo der
// fehlt, wird er aus dem Angebotstext gerechnet - Prospekttexte sehen aus wie
// "je 350-g-Pckg." oder "je 8 x 100-g-Fl.-Pckg.".

// "zzgl. 0.25 Pfand" wuerde sonst als Produktmenge gelesen.
const PFAND = /zzgl\.?\s*[\d.,]+\s*(?:€|eur)?\s*pfand/gi;

const AMOUNT = /(?:(\d+(?:[.,]\d+)?)\s*[x×]\s*)?(\d+(?:[.,]\d+)?)\s*-?\s*(kg|g|ml|l|st)\b/i;

const BASE_UNIT_STRING = /(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|st)\b\s*=\s*(\d+(?:[.,]\d+)?)/i;

const TO_BASE = {
  g: [0.001, "kg"],
  kg: [1, "kg"],
  ml: [0.001, "l"],
  l: [1, "l"],
  st: [1, "St."],
};

function num(raw) {
  const value = Number.parseFloat(String(raw).replace(",", "."));
  return Number.isFinite(value) ? value : NaN;
}

function pack(value, label) {
  // Eine 5-Gramm-Probe ergaebe einen absurden Kilopreis - lieber nichts zeigen.
  if (!(value > 0) || value > 999) return null;
  return { price: Math.round(value * 100) / 100, unit: label };
}

/** Grundpreis aus dem Angebotstext ableiten. */
export function basePriceFromText(price, text) {
  if (!(price > 0) || !text) return null;

  const match = AMOUNT.exec(String(text).replace(PFAND, " "));
  if (!match) return null;

  const [, multiRaw, amountRaw, unitRaw] = match;
  const amount = num(amountRaw);
  const multi = multiRaw ? num(multiRaw) : 1;
  if (!(amount > 0) || !(multi > 0)) return null;

  const [factor, label] = TO_BASE[unitRaw.toLowerCase()];
  const total = amount * multi * factor;
  if (!(total > 0)) return null;

  return pack(price / total, label);
}

/** Kaufdas `priceByBaseUnit`, z.B. "Grundpreis 1 kg = 1,58". */
export function parseBaseUnitString(text) {
  if (!text) return null;

  const match = BASE_UNIT_STRING.exec(String(text));
  if (!match) return null;

  const [, amountRaw, unitRaw, priceRaw] = match;
  const amount = num(amountRaw);
  const price = num(priceRaw);
  if (!(amount > 0) || !(price > 0)) return null;

  const [factor, label] = TO_BASE[unitRaw.toLowerCase()];
  const total = amount * factor;
  if (!(total > 0)) return null;

  return pack(price / total, label);
}

/** Marktgurus `referencePrice` ist bereits ein Grundpreis. */
export function normalizeReferencePrice(price, shortName) {
  if (!(price > 0) || !shortName) return null;

  const label = { kg: "kg", l: "l", st: "St.", stk: "St.", "stück": "St." }[
    String(shortName).trim().toLowerCase()
  ];
  if (!label) return null;

  return pack(price, label);
}
