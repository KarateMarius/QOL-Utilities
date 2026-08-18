// Grid rendered as a repeating SVG pattern anchored to plan-space origin so
// it stays aligned under the wall/room layers regardless of pan/zoom. All
// layers in EditCanvas convert cm -> px via the same `pxPerCm` (which
// already bakes in the current zoom level, see useZoomPan) instead of using
// an SVG-native scale() transform, so the pattern cell size must be
// computed from `pxPerCm` too, not a fixed base — otherwise the grid would
// stop matching the wall/room geometry as soon as the user zooms.
export default function GridBackground({ gridSizeCm, pxPerCm, viewportBoundsPx }) {
  const cellPx = gridSizeCm * pxPerCm;
  const majorEvery = 4; // every 4 cells (1m at the 25cm default) gets a heavier line
  const { minX, minY, width, height } = viewportBoundsPx;

  return (
    <>
      <defs>
        <pattern id="grid-minor" width={cellPx} height={cellPx} patternUnits="userSpaceOnUse">
          <path d={`M ${cellPx} 0 L 0 0 0 ${cellPx}`} fill="none" stroke="var(--color-grid-minor)" strokeWidth={1} />
        </pattern>
        <pattern
          id="grid-major"
          width={cellPx * majorEvery}
          height={cellPx * majorEvery}
          patternUnits="userSpaceOnUse"
        >
          <rect width={cellPx * majorEvery} height={cellPx * majorEvery} fill="url(#grid-minor)" />
          <path
            d={`M ${cellPx * majorEvery} 0 L 0 0 0 ${cellPx * majorEvery}`}
            fill="none"
            stroke="var(--color-grid-major)"
            strokeWidth={1}
          />
        </pattern>
      </defs>
      <rect x={minX} y={minY} width={width} height={height} fill="url(#grid-major)" />
    </>
  );
}

export function ScaleBar({ pxPerCm }) {
  const targetPx = 120; // aim for a readable ~120px bar, pick a round cm length near it
  const roundSteps = [10, 25, 50, 100, 200, 500, 1000];
  const cmForTarget = targetPx / pxPerCm;
  const barCm = roundSteps.reduce((best, step) => (Math.abs(step - cmForTarget) < Math.abs(best - cmForTarget) ? step : best));
  const barPx = barCm * pxPerCm;
  const label = barCm >= 100 ? `${barCm / 100} m` : `${barCm} cm`;

  return (
    <div className="scale-bar" aria-label={`Maßstab: ${label}`}>
      <div className="scale-bar__bar" style={{ width: `${barPx}px` }} />
      <span className="scale-bar__label">{label}</span>
    </div>
  );
}
