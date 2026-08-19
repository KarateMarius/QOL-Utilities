import { useCallback, useState } from "react";
import { getApp } from "./apps.jsx";

// Fensterverwaltung. Ein Fenster existiert nur, solange die App offen ist -
// Schliessen haengt es aus dem Baum aus und verwirft damit bewusst den
// Zustand, genau wie ein beendetes Programm. Minimieren laesst es montiert
// und nur unsichtbar, deshalb ueberlebt der Zustand das Wegklicken.

const CASCADE_STEP = 34;

function nextPosition(count, size) {
  const offset = (count % 6) * CASCADE_STEP;
  const maxLeft = Math.max(0, window.innerWidth - size.width - 40);
  const maxTop = Math.max(0, window.innerHeight - size.height - 90);
  return {
    left: Math.min(60 + offset, maxLeft),
    top: Math.min(48 + offset, maxTop),
  };
}

function fittedSize(app) {
  // Auf kleinen Bildschirmen ist die Wunschgroesse groesser als der Platz.
  return {
    width: Math.min(app.defaultSize.width, window.innerWidth - 48),
    height: Math.min(app.defaultSize.height, window.innerHeight - 120),
  };
}

export function useWindows() {
  const [windows, setWindows] = useState([]);
  const [topZ, setTopZ] = useState(1);

  const focus = useCallback((appId) => {
    setTopZ((z) => {
      const next = z + 1;
      setWindows((current) =>
        current.map((win) => (win.appId === appId ? { ...win, z: next, minimized: false } : win))
      );
      return next;
    });
  }, []);

  const open = useCallback(
    (appId) => {
      const app = getApp(appId);
      if (!app) return;

      setWindows((current) => {
        if (current.some((win) => win.appId === appId)) return current;

        const size = fittedSize(app);
        const nextWindow = {
          appId,
          ...size,
          ...nextPosition(current.length, size),
          minimized: false,
          maximized: false,
          z: topZ + 1,
        };
        return [...current, nextWindow];
      });
      setTopZ((z) => z + 1);
    },
    [topZ]
  );

  const close = useCallback((appId) => {
    setWindows((current) => current.filter((win) => win.appId !== appId));
  }, []);

  const minimize = useCallback((appId) => {
    setWindows((current) =>
      current.map((win) => (win.appId === appId ? { ...win, minimized: true } : win))
    );
  }, []);

  const toggleMaximize = useCallback((appId) => {
    setWindows((current) =>
      current.map((win) => (win.appId === appId ? { ...win, maximized: !win.maximized } : win))
    );
  }, []);

  const move = useCallback((appId, position) => {
    setWindows((current) =>
      current.map((win) => (win.appId === appId ? { ...win, ...position } : win))
    );
  }, []);

  const resize = useCallback((appId, size) => {
    setWindows((current) =>
      current.map((win) => (win.appId === appId ? { ...win, ...size } : win))
    );
  }, []);

  const toggle = useCallback(
    (appId) => {
      const existing = windows.find((win) => win.appId === appId);
      if (!existing) return open(appId);
      // Ein Klick auf die aktive App in der Taskleiste legt sie weg, ein Klick
      // auf eine andere holt sie nach vorn.
      const isTop = windows.every((win) => win.appId === appId || win.z < existing.z);
      if (isTop && !existing.minimized) return minimize(appId);
      return focus(appId);
    },
    [windows, open, minimize, focus]
  );

  const activeId = windows.reduce(
    (top, win) => (!win.minimized && (!top || win.z > top.z) ? win : top),
    null
  )?.appId ?? null;

  return { windows, activeId, open, close, minimize, toggleMaximize, move, resize, focus, toggle };
}
