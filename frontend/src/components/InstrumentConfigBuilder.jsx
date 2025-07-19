import React, { useState } from "react";

export default function InstrumentConfigBuilder({ onSave }) {
  const [configName, setConfigName] = useState("");
  const [filters, setFilters] = useState([]);
  const [manualName, setManualName] = useState("");
  const [manualCenter, setManualCenter] = useState("");
  const [manualWidth, setManualWidth] = useState("");
  const [error, setError] = useState("");

  function handleAddFilter() {
    if (!manualName || isNaN(+manualCenter) || isNaN(+manualWidth)) {
      setError("Please provide valid filter name, center, and width.");
      return;
    }
    setFilters([
      ...filters,
      {
        name: manualName,
        profile: Array.from({ length: 61 }, (_, i) => [
          +manualCenter - 30 + i,
          i > 30 - manualWidth / 2 && i < 30 + manualWidth / 2 ? 100 : 0
        ])
      }
    ]);
    setManualName("");
    setManualCenter("");
    setManualWidth("");
    setError("");
  }

  function handleRemoveFilter(idx) {
    setFilters(filters.filter((_, i) => i !== idx));
  }

  function handleSave() {
    if (!configName.trim()) {
      setError("Please provide a unique configuration name.");
      return;
    }
    if (filters.length === 0) {
      setError("Add at least one filter to the configuration.");
      return;
    }
    setError("");
    onSave && onSave({ name: configName.trim(), filters });
    setConfigName("");
    setFilters([]);
  }

  return (
    <div style={{ border: "1px solid #888", borderRadius: 8, padding: 16, margin: 16 }}>
      <h2>Build Instrument Configuration</h2>
      <div style={{ marginBottom: 8 }}>
        <label>
          Configuration Name:
          <input
            value={configName}
            onChange={e => setConfigName(e.target.value)}
            placeholder="Unique name"
            style={{ marginLeft: 8 }}
          />
        </label>
      </div>
      <div style={{ marginBottom: 8 }}>
        <b>Add Manual Filter:</b>
        <input
          placeholder="Filter name"
          value={manualName}
          onChange={e => setManualName(e.target.value)}
          style={{ marginLeft: 8, width: 110 }}
        />
        <input
          placeholder="Center nm"
          value={manualCenter}
          onChange={e => setManualCenter(e.target.value)}
          style={{ marginLeft: 8, width: 70 }}
        />
        <input
          placeholder="Bandwidth"
          value={manualWidth}
          onChange={e => setManualWidth(e.target.value)}
          style={{ marginLeft: 8, width: 70 }}
        />
        <button style={{ marginLeft: 8 }} onClick={handleAddFilter}>Add Filter</button>
      </div>
      {filters.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <b>Current Filters:</b>
          <ul>
            {filters.map((f, i) => (
              <li key={i}>
                {f.name} <button onClick={() => handleRemoveFilter(i)}>Remove</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && <div style={{ color: "red", marginBottom: 8 }}>{error}</div>}
      <button onClick={handleSave} style={{ fontWeight: "bold" }}>Save Configuration</button>
    </div>
  );
}
