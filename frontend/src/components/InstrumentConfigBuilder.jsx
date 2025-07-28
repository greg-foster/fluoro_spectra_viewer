import React, { useState } from "react";

// Utility functions to calculate filter properties from profile data
function calculateCenterWavelength(profile) {
  if (!profile || profile.length === 0) return 'N/A';
  
  // Find the wavelength with maximum transmission
  let maxTransmission = 0;
  let centerWavelength = 0;
  
  profile.forEach(([wavelength, transmission]) => {
    if (transmission > maxTransmission) {
      maxTransmission = transmission;
      centerWavelength = wavelength;
    }
  });
  
  return Math.round(centerWavelength);
}

function calculateBandwidth(profile) {
  if (!profile || profile.length === 0) return 'N/A';
  
  // Find the full width at half maximum (FWHM)
  const maxTransmission = Math.max(...profile.map(([_, transmission]) => transmission));
  const halfMax = maxTransmission / 2;
  
  // Find wavelengths where transmission crosses half maximum
  const crossings = [];
  for (let i = 0; i < profile.length - 1; i++) {
    const [wl1, trans1] = profile[i];
    const [wl2, trans2] = profile[i + 1];
    
    // Check if line crosses half maximum
    if ((trans1 <= halfMax && trans2 >= halfMax) || (trans1 >= halfMax && trans2 <= halfMax)) {
      // Linear interpolation to find exact crossing point
      const crossingWl = wl1 + (halfMax - trans1) * (wl2 - wl1) / (trans2 - trans1);
      crossings.push(crossingWl);
    }
  }
  
  if (crossings.length >= 2) {
    // FWHM is the difference between the first and last crossing
    return Math.round(Math.abs(crossings[crossings.length - 1] - crossings[0]));
  }
  
  return 'N/A';
}

export default function InstrumentConfigBuilder({ onSave, editingConfig, onCancelEdit }) {
  const [configName, setConfigName] = useState("");
  const [filters, setFilters] = useState([]);
  const [manualName, setManualName] = useState("");
  const [manualCenter, setManualCenter] = useState("");
  const [manualWidth, setManualWidth] = useState("");
  const [manualFilterType, setManualFilterType] = useState("excitation");
  const [error, setError] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);

  // Effect to handle editing mode
  React.useEffect(() => {
    if (editingConfig) {
      setIsEditMode(true);
      setConfigName(editingConfig.name);
      setFilters([...editingConfig.filters]);
      setError("");
    } else {
      setIsEditMode(false);
      setConfigName("");
      setFilters([]);
      setError("");
    }
  }, [editingConfig]);

  function handleAddFilter() {
    if (!manualName || isNaN(+manualCenter) || isNaN(+manualWidth)) {
      setError("Please provide valid filter name, center, and width.");
      return;
    }
    
    // Generate unique ID for the filter
    const filterId = `manual_${manualFilterType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Set color based on filter type (following Thermo Fisher branding)
    const filterColor = manualFilterType === 'excitation' 
      ? '#1565C0' // Dark blue for excitation
      : '#E31E24'; // Thermo Fisher red for emission
    
    setFilters([
      ...filters,
      {
        id: filterId,
        name: manualName,
        profile: Array.from({ length: 61 }, (_, i) => [
          +manualCenter - 30 + i,
          i > 30 - manualWidth / 2 && i < 30 + manualWidth / 2 ? 100 : 0
        ]),
        filterType: manualFilterType,
        color: filterColor
      }
    ]);
    setManualName("");
    setManualCenter("");
    setManualWidth("");
    // Keep the filter type selection for convenience
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
    onSave && onSave({ 
      name: configName.trim(), 
      filters,
      isEdit: isEditMode,
      originalName: editingConfig?.name
    });
    
    // Reset form after save
    setConfigName("");
    setFilters([]);
    setIsEditMode(false);
  }

  function handleCancel() {
    setConfigName("");
    setFilters([]);
    setIsEditMode(false);
    setError("");
    onCancelEdit && onCancelEdit();
  }

  return (
    <div style={{ border: "1px solid #888", borderRadius: 8, padding: 16, margin: 16 }}>
      <h2>{isEditMode ? `Edit Configuration: ${editingConfig?.name}` : "Build Instrument Configuration"}</h2>
      {isEditMode && (
        <div style={{ 
          backgroundColor: '#fff3cd', 
          border: '1px solid #ffeaa7', 
          borderRadius: '4px', 
          padding: '8px', 
          marginBottom: '12px',
          fontSize: '0.9em',
          color: '#856404'
        }}>
          <strong>Edit Mode:</strong> You are currently editing the "{editingConfig?.name}" configuration. 
          Make your changes and click "Update Configuration" to save, or "Cancel" to discard changes.
        </div>
      )}
      <div style={{ marginBottom: 8 }}>
        <label>
          Configuration Name:
          <input
            value={configName}
            onChange={e => setConfigName(e.target.value)}
            placeholder="Unique name"
            style={{ marginLeft: 8 }}
            title="Enter a unique name for your custom instrument configuration"
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
          title="Enter a descriptive name for this filter (e.g., 'FITC Excitation', 'Cy5 Emission')"
        />
        <input
          placeholder="Center nm"
          value={manualCenter}
          onChange={e => setManualCenter(e.target.value)}
          style={{ marginLeft: 8, width: 70 }}
          title="Enter the center wavelength in nanometers (e.g., 488 for FITC excitation)"
        />
        <input
          placeholder="Bandwidth"
          value={manualWidth}
          onChange={e => setManualWidth(e.target.value)}
          style={{ marginLeft: 8, width: 70 }}
          title="Enter the filter bandwidth in nanometers (e.g., 20 for a ±10nm filter)"
        />
        <select
          value={manualFilterType}
          onChange={e => setManualFilterType(e.target.value)}
          title="Select whether this filter is used for excitation (illumination) or emission (detection)"
          style={{ 
            marginLeft: 8, 
            padding: '4px 8px',
            borderRadius: '4px',
            border: '1px solid #ccc',
            backgroundColor: manualFilterType === 'excitation' ? '#e3f2fd' : '#ffebee',
            color: manualFilterType === 'excitation' ? '#1565C0' : '#E31E24'
          }}
        >
          <option value="excitation">Excitation</option>
          <option value="emission">Emission</option>
        </select>
        <button 
          style={{ marginLeft: 8 }} 
          onClick={handleAddFilter}
          title="Add this filter to your custom instrument configuration"
        >
          Add Filter
        </button>
      </div>
      {filters.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <b>Current Filters:</b>
          <ul>
            {filters.map((f, i) => {
              const centerWl = calculateCenterWavelength(f.profile);
              const bandwidth = calculateBandwidth(f.profile);
              
              return (
                <li key={i} style={{ marginBottom: '8px', padding: '8px', backgroundColor: '#f9f9f9', borderRadius: '6px', border: '1px solid #e0e0e0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <span 
                      style={{ 
                        color: f.color || '#666',
                        fontWeight: 'bold',
                        fontSize: '1em'
                      }}
                    >
                      {f.name}
                    </span>
                    <span 
                      style={{ 
                        fontSize: '0.85em',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        backgroundColor: f.filterType === 'excitation' ? '#e3f2fd' : '#ffebee',
                        color: f.filterType === 'excitation' ? '#1565C0' : '#E31E24'
                      }}
                    >
                      {f.filterType || 'unknown'}
                    </span>
                    <span 
                      style={{ 
                        fontSize: '0.8em',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        backgroundColor: '#e8f5e8',
                        color: '#2e7d32',
                        fontWeight: '500'
                      }}
                    >
                      Center: {centerWl} nm
                    </span>
                    <span 
                      style={{ 
                        fontSize: '0.8em',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        backgroundColor: '#fff3e0',
                        color: '#f57c00',
                        fontWeight: '500'
                      }}
                    >
                      BW: {bandwidth} nm
                    </span>
                    <button 
                      onClick={() => handleRemoveFilter(i)}
                      title={`Remove ${f.name} filter from this configuration`}
                      style={{
                        fontSize: '0.8em',
                        padding: '4px 8px',
                        backgroundColor: '#f44336',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        marginLeft: 'auto'
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {error && <div style={{ color: "red", marginBottom: 8 }}>{error}</div>}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button 
          onClick={handleSave} 
          style={{ 
            fontWeight: "bold",
            backgroundColor: isEditMode ? '#28a745' : '#007bff',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
          title={isEditMode ? "Update this configuration with your changes" : "Save this custom instrument configuration. It will be available in the Saved Instrument Configurations section."}
        >
          {isEditMode ? 'Update Configuration' : 'Save Configuration'}
        </button>
        {isEditMode && (
          <button 
            onClick={handleCancel}
            style={{ 
              fontWeight: "bold",
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
            title="Cancel editing and discard any changes made to this configuration"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
