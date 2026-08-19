import { Suspense, useCallback, useRef } from "react";

// Ein Fenster mit Titelleiste, Ziehen und Groessenaenderung.
//
// Ziehen laeuft ueber Pointer Capture: das Element, das den Zeiger einfaengt,
// bekommt auch alle folgenden Bewegungen - auch wenn der Zeiger das Fenster
// verlaesst. Deshalb haengen pointerdown/move/up am selben Element.
//
// Auf schmalen Bildschirmen gibt es kein Fenstermanagement: dort fuellt die
// aktive App den Bildschirm. Ein 380 Pixel breites Fenster zu verschieben ist
// kein Komfort, sondern eine Zumutung.

const TASKBAR_HEIGHT = 56;

export default function Window({
  app,
  win,
  active,
  compact,
  onFocus,
  onClose,
  onMinimize,
  onToggleMaximize,
  onMove,
  onResize,
}) {
  const drag = useRef(null);
  const maximized = win.maximized || compact;

  const beginDrag = useCallback(
    (event, mode) => {
      // Nur die primaere Taste zieht, und im Vollbild gibt es nichts zu ziehen.
      if (maximized || event.button !== 0) return;

      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current =
        mode === "move"
          ? { mode, pointerId: event.pointerId, offsetX: event.clientX - win.left, offsetY: event.clientY - win.top }
          : {
              mode,
              pointerId: event.pointerId,
              startX: event.clientX,
              startY: event.clientY,
              startWidth: win.width,
              startHeight: win.height,
            };
      onFocus();
    },
    [maximized, win.left, win.top, win.width, win.height, onFocus]
  );

  const handleMove = useCallback(
    (event) => {
      const state = drag.current;
      if (!state || state.pointerId !== event.pointerId) return;

      if (state.mode === "move") {
        // Die Titelleiste muss greifbar bleiben, sonst laesst sich das Fenster
        // nicht mehr zurueckholen.
        onMove({
          left: Math.max(
            -win.width + 120,
            Math.min(event.clientX - state.offsetX, window.innerWidth - 120)
          ),
          top: Math.max(
            0,
            Math.min(event.clientY - state.offsetY, window.innerHeight - TASKBAR_HEIGHT - 40)
          ),
        });
        return;
      }

      onResize({
        width: Math.max(app.minSize.width, state.startWidth + (event.clientX - state.startX)),
        height: Math.max(app.minSize.height, state.startHeight + (event.clientY - state.startY)),
      });
    },
    [app.minSize, win.width, onMove, onResize]
  );

  const endDrag = useCallback((event) => {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
  }, []);

  const dragProps = {
    onPointerMove: handleMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
  };

  const { Component, Icon } = app;

  return (
    <section
      className={`window${maximized ? " window--maximized" : ""}${active ? " window--active" : ""}`}
      style={{
        "--app-accent": app.accent,
        zIndex: win.z,
        ...(maximized
          ? null
          : { left: win.left, top: win.top, width: win.width, height: win.height }),
      }}
      hidden={win.minimized}
      onPointerDown={onFocus}
      aria-label={app.name}
    >
      <div
        className="window__bar"
        onPointerDown={(event) => beginDrag(event, "move")}
        onDoubleClick={compact ? undefined : onToggleMaximize}
        {...dragProps}
      >
        <span className="window__icon" aria-hidden="true">
          <Icon />
        </span>
        <h2 className="window__title">{app.name}</h2>

        <div className="window__actions">
          <button
            type="button"
            className="window__button"
            onClick={onMinimize}
            aria-label={`${app.name} minimieren`}
            title="Minimieren"
          >
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="M2.5 6h7" />
            </svg>
          </button>

          {!compact && (
            <button
              type="button"
              className="window__button"
              onClick={onToggleMaximize}
              aria-label={win.maximized ? `${app.name} verkleinern` : `${app.name} maximieren`}
              title={win.maximized ? "Verkleinern" : "Maximieren"}
            >
              <svg viewBox="0 0 12 12" aria-hidden="true">
                <rect x="2.5" y="2.5" width="7" height="7" />
              </svg>
            </button>
          )}

          <button
            type="button"
            className="window__button window__button--close"
            onClick={onClose}
            aria-label={`${app.name} schließen`}
            title="Schließen"
          >
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="M3 3l6 6M9 3l-6 6" />
            </svg>
          </button>
        </div>
      </div>

      <div className="window__body">
        <Suspense fallback={<p className="window__loading">{app.name} wird geladen…</p>}>
          <Component />
        </Suspense>
      </div>

      {!maximized && (
        <div
          className="window__resize"
          onPointerDown={(event) => beginDrag(event, "resize")}
          {...dragProps}
          role="presentation"
        />
      )}
    </section>
  );
}
