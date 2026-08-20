import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchCategories,
  fetchDeals,
  fetchWatchlist,
  saveSettings,
  saveWatchlist,
  type Deal,
  type WatchEntry,
} from './lib/api';
import {
  dominantValidUntil,
  formatDay,
  isoWeek,
  merchantStyle,
  relativeTime,
} from './lib/format';
import { currentState, disablePush, enablePush, type PushState } from './lib/push';
import { useCart } from './hooks/useCart';
import { useTheme } from './hooks/useTheme';
import { DealCard } from './components/DealCard';
import { CartDrawer } from './components/CartDrawer';
import { WatchlistDrawer } from './components/WatchlistDrawer';

const PAGE_SIZE = 60;
const PLZ_KEY = 'angebote_plz';

type SortKey = 'default' | 'price-asc' | 'price-desc' | 'base' | 'merchant' | 'discount';

const SORT_LABELS: Record<SortKey, string> = {
  default: 'Prospekt-Reihenfolge',
  'price-asc': 'Preis aufsteigend',
  'price-desc': 'Preis absteigend',
  base: 'Grundpreis € / kg · l',
  merchant: 'Nach Laden',
  discount: 'Größter Rabatt',
};

function sortDeals(deals: Deal[], key: SortKey): Deal[] {
  if (key === 'default') return deals;
  const sorted = [...deals];
  switch (key) {
    case 'price-asc':
      return sorted.sort((a, b) => (a.price || Infinity) - (b.price || Infinity));
    case 'price-desc':
      return sorted.sort((a, b) => (b.price || 0) - (a.price || 0));
    case 'base':
      return sorted.sort((a, b) => (a.base_price ?? Infinity) - (b.base_price ?? Infinity));
    case 'merchant':
      return sorted.sort(
        (a, b) => a.merchant.localeCompare(b.merchant, 'de') || (a.price || 0) - (b.price || 0)
      );
    case 'discount':
      return sorted.sort((a, b) => b.discount_pct - a.discount_pct);
  }
}

export function App() {
  const queryClient = useQueryClient();
  const { theme, toggle: toggleTheme } = useTheme();
  const cart = useCart();

  const [plz, setPlz] = useState(() => localStorage.getItem(PLZ_KEY) ?? '48155');
  const [plzDraft, setPlzDraft] = useState(plz);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [merchants, setMerchants] = useState<string[]>([]);
  const [sort, setSort] = useState<SortKey>('default');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [drawer, setDrawer] = useState<'cart' | 'watchlist' | null>(null);
  const [pushState, setPushState] = useState<PushState>('off');

  const dealsQuery = useQuery({
    queryKey: ['deals', plz],
    queryFn: () => fetchDeals(plz),
    staleTime: 5 * 60 * 1000,
  });

  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: fetchCategories });
  const watchlistQuery = useQuery({ queryKey: ['watchlist'], queryFn: fetchWatchlist });

  const refresh = useMutation({
    mutationFn: () => fetchDeals(plz, true),
    onSuccess: (data) => queryClient.setQueryData(['deals', plz], data),
  });

  const watchlistMutation = useMutation({
    mutationFn: saveWatchlist,
    onSuccess: (entries) => {
      queryClient.setQueryData(['watchlist'], entries);
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    },
  });

  useEffect(() => {
    currentState().then(setPushState);
  }, []);

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [category, search, merchants, sort, plz]);

  const deals = dealsQuery.data?.deals ?? [];
  const hits = dealsQuery.data?.hits ?? [];

  const storeNames = useMemo(
    () => [...new Set(deals.map((deal) => deal.merchant))].sort((a, b) => a.localeCompare(b, 'de')),
    [deals]
  );

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const deal of deals) map.set(deal.category, (map.get(deal.category) ?? 0) + 1);
    return map;
  }, [deals]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const result = deals.filter((deal) => {
      if (category !== 'all' && deal.category !== category) return false;
      if (merchants.length && !merchants.includes(deal.merchant)) return false;
      if (needle && !deal.name.toLowerCase().includes(needle)) return false;
      return true;
    });
    return sortDeals(result, sort);
  }, [deals, category, merchants, search, sort]);

  const week = useMemo(() => {
    const until = dominantValidUntil(deals);
    if (!until) return null;
    const date = new Date(until);
    return { week: isoWeek(date), until: formatDay(until) };
  }, [deals]);

  const applyPlz = () => {
    if (plzDraft.length !== 5 || plzDraft === plz) return;
    localStorage.setItem(PLZ_KEY, plzDraft);
    setPlz(plzDraft);
    saveSettings(plzDraft).catch(() => undefined);
  };

  const turnOnPush = async () => {
    try {
      setPushState(await enablePush());
    } catch (error) {
      console.error(error);
      setPushState(await currentState());
    }
  };

  const turnOffPush = async () => setPushState(await disablePush());

  const cartIds = useMemo(() => new Set(cart.items.map((item) => item.id)), [cart.items]);

  return (
    <>
      <header className="topbar">
        <div className="wordmark">
          Angebots<span>tracker</span>
        </div>

        <div className="plz-field">
          <label htmlFor="plz">PLZ</label>
          <input
            id="plz"
            value={plzDraft}
            inputMode="numeric"
            onChange={(e) => setPlzDraft(e.target.value.replace(/\D/g, '').slice(0, 5))}
            onBlur={applyPlz}
            onKeyDown={(e) => e.key === 'Enter' && applyPlz()}
          />
        </div>

        <button
          type="button"
          className="icon-button"
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending}
          aria-label="Prospekte neu laden"
          title="Prospekte neu laden"
        >
          {refresh.isPending ? '…' : '↻'}
        </button>

        <button
          type="button"
          className="icon-button"
          onClick={toggleTheme}
          aria-label="Darstellung wechseln"
          title="Darstellung wechseln"
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>

        <button
          type="button"
          className="icon-button"
          onClick={() => setDrawer('watchlist')}
          aria-label="Watchlist öffnen"
          title="Watchlist"
        >
          ★
        </button>

        <button type="button" className="cart-button" onClick={() => setDrawer('cart')}>
          Korb
          <span className="count">{cart.items.length}</span>
        </button>
      </header>

      <main className="shell">
        <section className="masthead">
          <h1>
            Diese
            <em>Woche</em>
          </h1>
          <dl className="masthead-facts">
            <div className="fact">
              <dt>Kalenderwoche</dt>
              <dd>{week ? `KW ${week.week}` : '—'}</dd>
            </div>
            <div className="fact">
              <dt>Gültig bis</dt>
              <dd>{week ? week.until : '—'}</dd>
            </div>
            <div className="fact">
              <dt>Angebote</dt>
              <dd>{deals.length.toLocaleString('de-DE')}</dd>
            </div>
            <div className="fact">
              <dt>Läden</dt>
              <dd>{storeNames.length}</dd>
            </div>
            <div className="fact">
              <dt>Stand</dt>
              <dd>{relativeTime(dealsQuery.data?.fetched_at ?? 0)}</dd>
            </div>
          </dl>
        </section>

        {hits.length > 0 && (
          <section className="hits">
            <div className="hits-head">
              <h2>
                <span className="marker">Deine Treffer</span>
              </h2>
              <span className="meta">
                {hits.length} Angebote passen auf deine Watchlist
              </span>
            </div>
            <div className="grid">
              {hits.slice(0, 12).map((deal) => (
                <DealCard
                  key={deal.id}
                  deal={deal}
                  selected={cartIds.has(deal.id)}
                  onToggle={cart.toggle}
                />
              ))}
            </div>
          </section>
        )}

        <div className="controls">
          <div className="control-row tabs" aria-label="Kategorien">
            <button
              type="button"
              className="tab"
              aria-pressed={category === 'all'}
              onClick={() => setCategory('all')}
            >
              Alle <span className="count">{deals.length}</span>
            </button>
            {(categoriesQuery.data ?? []).map((entry) => (
              <button
                key={entry.key}
                type="button"
                className="tab"
                aria-pressed={category === entry.key}
                onClick={() => setCategory(entry.key)}
              >
                {entry.label} <span className="count">{counts.get(entry.key) ?? 0}</span>
              </button>
            ))}
          </div>

          <div className="control-row">
            <div className="search">
              <span aria-hidden="true">⌕</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Angebote durchsuchen"
                aria-label="Angebote durchsuchen"
              />
            </div>

            <select
              className="select"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label="Sortierung"
            >
              {Object.entries(SORT_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="icon-button"
              aria-pressed={layout === 'list'}
              onClick={() => setLayout(layout === 'grid' ? 'list' : 'grid')}
              aria-label="Zwischen Raster und Liste wechseln"
              title="Ansicht wechseln"
            >
              {layout === 'grid' ? '☰' : '▦'}
            </button>
          </div>

          <div className="control-row tabs">
            {storeNames.map((store) => {
              const active = merchants.includes(store);
              return (
                <button
                  key={store}
                  type="button"
                  className="chip"
                  aria-pressed={active}
                  onClick={() =>
                    setMerchants(
                      active ? merchants.filter((m) => m !== store) : [...merchants, store]
                    )
                  }
                >
                  <span
                    className="swatch"
                    style={{ background: merchantStyle(store).background }}
                    aria-hidden="true"
                  />
                  {store}
                </button>
              );
            })}
            {merchants.length > 0 && (
              <button type="button" className="link-button" onClick={() => setMerchants([])}>
                Alle Läden
              </button>
            )}
          </div>
        </div>

        <div className="section-head">
          <h2>{category === 'all' ? 'Alle Angebote' : categoriesQuery.data?.find((c) => c.key === category)?.label}</h2>
          <span className="meta">
            {filtered.length.toLocaleString('de-DE')} von {deals.length.toLocaleString('de-DE')}
          </span>
        </div>

        {dealsQuery.isLoading ? (
          <div className="skeleton-grid">
            {Array.from({ length: 12 }, (_, index) => (
              <div className="skeleton" key={index} />
            ))}
          </div>
        ) : dealsQuery.isError ? (
          <div className="empty">
            <strong>Keine Verbindung</strong>
            Die Angebote konnten nicht geladen werden. Läuft das Backend?
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <strong>Nichts gefunden</strong>
            Für diese Filter gibt es diese Woche keine Angebote.
          </div>
        ) : (
          <>
            <div className={`grid ${layout === 'list' ? 'list' : ''}`}>
              {filtered.slice(0, visible).map((deal) => (
                <DealCard
                  key={deal.id}
                  deal={deal}
                  selected={cartIds.has(deal.id)}
                  onToggle={cart.toggle}
                />
              ))}
            </div>
            {visible < filtered.length && (
              <button
                type="button"
                className="load-more"
                onClick={() => setVisible((count) => count + PAGE_SIZE)}
              >
                Weitere {Math.min(PAGE_SIZE, filtered.length - visible)} anzeigen
              </button>
            )}
          </>
        )}
      </main>

      {drawer === 'cart' && (
        <CartDrawer
          items={cart.items}
          total={cart.total}
          pushState={pushState}
          onRemove={cart.remove}
          onClear={cart.clear}
          onClose={() => setDrawer(null)}
          onEnablePush={turnOnPush}
        />
      )}

      {drawer === 'watchlist' && (
        <WatchlistDrawer
          entries={watchlistQuery.data ?? []}
          categories={categoriesQuery.data ?? []}
          pushState={pushState}
          saving={watchlistMutation.isPending}
          onSave={(entries: WatchEntry[]) => watchlistMutation.mutate(entries)}
          onClose={() => setDrawer(null)}
          onEnablePush={turnOnPush}
          onDisablePush={turnOffPush}
        />
      )}
    </>
  );
}
