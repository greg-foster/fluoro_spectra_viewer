import React, { useEffect, useState } from "react";
import Select from "react-select";
import { fetchDyeList, fetchDyeSpectrum } from "../utils/spectra";

export default function SearchableDyeSelector({ selectedDyes, setSelectedDyes, setDyeSpectra, darkMode = false }) {
  const [dyeList, setDyeList] = useState([]);
  const [options, setOptions] = useState([]);
  const [brightnessMap, setBrightnessMap] = useState({}); // dyeId -> coefficient

  // Fetch brightness coefficient for a dye
  async function fetchBrightness(dyeId) {
    try {
      const resp = await fetch(`${process.env.REACT_APP_API_BASE_URL || ""}/api/dyes/${dyeId}`);
      if (!resp.ok) return null;
      const data = await resp.json();
      return data.brightness_coefficient !== undefined ? data.brightness_coefficient : '';
    } catch {
      return '';
    }
  }

  // When selectedDyes changes, fetch brightness coefficients
  useEffect(() => {
    (async () => {
      const bm = { ...brightnessMap };
      for (const dye of selectedDyes) {
        if (!(dye.id in bm)) {
          bm[dye.id] = await fetchBrightness(dye.id);
        }
      }
      setBrightnessMap(bm);
    })();
  }, [selectedDyes]);

  // Helper to flatten and normalize dye spectrum
  function normalizeDyeSpectrum(raw, dyeId) {
    if (raw && raw.data && typeof raw.data === 'object') {
      const keys = Object.keys(raw.data);
      if (keys.length > 0) {
        const key = keys[0];
        const nested = raw.data[key];
        let flat = {
          ...raw,
          ...nested,
          ...nested.info,
        };
        delete flat.data;
        if (flat.info) delete flat.info;
        // Fix: flatten emission/excitation if object with "" key
        if (flat.emission && typeof flat.emission === 'object' && Array.isArray(flat.emission[""])) {
          flat.emission = flat.emission[""];
        }
        if (flat.excitation && typeof flat.excitation === 'object' && Array.isArray(flat.excitation[""])) {
          flat.excitation = flat.excitation[""];
        }
        return flat;
      }
    }
    return raw;
  }

  // Handle brightness coefficient change
  const handleBrightnessChange = async (dyeId, value) => {
    setBrightnessMap(bm => ({ ...bm, [dyeId]: value }));
    if (value === '' || isNaN(Number(value))) return;
    await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/dyes/${dyeId}/brightness`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brightness_coefficient: Number(value) })
    });
    // Refetch the updated dye spectrum and update setDyeSpectra
    const updated = await fetchDyeSpectrum(`${process.env.REACT_APP_API_BASE_URL}/api/dyes/${dyeId}/spectrum`);
    setDyeSpectra(prev => ({
      ...prev,
      [dyeId]: normalizeDyeSpectrum(updated, dyeId)
    }));
  };



  useEffect(() => {
    fetchDyeList().then(list => {
      console.log('[DEBUG] fetchDyeList returned:', list);
      setDyeList(list);
      setOptions(list.map(dye => ({ value: dye.id, label: dye.name })));
      if (!Array.isArray(list) || list.length === 0) {
        console.error('[DEBUG] Dye list is empty or not an array:', list);
      }
    }).catch(e => {
      console.error('[DEBUG] fetchDyeList threw error:', e);
    });
  }, []);

  useEffect(() => {
    async function fetchSpectra() {
      const spectra = {};
      for (const dye of selectedDyes) {
        let raw = await fetchDyeSpectrum(dye.id);
        spectra[dye.id] = normalizeDyeSpectrum(raw, dye.id);
      }
      setDyeSpectra(spectra);
    }
    if (selectedDyes.length > 0) fetchSpectra();
    else setDyeSpectra({});
  }, [selectedDyes, setDyeSpectra]);

  const handleChange = selectedOptions => {
    if (!selectedOptions) setSelectedDyes([]);
    else {
      // Map back to full dye objects
      setSelectedDyes(selectedOptions.map(opt => dyeList.find(d => d.id === opt.value)));
    }
  };

  return (
    <div>
      <h2>Select Dyes</h2>
      <Select
        options={options}
        isMulti
        isClearable
        value={selectedDyes.map(dye => ({ value: dye.id, label: dye.name }))}
        onChange={handleChange}
        placeholder="Search or select dyes..."
        menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
        styles={(() => {
          const dark = darkMode;
          return {
            menu: base => ({
              ...base,
              zIndex: 9999,
              backgroundColor: dark ? '#23272a' : '#fff',
              color: dark ? '#f5f5f5' : '#222',
            }),
            menuPortal: base => ({
              ...base,
              zIndex: 9999,
              backgroundColor: dark ? '#23272a' : '#fff',
              color: dark ? '#f5f5f5' : '#222',
            }),
            option: (base, state) => ({
              ...base,
              backgroundColor: dark
                ? state.isFocused
                  ? '#2e3236'
                  : '#23272a'
                : state.isFocused
                  ? '#f0f0f0'
                  : '#fff',
              color: dark ? '#f5f5f5' : '#222',
            }),
            control: base => ({
              ...base,
              backgroundColor: dark ? '#23272a' : '#fff',
              color: dark ? '#000' : '#222',
              borderColor: dark ? '#444' : base.borderColor,
            }),
            singleValue: base => ({
              ...base,
              color: dark ? '#f5f5f5' : '#222',
            }),
            multiValue: base => ({
              ...base,
              backgroundColor: dark ? '#444950' : '#e0e0e0',
            }),
            multiValueLabel: base => ({
              ...base,
              color: dark ? '#f5f5f5' : '#222',
            }),
          };
        })()}
      />
      {/* Brightness coefficient controls for each selected dye */}
      {selectedDyes.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <h3>Brightness Coefficient</h3>
          {selectedDyes.map(dye => (
            <div key={dye.id} style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ minWidth: 120 }}>{dye.name}:</span>
              <input
                type="number"
                step="any"
                value={brightnessMap[dye.id] ?? ''}
                onChange={e => handleBrightnessChange(dye.id, e.target.value)}
                style={{ width: 90, padding: 2 }}
                placeholder="(none)"
                min={0}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
