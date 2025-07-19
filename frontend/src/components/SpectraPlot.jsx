import React, { useRef } from "react";
import Plot from "react-plotly.js";
import ExportButtons from "./ExportButtons";

import { useState } from "react";

// Converts a wavelength in nm (380-700) to an RGB color
function wavelengthToRGB(wavelength) {
  let r = 0, g = 0, b = 0;
  if (wavelength >= 380 && wavelength < 440) {
    r = -(wavelength - 440) / (440 - 380);
    g = 0;
    b = 1;
  } else if (wavelength >= 440 && wavelength < 490) {
    r = 0;
    g = (wavelength - 440) / (490 - 440);
    b = 1;
  } else if (wavelength >= 490 && wavelength < 510) {
    r = 0;
    g = 1;
    b = -(wavelength - 510) / (510 - 490);
  } else if (wavelength >= 510 && wavelength < 580) {
    r = (wavelength - 510) / (580 - 510);
    g = 1;
    b = 0;
  } else if (wavelength >= 580 && wavelength < 645) {
    r = 1;
    g = -(wavelength - 645) / (645 - 580);
    b = 0;
  } else if (wavelength >= 645 && wavelength <= 700) {
    r = 1;
    g = 0;
    b = 0;
  }
  // Intensity correction
  let factor = 1;
  if (wavelength >= 380 && wavelength < 420) {
    factor = 0.3 + 0.7 * (wavelength - 380) / (420 - 380);
  } else if (wavelength >= 700 && wavelength <= 780) {
    factor = 0.3 + 0.7 * (780 - wavelength) / (780 - 700);
  }
  r = Math.round(r * 255 * factor);
  g = Math.round(g * 255 * factor);
  b = Math.round(b * 255 * factor);
  return { r, g, b };
}

export default function SpectraPlot({ selectedDyes, dyeSpectra, filterSpectra = {}, filters = [], filterOrder = null, normalize = false, darkMode = false, normalizationDyeId = null, normalizedBrightness = {}, brightnessNormalizationOn = false, cameraQE = [] }) {
  // DEBUG: Log cameraQE prop
  if (typeof window !== 'undefined') {
    console.log('SpectraPlot cameraQE:', cameraQE);
  }
  // Plot real spectra if available, else fallback to simulated
  const [showExcitation, setShowExcitation] = useState(true);
  const [showEmission, setShowEmission] = useState(true);

  // Reorder filters if filterOrder is provided
  const orderedFilters = filterOrder && Array.isArray(filterOrder) && filterOrder.length === filters.length
    ? filterOrder.map(i => filters[i])
    : filters;

  // Compute min/max for all Intensity (excitation/emission) values for y-axis alignment
  let allY = [];

  // Dye traces
  const traces = selectedDyes.map((dye, i) => {
    const spectra = dyeSpectra[dye.id];
    let exc = null, em = null;
    if (spectra && Array.isArray(spectra.excitation) && spectra.excitation.length > 0) {
      exc = spectra.excitation;
    }
    if (spectra && Array.isArray(spectra.emission) && spectra.emission.length > 0) {
      em = spectra.emission;
    }
    // exc/em: [[wavelength, intensity], ...]
    let excTrace, emTrace;
    // Robust brightness normalization logic
    let normLabel = '';
    let brightnessNormFactor = 1;
    if (brightnessNormalizationOn && normalizationDyeId && dyeSpectra[normalizationDyeId] && dyeSpectra[dye.id]) {
      const normDyeBrightness = dyeSpectra[normalizationDyeId].brightness_coefficient;
      const dyeBrightness = dyeSpectra[dye.id].brightness_coefficient;
      if (normDyeBrightness > 0 && dyeBrightness > 0) {
        brightnessNormFactor = normDyeBrightness / dyeBrightness;
        normLabel = ` (Norm: ${brightnessNormFactor.toFixed(2)})`;
      }
    }
    // Remove old debug printouts

    if (exc && exc.length > 0) {
      let y_exc = exc.map(pair => pair[1]);
      if (normalize && Math.max(...y_exc) > 0) {
        y_exc = y_exc.map(y => y / Math.max(...y_exc));
      }
      allY.push(...y_exc);

      excTrace = {
        x: exc.map(pair => pair[0]),
        y: y_exc,
        mode: "lines",
        name: `${dye.name} Excitation${normLabel}`,
        line: { color: `hsl(${i * 50}, 70%, 45%)`, dash: "solid" }
      };
    }
    if (em && em.length > 0) {
      let y_em = em.map(pair => pair[1]);
      if (normalize && Math.max(...y_em) > 0) {
        y_em = y_em.map(y => y / Math.max(...y_em));
      }
      // Scale by normalized brightness if set and toggle is on
      if (brightnessNormalizationOn && normalizationDyeId && normalizedBrightness && dye.id in normalizedBrightness && normalizedBrightness[dye.id] != null) {
        y_em = y_em.map(y => y * normalizedBrightness[dye.id]);
      }
      allY.push(...y_em);
      // Find wavelength of max emission
      let maxIdx = y_em.reduce((maxIdx, val, idx, arr) => val > arr[maxIdx] ? idx : maxIdx, 0);
      let peakWavelength = em[maxIdx][0];
      const rgb = wavelengthToRGB(peakWavelength);
      const rgba = `rgba(${rgb.r},${rgb.g},${rgb.b},1)`;
      const fillrgba = `rgba(${rgb.r},${rgb.g},${rgb.b},0.18)`;
      emTrace = {
        x: em.map(pair => pair[0]),
        y: y_em,
        mode: "lines",
        name: `${dye.name} Emission${normLabel}`,
        line: { color: rgba, dash: "dash" },
        fill: "tozeroy",
        fillcolor: fillrgba
      };
    }
    // fallback to simulated if missing
    if (!exc || !em) {
      const simrgb = wavelengthToRGB(500);
      const simrgba = `rgba(${simrgb.r},${simrgb.g},${simrgb.b},1)`;
      const simfill = `rgba(${simrgb.r},${simrgb.g},${simrgb.b},0.18)`;
      if (!exc) {
        excTrace = {
          x: [400, 500, 600],
          y: [0, 1, 0],
          mode: "lines",
          name: `${dye.name} Excitation (sim)`,
          line: { color: `hsl(${i * 50}, 70%, 45%)`, dash: "solid" }
        };
      }
      if (!em) {
        emTrace = {
          x: [400, 500, 600],
          y: [0, 1, 0],
          mode: "lines",
          name: `${dye.name} Emission (sim)`,
          line: { color: simrgba, dash: "dash" },
          fill: "tozeroy",
          fillcolor: simfill
        };
      }
    }
    return [excTrace, emTrace];
  }).flat().filter(trace => {
    if (!trace) return false;
    if (trace.name.includes('Excitation') && !showExcitation) return false;
    if (trace.name.includes('Emission') && !showEmission) return false;
    return true;
  });

  // Filter transmission traces
  // Extra debug logging for filters and filterSpectra
  if (typeof window !== 'undefined') {
    window._lastFilterSpectra = filterSpectra;
    console.log('DEBUG filterSpectra', filterSpectra);
    console.log('DEBUG filters', filters);
  }
  let missingFilterData = [];
  const filterTraces = orderedFilters.map((filter, idx) => {
    // Support manual filters with a 'profile' array
    if (filter.profile && Array.isArray(filter.profile)) {
      const x = filter.profile.map(pt => pt[0]);
      const y = filter.profile.map(pt => pt[1]);
      return {
        x,
        y,
        mode: "lines",
        name: `${filter.name} (Manual) Transmission`,
        line: { color: `rgba(80,180,255,0.85)`, dash: "dash", width: 2 },
        fill: "tozeroy",
        fillcolor: "rgba(80,180,255,0.10)",
        yaxis: "y2"
      };
    }
    const fData = filterSpectra[filter.id];
    // Defensive: check for items[0].spectra[0].data
    const items = fData && Array.isArray(fData.items) ? fData.items : [];
    const spectra = items[0] && Array.isArray(items[0].spectra) ? items[0].spectra : [];
    const dataArr = spectra[0] && Array.isArray(spectra[0].data) ? spectra[0].data : [];
    if (typeof window !== 'undefined') {
      console.log(`DEBUG filter ${filter.id}`, fData, dataArr.length);
    }
    if (!dataArr.length) {
      missingFilterData.push(filter.id);
      return null;
    }
    return {
      x: dataArr.map(pt => pt.x),
      y: dataArr.map(pt => pt.y),
      mode: "lines",
      name: `${filter.name} Transmission`,
      line: { color: `rgba(80,180,255,0.85)`, dash: "dot", width: 2 },
      fill: "tozeroy",
      fillcolor: "rgba(80,180,255,0.10)",
      yaxis: "y2"
    };
  }).filter(Boolean);

  // Camera QE trace
  let cameraQETrace = null;
  if (Array.isArray(cameraQE) && cameraQE.length > 0) {
    cameraQETrace = {
      x: cameraQE.map(pt => parseFloat(pt.x)),
      y: cameraQE.map(pt => parseFloat(pt.y)),
      mode: "lines",
      name: "Camera QE (%)",
      line: { color: "#00bfae", width: 3, dash: "dashdot" },
      yaxis: "y2"
    };
  }

  const plotId = "spectra-plot";
  return (
    <div>
      <h2>Spectra Plot</h2>
      {missingFilterData.length > 0 && (
        <div style={{ color: 'red', fontWeight: 'bold', marginBottom: 8 }}>
          Warning: No data found for filter(s): {missingFilterData.join(', ')}
        </div>
      )}
      <div style={{ marginBottom: 12 }}>
        <button
          onClick={() => setShowExcitation(v => !v)}
          style={{ marginRight: 8, background: showExcitation ? '#0288d1' : '#bdbdbd', color: 'white', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer' }}
        >
          {showExcitation ? 'Hide' : 'Show'} Excitation
        </button>
        <button
          onClick={() => setShowEmission(v => !v)}
          style={{ background: showEmission ? '#c2185b' : '#bdbdbd', color: 'white', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer' }}
        >
          {showEmission ? 'Hide' : 'Show'} Emission
        </button>
      </div>
      <ExportButtons plotId={plotId} filenameBase="spectra" />


      <Plot
        key={
          'norm-' + (brightnessNormalizationOn ? 'on' : 'off') +
          '-dye-' + (normalizationDyeId || 'none') +
          '-map-' + JSON.stringify(normalizedBrightness)
        }
        divId={plotId}
        data={[...traces, ...filterTraces, ...(cameraQETrace ? [cameraQETrace] : [])]}
        layout={{
          autosize: true,
          height: 450,
          xaxis: {
            title: "Wavelength (nm)",
            color: darkMode ? "#e0e0e0" : undefined,
            gridcolor: darkMode ? "#333" : undefined,
            zerolinecolor: darkMode ? "#333" : undefined
          },
          yaxis: {
            title: "Intensity (a.u.)",
            color: darkMode ? "#e0e0e0" : undefined,
            gridcolor: darkMode ? "#333" : undefined,
            zerolinecolor: darkMode ? "#333" : undefined,
            anchor: "x",
            rangemode: "tozero",
            range: (allY.length > 0) ? [Math.min(...allY), Math.max(...allY)] : undefined
          },
          yaxis2: {
            title: {
              text: "Transmission / QE (%)",
              standoff: 38 // Slightly closer for optimal spacing
            },
            overlaying: "y",
            side: "right",
            showgrid: false,
            color: darkMode ? "#e0e0e0" : undefined,
            gridcolor: darkMode ? "#333" : undefined,
            zerolinecolor: darkMode ? "#333" : undefined,
            range: (allY.length > 0) ? [Math.min(...allY), Math.max(...allY)] : undefined,
            anchor: "x"
          },
          legend: { orientation: "h", yanchor: "bottom", y: 1.05, font: { color: darkMode ? "#fafafa" : undefined } },
          margin: { l: 60, r: 60, t: 40, b: 50 },
          plot_bgcolor: darkMode ? "#23272a" : "#f7f7f7",
          paper_bgcolor: darkMode ? "#23272a" : "#fff",

        }}
        useResizeHandler
        style={{ width: "100%", minHeight: 400 }}
        config={{ responsive: true }}
      />
    </div>
  );
}
