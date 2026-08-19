import { IconMinus, IconPlus } from "../../../../icons.jsx";
import IconButton from "../shared/IconButton.jsx";
import NumberField from "./NumberField.jsx";
import {
  TOOLS,
  FIXTURE_TYPES,
  FIXTURE_TOOLS,
  FURNITURE_TYPES,
  FURNITURE_TOOLS,
  furnitureTypeOfTool,
} from "../../utils/constants.js";
import { formatAreaM2 } from "../../geometry/units.js";

const TOOL_DEFS = [
  { tool: TOOLS.SELECT, label: "Auswählen", icon: "↖" },
  { tool: TOOLS.WALL, label: "Wand zeichnen", icon: "╱" },
  { tool: TOOLS.DOOR, label: "Tür setzen", icon: "◥" },
  { tool: TOOLS.WINDOW, label: "Fenster setzen", icon: "☐" },
  { tool: TOOLS.DELETE, label: "Löschen", icon: "✕" },
];

export default function Toolbar({
  tool,
  onToolChange,
  gridSizeCm,
  onGridSizeChange,
  selectedWall,
  onSelectedLengthChange,
  onSelectedThicknessChange,
  newWallThicknessCm,
  onNewWallThicknessChange,
  onApplyThicknessToAll,
  showDimensions,
  onToggleDimensions,
  onFitToPlan,
  zoom,
  onZoomIn,
  onZoomOut,
  hasWalls,
  selectedFurniture,
  onFurnitureChange,
  onFurnitureDelete,
  rooms = [],
  waendeOhneRaum = 0,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}) {
  const selectedLengthCm = selectedWall
    ? Math.round(Math.hypot(selectedWall.end.x - selectedWall.start.x, selectedWall.end.y - selectedWall.start.y) * 10) / 10
    : 0;

  return (
    <div className="toolbar">
      <div className="toolbar__group">
        {TOOL_DEFS.map((def) => (
          <IconButton
            key={def.tool}
            label={def.label}
            icon={def.icon}
            active={tool === def.tool}
            danger={def.tool === TOOLS.DELETE}
            onClick={() => onToolChange(def.tool)}
          />
        ))}
      </div>

      <div className="toolbar__group toolbar__group--fixtures">
        {FIXTURE_TOOLS.map((t) => (
          <IconButton
            key={t}
            label={FIXTURE_TYPES[t].label}
            icon={FIXTURE_TYPES[t].icon}
            active={tool === t}
            onClick={() => onToolChange(t)}
          />
        ))}
      </div>

      {/* Moebel: freistehende Rechtecke, anders als Installationen an keiner
          Wand. Antippen setzt sie, im Auswahlmodus lassen sie sich ziehen. */}
      <div className="toolbar__group toolbar__group--furniture">
        {FURNITURE_TOOLS.map((werkzeug) => (
          <IconButton
            key={werkzeug}
            label={FURNITURE_TYPES[furnitureTypeOfTool(werkzeug)].label}
            icon="▭"
            active={tool === werkzeug}
            onClick={() => onToolChange(werkzeug)}
          />
        ))}
      </div>

      <div className="toolbar__group toolbar__group--history">
        <IconButton label="Rückgängig" icon="↶" onClick={onUndo} disabled={!canUndo} />
        <IconButton label="Wiederholen" icon="↷" onClick={onRedo} disabled={!canRedo} />
      </div>

      <div className="toolbar__section">
        <div className="toolbar__section-title">Ausgewählte Wand</div>
        {selectedWall ? (
          <>
            <NumberField
              label="Länge (cm)"
              value={selectedLengthCm}
              min={1}
              step={5}
              onCommit={onSelectedLengthChange}
            />
            <NumberField
              label="Dicke (cm)"
              value={selectedWall.thicknessCm}
              min={1}
              step={1}
              onCommit={onSelectedThicknessChange}
            />
            <p className="toolbar__hint">
              Beim Ändern der Länge bleibt der Startpunkt fest; das andere Ende wandert. Angrenzende Wände bleiben
              verbunden und wandern mit.
            </p>
          </>
        ) : (
          <p className="toolbar__hint">
            Mit dem Werkzeug „Auswählen“ auf eine Wand klicken, um Länge und Dicke zu bearbeiten. Ziehen auf
            freier Fläche verschiebt den Plan.
          </p>
        )}
      </div>

      {selectedFurniture && (
        <div className="toolbar__section">
          <div className="toolbar__section-title">
            Ausgewählt: {FURNITURE_TYPES[selectedFurniture.type]?.label || "Möbel"}
          </div>
          <NumberField
            label="Breite (cm)"
            value={Math.round(selectedFurniture.widthCm)}
            min={10}
            step={5}
            onCommit={(widthCm) => onFurnitureChange({ widthCm })}
          />
          <NumberField
            label="Tiefe (cm)"
            value={Math.round(selectedFurniture.depthCm)}
            min={10}
            step={5}
            onCommit={(depthCm) => onFurnitureChange({ depthCm })}
          />
          <button
            type="button"
            className="toolbar__action"
            onClick={() =>
              onFurnitureChange({ rotationDeg: ((selectedFurniture.rotationDeg || 0) + 90) % 360 })
            }
          >
            Drehen (90°) — jetzt {selectedFurniture.rotationDeg || 0}°
          </button>
          <button type="button" className="toolbar__action" onClick={onFurnitureDelete}>
            Entfernen
          </button>
        </div>
      )}

      {/* Flaechen. Der haeufigste Grund, ueberhaupt einen Grundriss zu
          zeichnen - bisher stand die Zahl nur klein im Raum selbst und nirgends
          zusammengezaehlt. */}
      <div className="toolbar__section">
        <div className="toolbar__section-title">Flächen</div>
        {rooms.length === 0 ? (
          <p className="toolbar__hint">
            Noch keine geschlossene Fläche. Ein Raum entsteht, sobald die Wände ringsum an ihren
            Enden zusammenstoßen.
          </p>
        ) : (
          <>
            <ul className="toolbar__rooms">
              {rooms.map((raum) => (
                <li className="toolbar__room" key={raum.id}>
                  <span className="toolbar__room-name">{raum.name || "ohne Namen"}</span>
                  <span className="toolbar__room-area">{formatAreaM2(raum.areaM2)}</span>
                </li>
              ))}
            </ul>
            <p className="toolbar__room toolbar__room--sum">
              <span className="toolbar__room-name">Summe · {rooms.length} Räume</span>
              <span className="toolbar__room-area">
                {formatAreaM2(rooms.reduce((summe, raum) => summe + raum.areaM2, 0))}
              </span>
            </p>
          </>
        )}

        {/* Offene Bereiche werden benannt, nicht geschaetzt. Eine Flaeche mit
            fehlender Wand hat keine Groesse - sie zu erfinden waere eine
            Zahl, auf die sich niemand verlassen koennte. */}
        {waendeOhneRaum > 0 && (
          <p className="toolbar__hint toolbar__hint--warn">
            {waendeOhneRaum === 1 ? "Eine Wand gehört" : `${waendeOhneRaum} Wände gehören`} zu keiner
            geschlossenen Fläche — dort fehlt noch eine Verbindung. Solche Bereiche haben keine
            berechenbare Größe und fehlen deshalb in der Summe.
          </p>
        )}
      </div>

      <div className="toolbar__section">
        <div className="toolbar__section-title">Allgemein</div>
        {/* Zoomen ohne Rad. Am Trackpad ist das Rad ungenau, und ohne Maus
            gab es bisher ueberhaupt keinen Weg ausser "Ansicht zentrieren".
            Die Prozentzahl sagt zugleich, wo man gerade steht. */}
        <div className="toolbar__zoom">
          <button
            type="button"
            className="toolbar__zoom-button"
            onClick={onZoomOut}
            aria-label="Verkleinern"
            title="Verkleinern (−)"
          >
            <IconMinus />
          </button>
          <span className="toolbar__zoom-value">{Math.round(zoom * 100)} %</span>
          <button
            type="button"
            className="toolbar__zoom-button"
            onClick={onZoomIn}
            aria-label="Vergrößern"
            title="Vergrößern (+)"
          >
            <IconPlus />
          </button>
        </div>
        <button type="button" className="toolbar__action" onClick={onFitToPlan} disabled={!hasWalls}>
          Ansicht zentrieren
        </button>
        <NumberField label="Raster (cm)" value={gridSizeCm} min={5} step={5} onCommit={onGridSizeChange} />
        <NumberField
          label="Dicke neuer Wände (cm)"
          value={newWallThicknessCm}
          min={1}
          step={1}
          onCommit={onNewWallThicknessChange}
        />
        <button type="button" className="toolbar__action" onClick={onApplyThicknessToAll}>
          Dicke auf alle Wände anwenden
        </button>
        <label className="toolbar__field toolbar__field--checkbox">
          <input type="checkbox" checked={showDimensions} onChange={(e) => onToggleDimensions(e.target.checked)} />
          Bemaßung anzeigen
        </label>
      </div>
    </div>
  );
}
