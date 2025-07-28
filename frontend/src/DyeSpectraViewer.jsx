import React, { useState, useEffect } from "react";
import DyeSelector from "./components/DyeSelector";
import SpectraPlot from "./components/SpectraPlot";
import FilterManager from "./components/FilterManager";
import CrosstalkTable from "./components/CrosstalkTable";
import InstrumentConfigBuilder from "./components/InstrumentConfigBuilder";
import FilterToggleControls from "./components/FilterToggleControls";
import { fetchInstrumentConfigs, saveInstrumentConfig } from "./utils/instrumentConfigs";
import { exportConfigToCSV, importConfigFromCSV, downloadCSV, readFileAsText } from "./utils/csvUtils";
import CrosstalkHeatmap from "./components/CrosstalkHeatmap";

import { computeCrosstalkMatrix } from "./utils/crosstalk";
import { fetchDyeList, fetchFilterList, loadUserSettings, saveUserSettings } from "./utils/spectra";
import "./styles.css";
import "./styles-dark.css";
import "./quad-grid.css";
import "./login.css";

// Camera QE API helpers
async function fetchCameraList() {
  const res = await fetch(`${process.env.REACT_APP_API_BASE_URL || ""}/api/cameras`);
  return res.ok ? res.json() : [];
}
async function fetchCameraQE(cameraId) {
  const res = await fetch(`${process.env.REACT_APP_API_BASE_URL || ""}/api/cameras/${cameraId}`);
  return res.ok ? res.json() : [];
}


export default function DyeSpectraViewer({ darkMode, toggleDarkMode }) {

  // ALL STATE HOOKS MUST BE DECLARED BEFORE ANY CONDITIONAL LOGIC
  const [cameraList, setCameraList] = React.useState([]);
  const [selectedCamera, setSelectedCamera] = React.useState("");
  const [cameraQE, setCameraQE] = React.useState([]);
  const [includeCameraQEInCrosstalk, setIncludeCameraQEInCrosstalk] = React.useState(true);
  const [filterSpectra, setFilterSpectra] = React.useState({});
  const [selectedDyes, setSelectedDyes] = React.useState([]);
  const [dyeSpectra, setDyeSpectra] = React.useState({});
  const [filters, setFilters] = React.useState([]);
  const [normalizationDyeId, setNormalizationDyeId] = React.useState(null);
  const [brightnessNormalizationOn, setBrightnessNormalizationOn] = React.useState(false);
  
  // Filter visibility state for independent toggling
  const [filterVisibility, setFilterVisibility] = React.useState({});

  // ALL useEffect HOOKS MUST BE DECLARED BEFORE ANY CONDITIONAL LOGIC
  // Fetch camera list on mount
  useEffect(() => {
    fetchCameraList().then(setCameraList);
  }, []);

  // Fetch QE data when camera changes
  useEffect(() => {
    if (selectedCamera) {
      fetchCameraQE(selectedCamera).then(setCameraQE);
    } else {
      setCameraQE([]);
    }
  }, [selectedCamera]);

  // Dark mode is now managed by the portal

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
      if (settings.normalizationDyeId) setNormalizationDyeId(settings.normalizationDyeId);
    }
    loadAll();
  }, []);

  // Save settings when they change
  useEffect(() => {
    saveUserSettings({ selectedDyes, filters, normalizationDyeId });
  }, [selectedDyes, filters, normalizationDyeId]);

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

  // Brightness normalization toggle (moved to top)

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

  // Authentication is now handled by AuthWrapper component

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
    // Default configurations that come pre-installed
    const defaultConfigs = [
      {
        name: 'QuantStudio 5',
        category: 'default',
        filters: [
          // Excitation filters (blue-tinted colors)
          {
            id: 'qs5_x1_excitation',
            name: 'x1 Excitation (Blue)',
            profile: Array.from({ length: 401 }, (_, i) => {
              const wavelength = 400 + i;
              // Excitation: 470 ± 15 nm
              return [wavelength, (wavelength >= 455 && wavelength <= 485) ? 100 : 0];
            }),
            color: '#1565C0', // Dark blue for excitation
            filterType: 'excitation'
          },
          {
            id: 'qs5_x2_excitation',
            name: 'x2 Excitation (Green)',
            profile: Array.from({ length: 401 }, (_, i) => {
              const wavelength = 400 + i;
              // Excitation: 520 ± 10 nm
              return [wavelength, (wavelength >= 510 && wavelength <= 530) ? 100 : 0];
            }),
            color: '#2E7D32', // Dark green for excitation
            filterType: 'excitation'
          },
          {
            id: 'qs5_x3_excitation',
            name: 'x3 Excitation (Yellow)',
            profile: Array.from({ length: 401 }, (_, i) => {
              const wavelength = 400 + i;
              // Excitation: 550 ± 10 nm
              return [wavelength, (wavelength >= 540 && wavelength <= 560) ? 100 : 0];
            }),
            color: '#F57F17', // Dark yellow for excitation
            filterType: 'excitation'
          },
          {
            id: 'qs5_x4_excitation',
            name: 'x4 Excitation (Orange)',
            profile: Array.from({ length: 401 }, (_, i) => {
              const wavelength = 400 + i;
              // Excitation: 580 ± 10 nm
              return [wavelength, (wavelength >= 570 && wavelength <= 590) ? 100 : 0];
            }),
            color: '#E65100', // Dark orange for excitation
            filterType: 'excitation'
          },
          {
            id: 'qs5_x5_excitation',
            name: 'x5 Excitation (Red)',
            profile: Array.from({ length: 401 }, (_, i) => {
              const wavelength = 400 + i;
              // Excitation: 640 ± 10 nm
              return [wavelength, (wavelength >= 630 && wavelength <= 650) ? 100 : 0];
            }),
            color: '#B71C1C', // Dark red for excitation
            filterType: 'excitation'
          },
          {
            id: 'qs5_x6_excitation',
            name: 'x6 Excitation (Deep-Red)',
            profile: Array.from({ length: 401 }, (_, i) => {
              const wavelength = 400 + i;
              // Excitation: 662 ± 10 nm
              return [wavelength, (wavelength >= 652 && wavelength <= 672) ? 100 : 0];
            }),
            color: '#4A148C', // Dark purple for excitation
            filterType: 'excitation'
          },
          // Emission filters (lighter, warmer colors)
          {
            id: 'qs5_m1_emission',
            name: 'm1 Emission (Blue)',
            profile: Array.from({ length: 401 }, (_, i) => {
              const wavelength = 400 + i;
              // Emission: 520 ± 15 nm
              return [wavelength, (wavelength >= 505 && wavelength <= 535) ? 100 : 0];
            }),
            color: '#42A5F5', // Light blue for emission
            filterType: 'emission'
          },
          {
            id: 'qs5_m2_emission',
            name: 'm2 Emission (Green)',
            profile: Array.from({ length: 401 }, (_, i) => {
              const wavelength = 400 + i;
              // Emission: 558 ± 12 nm
              return [wavelength, (wavelength >= 546 && wavelength <= 570) ? 100 : 0];
            }),
            color: '#66BB6A', // Light green for emission
            filterType: 'emission'
          },
          {
            id: 'qs5_m3_emission',
            name: 'm3 Emission (Yellow)',
            profile: Array.from({ length: 401 }, (_, i) => {
              const wavelength = 400 + i;
              // Emission: 587 ± 10 nm
              return [wavelength, (wavelength >= 577 && wavelength <= 597) ? 100 : 0];
            }),
            color: '#FFEB3B', // Light yellow for emission
            filterType: 'emission'
          },
          {
            id: 'qs5_m4_emission',
            name: 'm4 Emission (Orange)',
            profile: Array.from({ length: 401 }, (_, i) => {
              const wavelength = 400 + i;
              // Emission: 623 ± 14 nm
              return [wavelength, (wavelength >= 609 && wavelength <= 637) ? 100 : 0];
            }),
            color: '#FF9800', // Light orange for emission
            filterType: 'emission'
          },
          {
            id: 'qs5_m5_emission',
            name: 'm5 Emission (Red)',
            profile: Array.from({ length: 401 }, (_, i) => {
              const wavelength = 400 + i;
              // Emission: 682 ± 14 nm
              return [wavelength, (wavelength >= 668 && wavelength <= 696) ? 100 : 0];
            }),
            color: '#EF5350', // Light red for emission
            filterType: 'emission'
          },
          {
            id: 'qs5_m6_emission',
            name: 'm6 Emission (Deep-Red)',
            profile: Array.from({ length: 401 }, (_, i) => {
              const wavelength = 400 + i;
              // Emission: 711 ± 12 nm
              return [wavelength, (wavelength >= 699 && wavelength <= 723) ? 100 : 0];
            }),
            color: '#AB47BC', // Light purple for emission
            filterType: 'emission'
          }
        ]
      },
      {
        name: 'CFX96 Touch™',
        category: 'default',
        filters: [
          // Excitation filters based on CFX96 Touch™ specifications
          {
            id: 'cfx96_ch1_excitation',
            name: 'Channel 1 Excitation (450-490)',
            profile: Array.from({ length: 401 }, (_, i) => {
              const wavelength = 400 + i;
              // Excitation: 450-490 nm (FAM)
              return [wavelength, (wavelength >= 450 && wavelength <= 490) ? 100 : 0];
            }),
            color: '#1565C0', // Dark blue for excitation
            filterType: 'excitation'
          },
          {
            id: 'cfx96_ch2_excitation',
            name: 'Channel 2 Excitation (515-535)',
            profile: Array.from({ length: 401 }, (_, i) => {
              const wavelength = 400 + i;
              // Excitation: 515-535 nm (HEX)
              return [wavelength, (wavelength >= 515 && wavelength <= 535) ? 100 : 0];
            }),
            color: '#2E7D32', // Dark green for excitation
            filterType: 'excitation'
          },
          {
            id: 'cfx96_ch3_excitation',
            name: 'Channel 3 Excitation (560-590)',
            profile: Array.from({ length: 401 }, (_, i) => {
              const wavelength = 400 + i;
              // Excitation: 560-590 nm (Texas Red)
              return [wavelength, (wavelength >= 560 && wavelength <= 590) ? 100 : 0];
            }),
            color: '#F57F17', // Dark yellow for excitation
            filterType: 'excitation'
          },
          {
            id: 'cfx96_ch4_excitation',
            name: 'Channel 4 Excitation (620-650)',
            profile: Array.from({ length: 401 }, (_, i) => {
              const wavelength = 400 + i;
              // Excitation: 620-650 nm (Cy5)
              return [wavelength, (wavelength >= 620 && wavelength <= 650) ? 100 : 0];
            }),
            color: '#E65100', // Dark orange for excitation
            filterType: 'excitation'
          },
          {
            id: 'cfx96_ch5_excitation',
            name: 'Channel 5 Excitation (672-684)',
            profile: Array.from({ length: 401 }, (_, i) => {
              const wavelength = 400 + i;
              // Excitation: 672-684 nm (Quasar 705)
              return [wavelength, (wavelength >= 672 && wavelength <= 684) ? 100 : 0];
            }),
            color: '#B71C1C', // Dark red for excitation
            filterType: 'excitation'
          },
          // Detection (Emission) filters based on CFX96 Touch™ specifications
          {
            id: 'cfx96_ch1_detection',
            name: 'Channel 1 Detection (510-530)',
            profile: Array.from({ length: 401 }, (_, i) => {
              const wavelength = 400 + i;
              // Detection: 510-530 nm (FAM)
              return [wavelength, (wavelength >= 510 && wavelength <= 530) ? 100 : 0];
            }),
            color: '#42A5F5', // Light blue for detection
            filterType: 'emission'
          },
          {
            id: 'cfx96_ch2_detection',
            name: 'Channel 2 Detection (560-580)',
            profile: Array.from({ length: 401 }, (_, i) => {
              const wavelength = 400 + i;
              // Detection: 560-580 nm (HEX)
              return [wavelength, (wavelength >= 560 && wavelength <= 580) ? 100 : 0];
            }),
            color: '#66BB6A', // Light green for detection
            filterType: 'emission'
          },
          {
            id: 'cfx96_ch3_detection',
            name: 'Channel 3 Detection (610-650)',
            profile: Array.from({ length: 401 }, (_, i) => {
              const wavelength = 400 + i;
              // Detection: 610-650 nm (Texas Red)
              return [wavelength, (wavelength >= 610 && wavelength <= 650) ? 100 : 0];
            }),
            color: '#FFEB3B', // Light yellow for detection
            filterType: 'emission'
          },
          {
            id: 'cfx96_ch4_detection',
            name: 'Channel 4 Detection (675-690)',
            profile: Array.from({ length: 401 }, (_, i) => {
              const wavelength = 400 + i;
              // Detection: 675-690 nm (Cy5)
              return [wavelength, (wavelength >= 675 && wavelength <= 690) ? 100 : 0];
            }),
            color: '#FF9800', // Light orange for detection
            filterType: 'emission'
          },
          {
            id: 'cfx96_ch5_detection',
            name: 'Channel 5 Detection (705-730)',
            profile: Array.from({ length: 401 }, (_, i) => {
              const wavelength = 400 + i;
              // Detection: 705-730 nm (Quasar 705)
              return [wavelength, (wavelength >= 705 && wavelength <= 730) ? 100 : 0];
            }),
            color: '#EF5350', // Light red for detection
            filterType: 'emission'
          }
        ]
      }
    ];

    // Custom configurations that come pre-installed
    const customConfigs = [];



    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('instrumentConfigs');
      if (stored) {
        const storedConfigs = JSON.parse(stored);
        // Ensure all configs have categories, mark unknown ones as custom
        const categorizedConfigs = storedConfigs.map(cfg => ({
          ...cfg,
          category: cfg.category || 'custom'
        }));
        // Merge with defaults and customs, avoiding duplicates
        const configsByName = {};
        defaultConfigs.forEach(cfg => { configsByName[cfg.name] = cfg; });
        customConfigs.forEach(cfg => { configsByName[cfg.name] = cfg; });
        categorizedConfigs.forEach(cfg => { configsByName[cfg.name] = cfg; });
        return Object.values(configsByName);
      }
    }
    return [...defaultConfigs, ...customConfigs];
  });

  // Configuration editing state
  const [editingConfig, setEditingConfig] = useState(null);

  // On mount, fetch from backend and merge with local
  useEffect(() => {
    fetchInstrumentConfigs().then(backendConfigs => {
      setInstrumentConfigs(prev => {
        // Ensure backend configs have proper categories
        const categorizedBackendConfigs = backendConfigs.map(cfg => ({
          ...cfg,
          category: cfg.category || 'custom'
        }));
        
        // Merge unique configs by name, preserving categories
        const byName = {};
        // Start with current configs (includes defaults)
        prev.forEach(cfg => { byName[cfg.name] = cfg; });
        // Add/update with backend configs, but preserve default category for defaults
        categorizedBackendConfigs.forEach(cfg => {
          const existing = byName[cfg.name];
          if (existing && existing.category === 'default') {
            // Don't overwrite default configurations from backend
            return;
          }
          byName[cfg.name] = cfg;
        });
        
        const merged = Object.values(byName);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('instrumentConfigs', JSON.stringify(merged));
        }
        return merged;
      });
    }).catch(() => {});
  }, []);

  // CSV Import/Export handlers
  const handleExportConfig = (config) => {
    try {
      const csvContent = exportConfigToCSV(config);
      const filename = `${config.name.replace(/[^a-z0-9]/gi, '_')}_config.csv`;
      downloadCSV(csvContent, filename);
    } catch (error) {
      alert(`Failed to export configuration: ${error.message}`);
    }
  };

  const handleImportConfig = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      if (!file.name.toLowerCase().endsWith('.csv')) {
        throw new Error('Please select a CSV file');
      }

      const csvContent = await readFileAsText(file);
      const importedConfig = importConfigFromCSV(csvContent, file.name);
      
      // Always set imported configurations as custom category
      importedConfig.category = 'custom';
      
      // Check if configuration name already exists
      const existingConfig = instrumentConfigs.find(cfg => cfg.name === importedConfig.name);
      if (existingConfig) {
        const overwrite = window.confirm(
          `A configuration named "${importedConfig.name}" already exists. Do you want to overwrite it?`
        );
        if (!overwrite) {
          // Reset file input
          event.target.value = '';
          return;
        }
      }

      // Add imported configuration (always as custom)
      setInstrumentConfigs(prev => {
        const newConfigs = prev.filter(c => c.name !== importedConfig.name);
        newConfigs.push(importedConfig);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('instrumentConfigs', JSON.stringify(newConfigs));
        }
        return newConfigs;
      });

      alert(`Successfully imported configuration "${importedConfig.name}" with ${importedConfig.filters.length} filters.`);
    } catch (error) {
      alert(`Failed to import configuration: ${error.message}`);
    }

    // Reset file input
    event.target.value = '';
  };

  // Cache clearing handler
  const handleClearCache = () => {
    const confirmClear = window.confirm(
      'Are you sure you want to clear all cached data?\n\n' +
      'This will reset:\n' +
      '• Custom instrument configurations (default configs will be preserved)\n' +
      '• User settings and preferences\n' +
      '• Selected dyes and filters\n' +
      '• All other stored data\n\n' +
      'Default configurations (QuantStudio 5, CFX96 Touch™) will remain available.\n\n' +
      'This action cannot be undone.'
    );

    if (confirmClear) {
      try {
        // Clear all localStorage data
        if (typeof window !== 'undefined') {
          window.localStorage.clear();
        }

        // Recreate the initial configuration arrays
        const initialDefaultConfigs = [
          {
            name: 'QuantStudio 5',
            category: 'default',
            filters: [
              // Excitation filters (blue-tinted colors)
              {
                name: 'x1 Excitation (Blue)',
                profile: Array.from({ length: 301 }, (_, i) => {
                  const wavelength = 400 + i;
                  // Excitation: 470 ± 15 nm
                  return [wavelength, (wavelength >= 455 && wavelength <= 485) ? 100 : 0];
                }),
                color: '#1565C0', // Dark blue for excitation
                filterType: 'excitation'
              },
              {
                name: 'x2 Excitation (Green)',
                profile: Array.from({ length: 301 }, (_, i) => {
                  const wavelength = 400 + i;
                  // Excitation: 520 ± 10 nm
                  return [wavelength, (wavelength >= 510 && wavelength <= 530) ? 100 : 0];
                }),
                color: '#2E7D32', // Dark green for excitation
                filterType: 'excitation'
              },
              {
                name: 'x3 Excitation (Yellow)',
                profile: Array.from({ length: 301 }, (_, i) => {
                  const wavelength = 400 + i;
                  // Excitation: 550 ± 10 nm
                  return [wavelength, (wavelength >= 540 && wavelength <= 560) ? 100 : 0];
                }),
                color: '#F57F17', // Dark yellow for excitation
                filterType: 'excitation'
              },
              {
                name: 'x4 Excitation (Orange)',
                profile: Array.from({ length: 301 }, (_, i) => {
                  const wavelength = 400 + i;
                  // Excitation: 580 ± 10 nm
                  return [wavelength, (wavelength >= 570 && wavelength <= 590) ? 100 : 0];
                }),
                color: '#E65100', // Dark orange for excitation
                filterType: 'excitation'
              },
              {
                name: 'x5 Excitation (Red)',
                profile: Array.from({ length: 301 }, (_, i) => {
                  const wavelength = 400 + i;
                  // Excitation: 640 ± 10 nm
                  return [wavelength, (wavelength >= 630 && wavelength <= 650) ? 100 : 0];
                }),
                color: '#B71C1C', // Dark red for excitation
                filterType: 'excitation'
              },
              {
                name: 'x6 Excitation (Deep-Red)',
                profile: Array.from({ length: 301 }, (_, i) => {
                  const wavelength = 400 + i;
                  // Excitation: 662 ± 10 nm
                  return [wavelength, (wavelength >= 652 && wavelength <= 672) ? 100 : 0];
                }),
                color: '#4A148C', // Dark purple for excitation
                filterType: 'excitation'
              },
              // Emission filters (lighter, warmer colors)
              {
                name: 'm1 Emission (Blue)',
                profile: Array.from({ length: 301 }, (_, i) => {
                  const wavelength = 400 + i;
                  // Emission: 520 ± 15 nm
                  return [wavelength, (wavelength >= 505 && wavelength <= 535) ? 100 : 0];
                }),
                color: '#42A5F5', // Light blue for emission
                filterType: 'emission'
              },
              {
                name: 'm2 Emission (Green)',
                profile: Array.from({ length: 301 }, (_, i) => {
                  const wavelength = 400 + i;
                  // Emission: 558 ± 12 nm
                  return [wavelength, (wavelength >= 546 && wavelength <= 570) ? 100 : 0];
                }),
                color: '#66BB6A', // Light green for emission
                filterType: 'emission'
              },
              {
                name: 'm3 Emission (Yellow)',
                profile: Array.from({ length: 301 }, (_, i) => {
                  const wavelength = 400 + i;
                  // Emission: 587 ± 10 nm
                  return [wavelength, (wavelength >= 577 && wavelength <= 597) ? 100 : 0];
                }),
                color: '#FFEB3B', // Light yellow for emission
                filterType: 'emission'
              },
              {
                name: 'm4 Emission (Orange)',
                profile: Array.from({ length: 301 }, (_, i) => {
                  const wavelength = 400 + i;
                  // Emission: 623 ± 14 nm
                  return [wavelength, (wavelength >= 609 && wavelength <= 637) ? 100 : 0];
                }),
                color: '#FF9800', // Light orange for emission
                filterType: 'emission'
              },
              {
                name: 'm5 Emission (Red)',
                profile: Array.from({ length: 301 }, (_, i) => {
                  const wavelength = 400 + i;
                  // Emission: 682 ± 14 nm
                  return [wavelength, (wavelength >= 668 && wavelength <= 696) ? 100 : 0];
                }),
                color: '#EF5350', // Light red for emission
                filterType: 'emission'
              },
              {
                name: 'm6 Emission (Deep-Red)',
                profile: Array.from({ length: 401 }, (_, i) => {
                  const wavelength = 400 + i;
                  // Emission: 711 ± 12 nm
                  return [wavelength, (wavelength >= 699 && wavelength <= 723) ? 100 : 0];
                }),
                color: '#AB47BC', // Light purple for emission
                filterType: 'emission'
              }
            ]
          }
        ];

        // Reset all state to initial values, but preserve all default configurations
        const defaultConfigs = instrumentConfigs.filter(config => config.category === 'default');
        setInstrumentConfigs(defaultConfigs);
        setSelectedDyes([]);
        setFilters([]);
        setNormalizationDyeId(null);
        setBrightnessNormalizationOn(false);
        setSelectedCamera('');
        setCameraQE([]);
        setIncludeCameraQEInCrosstalk(true);

        alert('Cache cleared successfully! All data has been reset to defaults.');
      } catch (error) {
        alert(`Failed to clear cache: ${error.message}`);
      }
    }
  };

  // Handle individual filter visibility toggle
  const handleFilterToggle = (filterIndex, isVisible) => {
    setFilterVisibility(prev => ({
      ...prev,
      [filterIndex]: isVisible
    }));
  };
  
  // Handle filter update from SpectraPlot drag operations
  const handleFilterUpdate = (updatedFilter, isTemporary) => {
    // Update the filter in the current filters array for real-time display
    const updatedFilters = filters.map(filter => 
      filter.id === updatedFilter.id ? updatedFilter : filter
    );
    setFilters(updatedFilters);
    
    // If this is a final update (not temporary), also update the saved configuration
    if (!isTemporary) {
      setInstrumentConfigs(prev => {
        const updatedConfigs = prev.map(config => {
          if (config.category === 'custom' && 
              JSON.stringify(config.filters.map(f => f.id).sort()) === JSON.stringify(filters.map(f => f.id).sort())) {
            return {
              ...config,
              filters: config.filters.map(filter => 
                filter.id === updatedFilter.id ? updatedFilter : filter
              )
            };
          }
          return config;
        });
        
        // Persist to localStorage
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('instrumentConfigs', JSON.stringify(updatedConfigs));
        }
        
        return updatedConfigs;
      });
    }
  };

  // Initialize filter visibility when filters change
  React.useEffect(() => {
    const newVisibility = {};
    filters.forEach((filter, index) => {
      // Default to visible if not already set
      newVisibility[index] = filterVisibility[index] !== undefined ? filterVisibility[index] : true;
    });
    setFilterVisibility(newVisibility);
  }, [filters.length]);

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

  // Filter only emission filters for crosstalk calculation
  const emissionFiltersWithProfile = React.useMemo(() => {
    return filtersWithProfile.filter(filter => filter.filterType === 'emission');
  }, [filtersWithProfile]);

  // Emission filter order state for crosstalk table
  const [emissionFilterOrder, setEmissionFilterOrder] = useState([]);
  // Reset emission filter order if emission filters change
  useEffect(() => {
    setEmissionFilterOrder(emissionFiltersWithProfile.map((_, i) => i));
  }, [emissionFiltersWithProfile.length]);

  // Compute crosstalk matrix (only using emission filters)
  const crosstalk = React.useMemo(() => {
    if (!selectedDyes.length || !emissionFiltersWithProfile.length) return null;
    return computeCrosstalkMatrix(
      selectedDyes,
      emissionFiltersWithProfile,
      dyeSpectraForCrosstalk,
      false,
      {},
      includeCameraQEInCrosstalk ? cameraQEProfile : null
    );
  }, [selectedDyes, emissionFiltersWithProfile, dyeSpectraForCrosstalk, includeCameraQEInCrosstalk, cameraQEProfile]);

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
      {/* Spectra Plot and Crosstalk Table moved to top for better visibility */}
      <SpectraPlot
        selectedDyes={selectedDyes}
        dyeSpectra={dyeSpectra}
        filterSpectra={filterSpectra}
        filters={filtersWithProfile}
        filterOrder={filterOrder}
        filterVisibility={filterVisibility}
        darkMode={darkMode}
        normalizationDyeId={normalizationDyeId}
        normalizedBrightness={normalizedBrightness}
        brightnessNormalizationOn={brightnessNormalizationOn}
        cameraQE={includeCameraQEInCrosstalk ? cameraQE : []}
        isCustomConfig={instrumentConfigs.some(config => 
          config.category === 'custom' && 
          JSON.stringify(config.filters.map(f => f.id).sort()) === JSON.stringify(filtersWithProfile.map(f => f.id).sort())
        )}
        onFilterUpdate={handleFilterUpdate}
        onClearCache={handleClearCache}
      />
      <div style={{ margin: '18px 0 8px 0', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        {/* Brightness normalization controls */}
        {selectedDyes.length > 0 && (
          <>
            <label htmlFor="norm-dye-select"><b>Normalize brightness to:</b></label>
            <select
              id="norm-dye-select"
              value={normalizationDyeId || ''}
              onChange={e => setNormalizationDyeId(e.target.value || null)}
              style={{ minWidth: 160 }}
              title="Select a reference dye to normalize brightness values. This helps compare relative brightness across different dyes."
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
                style={{ marginLeft: 8 }}
                title="Enable brightness normalization to compare dye intensities relative to the selected reference dye. Requires selecting a reference dye first."
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
          </>
        )}
        
        {/* Camera QE dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label htmlFor="camera-select"><b>Camera QE:</b></label>
          <select
            id="camera-select"
            value={selectedCamera}
            onChange={e => setSelectedCamera(e.target.value)}
            style={{ minWidth: 180 }}
            title="Select a camera to include its quantum efficiency profile in crosstalk calculations"
          >
            <option value="">-- None --</option>
            {cameraList.map(cam => (
              <option key={cam.id} value={cam.id}>{cam.name}</option>
            ))}
          </select>
          {selectedCamera && <span style={{ color: '#0288d1', fontSize: '0.9em' }}>(Active)</span>}
        </div>
        
        {/* Include QE in Crosstalk toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            type="checkbox"
            checked={includeCameraQEInCrosstalk}
            onChange={e => setIncludeCameraQEInCrosstalk(e.target.checked)}
            disabled={!selectedCamera}
            style={{ marginRight: 4 }}
            title="Include camera quantum efficiency in crosstalk calculations for more accurate real-world analysis. Requires selecting a camera first."
          />
          <span style={{ color: includeCameraQEInCrosstalk ? '#0288d1' : '#888' }}>
            Include QE in Crosstalk
          </span>
        </label>
      </div>
      <CrosstalkTable dyes={selectedDyes} filters={emissionFiltersWithProfile} crosstalk={crosstalk} filterOrder={emissionFilterOrder} setFilterOrder={setEmissionFilterOrder} darkMode={darkMode} />

      {/* Side-by-side layout: Configuration on left, Selection on right */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
        {/* Left side: Instrument Configuration */}
        <div style={{ flex: '1', minWidth: '0' }}>
          <InstrumentConfigBuilder
            selectedDyes={selectedDyes}
            filters={filters}
            editingConfig={editingConfig}
            onCancelEdit={() => setEditingConfig(null)}
            onSave={cfg => {
              setInstrumentConfigs(prev => {
                // Add category field - user-created configs are "custom"
                const configWithCategory = { ...cfg, category: 'custom' };
                
                let newConfigs;
                if (cfg.isEdit && cfg.originalName) {
                  // Editing existing configuration
                  newConfigs = prev.map(c => 
                    c.name === cfg.originalName 
                      ? { ...configWithCategory, name: cfg.name, filters: cfg.filters }
                      : c
                  );
                } else {
                  // Creating new configuration
                  newConfigs = [...prev.filter(c => c.name !== cfg.name), configWithCategory];
                }
                
                if (typeof window !== 'undefined') {
                  window.localStorage.setItem('instrumentConfigs', JSON.stringify(newConfigs));
                }
                return newConfigs;
              });
              
              // Clear editing state after save
              setEditingConfig(null);
            }}
          />
          {instrumentConfigs.length > 0 && (
            <div style={{margin:'16px 0', padding:8, border:'1px solid #aaa', borderRadius:6}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12}}>
                <h3 style={{margin: 0}}>Saved Instrument Configurations</h3>
                <div style={{display: 'flex', gap: 8}}>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleImportConfig}
                    style={{display: 'none'}}
                    id="config-import-input"
                  />
                  <button
                    onClick={() => document.getElementById('config-import-input').click()}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#0288d1',
                      color: 'white',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: '0.9em'
                    }}
                    title="Import configuration from CSV file"
                  >
                    📁 Import CSV
                  </button>
                </div>
              </div>
              
              {/* Default Configurations */}
              {instrumentConfigs.filter(cfg => cfg.category === 'default').length > 0 && (
                <div style={{marginBottom: 16}}>
                  <h4 style={{color: '#666', marginBottom: 8}}>Default Configurations</h4>
                  <ul style={{marginTop: 0}}>
                    {instrumentConfigs
                      .filter(cfg => cfg.category === 'default')
                      .map((cfg, i) => (
                        <li key={`default-${i}`} style={{marginBottom: 4}}>
                          <b>{cfg.name}</b> ({cfg.filters.length} filters)
                          <span style={{color: '#888', fontSize: '0.9em', marginLeft: 8}}>[Default]</span>
                          <button 
                            style={{marginLeft:8}} 
                            onClick={() => setFilters(cfg.filters)}
                            title={`Apply ${cfg.name} configuration with ${cfg.filters.length} filters. This will replace any currently selected filters.`}
                          >
                            Apply
                          </button>
                          <button 
                            style={{marginLeft:4, color: '#0288d1'}} 
                            onClick={() => handleExportConfig(cfg)}
                            title="Export configuration as CSV"
                          >
                            Export
                          </button>
                        </li>
                      ))
                    }
                  </ul>
                </div>
              )}
              
              {/* Custom Configurations */}
              {instrumentConfigs.filter(cfg => cfg.category === 'custom').length > 0 && (
                <div>
                  <h4 style={{color: '#666', marginBottom: 8}}>Custom Configurations</h4>
                  <ul style={{marginTop: 0}}>
                    {instrumentConfigs
                      .filter(cfg => cfg.category === 'custom')
                      .map((cfg, i) => (
                        <li key={`custom-${i}`} style={{marginBottom: 4}}>
                          <b>{cfg.name}</b> ({cfg.filters.length} filters)
                          <button 
                            style={{marginLeft:8}} 
                            onClick={() => setFilters(cfg.filters)}
                            title={`Apply ${cfg.name} custom configuration with ${cfg.filters.length} filters. This will replace any currently selected filters.`}
                          >
                            Apply
                          </button>
                          <button 
                            style={{marginLeft:4, backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: 3, padding: '2px 6px', fontSize: '0.8em'}} 
                            onClick={() => setEditingConfig(cfg)}
                            title="Edit this configuration - modify name, add/remove filters, or change filter properties"
                          >
                            Edit
                          </button>
                          <button 
                            style={{marginLeft:4, color: '#0288d1'}} 
                            onClick={() => handleExportConfig(cfg)}
                            title="Export configuration as CSV"
                          >
                            Export
                          </button>
                          <button 
                            style={{marginLeft:4, color: '#d32f2f'}} 
                            onClick={() => {
                              if (window.confirm(`Delete configuration "${cfg.name}"?`)) {
                                setInstrumentConfigs(prev => {
                                  const newConfigs = prev.filter(c => c.name !== cfg.name);
                                  if (typeof window !== 'undefined') {
                                    window.localStorage.setItem('instrumentConfigs', JSON.stringify(newConfigs));
                                  }
                                  return newConfigs;
                                });
                              }
                            }}
                            title="Delete this configuration permanently"
                          >
                            Delete
                          </button>
                        </li>
                      ))
                    }
                  </ul>
                </div>
              )}
              
              {instrumentConfigs.filter(cfg => cfg.category === 'custom').length === 0 && 
               instrumentConfigs.filter(cfg => cfg.category === 'default').length > 0 && (
                <p style={{color: '#888', fontStyle: 'italic', marginTop: 8}}>
                  No custom configurations yet. Use the Build Instrument Configuration tool above to create your own.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right side: Dye and Filter Selection */}
        <div style={{ flex: '1', minWidth: '0' }}>
          <DyeSelector
            selectedDyes={selectedDyes}
            setSelectedDyes={setSelectedDyes}
            setDyeSpectra={setDyeSpectra}
            darkMode={darkMode}
          />

          <FilterManager 
            filters={filters} 
            setFilters={setFilters} 
            setFilterSpectra={setFilterSpectra} 
            darkMode={darkMode} 
            instrumentConfigs={instrumentConfigs}
          />
        </div>
      </div>

      {/* Keep instrumentConfigs in sync with localStorage on any change */}
      {React.useEffect(() => {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('instrumentConfigs', JSON.stringify(instrumentConfigs));
        }
      }, [instrumentConfigs])}
      


      
      {/* Filter Toggle Controls for independent excitation/emission filter visibility */}
      <FilterToggleControls 
        filters={filters}
        onFilterToggle={handleFilterToggle}
        darkMode={darkMode}
      />
      


    </div>
  );
}
