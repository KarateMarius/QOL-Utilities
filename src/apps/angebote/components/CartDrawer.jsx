import { Fragment, useMemo, useState } from "react";
import { IconCheck, IconClose } from "../../../icons.jsx";
import RezeptListe from "./RezeptListe.jsx";
import { CATEGORIES, NOT_AUTHENTICATED, ladenwegPlatz, sendCartPush } from "../lib/api.js";
import { formatDay, formatEuro, lowLabel, merchantStyle } from "../lib/format.js";

// Der Einkaufskorb, nach Laden gruppiert - so, wie man auch einkauft.
//
// Innerhalb eines Ladens steht die Liste in der Reihenfolge, in der man den
// Laden durchlaeuft (siehe LADENWEG in api.js): erst Obst und Gemuese, zuletzt
// die Getraenke. Vorher stand dort die Reihenfolge des Antippens - im Laden
// hiess das, zwischen Kuehltheke und Regal hin und her zu laufen.
//
// Die Kategorie steht als kleine Zwischenzeile dabei. Ohne sie waere die
// Reihenfolge zwar besser, aber unerklaerlich: man sieht nur, dass sie sich
// geaendert hat.
//
// Jeder Artikel laesst sich abhaken, sobald er im Wagen liegt. Abgehaktes
// bleibt stehen statt zu verschwinden: im Laden will man sehen, was man schon
// hat, nicht nur was noch fehlt.

/** Nach Ladenweg, innerhalb einer Kategorie alphabetisch. */
function nachLadenweg(a, b) {
  return (
    ladenwegPlatz(a.category) - ladenwegPlatz(b.category) ||
    (a.title || "").localeCompare(b.title || "", "de")
  );
}

function kategorieName(key) {
  return CATEGORIES.find((c) => c.key === key)?.label ?? null;
}

function asPlainText(items, done, total) {
  const groups = new Map();
  for (const item of items) {
    const list = groups.get(item.merchant) || [];
    list.push(item);
    groups.set(item.merchant, list);
  }

  const lines = ["Einkaufsliste"];
  for (const [merchant, deals] of [...groups].sort()) {
    lines.push("", merchant.toUpperCase());
    // Dieselbe Reihenfolge wie auf dem Schirm - eine ausgedruckte Liste, die
    // anders sortiert ist als die App, waere im Laden nur verwirrend.
    for (const deal of [...deals].sort(nachLadenweg)) {
      lines.push(`${done[deal.id] ? "[x]" : "[ ]"} ${deal.title} — ${formatEuro(deal.price)}`);
    }
  }
  lines.push("", `Summe: ${formatEuro(total)}`);
  return lines.join("\n");
}

export default function CartDrawer({
  items,
  done,
  total,
  openTotal,
  openCount,
  history,
  pushState,
  onToggleDone,
  onRemove,
  onAddEigenes,
  onClear,
  onResetDone,
  onClose,
  onEnablePush,
}) {
  const [status, setStatus] = useState({ text: "", kind: "" });
  const [eigeneZeile, setEigeneZeile] = useState("");
  const [sending, setSending] = useState(false);

  const groups = useMemo(() => {
    const map = new Map();
    for (const item of items) {
      const list = map.get(item.merchant) || [];
      list.push(item);
      map.set(item.merchant, list);
    }
    return [...map]
      .sort((a, b) => a[0].localeCompare(b[0], "de"))
      .map(([merchant, deals]) => [merchant, [...deals].sort(nachLadenweg)]);
  }, [items]);

  const erledigt = items.length - openCount;

  async function copy() {
    try {
      await navigator.clipboard.writeText(asPlainText(items, done, total));
      setStatus({ text: "Liste in die Zwischenablage kopiert.", kind: "ok" });
    } catch {
      setStatus({ text: "Kopieren hat nicht geklappt — der Browser blockiert den Zugriff.", kind: "error" });
    }
  }

  async function push() {
    setSending(true);
    setStatus({ text: "", kind: "" });
    try {
      // Aufs Handy geht, was noch fehlt - Abgehaktes braucht dort niemand.
      const offen = items.filter((item) => !done[item.id]);
      const result = await sendCartPush(
        offen.map((item) => ({ name: item.title, merchant: item.merchant, price: item.price }))
      );
      if (result === NOT_AUTHENTICATED) {
        setStatus({ text: "Dafür musst du angemeldet sein.", kind: "error" });
      } else if (result.error) {
        setStatus({ text: `Nicht gesendet: ${result.error}`, kind: "error" });
      } else {
        setStatus({
          text: `An ${result.sent} ${result.sent === 1 ? "Gerät" : "Geräte"} gesendet.`,
          kind: "ok",
        });
      }
    } catch (error) {
      setStatus({ text: `Nicht gesendet: ${error.message}`, kind: "error" });
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label="Einkaufskorb">
        <header className="drawer-head">
          <h2>Korb</h2>
          {items.length > 0 && (
            <button type="button" className="link-button" onClick={onClear}>
              Leeren
            </button>
          )}
          <button type="button" className="ang-icon-button" onClick={onClose} aria-label="Schließen">
            <IconClose />
          </button>
        </header>

        <div className="drawer-body">
          {items.length === 0 ? (
            <div className="empty">
              <strong>Noch nichts drin</strong>
              Tippe ein Angebot an, um es auf die Liste zu setzen.
            </div>
          ) : (
            <>
              {erledigt > 0 && (
                <p className="cart-progress">
                  {erledigt} von {items.length} eingesammelt
                  <button type="button" className="link-button" onClick={onResetDone}>
                    Haken zurücksetzen
                  </button>
                </p>
              )}

              {groups.map(([merchant, deals]) => {
                const offenImLaden = deals.filter((deal) => !done[deal.id]);
                return (
                  <section className="cart-group" key={merchant}>
                    <div className="cart-group-head">
                      <span className="merchant-tag" style={merchantStyle(merchant)}>
                        {merchant}
                      </span>
                      <span className="sum">
                        {offenImLaden.length ? `${offenImLaden.length} offen · ` : "fertig · "}
                        {formatEuro(deals.reduce((s, d) => s + d.price, 0))}
                      </span>
                    </div>

                    {deals.map((deal, index) => {
                      const neueKategorie = index === 0 || deals[index - 1].category !== deal.category;
                      const seen = history?.[deal.key];
                      const isLow = seen && seen.days > 2 && deal.price <= seen.low;
                      const abgehakt = Boolean(done[deal.id]);

                      return (
                        <Fragment key={deal.id}>
                        {neueKategorie && kategorieName(deal.category) && (
                          <p className="cart-category">{kategorieName(deal.category)}</p>
                        )}
                        <div className={`cart-item${abgehakt ? " cart-item--done" : ""}`}>
                          {/* Die ganze Zeile hakt ab - im Laden trifft man mit
                              dem Daumen keine 16 Pixel grosse Box. */}
                          <button
                            type="button"
                            className="cart-item__check"
                            onClick={() => onToggleDone(deal.id)}
                            aria-pressed={abgehakt}
                            aria-label={
                              abgehakt
                                ? `${deal.title} als nicht eingesammelt markieren`
                                : `${deal.title} als eingesammelt markieren`
                            }
                          >
                            <span className="cart-item__box" aria-hidden="true">
                              {abgehakt && <IconCheck />}
                            </span>
                            <span className="name">
                              {deal.title}
                              {deal.subtitle && <small>{deal.subtitle}</small>}
                              {seen && seen.days > 1 && (
                                <small
                                  className={
                                    isLow ? "cart-item__low cart-item__low--best" : "cart-item__low"
                                  }
                                >
                                  {isLow
                                    ? `Bestpreis · ${lowLabel(seen.days)}`
                                    : `${lowLabel(seen.days)}: ${formatEuro(seen.low)} am ${formatDay(seen.low_date)}`}
                                </small>
                              )}
                            </span>
                            <span className="amount">{formatEuro(deal.price)}</span>
                          </button>

                          <button
                            type="button"
                            className="remove"
                            onClick={() => onRemove(deal.id)}
                            aria-label={`${deal.title} entfernen`}
                          >
                            <IconClose />
                          </button>
                        </div>
                        </Fragment>
                      );
                    })}
                  </section>
                );
              })}
            </>
          )}
          {/* Auf die Liste gehoert auch, was nicht im Prospekt steht. Ohne
              dieses Feld war der Korb eine Angebotsliste, keine
              Einkaufsliste. */}
          <form
            className="eigene-zeile"
            onSubmit={(e) => {
              e.preventDefault();
              onAddEigenes(eigeneZeile);
              setEigeneZeile("");
            }}
          >
            <input
              value={eigeneZeile}
              onChange={(e) => setEigeneZeile(e.target.value)}
              placeholder="Eigene Zeile, z. B. Milch"
              aria-label="Eigene Zeile hinzufügen"
            />
            <button type="submit" className="button" disabled={!eigeneZeile.trim()}>
              Hinzufügen
            </button>
          </form>

          <RezeptListe onUebernehmen={(zutaten) => zutaten.forEach(onAddEigenes)} />
        </div>

        <footer className="drawer-foot">
          <dl className="total">
            <dt>{erledigt > 0 ? "Noch offen" : "Summe"}</dt>
            <dd>{formatEuro(erledigt > 0 ? openTotal : total)}</dd>
          </dl>
          {erledigt > 0 && <p className="total-note">Gesamt {formatEuro(total)}</p>}

          <div className="button-row">
            <button type="button" className="button" onClick={copy} disabled={!items.length}>
              Kopieren
            </button>
            <button type="button" className="button" onClick={() => window.print()} disabled={!items.length}>
              Drucken
            </button>
            {pushState === "on" ? (
              <button
                type="button"
                className="button primary"
                onClick={push}
                disabled={!openCount || sending}
              >
                {sending ? "Wird gesendet…" : "Aufs Handy"}
              </button>
            ) : (
              <button
                type="button"
                className="button primary"
                onClick={onEnablePush}
                disabled={pushState !== "off"}
                title={pushState === "anonymous" ? "Dafür musst du angemeldet sein" : undefined}
              >
                Push einschalten
              </button>
            )}
          </div>

          {status.text && <p className={`status ${status.kind}`}>{status.text}</p>}
        </footer>
      </aside>
    </>
  );
}
