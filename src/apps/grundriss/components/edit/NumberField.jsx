import { useEffect, useState } from "react";

// Numeric input that commits on blur/Enter instead of on every keystroke.
//
// Per-keystroke commits are wrong for these fields for two reasons: typing
// "150" into a length field would briefly apply 1 then 15 (yanking the
// geometry around mid-type), and each intermediate value would land in the
// undo history as its own step. Escape reverts to the committed value.
export default function NumberField({ label, value, min, step = 1, onCommit, disabled = false }) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  function commit() {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed) || (min !== undefined && parsed < min)) {
      setDraft(String(value)); // reject invalid input, restore last good value
      return;
    }
    if (parsed !== value) onCommit(parsed);
  }

  return (
    <label className="toolbar__field">
      {label}
      <input
        type="number"
        min={min}
        step={step}
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setDraft(String(value));
            e.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}
