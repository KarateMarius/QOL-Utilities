import { useCallback, useRef, useState } from "react";
import { BASE_PX_PER_CM } from "../geometry/units.js";
import { ZOOM_MIN, ZOOM_MAX } from "../utils/constants.js";

function distanceOf(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function midOf(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// Shared zoom/pan transform state for both canvases. Exposes low-level
// primitives (panBy/zoomAt/screenToPlan) that EditCanvas composes with its
// own drawing pointer-state-machine (pan only while space is held), plus a
// ready-made `bindPointerPanZoom` handler bundle that ViewCanvas uses
// directly (view mode has no competing drawing gesture, so pointer1 = pan,
// pointer2 = pinch-zoom can own the whole pointer lifecycle there).
export function useZoomPan(containerRef) {
  const [transform, setTransform] = useState({ zoom: 1, panX: 0, panY: 0 });
  const pointers = useRef(new Map());
  const gesture = useRef(null);

  const getRect = useCallback(() => containerRef.current?.getBoundingClientRect(), [containerRef]);

  const screenToPlan = useCallback(
    (clientX, clientY) => {
      const rect = getRect();
      const x = clientX - (rect?.left ?? 0);
      const y = clientY - (rect?.top ?? 0);
      const pxPerCm = transform.zoom * BASE_PX_PER_CM;
      return { x: (x - transform.panX) / pxPerCm, y: (y - transform.panY) / pxPerCm };
    },
    [transform, getRect]
  );

  const panBy = useCallback((dx, dy) => {
    setTransform((t) => ({ ...t, panX: t.panX + dx, panY: t.panY + dy }));
  }, []);

  const zoomAt = useCallback(
    (clientX, clientY, factor) => {
      const rect = getRect();
      const x = clientX - (rect?.left ?? 0);
      const y = clientY - (rect?.top ?? 0);
      setTransform((t) => {
        const nextZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, t.zoom * factor));
        const actualFactor = nextZoom / t.zoom;
        return {
          zoom: nextZoom,
          panX: x - (x - t.panX) * actualFactor,
          panY: y - (y - t.panY) * actualFactor,
        };
      });
    },
    [getRect]
  );

  const onWheel = useCallback(
    (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      zoomAt(e.clientX, e.clientY, factor);
    },
    [zoomAt]
  );

  const resetView = useCallback(() => setTransform({ zoom: 1, panX: 0, panY: 0 }), []);

  // Ready-made bundle for "always pan on drag, pinch with two pointers to
  // zoom" — used by ViewCanvas. EditCanvas does NOT use this; it calls
  // panBy/zoomAt itself, gated on the spacebar, from its own drawing
  // pointer-state-machine so pan doesn't compete with wall drawing.
  const onPanZoomPointerDown = useCallback((e) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      gesture.current = { mode: "pan", lastX: e.clientX, lastY: e.clientY };
    } else if (pointers.current.size === 2) {
      const pts = [...pointers.current.values()];
      gesture.current = { mode: "pinch", lastDist: distanceOf(pts[0], pts[1]), lastMid: midOf(pts[0], pts[1]) };
    }
  }, []);

  const onPanZoomPointerMove = useCallback(
    (e) => {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (!gesture.current) return;

      if (gesture.current.mode === "pan") {
        const dx = e.clientX - gesture.current.lastX;
        const dy = e.clientY - gesture.current.lastY;
        gesture.current.lastX = e.clientX;
        gesture.current.lastY = e.clientY;
        panBy(dx, dy);
      } else if (gesture.current.mode === "pinch") {
        const pts = [...pointers.current.values()];
        if (pts.length < 2) return;
        const dist = distanceOf(pts[0], pts[1]);
        const mid = midOf(pts[0], pts[1]);
        if (gesture.current.lastDist > 0) {
          zoomAt(mid.x, mid.y, dist / gesture.current.lastDist);
        }
        panBy(mid.x - gesture.current.lastMid.x, mid.y - gesture.current.lastMid.y);
        gesture.current.lastDist = dist;
        gesture.current.lastMid = mid;
      }
    },
    [panBy, zoomAt]
  );

  const endPanZoomPointer = useCallback((e) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      gesture.current = null;
    } else if (pointers.current.size === 1) {
      const [p] = [...pointers.current.values()];
      gesture.current = { mode: "pan", lastX: p.x, lastY: p.y };
    }
  }, []);

  return {
    transform,
    pxPerCm: transform.zoom * BASE_PX_PER_CM,
    screenToPlan,
    panBy,
    zoomAt,
    onWheel,
    resetView,
    bindPointerPanZoom: {
      onPointerDown: onPanZoomPointerDown,
      onPointerMove: onPanZoomPointerMove,
      onPointerUp: endPanZoomPointer,
      onPointerCancel: endPanZoomPointer,
    },
  };
}
