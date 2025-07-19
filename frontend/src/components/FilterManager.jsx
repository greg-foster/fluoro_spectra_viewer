import React, { useRef } from "react";
import FilterSelector from "./FilterSelector";

export default function FilterManager({ filters, setFilters, setFilterSpectra, darkMode }) {
  const fileInput = useRef();

  // Handle CSV/JSON filter upload
  const handleUpload = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        let filtersData;
        if (file.name.endsWith(".json")) {
          filtersData = JSON.parse(evt.target.result);
        } else if (file.name.endsWith(".csv")) {
          // Simple CSV parser: wavelength,transmission\n...
          filtersData = csvToFilters(evt.target.result);
        }
        if (filtersData) setFilters([...filters, ...filtersData]);
      } catch {
        alert("Failed to parse filter file");
      }
    };
    reader.readAsText(file);
  };

  // Manual filter add (simple example)
  const handleAdd = () => {
    const name = prompt("Filter name?");
    const center = Number(prompt("Center wavelength?"));
    const width = Number(prompt("Bandwidth?"));
    if (!name || isNaN(center) || isNaN(width)) return;
    setFilters([
      ...filters,
      {
        name,
        profile: Array.from({ length: 61 }, (_, i) => [center - 30 + i, i > 30 - width / 2 && i < 30 + width / 2 ? 100 : 0])
      }
    ]);
  };

  // Simple CSV parser for filters
  function csvToFilters(csv) {
    const rows = csv.trim().split(/\r?\n/);
    return [
      {
        name: "Uploaded Filter",
        profile: rows.map(line => {
          const [wl, t] = line.split(/,|\t/);
          return [Number(wl), Number(t)];
        })
      }
    ];
  }

  return (
    <div>
      <FilterSelector
        selectedFilters={filters}
        setSelectedFilters={setFilters}
        setFilterSpectra={setFilterSpectra}
        darkMode={darkMode}
      />

    </div>
  );
}
