import React, { useEffect, useState } from "react";

import { fetchDyeList, fetchDyeSpectrum } from "../utils/spectra";

import SearchableDyeSelector from "./SearchableDyeSelector";

export default function DyeSelector(props) {
  return <SearchableDyeSelector {...props} darkMode={props.darkMode} />;

  const [dyeList, setDyeList] = useState([]);

  useEffect(() => {
    fetchDyeList().then(setDyeList);
  }, []);

  useEffect(() => {
    async function fetchSpectra() {
      const spectra = {};
      for (const dye of selectedDyes) {
        spectra[dye.id] = await fetchDyeSpectrum(dye.id);
      }
      setDyeSpectra(spectra);
    }
    if (selectedDyes.length > 0) fetchSpectra();
    else setDyeSpectra({});
  }, [selectedDyes, setDyeSpectra]);

  const handleChange = e => {
    const id = e.target.value;
    const dye = dyeList.find(d => d.id === id);
    if (!dye) return;
    if (selectedDyes.some(d => d.id === id)) {
      setSelectedDyes(selectedDyes.filter(d => d.id !== id));
    } else {
      setSelectedDyes([...selectedDyes, dye]);
    }
  };

  return (
    <div>
      <h2>Select Dyes</h2>
      <select
        onChange={e => {
          const id = e.target.value;
          if (!id) return;
          const dye = dyeList.find(d => d.id === id);
          if (dye && !selectedDyes.some(d => d.id === id)) {
            setSelectedDyes([...selectedDyes, dye]);
          }
        }}
        value=""
        style={{ minWidth: 220 }}
      >
        <option value="">-- Add a dye --</option>
        {dyeList
          .filter(d => !selectedDyes.some(sel => sel.id === d.id))
          .map(dye => (
            <option key={dye.id} value={dye.id}>{dye.name}</option>
          ))}
      </select>
      <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
        {selectedDyes.map(dye => (
          <span key={dye.id} style={{ background: "#e0f7fa", borderRadius: 12, padding: "4px 10px", display: "flex", alignItems: "center", gap: 6 }}>
            {dye.name}
            <button
              style={{ marginLeft: 4, background: "#ff5252", color: "white", border: "none", borderRadius: 8, cursor: "pointer", padding: "0 6px" }}
              onClick={() => setSelectedDyes(selectedDyes.filter(d => d.id !== dye.id))}
              title={`Remove ${dye.name}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
