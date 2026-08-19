import { MODES } from "../../utils/constants.js";

export default function ModeSwitch({ mode, onChange }) {
  return (
    <div className="mode-switch" role="tablist" aria-label="Modus">
      <button
        type="button"
        role="tab"
        aria-selected={mode === MODES.EDIT}
        className={`mode-switch__option ${mode === MODES.EDIT ? "mode-switch__option--active" : ""}`}
        onClick={() => onChange(MODES.EDIT)}
      >
        Editieren
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === MODES.VIEW}
        className={`mode-switch__option ${mode === MODES.VIEW ? "mode-switch__option--active" : ""}`}
        onClick={() => onChange(MODES.VIEW)}
      >
        Ansehen
      </button>
    </div>
  );
}
