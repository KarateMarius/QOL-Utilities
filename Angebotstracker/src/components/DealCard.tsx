import type { CSSProperties } from 'react';
import type { Deal } from '../lib/api';
import { formatBasePrice, formatDay, formatEuro, merchantStyle, priceParts } from '../lib/format';

interface Props {
  deal: Deal;
  selected: boolean;
  onToggle: (deal: Deal) => void;
}

/** The whole card is the button, so its children stay phrasing content. */
export function DealCard({ deal, selected, onToggle }: Props) {
  const [euro, cent] = priceParts(deal.price);
  const basePrice = formatBasePrice(deal);
  const brand = merchantStyle(deal.merchant);

  return (
    <button
      type="button"
      className="card"
      style={{ '--brand': brand.background } as CSSProperties}
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
      </span>

      <span className="card-body">
        <span className="card-title">{deal.title}</span>
        {deal.subtitle && <span className="card-sub">{deal.subtitle}</span>}
        {deal.note && <span className="card-note">{deal.note}</span>}
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

      <span className="card-check" aria-hidden="true">
        ✓
      </span>
    </button>
  );
}
