import { useCallback, useEffect, useRef, useState } from "react";
import { BASE_PX_PER_CM } from "../geometry/units.js";
import { ZOOM_MIN, ZOOM_MAX } from "../utils/constants.js";

// Zoom am Rad, proportional zur tatsaechlichen Bewegung.
//
// Vorher gab jedes Rad-Ereignis denselben Faktor 1,1 - gleich, ob es von
// einer Mausrastung (deltaY 100) oder von einem Trackpad kam, das beim
// Wischen dutzende Ereignisse mit deltaY 4 schickt. Gemessen: zehn kleine
// Trackpad-Schritte zoomten um den Faktor 2,6. Ueber die e-Funktion haengt
// der Faktor jetzt an der Strecke, und gleich grosse Strecken zoomen gleich
// viel, egal in wie vielen Ereignissen sie ankommen.
//
// RATE ist so gewaehlt, dass eine Mausrastung rund 10 % ergibt (e^0,1).
const WHEEL_RATE = 0.001;
// Ein einzelnes Ereignis darf den Zoom nicht verreissen; manche Maeuse
// schicken deltaY von mehreren hundert Pixeln auf einmal.
const WHEEL_STEP_MAX = 1.5;
// Firefox meldet Zeilen (deltaMode 1) statt Pixel, manche Browser Seiten (2).
const WHEEL_LINE_PX = 16;
const WHEEL_PAGE_PX = 400;

function wheelPixels(e) {
  if (e.deltaMode === 1) return e.deltaY * WHEEL_LINE_PX;
  if (e.deltaMode === 2) return e.deltaY * WHEEL_PAGE_PX;
  return e.deltaY;
}

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

  // Das Rad haengt als eigener Listener am Container, nicht als React-
  // Eigenschaft: React meldet wheel am Wurzelknoten passiv an, dort ist
  // preventDefault wirkungslos. Gemessen blieb defaultPrevented false - und
  // damit zoomte Strg+Rad zusaetzlich den ganzen Browser, statt nur den
  // Grundriss. Mit { passive: false } greift die Sperre wieder.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    function handleWheel(e) {
      e.preventDefault();
      const strecke = wheelPixels(e);
      const factor = Math.min(
        WHEEL_STEP_MAX,
        Math.max(1 / WHEEL_STEP_MAX, Math.exp(-strecke * WHEEL_RATE))
      );
      zoomAt(e.clientX, e.clientY, factor);
    }

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [containerRef, zoomAt]);

  // Zoomen ohne Rad - fuer die Schaltflaechen und die Tastatur. Bezugspunkt
  // ist die Mitte der Flaeche, denn einen Zeiger gibt es dabei nicht.
  const zoomBy = useCallback(
    (factor) => {
      const rect = getRect();
      if (!rect) return;
      zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
    },
    [getRect, zoomAt]
  );

  const resetView = useCallback(() => setTransform({ zoom: 1, panX: 0, panY: 0 }), []);

  // Passt einen Bereich in Plan-Koordinaten (cm) so in den Container ein, dass
  // er vollstaendig sichtbar und zentriert ist.
  //
  // Ohne das startet die Ansicht immer bei zoom 1 / pan 0,0 - Planpunkt (0,0)
  // liegt dann in der Bildschirmecke oben links. Ein Grundriss, der nicht
  // zufaellig am Ursprung beginnt, liegt damit ausserhalb des Sichtfelds; auf
  // einem schmalen Handydisplay sieht man schlicht nichts.
  const fitTo = useCallback(
    (boundsCm, paddingPx = 32) => {
      const rect = getRect();
      if (!rect || !boundsCm || rect.width === 0 || rect.height === 0) return false;

      const availableW = Math.max(1, rect.width - paddingPx * 2);
      const availableH = Math.max(1, rect.height - paddingPx * 2);
      // Ein Grundriss ohne Ausdehnung (eine einzelne Wand) darf die Division
      // nicht sprengen.
      const planW = Math.max(boundsCm.width, 1);
      const planH = Math.max(boundsCm.height, 1);

      const pxPerCmNeeded = Math.min(availableW / planW, availableH / planH);
      const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, pxPerCmNeeded / BASE_PX_PER_CM));
      const effectivePxPerCm = zoom * BASE_PX_PER_CM;

      const centerXcm = (boundsCm.minX + boundsCm.maxX) / 2;
      const centerYcm = (boundsCm.minY + boundsCm.maxY) / 2;
      setTransform({
        zoom,
        panX: rect.width / 2 - centerXcm * effectivePxPerCm,
        panY: rect.height / 2 - centerYcm * effectivePxPerCm,
      });
      return true;
    },
    [getRect]
  );

  // Ready-made bundle for "always pan on drag, pinch with two pointers to
  // zoom" — used by ViewCanvas. EditCanvas does NOT use this; it calls
  // panBy/zoomAt itself, gated on the spacebar, from its own drawing
  // pointer-state-machine so pan doesn't compete with wall drawing.
  const onPanZoomPointerDown = useCallback((e) => {
    // Ohne Pointer-Capture geht das pointerup verloren, sobald der Finger das
    // SVG verlaesst. Die Pointer-Map wird dann nie geleert und die Geste
    // haengt: die naechste Beruehrung verhaelt sich, als laege noch ein
    // Phantom-Finger auf dem Schirm.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* aeltere Browser ohne Pointer-Capture: Geste funktioniert weiterhin */
    }
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
    zoom: transform.zoom,
    pxPerCm: transform.zoom * BASE_PX_PER_CM,
    screenToPlan,
    panBy,
    zoomAt,
    zoomBy,
    resetView,
    fitTo,
    bindPointerPanZoom: {
      onPointerDown: onPanZoomPointerDown,
      onPointerMove: onPanZoomPointerMove,
      onPointerUp: endPanZoomPointer,
      onPointerCancel: endPanZoomPointer,
    },
  };
}
