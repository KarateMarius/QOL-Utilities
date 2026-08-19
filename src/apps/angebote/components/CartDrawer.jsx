import { useMemo, useState } from "react";
import { NOT_AUTHENTICATED, sendCartPush } from "../lib/api.js";
import { formatEuro, merchantStyle } from "../lib/format.js";

// Der Einkaufskorb, nach Laden gruppiert - so, wie man auch einkauft.

function asPlainText(items, total) {
  const groups = new Map();
  for (const item of items) {
    const list = groups.get(item.merchant) || [];
    list.push(item);
    groups.set(item.merchant, list);
  }

  const lines = ["Einkaufsliste"];
  for (const [merchant, deals] of [...groups].sort()) {
    lines.push("", merchant.toUpperCase());
    for (const deal of deals) lines.push(`- ${deal.title} — ${formatEuro(deal.price)}`);
  }
  lines.push("", `Summe: ${formatEuro(total)}`);
  return lines.join("\n");
}

export default function CartDrawer({
  items,
  total,
  pushState,
  onRemove,
  onClear,
  onClose,
  onEnablePush,
}) {
  const [status, setStatus] = useState({ text: "", kind: "" });
  const [sending, setSending] = useState(false);

  const groups = useMemo(() => {
    const map = new Map();
    for (const item of items) {
      const list = map.get(item.merchant) || [];
      list.push(item);
      map.set(item.merchant, list);
    }
    return [...map].sort((a, b) => a[0].localeCompare(b[0], "de"));
  }, [items]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(asPlainText(items, total));
      setStatus({ text: "Liste in die Zwischenablage kopiert.", kind: "ok" });
    } catch {
      setStatus({ text: "Kopieren hat nicht geklappt — der Browser blockiert den Zugriff.", kind: "error" });
    }
  }

  async function push() {
    setSending(true);
    setStatus({ text: "", kind: "" });
    try {
      const result = await sendCartPush(
        items.map((item) => ({ name: item.title, merchant: item.merchant, price: item.price }))
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
            ✕
          </button>
        </header>

        <div className="drawer-body">
          {items.length === 0 ? (
            <div className="empty">
              <strong>Noch nichts drin</strong>
              Tippe ein Angebot an, um es auf die Liste zu setzen.
            </div>
          ) : (
            groups.map(([merchant, deals]) => (
              <section className="cart-group" key={merchant}>
                <div className="cart-group-head">
                  <span className="merchant-tag" style={merchantStyle(merchant)}>
                    {merchant}
                  </span>
                  <span className="sum">
                    {deals.length} · {formatEuro(deals.reduce((s, d) => s + d.price, 0))}
                  </span>
                </div>
                {deals.map((deal) => (
                  <div className="cart-item" key={deal.id}>
                    <span className="name">
                      {deal.title}
                      {deal.subtitle && <small>{deal.subtitle}</small>}
                    </span>
                    <span className="amount">{formatEuro(deal.price)}</span>
                    <button
                      type="button"
                      className="remove"
                      onClick={() => onRemove(deal.id)}
                      aria-label={`${deal.title} entfernen`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </section>
            ))
          )}
        </div>

        <footer className="drawer-foot">
          <dl className="total">
            <dt>Summe</dt>
            <dd>{formatEuro(total)}</dd>
          </dl>

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
                disabled={!items.length || sending}
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
