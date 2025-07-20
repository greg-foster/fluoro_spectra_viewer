import React, { useState, useEffect } from "react";
import DyeSelector from "./components/DyeSelector";
import SpectraPlot from "./components/SpectraPlot";
import FilterManager from "./components/FilterManager";
import CrosstalkTable from "./components/CrosstalkTable";
import InstrumentConfigBuilder from "./components/InstrumentConfigBuilder";
import { fetchInstrumentConfigs, saveInstrumentConfig } from "./utils/instrumentConfigs";
import CrosstalkHeatmap from "./components/CrosstalkHeatmap";

import { computeCrosstalkMatrix } from "./utils/crosstalk";
import { fetchDyeList, fetchFilterList, loadUserSettings, saveUserSettings } from "./utils/spectra";
import "./styles.css";
import "./styles-dark.css";
import "./quad-grid.css";

// Camera QE API helpers
async function fetchCameraList() {
  const res = await fetch(`${process.env.REACT_APP_API_BASE_URL || ""}/api/cameras`);
  return res.ok ? res.json() : [];
}
async function fetchCameraQE(cameraId) {
  const res = await fetch(`${process.env.REACT_APP_API_BASE_URL || ""}/api/cameras/${cameraId}`);
  return res.ok ? res.json() : [];
}


export default function App() {
  // Camera QE state (must be declared before any usage)
  const [cameraList, setCameraList] = React.useState([]);

  // Fetch camera list on mount
  useEffect(() => {
    fetchCameraList().then(setCameraList);
  }, []);
  const [selectedCamera, setSelectedCamera] = React.useState("");
  const [cameraQE, setCameraQE] = React.useState([]);
  const [includeCameraQEInCrosstalk, setIncludeCameraQEInCrosstalk] = React.useState(true);

  // Fetch QE data when camera changes
  useEffect(() => {
    if (selectedCamera) {
      fetchCameraQE(selectedCamera).then(setCameraQE);
    } else {
      setCameraQE([]);
    }
  }, [selectedCamera]);
  
  const [filterSpectra, setFilterSpectra] = React.useState({});
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('darkMode');
      return stored === 'true';
    }
    return false;
  });

  useEffect(() => {
    document.body.classList.toggle('dark', darkMode);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('darkMode', darkMode);
    }
  }, [darkMode]);
  const [selectedDyes, setSelectedDyes] = React.useState([]);
  const [dyeSpectra, setDyeSpectra] = React.useState({});
  const [filters, setFilters] = React.useState([]);

  // Normalization dye state
  const [normalizationDyeId, setNormalizationDyeId] = React.useState(null);

  // Compute brightness coefficients map from selectedDyes (if present)
  const brightnessMap = React.useMemo(() => {
    const map = {};
    for (const dye of selectedDyes) {
      // Try to get brightness coefficient from dyeSpectra (fetched by DyeSelector)
      const spectra = dyeSpectra[dye.id];
      if (spectra && spectra.brightness_coefficient !== undefined) {
        map[dye.id] = spectra.brightness_coefficient;
      }
    }
    return map;
  }, [selectedDyes, dyeSpectra]);

  // Brightness normalization toggle
  const [brightnessNormalizationOn, setBrightnessNormalizationOn] = React.useState(false);

  // Compute normalized brightness for each dye (always, regardless of toggle)
  const normalizedBrightness = React.useMemo(() => {
    if (!normalizationDyeId || !brightnessMap[normalizationDyeId]) return {};
    const norm = brightnessMap[normalizationDyeId];
    const out = {};
    for (const k in brightnessMap) {
      out[k] = norm > 0 ? brightnessMap[k] / norm : null;
    }
    return out;
  }, [brightnessMap, normalizationDyeId]);

  // Compute dyeSpectraForCrosstalk: normalized or raw depending on toggle
  const dyeSpectraForCrosstalk = React.useMemo(() => {
    if (!brightnessNormalizationOn || !normalizationDyeId || !dyeSpectra[normalizationDyeId]) {
      return dyeSpectra;
    }
    const result = {};
    for (const dye of selectedDyes) {
      const spec = dyeSpectra[dye.id];
      if (!spec || !Array.isArray(spec.emission)) {
        result[dye.id] = spec;
        continue;
      }
      const factor =
        normalizedBrightness && dye.id in normalizedBrightness && normalizedBrightness[dye.id] != null
          ? normalizedBrightness[dye.id]
          : 1;
      result[dye.id] = {
        ...spec,
        emission: spec.emission.map(([wl, inten]) => [wl, inten * factor])
      };
    }
    return result;
  }, [brightnessNormalizationOn, normalizationDyeId, dyeSpectra, selectedDyes, normalizedBrightness]);

  // Load dye/filter/settings from backend on mount
  useEffect(() => {
    async function loadAll() {
      const [dyes, filters, settings] = await Promise.all([
        fetchDyeList(),
        fetchFilterList(),
        loadUserSettings()
      ]);
      if (settings.selectedDyes) setSelectedDyes(settings.selectedDyes);
      if (settings.filters) setFilters(settings.filters);
      
    }
    loadAll();
  }, []);

  // Save settings on change
  useEffect(() => {
    saveUserSettings({ selectedDyes, filters });
  }, [selectedDyes, filters]);

  // Merge .profile from filterSpectra into filters for downstream use, skip undefined
  const filtersWithProfile = filters
    .map(f => {
      if (!f) return undefined;
      const fs = filterSpectra[f.id];
      if (fs && fs.profile) return { ...f, profile: fs.profile };
      return f;
    })
    .filter(f => !!f);

  // Filter order state (shared by CrosstalkTable and SpectraPlot)
  const [filterOrder, setFilterOrder] = useState(filtersWithProfile.map((_, i) => i));
  // Reset filter order if filters change
  useEffect(() => {
    setFilterOrder(filtersWithProfile.map((_, i) => i));
  }, [filtersWithProfile.length]);

  // Instrument configurations state
  const [instrumentConfigs, setInstrumentConfigs] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('instrumentConfigs');
      if (stored) return JSON.parse(stored);
    }
    return [];
  });
  // On mount, fetch from backend and merge with local
  useEffect(() => {
    fetchInstrumentConfigs().then(backendConfigs => {
      setInstrumentConfigs(prev => {
        // Merge unique configs by name (backend wins)
        const byName = {};
        prev.forEach(cfg => { byName[cfg.name] = cfg; });
        backendConfigs.forEach(cfg => { byName[cfg.name] = cfg; });
        const merged = Object.values(byName);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('instrumentConfigs', JSON.stringify(merged));
        }
        return merged;
      });
    }).catch(() => {});
  }, []);

  // Prepare camera QE profile for crosstalk calculation
  const cameraQEProfile = React.useMemo(() => {
    if (!Array.isArray(cameraQE) || cameraQE.length === 0) return null;
    // Accepts either [{x, y}, ...] or [wl, qe%] arrays
    if (typeof cameraQE[0] === 'object' && cameraQE[0].x !== undefined && cameraQE[0].y !== undefined) {
      return cameraQE.map(pt => [parseFloat(pt.x), parseFloat(pt.y)]);
    }
    if (Array.isArray(cameraQE[0]) && cameraQE[0].length === 2) {
      return cameraQE.map(pt => [parseFloat(pt[0]), parseFloat(pt[1])]);
    }
    return null;
  }, [cameraQE]);

  // Compute crosstalk matrix
  const crosstalk = React.useMemo(() => {
    if (!selectedDyes.length || !filtersWithProfile.length) return null;
    return computeCrosstalkMatrix(
      selectedDyes,
      filtersWithProfile,
      dyeSpectraForCrosstalk,
      false,
      {},
      includeCameraQEInCrosstalk ? cameraQEProfile : null
    );
  }, [selectedDyes, filtersWithProfile, dyeSpectraForCrosstalk, includeCameraQEInCrosstalk, cameraQEProfile]);

  // Recommendation: Find set of dyes with minimal total crosstalk (greedy, demo)
  const recommend = () => {
    if (!selectedDyes.length || !filters.length) return;
    // Greedy: pick dye for each filter with max signal, minimize off-diagonal crosstalk
    const assignment = filters.map((filter, j) => {
      let best = null, bestSignal = -Infinity;
      selectedDyes.forEach((dye, i) => {
        const signal = crosstalk[i][j];
        if (signal > bestSignal) {
          bestSignal = signal;
          best = dye;
        }
      });
      return best;
    });
    alert("Suggested dye for each filter:\n" + assignment.map((d, j) => `${filters[j].name}: ${d.name}`).join("\n"));
  };


  return (
    <div className={`container${darkMode ? ' dark' : ''}`}>
      <h1>Fluorescent Dye Spectra Viewer</h1>

      <DyeSelector
        selectedDyes={selectedDyes}
        setSelectedDyes={setSelectedDyes}
        setDyeSpectra={setDyeSpectra}
        darkMode={darkMode}
      />
      <button
        onClick={() => setDarkMode(dm => !dm)}
        style={{ position: 'absolute', top: 18, right: 24, zIndex: 2000, background: darkMode ? '#23272a' : '#fafafa', color: darkMode ? '#fafafa' : '#23272a', border: '1px solid #444', borderRadius: 6, padding: '6px 14px', cursor: 'pointer' }}
      >
        {darkMode ? 'Light Mode' : 'Dark Mode'}
      </button>
      <InstrumentConfigBuilder
        selectedDyes={selectedDyes}
        filters={filters}
        onSave={cfg => {
          setInstrumentConfigs(prev => {
            const newConfigs = [...prev.filter(c => c.name !== cfg.name), cfg];
            if (typeof window !== 'undefined') {
              window.localStorage.setItem('instrumentConfigs', JSON.stringify(newConfigs));
            }
            return newConfigs;
          });
        }}
      />
      {instrumentConfigs.length > 0 && (
        <div style={{margin:16, padding:8, border:'1px solid #aaa', borderRadius:6}}>
          <h3>Saved Instrument Configurations</h3>
          <ul>
            {instrumentConfigs.map((cfg, i) => (
              <li key={i}>
                <b>{cfg.name}</b> ({cfg.filters.length} filters)
                <button style={{marginLeft:8}} onClick={() => setFilters(cfg.filters)}>Load</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Keep instrumentConfigs in sync with localStorage on any change */}
      {React.useEffect(() => {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('instrumentConfigs', JSON.stringify(instrumentConfigs));
        }
      }, [instrumentConfigs])}
      {/* Normalization dye selector and toggle above Spectra Plot */}
      {selectedDyes.length > 0 && (
        <div style={{ margin: '20px 0 12px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <label htmlFor="norm-dye-select"><b>Normalize brightness to:</b></label>
          <select
            id="norm-dye-select"
            value={normalizationDyeId || ''}
            onChange={e => setNormalizationDyeId(e.target.value || null)}
            style={{ minWidth: 160 }}
          >
            <option value="">-- Select reference dye --</option>
            {selectedDyes.map(dye => (
              <option key={dye.id} value={dye.id}>{dye.name}</option>
            ))}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              type="checkbox"
              checked={brightnessNormalizationOn}
              onChange={e => setBrightnessNormalizationOn(e.target.checked)}
              disabled={!normalizationDyeId}
              style={{ marginLeft: 16 }}
            />
            <span style={{ color: brightnessNormalizationOn ? '#0288d1' : '#888' }}>
              Brightness normalization
            </span>
          </label>
          {normalizationDyeId && (
            <span style={{ color: '#0288d1' }}>
              (Current: {selectedDyes.find(d => d.id === normalizationDyeId)?.name || normalizationDyeId})
            </span>
          )}
        </div>
      )}
      {/* Camera QE dropdown */}
      <div style={{ margin: '18px 0 12px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <label htmlFor="camera-select"><b>Camera Quantum Efficiency:</b></label>
        <select
          id="camera-select"
          value={selectedCamera}
          onChange={e => setSelectedCamera(e.target.value)}
          style={{ minWidth: 180 }}
        >
          <option value="">-- None --</option>
          {cameraList.map(cam => (
            <option key={cam.id} value={cam.id}>{cam.name}</option>
          ))}
        </select>
        {selectedCamera && <span style={{ color: '#0288d1' }}>(Showing: {selectedCamera})</span>}
      </div>
      <FilterManager filters={filters} setFilters={setFilters} setFilterSpectra={setFilterSpectra} darkMode={darkMode} />
      <SpectraPlot
        selectedDyes={selectedDyes}
        dyeSpectra={dyeSpectra}
        filterSpectra={filterSpectra}
        filters={filtersWithProfile}
        filterOrder={filterOrder}
        darkMode={darkMode}
        normalizationDyeId={normalizationDyeId}
        normalizedBrightness={normalizedBrightness}
        brightnessNormalizationOn={brightnessNormalizationOn}
        cameraQE={cameraQE}
      />
      <div style={{ margin: '18px 0 8px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            type="checkbox"
            checked={includeCameraQEInCrosstalk}
            onChange={e => setIncludeCameraQEInCrosstalk(e.target.checked)}
            style={{ marginRight: 4 }}
            disabled={!selectedCamera}
          />
          <span style={{ color: includeCameraQEInCrosstalk ? '#0288d1' : '#888' }}>
            Include QE in Crosstalk
          </span>
        </label>
      </div>
      <CrosstalkTable dyes={selectedDyes} filters={filtersWithProfile} crosstalk={crosstalk} filterOrder={filterOrder} setFilterOrder={setFilterOrder} darkMode={darkMode} />


    </div>
  );
}
