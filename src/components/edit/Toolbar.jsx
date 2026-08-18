import IconButton from "../shared/IconButton.jsx";
import { TOOLS } from "../../utils/constants.js";

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
  wallThicknessCm,
  onWallThicknessChange,
  wallThicknessLabel,
  showDimensions,
  onToggleDimensions,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}) {
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

      <div className="toolbar__group toolbar__group--history">
        <IconButton label="Rückgängig" icon="↶" onClick={onUndo} disabled={!canUndo} />
        <IconButton label="Wiederholen" icon="↷" onClick={onRedo} disabled={!canRedo} />
      </div>

      <div className="toolbar__group toolbar__fields">
        <label className="toolbar__field">
          Raster (cm)
          <input
            type="number"
            min={5}
            step={5}
            value={gridSizeCm}
            onChange={(e) => onGridSizeChange(Number(e.target.value) || gridSizeCm)}
          />
        </label>
        <label className="toolbar__field">
          {wallThicknessLabel}
          <input
            type="number"
            min={5}
            step={1}
            value={wallThicknessCm}
            onChange={(e) => onWallThicknessChange(Number(e.target.value) || wallThicknessCm)}
          />
        </label>
        <label className="toolbar__field toolbar__field--checkbox">
          <input type="checkbox" checked={showDimensions} onChange={(e) => onToggleDimensions(e.target.checked)} />
          Bemaßung anzeigen
        </label>
      </div>
    </div>
  );
}
