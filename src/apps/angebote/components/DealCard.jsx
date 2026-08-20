import { IconCheck, IconExternal } from '../../../icons.jsx';
import {
  formatBasePrice,
  formatDay,
  formatEuro,
  lowLabel,
  merchantStyle,
  notizArt,
  priceParts,
} from '../lib/format.js';

// Die ganze Karte ist der Knopf. Deshalb sind alle Kinder <span> und kein
// <div> oder <h3>: in einem <button> ist nur Phrasing Content erlaubt. Der
// Link zum Shop steht deshalb daneben statt darin - ein <a> im <button> waere
// ungueltig und in der Bedienung mehrdeutig.
export default function DealCard({ deal, selected, history, onToggle }) {
  const [euro, cent] = priceParts(deal.price);
  const basePrice = formatBasePrice(deal);
  const brand = merchantStyle(deal.merchant);
  // Bedingungen bekommen Farbe, blosse Mengenangaben nicht.
  const art = notizArt(deal.note);

  // Bestpreis nur behaupten, wenn lange genug beobachtet wurde.
  const isLow = history && history.days > 2 && deal.price <= history.low;

  return (
    <span className="card-wrap">
      <button
        type="button"
        className="card"
        style={{ '--brand': brand.background }}
        aria-pressed={selected}
        onClick={() => onToggle(deal)}
      >
        <span className="card-media">
          {deal.image_url ? (
            <img src={deal.image_url} alt="" loading="lazy" decoding="async" />
          ) : null}
          <span className="merchant" style={brand}>
            {deal.merchant}
          </span>
          {deal.discount_pct > 0 && <span className="badge-discount">−{deal.discount_pct}%</span>}

          {/* Sitzt in der Bildecke, nicht frei ueber der Karte: dort ist der
              Platz unabhaengig davon frei, ob die Karte eine Verlaufszeile
              traegt oder nicht. */}
          <span className="card-check" aria-hidden="true">
            <IconCheck />
          </span>
        </span>

        <span className="card-body">
          <span className="card-title">{deal.title}</span>
          {deal.subtitle && <span className="card-sub">{deal.subtitle}</span>}
          {deal.note && (
            <span className={`card-note${art ? ` card-note--${art}` : ""}`}>
              {art === "app" && <span className="card-note__marke">nur mit App</span>}
              {art === "menge" && <span className="card-note__marke">Bedingung</span>}
              <span className="card-note__text">{deal.note}</span>
            </span>
          )}
        </span>

        <span className="card-foot">
          <span className="price">
            {deal.price_range && <span className="prefix">ab</span>}
            <span className="euro">{euro}</span>
            <span className="cent">{cent}</span>
            <span className="currency">€</span>
          </span>
          <span className="price-meta">
            {deal.old_price > deal.price && (
              <span className="price-old">{formatEuro(deal.old_price)}</span>
            )}
            {basePrice && <span className="line">{basePrice}</span>}
            {deal.valid_until && <span className="line">bis {formatDay(deal.valid_until)}</span>}
          </span>
        </span>

        {history && (
          <span className={`card-history${isLow ? ' card-history--low' : ''}`}>
            <span className="card-history__label">{lowLabel(history.days)}</span>
            {history.days > 1 && (
              <span className="card-history__value">
                {isLow ? 'Bestpreis' : `${formatEuro(history.low)} am ${formatDay(history.low_date)}`}
              </span>
            )}
          </span>
        )}
      </button>

      {deal.url && (
        <a className="card-link" href={deal.url} target="_blank" rel="noopener noreferrer">
          Im Shop ansehen
          <IconExternal />
        </a>
      )}
    </span>
  );
}
