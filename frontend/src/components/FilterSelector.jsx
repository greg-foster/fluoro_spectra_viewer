import React, { useEffect, useState } from "react";
import Select from "react-select";

export default function FilterSelector({ selectedFilters, setSelectedFilters, setFilterSpectra, darkMode = false }) {
  const [filterList, setFilterList] = useState([]);
  const [options, setOptions] = useState([]);

  useEffect(() => {
    async function fetchFilters() {
      try {
        // Fetch list of filter files from backend
        const resp = await fetch(`${process.env.REACT_APP_API_BASE_URL || ""}/api/filters`);
        const files = await resp.json();
        // Map to option objects for react-select
        setFilterList(files);
        setOptions(
          files.map(f => ({
            value: f.id,
            label: f.name || f.id
          }))
        );
      } catch (e) {
        setFilterList([]);
        setOptions([]);
      }
    }
    fetchFilters();
  }, []);

  useEffect(() => {
    async function fetchSpectra() {
      const spectra = {};
      for (const filter of selectedFilters) {
        try {
          const resp = await fetch(`${process.env.REACT_APP_API_BASE_URL || ""}/api/filters/${filter.id}`);
          let data = null;
          try {
            data = await resp.json();
          } catch (e) {
            console.error('DEBUG FilterSelector: failed to parse JSON for', filter.id, e);
            const text = await resp.text();
            console.error('DEBUG FilterSelector: response text:', text);
          }
          console.log('DEBUG FilterSelector: fetched', filter.id, data);
          // Patch: Convert nested structure to .profile array if present
          if (
            data &&
            data.items &&
            data.items[0] &&
            data.items[0].spectra &&
            data.items[0].spectra[0] &&
            Array.isArray(data.items[0].spectra[0].data)
          ) {
            data.profile = data.items[0].spectra[0].data.map(pt => [pt.x, pt.y]);
          }
          spectra[filter.id] = data;
        } catch {
          spectra[filter.id] = null;
        }
      }
      setFilterSpectra(spectra);
    }
    if (selectedFilters.length > 0) fetchSpectra();
    else setFilterSpectra({});
  }, [selectedFilters, setFilterSpectra]);

  const handleChange = selectedOptions => {
    if (!selectedOptions) setSelectedFilters([]);
    else {
      setSelectedFilters(selectedOptions.map(opt => filterList.find(f => f.id === opt.value)));
    }
  };

  return (
    <div>
      <h2>Select Filters</h2>
      <Select
        options={options}
        isMulti
        isClearable
        value={selectedFilters.filter(f => f && f.id !== undefined).map(f => ({ value: f.id, label: f.name || f.id }))}
        onChange={handleChange}
        /* Warn if malformed filters are present */
        {...(selectedFilters.some(f => !f || f.id === undefined) ? (console.warn('Warning: Malformed filter in selectedFilters', selectedFilters), {}) : {})}
        placeholder="Search or select filters..."
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
              color: dark ? '#f5f5f5' : '#222',
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
    </div>
  );
}
