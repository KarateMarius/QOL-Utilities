import { IconMinus, IconPlus } from "../../../../icons.jsx";
import IconButton from "../shared/IconButton.jsx";
import NumberField from "./NumberField.jsx";
import { TOOLS, FIXTURE_TYPES, FIXTURE_TOOLS } from "../../utils/constants.js";

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
