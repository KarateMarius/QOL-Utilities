export interface Deal {
  id: string;
  name: string;
  title: string;
  subtitle: string;
  note: string;
  merchant: string;
  price: number;
  old_price: number;
  discount_pct: number;
  price_range: boolean;
  unit: string;
  base_price: number | null;
  base_unit: string | null;
  category: string;
  valid_from: string;
  valid_until: string;
  image_url: string;
  matched_keyword?: string;
}

export interface DealsResponse {
  plz: string;
  fetched_at: number;
  from_cache: boolean;
  count: number;
  deals: Deal[];
  hits: Deal[];
}

export interface WatchEntry {
  id: string;
  keyword: string;
  max_price: number | null;
  category: string | null;
}

export interface CategoryInfo {
  key: string;
  label: string;
}

export interface PushConfig {
  configured: boolean;
  public_key: string;
  subscriptions: number;
}

export interface PushResult {
  sent: number;
  failed: number;
  error?: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(detail || `${res.status} ${res.statusText}`);
  }
  return res.json();
}

export const fetchDeals = (plz: string, refresh = false) =>
  request<DealsResponse>(`/api/deals?plz=${plz}${refresh ? '&refresh=true' : ''}`);

export const fetchCategories = () => request<CategoryInfo[]>('/api/categories');

export const fetchWatchlist = () =>
  request<{ entries: WatchEntry[] }>('/api/watchlist').then((r) => r.entries);

export const saveWatchlist = (entries: WatchEntry[]) =>
  request<{ entries: WatchEntry[] }>('/api/watchlist', {
    method: 'PUT',
    body: JSON.stringify({ entries }),
  }).then((r) => r.entries);

export const saveSettings = (plz: string) =>
  request<{ plz: string }>('/api/settings', {
    method: 'PUT',
    body: JSON.stringify({ plz }),
  });

export const fetchPushConfig = () => request<PushConfig>('/api/push/config');

export const registerSubscription = (subscription: PushSubscriptionJSON) =>
  request<{ status: string }>('/api/push/subscribe', {
    method: 'POST',
    body: JSON.stringify({ subscription }),
  });

export const removeSubscription = (endpoint: string) =>
  request<{ status: string }>('/api/push/unsubscribe', {
    method: 'POST',
    body: JSON.stringify({ endpoint }),
  });

export const sendCartPush = (items: { name: string; merchant: string; price: number }[]) =>
  request<PushResult>('/api/push/cart', {
    method: 'POST',
    body: JSON.stringify({ items }),
  });

export const sendTestPush = () => request<PushResult>('/api/push/test', { method: 'POST' });
