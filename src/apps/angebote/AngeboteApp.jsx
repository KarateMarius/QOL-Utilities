import { useEffect, useMemo, useState } from "react";
import { CATEGORIES } from "./lib/api.js";
import {
  dominantValidUntil,
  formatDay,
  isoWeek,
  merchantStyle,
  relativeTime,
} from "./lib/format.js";
import { currentState, disablePush, enablePush } from "./lib/push.js";
import { useDeals } from "./hooks/useDeals.js";
import { useWatchlist } from "./hooks/useWatchlist.js";
import { useCart } from "./hooks/useCart.js";
import { useHistory } from "./hooks/useHistory.js";
import DealCard from "./components/DealCard.jsx";
import CartDrawer from "./components/CartDrawer.jsx";
import WatchlistDrawer from "./components/WatchlistDrawer.jsx";
import "./styles.css";

const PAGE_SIZE = 60;

const SORT_LABELS = {
  default: "Prospekt-Reihenfolge",
  "price-asc": "Preis aufsteigend",
  "price-desc": "Preis absteigend",
  base: "Grundpreis € / kg · l",
  merchant: "Nach Laden",
  discount: "Größter Rabatt",
};

function sortDeals(deals, key) {
  if (key === "default") return deals;
  const sorted = [...deals];

  switch (key) {
    case "price-asc":
      return sorted.sort((a, b) => (a.price || Infinity) - (b.price || Infinity));
    case "price-desc":
      return sorted.sort((a, b) => (b.price || 0) - (a.price || 0));
    case "base":
      return sorted.sort((a, b) => (a.base_price ?? Infinity) - (b.base_price ?? Infinity));
    case "merchant":
      return sorted.sort(
        (a, b) => a.merchant.localeCompare(b.merchant, "de") || (a.price || 0) - (b.price || 0)
      );
    case "discount":
      return sorted.sort((a, b) => b.discount_pct - a.discount_pct);
    default:
      return sorted;
  }
}

export default function AngeboteApp() {
  const watchlist = useWatchlist();
  const cart = useCart();
  const { data, loading, refreshing, error, refresh } = useDeals(watchlist.plz);

  const [plzDraft, setPlzDraft] = useState(watchlist.plz);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [merchants, setMerchants] = useState([]);
  const [sort, setSort] = useState("default");
  const [layout, setLayout] = useState("grid");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [drawer, setDrawer] = useState(null);
  const [pushState, setPushState] = useState("off");

  // Die gespeicherte PLZ kommt erst nach der Server-Antwort - dann muss auch
  // das Eingabefeld nachziehen.
  useEffect(() => {
    if (watchlist.ready) setPlzDraft(watchlist.plz);
  }, [watchlist.ready, watchlist.plz]);

  useEffect(() => {
    currentState().then(setPushState);
  }, [watchlist.signedIn]);

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [category, search, merchants, sort, watchlist.plz]);

  const deals = data?.deals ?? [];
  const hits = data?.hits ?? [];

  const storeNames = useMemo(
    () => [...new Set(deals.map((deal) => deal.merchant))].sort((a, b) => a.localeCompare(b, "de")),
    [deals]
  );

  const counts = useMemo(() => {
    const map = new Map();
    for (const deal of deals) map.set(deal.category, (map.get(deal.category) ?? 0) + 1);
    return map;
  }, [deals]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const result = deals.filter((deal) => {
      if (category !== "all" && deal.category !== category) return false;
      if (merchants.length && !merchants.includes(deal.merchant)) return false;
      if (needle && !deal.name.toLowerCase().includes(needle)) return false;
      return true;
    });
    return sortDeals(result, sort);
  }, [deals, category, merchants, search, sort]);

  const week = useMemo(() => {
    const until = dominantValidUntil(deals);
    if (!until) return null;
    return { week: isoWeek(new Date(until)), until: formatDay(until) };
  }, [deals]);

  const cartIds = useMemo(() => new Set(cart.items.map((item) => item.id)), [cart.items]);

  // Preisverlauf lohnt nur dort, wo er jemanden interessiert: im Korb, bei
  // Watchlist-Treffern und bei Shop-Artikeln, deren Preis sich taeglich
  // aendern kann. Fuer 2000 Prospektzeilen waere er Ballast.
  const trackedKeys = useMemo(() => {
    const keys = new Set();
    for (const item of cart.items) if (item.key) keys.add(item.key);
    for (const hit of hits) if (hit.key) keys.add(hit.key);
    for (const deal of deals) if (deal.key && deal.category === "supplements") keys.add(deal.key);
    return [...keys];
  }, [cart.items, hits, deals]);

  const { history, noteAdded } = useHistory(trackedKeys);

  function toggleDeal(deal) {
    if (!cartIds.has(deal.id)) noteAdded(deal);
    cart.toggle(deal);
  }

  function applyPlz() {
    if (plzDraft.length !== 5 || plzDraft === watchlist.plz) return;
    watchlist.setPlz(plzDraft);
  }

  async function turnOnPush() {
    try {
      setPushState(await enablePush());
    } catch (e) {
      console.error(e);
      setPushState(await currentState());
    }
  }

  return (
    <div className="angebote-app">
      <header className="topbar">
        <div className="wordmark">
          Angebots<span>tracker</span>
        </div>

        <div className="plz-field">
          <label htmlFor="ang-plz">PLZ</label>
          <input
            id="ang-plz"
            value={plzDraft}
            inputMode="numeric"
            onChange={(e) => setPlzDraft(e.target.value.replace(/\D/g, "").slice(0, 5))}
            onBlur={applyPlz}
            onKeyDown={(e) => e.key === "Enter" && applyPlz()}
          />
        </div>

        <button
          type="button"
          className="ang-icon-button"
          onClick={refresh}
          disabled={refreshing}
          aria-label="Prospekte neu laden"
          title="Prospekte neu laden"
        >
          {refreshing ? "…" : "↻"}
        </button>

        <button
          type="button"
          className="ang-icon-button"
          onClick={() => setDrawer("watchlist")}
          aria-label="Watchlist öffnen"
          title="Watchlist"
        >
          ★
        </button>

        <button type="button" className="cart-button" onClick={() => setDrawer("cart")}>
          Korb
          <span className="count">{cart.items.length}</span>
        </button>
      </header>

      <div className="scroll">
        <section className="masthead">
          <h1>
            Diese
            <em>Woche</em>
          </h1>
          <dl className="masthead-facts">
            <div className="fact">
              <dt>Kalenderwoche</dt>
              <dd>{week ? `KW ${week.week}` : "—"}</dd>
            </div>
            <div className="fact">
              <dt>Gültig bis</dt>
              <dd>{week ? week.until : "—"}</dd>
            </div>
            <div className="fact">
              <dt>Angebote</dt>
              <dd>{deals.length.toLocaleString("de-DE")}</dd>
            </div>
            <div className="fact">
              <dt>Läden</dt>
              <dd>{storeNames.length}</dd>
            </div>
            <div className="fact">
              <dt>Stand</dt>
              <dd>{relativeTime((data?.fetched_at ?? 0) / 1000)}</dd>
            </div>
          </dl>
        </section>

        {hits.length > 0 && (
          <section className="hits">
            <div className="hits-head">
              <h2>
                <span className="marker">Deine Treffer</span>
              </h2>
              <span className="meta">{hits.length} Angebote passen auf deine Watchlist</span>
            </div>
            <div className="grid">
              {hits.slice(0, 12).map((deal) => (
                <DealCard
                  key={deal.id}
                  deal={deal}
                  selected={cartIds.has(deal.id)}
                  history={history[deal.key]}
                  onToggle={toggleDeal}
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
              aria-pressed={category === "all"}
              onClick={() => setCategory("all")}
            >
              Alle <span className="count">{deals.length}</span>
            </button>
            {CATEGORIES.map((entry) => (
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
              onChange={(e) => setSort(e.target.value)}
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
              className="ang-icon-button"
              aria-pressed={layout === "list"}
              onClick={() => setLayout(layout === "grid" ? "list" : "grid")}
              aria-label="Zwischen Raster und Liste wechseln"
              title="Ansicht wechseln"
            >
              {layout === "grid" ? "☰" : "▦"}
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
          <h2>
            {category === "all"
              ? "Alle Angebote"
              : CATEGORIES.find((c) => c.key === category)?.label}
          </h2>
          <span className="meta">
            {filtered.length.toLocaleString("de-DE")} von {deals.length.toLocaleString("de-DE")}
          </span>
        </div>

        {loading ? (
          <div className="skeleton-grid">
            {Array.from({ length: 12 }, (_, index) => (
              <div className="skeleton" key={index} />
            ))}
          </div>
        ) : error ? (
          <div className="empty">
            <strong>Keine Verbindung</strong>
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <strong>Nichts gefunden</strong>
            Für diese Filter gibt es diese Woche keine Angebote.
          </div>
        ) : (
          <>
            <div className={`grid ${layout === "list" ? "list" : ""}`}>
              {filtered.slice(0, visible).map((deal) => (
                <DealCard
                  key={deal.id}
                  deal={deal}
                  selected={cartIds.has(deal.id)}
                  history={history[deal.key]}
                  onToggle={toggleDeal}
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
      </div>

      {drawer === "cart" && (
        <CartDrawer
          items={cart.items}
          total={cart.total}
          history={history}
          pushState={pushState}
          onRemove={cart.remove}
          onClear={cart.clear}
          onClose={() => setDrawer(null)}
          onEnablePush={turnOnPush}
        />
      )}

      {drawer === "watchlist" && (
        <WatchlistDrawer
          entries={watchlist.entries}
          plz={watchlist.plz}
          pushState={pushState}
          saving={watchlist.saving}
          signedIn={watchlist.signedIn}
          onSave={watchlist.setEntries}
          onClose={() => setDrawer(null)}
          onEnablePush={turnOnPush}
          onDisablePush={async () => setPushState(await disablePush())}
        />
      )}
    </div>
  );
}
