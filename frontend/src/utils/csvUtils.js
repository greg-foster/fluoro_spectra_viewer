// Utility functions for CSV import/export of instrument configurations

/**
 * Export an instrument configuration to CSV format
 * @param {Object} config - The instrument configuration object
 * @returns {string} CSV content as string
 */
export function exportConfigToCSV(config) {
  const lines = [];
  
  // Header with configuration metadata
  lines.push(`Configuration Name,${config.name}`);
  lines.push(`Category,${config.category || 'custom'}`);
  lines.push(`Number of Filters,${config.filters.length}`);
  lines.push(''); // Empty line separator
  
  // Filter data header
  lines.push('Filter Name,Filter Type,Wavelength (nm),Transmission (%)');
  
  // Export each filter's profile data
  config.filters.forEach(filter => {
    const filterType = filter.filterType || 'unknown';
    filter.profile.forEach(([wavelength, transmission]) => {
      lines.push(`${filter.name},${filterType},${wavelength},${transmission}`);
    });
  });
  
  return lines.join('\n');
}

/**
 * Import an instrument configuration from CSV content
 * @param {string} csvContent - The CSV content as string
 * @param {string} filename - Original filename for error reporting
 * @returns {Object} Parsed configuration object
 * @throws {Error} If CSV format is invalid
 */
export function importConfigFromCSV(csvContent, filename = 'uploaded file') {
  const lines = csvContent.trim().split('\n').map(line => line.trim()).filter(line => line);
  
  if (lines.length < 5) {
    throw new Error(`Invalid CSV format in ${filename}: File too short`);
  }
  
  // Parse metadata
  const configNameLine = lines[0].split(',');
  const categoryLine = lines[1].split(',');
  const filterCountLine = lines[2].split(',');
  
  if (configNameLine[0] !== 'Configuration Name' || 
      categoryLine[0] !== 'Category' || 
      filterCountLine[0] !== 'Number of Filters') {
    throw new Error(`Invalid CSV format in ${filename}: Missing or incorrect metadata headers`);
  }
  
  const configName = configNameLine.slice(1).join(',').trim();
  const category = categoryLine.slice(1).join(',').trim() || 'custom';
  const expectedFilterCount = parseInt(filterCountLine.slice(1).join(',').trim());
  
  if (!configName) {
    throw new Error(`Invalid CSV format in ${filename}: Configuration name is required`);
  }
  
  if (isNaN(expectedFilterCount) || expectedFilterCount <= 0) {
    throw new Error(`Invalid CSV format in ${filename}: Invalid filter count`);
  }
  
  // Find the data header line (support both old and new formats)
  let dataStartIndex = -1;
  let hasFilterType = false;
  for (let i = 3; i < lines.length; i++) {
    if (lines[i] === 'Filter Name,Filter Type,Wavelength (nm),Transmission (%)') {
      dataStartIndex = i + 1;
      hasFilterType = true;
      break;
    } else if (lines[i] === 'Filter Name,Wavelength (nm),Transmission (%)') {
      dataStartIndex = i + 1;
      hasFilterType = false;
      break;
    }
  }
  
  if (dataStartIndex === -1) {
    throw new Error(`Invalid CSV format in ${filename}: Data header not found`);
  }
  
  // Parse filter data
  const filterData = {};
  const dataLines = lines.slice(dataStartIndex);
  
  dataLines.forEach((line, index) => {
    const parts = line.split(',');
    const expectedColumns = hasFilterType ? 4 : 3;
    
    if (parts.length !== expectedColumns) {
      throw new Error(`Invalid CSV format in ${filename}: Invalid data row at line ${dataStartIndex + index + 1}`);
    }
    
    const filterName = parts[0].trim();
    let filterType, wavelength, transmission;
    
    if (hasFilterType) {
      filterType = parts[1].trim();
      wavelength = parseFloat(parts[2].trim());
      transmission = parseFloat(parts[3].trim());
    } else {
      filterType = 'unknown'; // Default for legacy files
      wavelength = parseFloat(parts[1].trim());
      transmission = parseFloat(parts[2].trim());
    }
    
    if (!filterName) {
      throw new Error(`Invalid CSV format in ${filename}: Missing filter name at line ${dataStartIndex + index + 1}`);
    }
    
    if (isNaN(wavelength) || isNaN(transmission)) {
      throw new Error(`Invalid CSV format in ${filename}: Invalid wavelength or transmission values at line ${dataStartIndex + index + 1}`);
    }
    
    if (!filterData[filterName]) {
      filterData[filterName] = { profile: [], filterType };
    }
    
    filterData[filterName].profile.push([wavelength, transmission]);
  });
  
  // Convert to filter objects with unique IDs
  const filters = Object.entries(filterData).map(([name, data], index) => ({
    id: `imported_${configName.replace(/[^a-zA-Z0-9]/g, '_')}_${name.replace(/[^a-zA-Z0-9]/g, '_')}_${index}`,
    name,
    profile: data.profile.sort((a, b) => a[0] - b[0]), // Sort by wavelength
    filterType: data.filterType,
    color: data.filterType === 'excitation' ? '#1976d2' : '#c2185b' // Blue for excitation, red for emission
  }));
  
  if (filters.length !== expectedFilterCount) {
    console.warn(`Warning: Expected ${expectedFilterCount} filters but found ${filters.length} in ${filename}`);
  }
  
  return {
    name: configName,
    category: category === 'default' ? 'custom' : category, // Force imported configs to be custom
    filters
  };
}

/**
 * Download a string as a CSV file
 * @param {string} content - The content to download
 * @param {string} filename - The filename for the download
 */
export function downloadCSV(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

/**
 * Read a file as text content
 * @param {File} file - The file to read
 * @returns {Promise<string>} Promise that resolves to file content
 */
export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(new Error(`Failed to read file: ${e.target.error}`));
    reader.readAsText(file);
  });
}
