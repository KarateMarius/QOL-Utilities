import type { Deal } from './api';

export const MERCHANT_COLORS: Record<string, string> = {
  REWE: '#cc071e',
  Lidl: '#0050aa',
  EDEKA: '#ffd400',
  'ALDI Nord': '#00005f',
  'ALDI Süd': '#00005f',
  Netto: '#ffe400',
  Penny: '#d0111a',
  Kaufland: '#e10915',
  Marktkauf: '#e2001a',
  Norma: '#d40511',
  Globus: '#004c93',
  Tegut: '#e2001a',
  HIT: '#e2001a',
  dm: '#002d72',
  Rossmann: '#c9001e',
  Müller: '#f39200',
  Denns: '#4ba82e',
  Alnatura: '#4ba82e',
};

/** Yellow store logos need dark text to stay readable. */
const LIGHT_BRANDS = new Set(['EDEKA', 'Netto', 'Müller']);

export function merchantStyle(merchant: string) {
  const background = MERCHANT_COLORS[merchant] ?? '#14161a';
  return {
    background,
    color: LIGHT_BRANDS.has(merchant) ? '#14161a' : '#ffffff',
  };
}

/** Splits 4.99 into "4" and "99" for the price stamp. */
export function priceParts(price: number): [string, string] {
  const [euro, cent] = price.toFixed(2).split('.');
  return [euro, cent];
}

export function formatEuro(value: number): string {
  return value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

export function formatBasePrice(deal: Deal): string | null {
  if (!deal.base_price || !deal.base_unit) return null;
  const value = deal.base_price.toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${value} € / ${deal.base_unit}`;
}

export function formatDay(iso: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

/** ISO week number — the unit supermarket flyers are organised in. */
export function isoWeek(date: Date): number {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3);
  return 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 86400000));
}

/** The date most offers expire on — that is the week the flyer covers. */
export function dominantValidUntil(deals: Deal[]): string {
  const counts = new Map<string, number>();
  for (const deal of deals) {
    if (!deal.valid_until) continue;
    counts.set(deal.valid_until, (counts.get(deal.valid_until) ?? 0) + 1);
  }
  let best = '';
  let bestCount = 0;
  for (const [date, count] of counts) {
    if (count > bestCount) {
      best = date;
      bestCount = count;
    }
  }
  return best;
}

export function relativeTime(timestamp: number): string {
  if (!timestamp) return 'noch nie';
  const minutes = Math.round((Date.now() - timestamp * 1000) / 60000);
  if (minutes < 1) return 'gerade eben';
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  return `vor ${Math.round(hours / 24)} Tagen`;
}
