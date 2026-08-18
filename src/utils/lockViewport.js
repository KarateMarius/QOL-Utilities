// Verhindert, dass der Browser selbst zoomt oder scrollt. Der Rest wird per
// CSS erledigt (siehe body in base.css); hier steht nur, was CSS nicht kann.
//
// Hintergrund: iOS Safari ignoriert `user-scalable=no` im Viewport-Meta seit
// iOS 10 bewusst (Barrierefreiheit). Die Seiten-Pinch-Zoom laesst sich dort
// ausschliesslich abfangen, indem man die nicht standardisierten
// gesture*-Events unterdrueckt - andere Browser kennen diese Events gar nicht
// und ignorieren die Listener folgenlos.
//
// Absichtlich NICHT abgefangen: touchmove auf Dokumentebene. Das wuerde zwar
// auch jede Seitenbewegung stoppen, kann aber je nach Browser die eigenen
// Pointer-Events der Zeichenflaeche mit abwuergen - und genau die brauchen
// wir fuer Pinch und Verschieben des Grundrisses.
export function lockViewport() {
  const prevent = (e) => e.preventDefault();

  // passive: false ist zwingend, sonst darf preventDefault nichts ausrichten.
  const options = { passive: false };
  document.addEventListener("gesturestart", prevent, options);
  document.addEventListener("gesturechange", prevent, options);
  document.addEventListener("gestureend", prevent, options);

  return () => {
    document.removeEventListener("gesturestart", prevent, options);
    document.removeEventListener("gesturechange", prevent, options);
    document.removeEventListener("gestureend", prevent, options);
  };
}
