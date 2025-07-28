import React, { useRef, useEffect } from "react";
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

export default function SpectraPlot({ selectedDyes, dyeSpectra, filterSpectra = {}, filters = [], filterOrder = null, filterVisibility = {}, normalize = false, darkMode = false, normalizationDyeId = null, normalizedBrightness = {}, brightnessNormalizationOn = false, cameraQE = [], isCustomConfig = false, onFilterUpdate = null, onClearCache = null }) {
  // DEBUG: Log cameraQE prop
  if (typeof window !== 'undefined') {
    console.log('SpectraPlot cameraQE:', cameraQE);
  }
  // Plot real spectra if available, else fallback to simulated
  const [showExcitation, setShowExcitation] = useState(true);
  const [showEmission, setShowEmission] = useState(true);
  
  // Drag-and-drop state
  const [isDragging, setIsDragging] = useState(false);
  const [draggedFilter, setDraggedFilter] = useState(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [originalCenterWavelength, setOriginalCenterWavelength] = useState(0);
  const [plotDimensions, setPlotDimensions] = useState({ width: 800, height: 450 });
  const [xAxisRange, setXAxisRange] = useState([400, 700]); // Track current x-axis range
  const [updateKey, setUpdateKey] = useState(0); // Force re-render key
  const plotRef = useRef(null);
  
  // Update plot dimensions when plot renders
  useEffect(() => {
    const updateDimensions = () => {
      const plotElement = plotRef.current?.querySelector('.js-plotly-plot');
      if (plotElement) {
        const rect = plotElement.getBoundingClientRect();
        setPlotDimensions({ width: rect.width, height: rect.height });
        // Force a re-render of labels when dimensions change
        setUpdateKey(prev => prev + 1);
      }
    };
    
    // Update dimensions after a short delay to ensure plot is rendered
    const timer = setTimeout(updateDimensions, 500);
    
    // Also update on window resize
    window.addEventListener('resize', updateDimensions);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateDimensions);
    };
  }, [filters, isCustomConfig]);
  
  // Use a debounced update for plot changes
  useEffect(() => {
    // Update labels when xAxisRange changes
    // This is a safer approach than using MutationObserver
  }, [xAxisRange]);
  
  // Helper function to shift filter profile by wavelength offset
  const shiftFilterProfile = (profile, offset) => {
    if (!profile || !Array.isArray(profile)) return profile;
    return profile.map(([wavelength, transmission]) => [wavelength + offset, transmission]);
  };
  
  // Calculate filter center wavelength for positioning drag handles
  const getFilterCenterWavelength = (filter) => {
    if (!filter) return 500;
    
    // For filters with profile data (custom configs)
    if (filter.profile && Array.isArray(filter.profile)) {
      // Calculate weighted average center for more accurate visual center
      let weightedSum = 0;
      let totalWeight = 0;
      
      filter.profile.forEach(([wavelength, transmission]) => {
        weightedSum += wavelength * transmission;
        totalWeight += transmission;
      });
      
      return totalWeight > 0 ? weightedSum / totalWeight : 500;
    }
    
    // For filters without profile data (default configs)
    // Try to get data from filterSpectra
    const filterKey = filter.id || filter.name;
    const filterData = filterSpectra[filterKey];
    
    if (filterData && Array.isArray(filterData)) {
      let weightedSum = 0;
      let totalWeight = 0;
      
      filterData.forEach(([wavelength, transmission]) => {
        weightedSum += wavelength * transmission;
        totalWeight += transmission;
      });
      
      return totalWeight > 0 ? weightedSum / totalWeight : 500;
    }
    
    return 500; // Default fallback
  };
  
  // Convert wavelength to pixel position on plot
  const wavelengthToPixel = (wavelength) => {
    // Calculate the pixel position based on the plot dimensions and current x-axis range
    const [minWavelength, maxWavelength] = xAxisRange;
    const plotWidth = plotDimensions.width;
    
    // Account for plot margins (approximately 80px on left, 50px on right)
    const leftMargin = 80;
    const rightMargin = 50;
    const usableWidth = plotWidth - leftMargin - rightMargin;
    
    // Calculate the pixel position
    const wavelengthRange = maxWavelength - minWavelength;
    const pixelsPerNm = usableWidth / wavelengthRange;
    const pixelPosition = leftMargin + (wavelength - minWavelength) * pixelsPerNm;
    
    return pixelPosition;
  };
  
  // Convert pixel position to wavelength
  const pixelToWavelength = (pixel, plotWidth = 800) => {
    // Calculate the wavelength based on the pixel position
    const minWavelength = 400;
    const maxWavelength = 700;
    
    // Account for plot margins (approximately 80px on left, 50px on right)
    const leftMargin = 80;
    const rightMargin = 50;
    const usableWidth = plotWidth - leftMargin - rightMargin;
    
    // Calculate the wavelength
    const wavelengthRange = maxWavelength - minWavelength;
    const nmPerPixel = wavelengthRange / usableWidth;
    const wavelength = minWavelength + (pixel - leftMargin) * nmPerPixel;
    
    return Math.max(minWavelength, Math.min(maxWavelength, wavelength));
  };
  
  // Handle drag start
  const handleDragStart = (filter, event) => {
    if (!isCustomConfig || !onFilterUpdate) return;
    
    // Get the starting X position
    setDragStartX(event.clientX);
    setDraggedFilter(filter);
    setIsDragging(true);
    setDragOffset(0);
    
    // Store the original center wavelength
    const centerWavelength = getFilterCenterWavelength(filter);
    setOriginalCenterWavelength(centerWavelength);
    
    // Add document-level event listeners for drag operations
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Change cursor style for entire document during drag
    document.body.style.cursor = 'grabbing';
  };
  
  // Handle drag move
  const handleDragMove = (event) => {
    if (!isDragging || !draggedFilter) return;
    
    // Calculate the pixel offset
    const currentX = event.clientX;
    const pixelOffset = currentX - dragStartX;
    
    // Convert pixel offset to wavelength offset
    const plotWidth = plotDimensions.width;
    const wavelengthRange = 300; // 400-700nm
    const pixelsPerNm = (plotWidth - 130) / wavelengthRange; // Adjust for margins
    const wavelengthOffset = pixelOffset / pixelsPerNm;
    
    // Round to nearest nm for cleaner UI
    const roundedOffset = Math.round(wavelengthOffset);
    
    // Update the drag offset
    setDragOffset(roundedOffset);
    
    // Create a new filter with shifted profile
    const updatedFilter = {
      ...draggedFilter,
      profile: shiftFilterProfile(draggedFilter.profile, roundedOffset)
    };
    
    // Call the update handler with temporary=true
    if (onFilterUpdate) {
      onFilterUpdate(updatedFilter, true);
    }
  };
  
  // Handle drag end
  const handleDragEnd = () => {
    if (!isDragging || !draggedFilter) return;
    
    // Clean up event listeners
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    
    // Reset cursor style
    document.body.style.cursor = '';
    
    // Create a final filter with shifted profile
    const updatedFilter = {
      ...draggedFilter,
      profile: shiftFilterProfile(draggedFilter.profile, dragOffset)
    };
    
    // Call the update handler with temporary=false to finalize the change
    if (onFilterUpdate) {
      onFilterUpdate(updatedFilter, false);
    }
    
    // Reset drag state
    setIsDragging(false);
    setDraggedFilter(null);
    setDragOffset(0);
  };
  
  // Document-level event handlers (used during drag operations)
  const handleMouseMove = (event) => {
    handleDragMove(event);
  };
  
  const handleMouseUp = () => {
    handleDragEnd();
  };
  
  // Clean up event listeners on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
    };
  }, []);
  
  // Create an ordered list of filters based on filterOrder if provided
  const orderedFilters = filterOrder 
    ? filterOrder.map(index => filters[index]).filter(Boolean)
    : filters;
  
  // Create traces for each dye
  let allY = [];
  const dyeTraces = selectedDyes.map((dye, i) => {
    const dyeData = dyeSpectra[dye.id];
    if (!dyeData) return [];
    
    const exc = dyeData.excitation;
    const em = dyeData.emission;
    
    let excTrace = null;
    let emTrace = null;
    
    // Determine if this is the normalization dye
    const isNormalizationDye = dye.id === normalizationDyeId;
    const normLabel = isNormalizationDye ? " (Reference)" : "";
    
    // Get brightness normalization factor for this dye
    const brightnessNormFactor = brightnessNormalizationOn && normalizedBrightness[dye.id] !== undefined 
      ? normalizedBrightness[dye.id] 
      : 1;
    
    if (exc && exc.length > 0) {
      let y_exc = exc.map(pair => pair[1]);
      if (normalize && Math.max(...y_exc) > 0) {
        y_exc = y_exc.map(y => y / Math.max(...y_exc));
      }
      allY.push(...y_exc);
      
      // Find peak excitation wavelength for proper color
      const maxIntensity = Math.max(...y_exc);
      const peakIndex = y_exc.findIndex(intensity => intensity === maxIntensity);
      const peakWavelength = exc[peakIndex] ? exc[peakIndex][0] : 450;
      const excRgb = wavelengthToRGB(peakWavelength);
      const excColor = `rgba(${excRgb.r},${excRgb.g},${excRgb.b},1)`;
      
      excTrace = {
        x: exc.map(pair => pair[0]),
        y: y_exc,
        mode: "lines",
        name: `${dye.name} Excitation${normLabel}`,
        line: { color: excColor, dash: "solid" }
      };
    }
    
    if (em && em.length > 0) {
      let y_em = em.map(pair => pair[1]);
      if (normalize && Math.max(...y_em) > 0) {
        y_em = y_em.map(y => y / Math.max(...y_em));
      }
      
      // Scale by normalized brightness if set and toggle is on
      if (brightnessNormalizationOn && brightnessNormFactor !== 1) {
        y_em = y_em.map(y => y * brightnessNormFactor);
      }
      
      allY.push(...y_em);
      
      // Find peak emission wavelength for proper color
      const maxEmIntensity = Math.max(...y_em);
      const peakEmIndex = y_em.findIndex(intensity => intensity === maxEmIntensity);
      const peakEmWavelength = em[peakEmIndex] ? em[peakEmIndex][0] : 550;
      const emRgb = wavelengthToRGB(peakEmWavelength);
      const emColor = `rgba(${emRgb.r},${emRgb.g},${emRgb.b},1)`;
      const emFillColor = `rgba(${emRgb.r},${emRgb.g},${emRgb.b},0.18)`;
      
      emTrace = {
        x: em.map(pair => pair[0]),
        y: y_em,
        mode: "lines",
        name: `${dye.name} Emission${normLabel}`,
        line: { color: emColor, dash: "dash" },
        fill: "tozeroy",
        fillcolor: emFillColor
      };
    }
    
    // fallback to simulated if missing
    if (!exc || !em) {
      if (!exc) {
        // Use blue-green for simulated excitation (around 480nm)
        const excSimRgb = wavelengthToRGB(480);
        const excSimColor = `rgba(${excSimRgb.r},${excSimRgb.g},${excSimRgb.b},1)`;
        
        excTrace = {
          x: [400, 450, 500, 550, 600],
          y: [0, 0.5, 1, 0.5, 0],
          mode: "lines",
          name: `${dye.name} Excitation (sim)`,
          line: { color: excSimColor, dash: "solid" }
        };
      }
      
      if (!em) {
        // Use yellow-green for simulated emission (around 570nm)
        const emSimRgb = wavelengthToRGB(570);
        const emSimColor = `rgba(${emSimRgb.r},${emSimRgb.g},${emSimRgb.b},1)`;
        const emSimFill = `rgba(${emSimRgb.r},${emSimRgb.g},${emSimRgb.b},0.18)`;
        
        emTrace = {
          x: [500, 550, 600, 650, 700],
          y: [0, 0.5, 1, 0.5, 0],
          mode: "lines",
          name: `${dye.name} Emission (sim)`,
          line: { color: emSimColor, dash: "dash" },
          fill: "tozeroy",
          fillcolor: emSimFill
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
    console.log('DEBUG filterVisibility', filterVisibility);
  }
  
  let missingFilterData = [];
  const filterTraces = orderedFilters
    .filter(filter => filter && filter.profile) // Add null check for filter and filter.profile
    .map((filter, index) => {
      // Find the original filter index to check visibility
      const originalIndex = filters.findIndex(f => f === filter);
      
      // Skip if filter is not visible
      if (filterVisibility[originalIndex] === false) {
        return null;
      }
      
      // Support manual filters with a 'profile' array
      if (filter.profile && Array.isArray(filter.profile)) {
        // Apply drag offset if this filter is being dragged
        const profileToUse = (isDragging && draggedFilter?.id === filter.id) 
          ? shiftFilterProfile(filter.profile, dragOffset)
          : filter.profile;
        
        // Calculate center wavelength for draggable indicator
        const centerWavelength = getFilterCenterWavelength({ ...filter, profile: profileToUse });
        
        return {
          x: profileToUse.map(point => point[0]),
          y: profileToUse.map(point => point[1]),
          mode: "lines",
          name: isCustomConfig ? `${filter.name} (draggable)` : filter.name,
          line: { 
            color: filter.color || '#1976d2',
            width: isCustomConfig ? 3 : 2,
            dash: isDragging && draggedFilter?.id === filter.id ? 'dash' : 'solid'
          },
          yaxis: "y2"
        };
      }
      
      // Fall back to filterSpectra for non-manual filters
      const filterKey = filter.id || filter.name;
      const filterData = filterSpectra[filterKey];
      
      if (!filterData || !Array.isArray(filterData)) {
        missingFilterData.push(filter.name || filterKey);
        return null;
      }
      
      return {
        x: filterData.map(point => point[0]),
        y: filterData.map(point => point[1]),
        mode: "lines",
        name: filter.name,
        line: { color: filter.color || '#1976d2' },
        yaxis: "y2"
      };
    }).filter(Boolean);
  
  // Camera QE trace
  let cameraQETrace = null;
  if (Array.isArray(cameraQE) && cameraQE.length > 0 && cameraQE[0].x !== undefined && cameraQE[0].y !== undefined) {
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>Spectra Plot</h2>
        {onClearCache && (
          <button
            onClick={onClearCache}
            style={{
              backgroundColor: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '5px 10px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
            title="Reset all data and configurations to defaults"
          >
            Clear Cache
          </button>
        )}
      </div>
      
      {missingFilterData.length > 0 && (
        <div style={{ color: 'red', fontWeight: 'bold', marginBottom: 8 }}>
          Warning: No data found for filter(s): {missingFilterData.join(', ')}
        </div>
      )}
      
      {isCustomConfig && (
        <div style={{ 
          backgroundColor: 'rgba(33, 150, 243, 0.1)', 
          border: '1px solid #2196f3', 
          borderRadius: '4px', 
          padding: '8px', 
          marginBottom: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <span style={{ fontWeight: 'bold', color: '#2196f3' }}>Interactive Mode:</span> 
            <span> Click and drag filters to adjust wavelength position</span>
          </div>
          {isDragging && draggedFilter && (
            <div style={{ fontWeight: 'bold' }}>
              Moving: {draggedFilter.name} ({dragOffset > 0 ? '+' : ''}{dragOffset} nm)
            </div>
          )}
        </div>
      )}
      
      <div style={{ display: 'flex', marginBottom: '10px' }}>
        <div>
          <button
            onClick={() => setShowExcitation(!showExcitation)}
            style={{
              backgroundColor: showExcitation ? '#4CAF50' : '#f5f5f5',
              color: showExcitation ? 'white' : 'black',
              border: '1px solid #ddd',
              borderRadius: '4px',
              padding: '5px 10px',
              marginRight: '5px',
              cursor: 'pointer'
            }}
          >
            {showExcitation ? 'Hide' : 'Show'} Excitation
          </button>
          <button
            onClick={() => setShowEmission(!showEmission)}
            style={{
              backgroundColor: showEmission ? '#4CAF50' : '#f5f5f5',
              color: showEmission ? 'white' : 'black',
              border: '1px solid #ddd',
              borderRadius: '4px',
              padding: '5px 10px',
              cursor: 'pointer'
            }}
          >
            {showEmission ? 'Hide' : 'Show'} Emission
          </button>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <ExportButtons 
            plotId={plotId} 
            darkMode={darkMode}
          />
        </div>
      </div>
      
      <div ref={plotRef} style={{ position: 'relative' }}>
        <Plot
          data={[
            ...dyeTraces,
            ...filterTraces,
            cameraQETrace
          ].filter(Boolean)}
          layout={{
            title: "",
            autosize: true,
            height: 450,
            plot_bgcolor: darkMode ? '#333' : 'white',
            paper_bgcolor: darkMode ? '#333' : 'white',
            font: {
              color: darkMode ? '#eee' : '#444'
            },
            xaxis: {
              title: "Wavelength (nm)",
              range: [400, 700],
              gridcolor: darkMode ? '#444' : '#eee',
              zerolinecolor: darkMode ? '#444' : '#eee',
              tickfont: {
                color: darkMode ? '#ddd' : '#444'
              }
            },
            yaxis: {
              title: "Relative Intensity",
              range: [0, Math.max(1, ...allY) * 1.1],
              gridcolor: darkMode ? '#444' : '#eee',
              zerolinecolor: darkMode ? '#444' : '#eee',
              tickfont: {
                color: darkMode ? '#ddd' : '#444'
              }
            },
            yaxis2: {
              title: "Transmission (%)",
              range: [0, 100],
              overlaying: "y",
              side: "right",
              gridcolor: darkMode ? '#444' : '#eee',
              zerolinecolor: darkMode ? '#444' : '#eee',
              tickfont: {
                color: darkMode ? '#ddd' : '#444'
              }
            },
            legend: {
              font: {
                color: darkMode ? '#ddd' : '#444'
              }
            },
            margin: {
              l: 60,
              r: 60,
              b: 60,
              t: 30,
              pad: 4
            },
            hovermode: 'closest',
            showlegend: true
          }}
          config={{
            responsive: true,
            displayModeBar: true,
            modeBarButtonsToRemove: ['lasso2d', 'select2d'],
            displaylogo: false
          }}
          onRelayout={(eventData) => {
            // Update x-axis range when plot is zoomed or panned
            if (eventData['xaxis.range[0]'] !== undefined && eventData['xaxis.range[1]'] !== undefined) {
              setXAxisRange([eventData['xaxis.range[0]'], eventData['xaxis.range[1]']]);
            } else if (eventData['xaxis.autorange'] === true) {
              // Reset to default range when autorange is triggered
              setXAxisRange([400, 700]);
            }
            // We don't need to force re-render here since xAxisRange change will trigger it
          }}
          style={{ width: '100%' }}
          id={plotId}
        />
        
        {/* Draggable filter handles overlay */}
        {isCustomConfig && orderedFilters.filter(filter => filter && filter.profile).map(filter => {
          // Find the original filter index to check visibility
          const originalIndex = filters.findIndex(f => f === filter);
          
          // Skip if filter is not visible
          if (filterVisibility[originalIndex] === false) {
            return null;
          }
          
          // Calculate center wavelength from the actual filter profile (shifted if dragging)
          let centerWavelength;
          if (isDragging && draggedFilter?.id === filter.id) {
            // For dragged filters, calculate center from the shifted profile
            const shiftedProfile = shiftFilterProfile(filter.profile, dragOffset);
            centerWavelength = getFilterCenterWavelength({ ...filter, profile: shiftedProfile });
          } else {
            // For non-dragged filters, use the original profile
            centerWavelength = getFilterCenterWavelength(filter);
          }
          
          const handleX = wavelengthToPixel(centerWavelength);
          
          return (
            <div
              key={`handle-${filter.id}`}
              style={{
                position: 'absolute',
                left: `${handleX}px`,
                top: '225px', // Middle of the plot
                width: '16px',
                height: '16px',
                backgroundColor: filter.color || '#1976d2',
                border: '2px solid white',
                borderRadius: '50%',
                cursor: isDragging && draggedFilter?.id === filter.id ? 'grabbing' : 'grab',
                boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                transform: 'translate(-50%, -50%)',
                zIndex: 1000,
                opacity: isDragging && draggedFilter?.id === filter.id ? 0.8 : 1
              }}
              onMouseDown={(e) => handleDragStart(filter, e)}
              title={`Drag to adjust ${filter.name} wavelength position`}
            >
              {/* Diamond shape indicator */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%) rotate(45deg)',
                width: '8px',
                height: '8px',
                backgroundColor: 'white'
              }} />
            </div>
          );
        })}
        
        {/* Filter name labels overlay - only for custom configurations */}
        {isCustomConfig && orderedFilters.map(filter => {
          if (!filter) return null;
          
          // Check if this filter has data either in filter.profile or in filterSpectra
          const filterKey = filter.id || filter.name;
          const hasFilterData = 
            (filter.profile && Array.isArray(filter.profile)) || 
            (filterSpectra[filterKey] && Array.isArray(filterSpectra[filterKey]));
          // Find the original filter index to check visibility
          const originalIndex = filters.findIndex(f => f === filter);
          
          // Skip if filter is not visible
          if (filterVisibility[originalIndex] === false) {
            return null;
          }
          
          // Calculate center wavelength from the actual filter profile (shifted if dragging)
          let centerWavelength;
          if (isDragging && draggedFilter?.id === filter.id) {
            // For dragged filters, calculate center from the shifted profile
            const shiftedProfile = shiftFilterProfile(filter.profile, dragOffset);
            centerWavelength = getFilterCenterWavelength({ ...filter, profile: shiftedProfile });
          } else {
            // For non-dragged filters, use the original profile
            centerWavelength = getFilterCenterWavelength(filter);
          }
          
          const labelX = wavelengthToPixel(centerWavelength);
          
          // Find the maximum transmission value for this filter to position label just above it
          let maxTransmission = 0;
          let profileData;
          
          // For custom configs with profile data
          if (filter.profile && Array.isArray(filter.profile)) {
            profileData = (isDragging && draggedFilter?.id === filter.id) 
              ? shiftFilterProfile(filter.profile, dragOffset)
              : filter.profile;
          } 
          // For default configs using filterSpectra
          else {
            const filterKey = filter.id || filter.name;
            profileData = filterSpectra[filterKey];
          }
          
          if (profileData && Array.isArray(profileData)) {
            maxTransmission = Math.max(...profileData.map(([wavelength, transmission]) => transmission));
          }
          
          // Convert transmission percentage to pixel position (approximate)
          // Use a much more conservative approach for positioning closer to filters
          const plotAreaHeight = plotDimensions.height - 140; // Account for margins
          const transmissionPixelHeight = (maxTransmission / 100) * plotAreaHeight * 0.6; // Scale down more for closer positioning
          const labelY = plotDimensions.height - 100 - transmissionPixelHeight - 5; // Just above the peak
          
          // Get first 5 characters of filter name
          const labelText = filter.name ? filter.name.substring(0, 5) : 'Filter';
          
          return (
            <div
              key={`label-${filter.id}-${updateKey}`}
              style={{
                position: 'absolute',
                left: `${labelX}px`,
                top: `${labelY}px`,
                transform: 'translate(-50%, -50%)',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                color: 'white',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 'bold',
                zIndex: 999,
                pointerEvents: 'none', // Don't interfere with plot interactions
                fontFamily: 'monospace',
                border: `1px solid ${filter.color || '#1976d2'}`,
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
              }}
            >
              {labelText}
            </div>
          );
        })}
      </div>
    </div>
  );
}
