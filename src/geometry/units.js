// Conversions between plan-space centimeters (the unit all stored
// coordinates use) and on-screen pixels. `pxPerCm` is the current zoom
// level expressed directly as pixels-per-centimeter, so zoom and unit
// conversion are the same number — simplest possible mapping.

export const BASE_PX_PER_CM = 2; // zoom = 1 -> 1cm = 2px, a readable default

export function cmToPx(cm, pxPerCm = BASE_PX_PER_CM) {
  return cm * pxPerCm;
}

export function pxToCm(px, pxPerCm = BASE_PX_PER_CM) {
  return px / pxPerCm;
}

export function cmToM(cm) {
  return cm / 100;
}

export function formatMeters(cm, fractionDigits = 2) {
  return `${cmToM(cm).toFixed(fractionDigits)} m`;
}

export function formatAreaM2(areaM2, fractionDigits = 1) {
  return `${areaM2.toFixed(fractionDigits)} m²`;
}
