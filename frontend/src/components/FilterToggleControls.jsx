import React, { useState, useEffect } from 'react';

export default function FilterToggleControls({ filters, onFilterToggle, darkMode = false }) {
  // State to track collapse/expand status
  const [isExpanded, setIsExpanded] = useState(true);
  
  // State to track filter type visibility (similar to SpectraPlot)
  const [showExcitation, setShowExcitation] = useState(true);
  const [showEmission, setShowEmission] = useState(true);
  
  // State to track which filters are enabled/visible
  const [enabledFilters, setEnabledFilters] = useState(() => {
    // Initialize all filters as enabled by default
    const initialState = {};
    filters.forEach((filter, index) => {
      initialState[index] = true;
    });
    return initialState;
  });

  // Update enabled filters when filters prop changes
  useEffect(() => {
    const newEnabledState = {};
    filters.forEach((filter, index) => {
      // Preserve existing state if available, otherwise default to enabled
      newEnabledState[index] = enabledFilters[index] !== undefined ? enabledFilters[index] : true;
    });
    setEnabledFilters(newEnabledState);
  }, [filters]);

  // Handle individual filter toggle
  const handleToggle = (filterIndex) => {
    const newEnabledState = {
      ...enabledFilters,
      [filterIndex]: !enabledFilters[filterIndex]
    };
    setEnabledFilters(newEnabledState);
    
    // Call parent callback with updated filter visibility
    if (onFilterToggle) {
      onFilterToggle(filterIndex, newEnabledState[filterIndex]);
    }
  };

  // Handle filter type toggle (excitation or emission)
  const handleFilterTypeToggle = (filterType) => {
    const newVisibility = filterType === 'excitation' ? !showExcitation : !showEmission;
    
    if (filterType === 'excitation') {
      setShowExcitation(newVisibility);
    } else {
      setShowEmission(newVisibility);
    }
    
    // Update individual filter states and call parent callbacks
    const newEnabledState = { ...enabledFilters };
    filters.forEach((filter, index) => {
      if (filter.filterType === filterType) {
        newEnabledState[index] = newVisibility;
        if (onFilterToggle) {
          onFilterToggle(index, newVisibility);
        }
      }
    });
    
    setEnabledFilters(newEnabledState);
  };

  // Separate filters by type
  const excitationFilters = filters.filter(filter => filter.filterType === 'excitation');
  const emissionFilters = filters.filter(filter => filter.filterType === 'emission');
  const otherFilters = filters.filter(filter => !filter.filterType);

  const containerStyle = {
    margin: '16px 0',
    padding: '16px',
    border: `1px solid ${darkMode ? '#444' : '#ddd'}`,
    borderRadius: '8px',
    backgroundColor: darkMode ? '#2a2a2a' : '#f9f9f9'
  };

  const sectionStyle = {
    marginBottom: '16px'
  };

  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: isExpanded ? '16px' : '0',
    cursor: 'pointer',
    padding: '4px 0'
  };

  const sectionTitleStyle = {
    fontSize: '1.1em',
    fontWeight: 'bold',
    color: darkMode ? '#f5f5f5' : '#333',
    margin: 0
  };

  const toggleButtonStyle = {
    background: 'none',
    border: 'none',
    fontSize: '1.2em',
    cursor: 'pointer',
    color: darkMode ? '#f5f5f5' : '#333',
    padding: '4px 8px',
    borderRadius: '4px',
    transition: 'background-color 0.2s',
    ':hover': {
      backgroundColor: darkMode ? '#444' : '#e0e0e0'
    }
  };

  const filterGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '8px'
  };

  const filterItemStyle = {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 8px',
    borderRadius: '4px',
    backgroundColor: darkMode ? '#333' : '#fff',
    border: `1px solid ${darkMode ? '#555' : '#ddd'}`
  };

  const checkboxStyle = {
    marginRight: '8px',
    cursor: 'pointer'
  };

  const labelStyle = {
    cursor: 'pointer',
    fontSize: '0.9em',
    color: darkMode ? '#f5f5f5' : '#333'
  };

  const colorIndicatorStyle = (color, enabled) => ({
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    backgroundColor: color,
    marginLeft: '8px',
    opacity: enabled ? 1 : 0.3,
    border: `2px solid ${darkMode ? '#555' : '#ddd'}`
  });

  const renderFilterSection = (sectionFilters, title) => {
    if (sectionFilters.length === 0) return null;

    return (
      <div style={sectionStyle}>
        <div style={{...sectionTitleStyle, marginBottom: '8px'}}>{title}</div>
        <div style={filterGridStyle}>
          {sectionFilters.map((filter) => {
            const originalIndex = filters.findIndex(f => f === filter);
            const isEnabled = enabledFilters[originalIndex];
            
            return (
              <div key={originalIndex} style={filterItemStyle}>
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={() => handleToggle(originalIndex)}
                  style={checkboxStyle}
                  id={`filter-${originalIndex}`}
                />
                <label 
                  htmlFor={`filter-${originalIndex}`}
                  style={{
                    ...labelStyle,
                    opacity: isEnabled ? 1 : 0.6
                  }}
                >
                  {filter.name}
                </label>
                {filter.color && (
                  <div style={colorIndicatorStyle(filter.color, isEnabled)} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (filters.length === 0) {
    return (
      <div style={containerStyle}>
        <div 
          style={headerStyle} 
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div style={sectionTitleStyle}>Filter Controls</div>
          <button style={toggleButtonStyle}>
            {isExpanded ? '▼' : '▶'}
          </button>
        </div>
        {isExpanded && (
          <p style={{ color: darkMode ? '#aaa' : '#666', fontStyle: 'italic' }}>
            No filters loaded. Apply an instrument configuration to see filter controls.
          </p>
        )}
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div 
        style={headerStyle} 
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={sectionTitleStyle}>Filter Visibility Controls</div>
        <button style={toggleButtonStyle}>
          {isExpanded ? '▼' : '▶'}
        </button>
      </div>
      
      {isExpanded && (
        <>
          {/* Filter Type Toggle Controls */}
          {(excitationFilters.length > 0 || emissionFilters.length > 0) && (
            <div style={{
              marginBottom: '16px',
              padding: '12px',
              backgroundColor: darkMode ? '#1a1a1a' : '#f0f0f0',
              borderRadius: '6px',
              border: `1px solid ${darkMode ? '#444' : '#ddd'}`
            }}>
              <div style={{
                fontSize: '0.95em',
                fontWeight: 'bold',
                color: darkMode ? '#f5f5f5' : '#333',
                marginBottom: '8px'
              }}>
                Filter Type Toggles
              </div>
              <div style={{
                display: 'flex',
                gap: '12px',
                flexWrap: 'wrap'
              }}>
                {excitationFilters.length > 0 && (
                  <button
                    onClick={() => handleFilterTypeToggle('excitation')}
                    title={`${showExcitation ? 'Hide' : 'Show'} all excitation filters in the spectra plot. Excitation filters control the illumination wavelengths.`}
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.9em',
                      backgroundColor: showExcitation ? '#1565C0' : (darkMode ? '#444' : '#ccc'),
                      color: showExcitation ? 'white' : (darkMode ? '#aaa' : '#666'),
                      border: `2px solid ${showExcitation ? '#1565C0' : (darkMode ? '#555' : '#999')}`,
                      borderRadius: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontWeight: '600'
                    }}
                    onMouseEnter={(e) => {
                      if (showExcitation) {
                        e.target.style.backgroundColor = '#0d47a1';
                      } else {
                        e.target.style.backgroundColor = darkMode ? '#555' : '#bbb';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = showExcitation ? '#1565C0' : (darkMode ? '#444' : '#ccc');
                    }}
                  >
                    🔵 Excitation {showExcitation ? 'ON' : 'OFF'}
                  </button>
                )}
                {emissionFilters.length > 0 && (
                  <button
                    onClick={() => handleFilterTypeToggle('emission')}
                    title={`${showEmission ? 'Hide' : 'Show'} all emission filters in the spectra plot. Emission filters control the detection wavelengths.`}
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.9em',
                      backgroundColor: showEmission ? '#E31E24' : (darkMode ? '#444' : '#ccc'),
                      color: showEmission ? 'white' : (darkMode ? '#aaa' : '#666'),
                      border: `2px solid ${showEmission ? '#E31E24' : (darkMode ? '#555' : '#999')}`,
                      borderRadius: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontWeight: '600'
                    }}
                    onMouseEnter={(e) => {
                      if (showEmission) {
                        e.target.style.backgroundColor = '#B71C1C';
                      } else {
                        e.target.style.backgroundColor = darkMode ? '#555' : '#bbb';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = showEmission ? '#E31E24' : (darkMode ? '#444' : '#ccc');
                    }}
                  >
                    🔴 Emission {showEmission ? 'ON' : 'OFF'}
                  </button>
                )}
              </div>
            </div>
          )}
          
          {renderFilterSection(excitationFilters, '🔵 Excitation Filters')}
          {renderFilterSection(emissionFilters, '🔴 Emission Filters')}
          {renderFilterSection(otherFilters, '⚪ Other Filters')}
          
          <div style={{ 
            marginTop: '12px', 
            padding: '8px', 
            backgroundColor: darkMode ? '#1a1a1a' : '#f0f0f0', 
            borderRadius: '4px',
            fontSize: '0.85em',
            color: darkMode ? '#bbb' : '#666'
          }}>
            💡 <strong>Tip:</strong> Toggle individual excitation and emission filters to customize your plot view. 
            Excitation filters use darker colors, emission filters use lighter colors.
          </div>
        </>
      )}
    </div>
  );
}
