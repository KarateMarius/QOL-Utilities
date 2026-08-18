import { useRef, useState } from "react";
import { exportPlan } from "../../io/exportPlan.js";
import { importPlan } from "../../io/importPlan.js";

export default function FileControls({ floorPlan, onImport }) {
  const fileInputRef = useRef(null);
  const [error, setError] = useState(null);

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-importing the same filename later
    if (!file) return;
    try {
      const plan = await importPlan(file);
      onImport(plan);
      setError(null);
    } catch (err) {
      setError(err.message || "Import fehlgeschlagen.");
    }
  }

  return (
    <div className="file-controls">
      <button type="button" className="file-controls__button" onClick={() => exportPlan(floorPlan)}>
        Exportieren
      </button>
      <button type="button" className="file-controls__button" onClick={() => fileInputRef.current?.click()}>
        Importieren
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />
      {error && <div className="file-controls__error">{error}</div>}
    </div>
  );
}
