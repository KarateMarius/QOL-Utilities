import { useEffect, useMemo, useState } from "react";
import { CATEGORIES } from "./lib/api.js";
import {
  dominantValidUntil,
  formatDay,
  isoWeek,
  merchantStyle,
  relativeTime,
} from "./lib/format.js";
import { currentState, disablePush, enablePush } from "../../push.js";
import { useDeals } from "./hooks/useDeals.js";
import { useWatchlist } from "./hooks/useWatchlist.js";
import { useCart } from "./hooks/useCart.js";
import { useHistory } from "./hooks/useHistory.js";
import { useOftGekauft, wortAusKey } from "./hooks/useOftGekauft.js";
import { useWochenzahl } from "./hooks/useWochenzahl.js";
import { IconGrid, IconList, IconRefresh, IconSearch } from "../../icons.jsx";
import DealCard from "./components/DealCard.jsx";
import CartDrawer from "./components/CartDrawer.jsx";
import WatchlistDrawer from "./components/WatchlistDrawer.jsx";
import "./styles.css";

const PAGE_SIZE = 60;
// Gewaehlte Laeden ueberdauern den Besuch: wer nie zu Norma faehrt, hat sie
// sonst jede Woche neu weggeklickt.
const LAEDEN_KEY = "angebote_laeden_v1";

function gemerkteLaeden() {
  try {
    const gelesen = JSON.parse(localStorage.getItem(LAEDEN_KEY) || "[]");
    return Array.isArray(gelesen) ? gelesen.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

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
  const oftGekauft = useOftGekauft();

  const [plzDraft, setPlzDraft] = useState(watchlist.plz);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [merchants, setMerchants] = useState(gemerkteLaeden);
  const [sort, setSort] = useState("default");
  const [layout, setLayout] = useState("grid");
  const [visible, setVisible] = useState(PAGE_SIZE);
  // ?panel=cart bzw. ?panel=watchlist oeffnet die Schublade direkt - praktisch
  // fuer ein Lesezeichen "Einkaufsliste" auf dem Startbildschirm.
  const [drawer, setDrawer] = useState(() => {
    const panel = new URLSearchParams(window.location.search).get("panel");
    return panel === "cart" || panel === "watchlist" ? panel : null;
  });
  const [pushState, setPushState] = useState("off");
  // Nur fuers Handy: dort stehen Sortierung und Ladenfilter hinter einem
  // Umschalter, weil sie sonst zwei von drei Zeilen des Filterblocks belegen
  // und die Angebote aus dem Bild schieben. Am Rechner ist alles sichtbar,
  // dieser Zustand aendert dort nichts.
  const [filterOffen, setFilterOffen] = useState(false);
  // Ebenfalls nur fuers Handy: dort steht der Filterblock in einer einzigen
  // Zeile, und das Suchfeld klappt erst auf, wenn man es ruft. Ausgeklappt
  // behaelt es seinen Inhalt, weil der Suchbegriff hier oben liegt.
  const [sucheOffen, setSucheOffen] = useState(false);

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

  useEffect(() => {
    localStorage.setItem(LAEDEN_KEY, JSON.stringify(merchants));
  }, [merchants]);

  const deals = data?.deals ?? [];
  const hits = data?.hits ?? [];

  const storeNames = useMemo(
    () => [...new Set(deals.map((deal) => deal.merchant))].sort((a, b) => a.localeCompare(b, "de")),
    [deals]
  );

  // Ein gemerkter Laden, den es an dieser PLZ nicht gibt, wuerde als Filter
  // stumm alles wegschneiden - bis hin zu einer leeren Seite, wenn keiner der
  // gemerkten Laeden hier liefert. Deshalb einmal abgleichen, sobald Prospekte
  // da sind.
  useEffect(() => {
    if (!storeNames.length) return;
    setMerchants((current) => {
      const bereinigt = current.filter((laden) => storeNames.includes(laden));
      return bereinigt.length === current.length ? current : bereinigt;
    });
  }, [storeNames]);

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
      // `name` schickt der Server nicht mehr mit - er ist Titel + Untertitel.
      if (needle && !`${deal.title} ${deal.subtitle}`.toLowerCase().includes(needle)) return false;
      return true;
    });
    return sortDeals(result, sort);
  }, [deals, category, merchants, search, sort]);

  const week = useMemo(() => {
    const until = dominantValidUntil(deals);
    if (!until) return null;
    const datum = new Date(until);
    return { week: isoWeek(datum), jahr: datum.getFullYear(), until: formatDay(until) };
  }, [deals]);

  const vergleich = useWochenzahl(watchlist.plz, week?.week ?? null, week?.jahr ?? null, deals.length);

  // Was der Umschalter verbirgt, wenn er zu ist.
  const gesetzteFilter = merchants.length + (sort === "default" ? 0 : 1);

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

  // Vorschlaege fuer die Watchlist: was mindestens zweimal im Korb lag und
  // noch von keinem Suchwort abgedeckt ist. Als Suchwort dient der
  // normalisierte Name aus dem Schluessel - genau das, wonach der taegliche
  // Scan ohnehin sucht.
  const vorschlaege = useMemo(() => {
    const vorhanden = watchlist.entries.map((e) => e.keyword.toLowerCase());
    return Object.entries(oftGekauft.zaehler)
      .filter(([, wert]) => wert.anzahl >= 2)
      .map(([key, wert]) => ({ wort: wortAusKey(key), anzahl: wert.anzahl, titel: wert.titel }))
      // Schluessel aus Shops tragen eine Varianten-Nummer statt eines Namens;
      // als Suchwort waere die wertlos.
      .filter((v) => /[a-zäöüß]{3,}/i.test(v.wort))
      .filter((v) => !vorhanden.some((k) => v.wort.includes(k) || k.includes(v.wort)))
      .sort((a, b) => b.anzahl - a.anzahl)
      .slice(0, 5);
  }, [oftGekauft.zaehler, watchlist.entries]);

  function toggleDeal(deal) {
    if (!cartIds.has(deal.id)) {
      noteAdded(deal);
      oftGekauft.merken(deal);
    }
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
          <IconRefresh />
        </button>

        {/* Frueher stand hier nur ein Stern - den hat niemand als Schaltflaeche
            erkannt. Jetzt ein beschrifteter Reiter wie der Korb, mit der Zahl
            der Treffer. */}
        <button
          type="button"
          className="tab-button"
          onClick={() => setDrawer("watchlist")}
          aria-label="Watchlist öffnen"
        >
          Watchlist
          {hits.length > 0 && <span className="count count--muted">{hits.length}</span>}
        </button>

        <button
          type="button"
          className="tab-button tab-button--strong"
          onClick={() => setDrawer("cart")}
          aria-label="Einkaufskorb öffnen"
        >
          Korb
          <span className="count">{cart.openCount || cart.items.length}</span>
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
              <dd>
                {deals.length.toLocaleString("de-DE")}
                {vergleich && vergleich.differenz !== 0 && (
                  <span
                    className={`fact-delta${vergleich.differenz > 0 ? " fact-delta--mehr" : ""}`}
                    title={`${Math.abs(vergleich.differenz)} ${
                      vergleich.differenz > 0 ? "mehr" : "weniger"
                    } als in KW ${vergleich.vergleichsWoche} (${vergleich.vergleichsAnzahl})`}
                  >
                    {vergleich.differenz > 0 ? "+" : "−"}
                    {Math.abs(vergleich.differenz)}
                  </span>
                )}
              </dd>
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

        <div
          className={`controls${filterOffen ? " controls--offen" : ""}${
            sucheOffen || search ? " controls--suche" : ""
          }`}
        >
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
              <IconSearch />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Angebote durchsuchen"
                aria-label="Angebote durchsuchen"
              />
            </div>

            {/* Auf schmalen Bildschirmen steht statt des Feldes erst einmal
                nur die Lupe - das Feld allein kostete dort eine ganze Zeile. */}
            <button
              type="button"
              className="suche-toggle"
              aria-pressed={sucheOffen || Boolean(search)}
              aria-label="Suche ein- oder ausblenden"
              onClick={() => {
                if (sucheOffen || search) {
                  setSearch("");
                  setSucheOffen(false);
                } else {
                  setSucheOffen(true);
                }
              }}
            >
              <IconSearch />
            </button>

            {/* Steht nur auf schmalen Bildschirmen; das CSS blendet ihn
                sonst aus. Die Zahl sagt, wie viel gerade eingestellt ist -
                sonst waere ein aktiver Filter hinter dem Knopf unsichtbar. */}
            <button
              type="button"
              className="filter-toggle"
              aria-expanded={filterOffen}
              aria-controls="ang-ladenfilter"
              onClick={() => setFilterOffen((offen) => !offen)}
            >
              Filter
              {gesetzteFilter > 0 && <span className="count">{gesetzteFilter}</span>}
            </button>

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
              {layout === "grid" ? <IconList /> : <IconGrid />}
            </button>
          </div>

          <div className="control-row tabs" id="ang-ladenfilter">
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
          done={cart.done}
          total={cart.total}
          openTotal={cart.openTotal}
          openCount={cart.openCount}
          history={history}
          pushState={pushState}
          onToggleDone={cart.toggleDone}
          onRemove={cart.remove}
          onAddEigenes={cart.addEigenes}
          onClear={cart.clear}
          onResetDone={cart.resetDone}
          onClose={() => setDrawer(null)}
          onEnablePush={turnOnPush}
        />
      )}

      {drawer === "watchlist" && (
        <WatchlistDrawer
          entries={watchlist.entries}
          vorschlaege={vorschlaege}
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
