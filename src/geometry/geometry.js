// Pure vector/segment math. All coordinates are plain {x, y} objects in
// plan-space centimeters unless noted otherwise.

export function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function pointsEqual(a, b, epsilon = 0.01) {
  return Math.abs(a.x - b.x) < epsilon && Math.abs(a.y - b.y) < epsilon;
}

export function angleOf(from, to) {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

export function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// Closest point on segment [a,b] to point p, plus the distance and the
// normalized projection t (0 = at a, 1 = at b, clamped to [0,1]).
export function closestPointOnSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) {
    return { point: { ...a }, t: 0, distance: distance(p, a) };
  }
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  const point = { x: a.x + t * dx, y: a.y + t * dy };
  return { point, t, distance: distance(p, point) };
}

export function distanceToSegment(p, a, b) {
  return closestPointOnSegment(p, a, b).distance;
}

// Shoelace formula. Returns a signed area (positive = counter-clockwise in
// a math-style y-up frame; sign flips in screen/SVG's y-down frame — callers
// should not assume a sign, only use it for winding-direction comparisons).
export function shoelaceSignedAreaCm2(polygon) {
  let sum = 0;
  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % polygon.length];
    sum += p1.x * p2.y - p2.x * p1.y;
  }
  return sum / 2;
}

export function shoelaceAreaCm2(polygon) {
  return Math.abs(shoelaceSignedAreaCm2(polygon));
}

export function polygonCentroid(polygon) {
  let cx = 0;
  let cy = 0;
  let signedArea = 0;
  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % polygon.length];
    const cross = p1.x * p2.y - p2.x * p1.y;
    signedArea += cross;
    cx += (p1.x + p2.x) * cross;
    cy += (p1.y + p2.y) * cross;
  }
  signedArea /= 2;
  if (signedArea === 0) {
    // Degenerate polygon (zero area) — fall back to a plain average.
    const n = polygon.length || 1;
    const sum = polygon.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: sum.x / n, y: sum.y / n };
  }
  return { x: cx / (6 * signedArea), y: cy / (6 * signedArea) };
}
