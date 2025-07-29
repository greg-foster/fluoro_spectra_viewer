import React, { useState, useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import pako from 'pako';

const EDSParser = ({ darkMode }) => {
  const [edsData, setEdsData] = useState(null);
  const [activeTab, setActiveTab] = useState('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingMessage, setProcessingMessage] = useState('');
  const [error, setError] = useState(null);
  const [expandedFiles, setExpandedFiles] = useState(new Set());
  const [activeXMLView, setActiveXMLView] = useState('raw');
  const memoryChartRef = useRef(null);
  const memoryChartInstance = useRef(null);

  // EDS file processing
  const processEDSFile = async (file) => {
    try {
      setIsProcessing(true);
      setProcessingProgress(0);
      setProcessingMessage('Reading file...');
      setError(null);

      if (!file.name.toLowerCase().endsWith('.eds')) {
        throw new Error('Please select a valid .eds file');
      }

      setProcessingProgress(25);
      setProcessingMessage('Extracting archive...');
      const arrayBuffer = await file.arrayBuffer();
      
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(arrayBuffer);
      
      setProcessingProgress(50);
      setProcessingMessage('Parsing data...');
      
      const parsedData = await parseEDSContents(zipContent);
      
      setProcessingProgress(75);
      setProcessingMessage('Analyzing memory usage...');
      
      const memoryProfile = analyzeMemoryUsage(parsedData, file.size);
      
      setProcessingProgress(100);
      setProcessingMessage('Complete!');
      
      const result = {
        filename: file.name,
        size: file.size,
        lastModified: file.lastModified,
        properties: parsedData.properties,
        plateLayout: parsedData.plateLayout,
        resultTable: parsedData.resultTable,
        amplificationData: parsedData.amplificationData,
        meltCurve: parsedData.meltCurve,
        images: parsedData.images,
        fileStructure: parsedData.fileStructure,
        fileCategories: parsedData.fileCategories,
        rawXML: parsedData.rawXML,
        rawFileContents: parsedData.rawFileContents,
        memoryProfile: memoryProfile
      };

      setEdsData(result);
      setTimeout(() => {
        setIsProcessing(false);
        setActiveTab('summary');
      }, 500);
      
    } catch (error) {
      console.error('EDS parsing error:', error);
      setError(error.message);
      setIsProcessing(false);
    }
  };

  // Parse EDS contents from ZIP with comprehensive XML parsing
  const parseEDSContents = async (zip) => {
    const result = {
      properties: null,
      plateLayout: null,
      resultTable: null,
      amplificationData: null,
      meltCurve: null,
      images: [],
      fileStructure: {},
      rawXML: {}
    };

    try {
      // Initialize XML parser with options
      const xmlParser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        textNodeName: '#text',
        parseAttributeValue: true,
        parseTagValue: true,
        trimValues: true
      });

      // Parse Properties.xml for experiment metadata
      const propertiesFile = zip.file('Properties.xml');
      if (propertiesFile) {
        const propertiesXML = await propertiesFile.async('text');
        result.rawXML.properties = propertiesXML;
        result.properties = xmlParser.parse(propertiesXML);
      }

      // Parse PlateLayout.xml for plate configuration
      const plateLayoutFile = zip.file('PlateLayout.xml');
      if (plateLayoutFile) {
        const plateLayoutXML = await plateLayoutFile.async('text');
        result.rawXML.plateLayout = plateLayoutXML;
        result.plateLayout = xmlParser.parse(plateLayoutXML);
      }

      // Parse ResultTable.xml for Cq values and results
      const resultTableFile = zip.file('ResultTable.xml');
      if (resultTableFile) {
        const resultTableXML = await resultTableFile.async('text');
        result.rawXML.resultTable = resultTableXML;
        result.resultTable = xmlParser.parse(resultTableXML);
      }

      // Parse AmplificationData.xml for fluorescence curves
      const amplificationFile = zip.file('AmplificationData.xml');
      if (amplificationFile) {
        const amplificationXML = await amplificationFile.async('text');
        result.rawXML.amplificationData = amplificationXML;
        result.amplificationData = xmlParser.parse(amplificationXML);
      }

      // Parse MeltCurve.xml if present
      const meltCurveFile = zip.file('MeltCurve.xml');
      if (meltCurveFile) {
        const meltCurveXML = await meltCurveFile.async('text');
        result.rawXML.meltCurve = meltCurveXML;
        result.meltCurve = xmlParser.parse(meltCurveXML);
      }

      // Extract images from Images/ directory if present
      const imageFiles = [];
      zip.forEach((relativePath, file) => {
        if (relativePath.startsWith('Images/') && !file.dir) {
          imageFiles.push({
            path: relativePath,
            name: relativePath.split('/').pop(),
            size: file._data ? file._data.uncompressedSize : 0
          });
        }
      });
      result.images = imageFiles;

      // Store raw file contents for all files
      result.rawFileContents = {};
      
      // Process all files and store their raw content
      const fileProcessingPromises = [];
      zip.forEach((relativePath, file) => {
        if (!file.dir) {
          // Store a promise to read the file content
          const promise = (async () => {
            try {
              if (relativePath.endsWith('.xml') || relativePath.endsWith('.json') || relativePath.endsWith('.txt') || relativePath.endsWith('.csv')) {
                // Text-based files
                const textContent = await file.async('text');
                result.rawFileContents[relativePath] = textContent;
                console.log(`Stored content for ${relativePath}:`, textContent ? `${textContent.length} characters` : 'empty');
              } else if (relativePath.endsWith('.png') || relativePath.endsWith('.jpg') || relativePath.endsWith('.jpeg') || relativePath.endsWith('.gif')) {
                // Image files - store as base64
                const arrayBuffer = await file.async('arraybuffer');
                const uint8Array = new Uint8Array(arrayBuffer);
                const base64 = btoa(String.fromCharCode.apply(null, uint8Array));
                result.rawFileContents[relativePath] = {
                  type: 'image',
                  data: base64,
                  mimeType: getMimeType(relativePath)
                };
              } else {
                // Other files - store as text if possible, otherwise as binary info
                try {
                  result.rawFileContents[relativePath] = await file.async('text');
                } catch (e) {
                  result.rawFileContents[relativePath] = {
                    type: 'binary',
                    size: file._data ? file._data.uncompressedSize : 0,
                    info: 'Binary file content not displayable as text'
                  };
                }
              }
            } catch (error) {
              console.warn(`Failed to read content for ${relativePath}:`, error);
              result.rawFileContents[relativePath] = {
                type: 'error',
                error: `Failed to read file content: ${error.message}`
              };
            }
          })();
          fileProcessingPromises.push(promise);
        }
      });
      
      // Wait for all file content to be processed
      await Promise.all(fileProcessingPromises);
      
      // Debug: Log all stored file paths
      console.log('All stored file paths:', Object.keys(result.rawFileContents));
      console.log('JSON files found:', Object.keys(result.rawFileContents).filter(path => path.endsWith('.json')));

      // Build comprehensive file structure with detailed analysis
      const fileCategories = {
        metadata: [],
        layout: [],
        results: [],
        amplification: [],
        melt: [],
        images: [],
        other: []
      };

      zip.forEach((relativePath, file) => {
        const fileInfo = {
          path: relativePath,
          name: relativePath.split('/').pop(),
          directory: relativePath.includes('/') ? relativePath.substring(0, relativePath.lastIndexOf('/')) : '',
          uncompressedSize: file._data ? file._data.uncompressedSize : 0,
          compressedSize: file._data ? file._data.compressedSize : 0,
          compressionRatio: 0,
          compressionPercentage: 0,
          isDirectory: file.dir,
          type: getFileType(relativePath),
          category: getFileCategory(relativePath),
          description: getFileDescription(relativePath),
          purpose: getFilePurpose(relativePath),
          importance: getFileImportance(relativePath)
        };

        // Calculate compression metrics
        if (fileInfo.uncompressedSize > 0 && fileInfo.compressedSize > 0) {
          fileInfo.compressionRatio = fileInfo.compressedSize / fileInfo.uncompressedSize;
          fileInfo.compressionPercentage = ((1 - fileInfo.compressionRatio) * 100).toFixed(1);
        }

        result.fileStructure[relativePath] = fileInfo;
        
        // Categorize files
        if (!fileInfo.isDirectory) {
          fileCategories[fileInfo.category].push(fileInfo);
        }
      });

      result.fileCategories = fileCategories;

      return result;
    } catch (error) {
      console.error('Error parsing EDS contents:', error);
      throw error;
    }
  };

  // Get MIME type for files
  const getMimeType = (path) => {
    const ext = path.toLowerCase().split('.').pop();
    const mimeTypes = {
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'xml': 'application/xml',
      'json': 'application/json',
      'txt': 'text/plain',
      'csv': 'text/csv'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  };

  // Determine file type for categorization
  const getFileType = (path) => {
    if (path.endsWith('.xml')) {
      if (path.includes('Properties')) return 'metadata';
      if (path.includes('PlateLayout')) return 'layout';
      if (path.includes('ResultTable')) return 'results';
      if (path.includes('AmplificationData')) return 'amplification';
      if (path.includes('MeltCurve')) return 'melt';
      return 'xml';
    }
    if (path.startsWith('Images/')) return 'image';
    if (path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.jpeg') || path.endsWith('.gif')) return 'image';
    if (path.endsWith('.json')) return 'json';
    if (path.endsWith('.csv')) return 'csv';
    if (path.endsWith('.txt')) return 'text';
    return 'other';
  };

  // Get file category for organization
  const getFileCategory = (path) => {
    if (path.includes('Properties')) return 'metadata';
    if (path.includes('PlateLayout')) return 'layout';
    if (path.includes('ResultTable')) return 'results';
    if (path.includes('AmplificationData')) return 'amplification';
    if (path.includes('MeltCurve')) return 'melt';
    if (path.startsWith('Images/') || path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.jpeg') || path.endsWith('.gif')) return 'images';
    if (path.endsWith('.json')) return 'metadata'; // JSON files are typically metadata or configuration
    return 'other';
  };

  // Get detailed file description
  const getFileDescription = (path) => {
    const descriptions = {
      'Properties.xml': 'Experiment metadata including user info, instrument settings, protocol parameters, and run configuration',
      'PlateLayout.xml': 'Plate configuration data with well positions, sample assignments, target mappings, and plate geometry',
      'ResultTable.xml': 'Analysis results including Cq values, quantification data, quality metrics, and statistical analysis per well',
      'AmplificationData.xml': 'Raw fluorescence data for amplification curves including cycle-by-cycle measurements for all wells and channels',
      'MeltCurve.xml': 'Dissociation curve data for melt analysis including temperature-dependent fluorescence measurements',
      'Manifest.xml': 'File manifest and archive structure information',
      'RunInfo.xml': 'Run-specific information and execution parameters'
    };

    // Check for exact matches first
    const fileName = path.split('/').pop();
    if (descriptions[fileName]) {
      return descriptions[fileName];
    }

    // Pattern-based descriptions
    if (path.startsWith('Images/')) {
      return 'Embedded image or graphic file related to the experiment or analysis results';
    }
    if (path.endsWith('.xml')) {
      return 'XML data file containing structured experiment or analysis information';
    }
    if (path.endsWith('.json')) {
      return 'JSON data file with structured experimental or configuration data';
    }
    if (path.endsWith('.csv')) {
      return 'Comma-separated values file containing tabular data';
    }
    if (path.endsWith('.txt')) {
      return 'Plain text file with experiment notes or configuration data';
    }

    return 'Additional file related to the qPCR experiment or analysis';
  };

  // Get file purpose explanation
  const getFilePurpose = (path) => {
    const purposes = {
      'Properties.xml': 'Provides experiment context and metadata for proper data interpretation',
      'PlateLayout.xml': 'Defines sample organization and enables well-to-sample mapping',
      'ResultTable.xml': 'Contains primary analysis results and quantification data',
      'AmplificationData.xml': 'Stores raw data for curve visualization and custom analysis',
      'MeltCurve.xml': 'Enables dissociation analysis and primer specificity assessment',
      'Manifest.xml': 'Ensures file integrity and provides archive structure',
      'RunInfo.xml': 'Documents run conditions and instrument parameters'
    };

    const fileName = path.split('/').pop();
    if (purposes[fileName]) {
      return purposes[fileName];
    }

    if (path.startsWith('Images/')) {
      return 'Visual documentation or graphical representation of results';
    }
    if (path.endsWith('.xml')) {
      return 'Structured data storage for specific analysis component';
    }

    return 'Supporting data or configuration for the qPCR analysis';
  };

  // Get file importance level
  const getFileImportance = (path) => {
    const fileName = path.split('/').pop();
    
    // Critical files for basic analysis
    if (['Properties.xml', 'ResultTable.xml'].includes(fileName)) {
      return 'Critical';
    }
    
    // Important files for comprehensive analysis
    if (['PlateLayout.xml', 'AmplificationData.xml'].includes(fileName)) {
      return 'Important';
    }
    
    // Optional but useful files
    if (['MeltCurve.xml', 'Manifest.xml', 'RunInfo.xml'].includes(fileName)) {
      return 'Optional';
    }
    
    // Supporting files
    if (path.startsWith('Images/')) {
      return 'Supporting';
    }
    
    return 'Additional';
  };

  const parseJSONWithNaN = (jsonString) => {
    try {
      const cleanedString = jsonString.replace(/:\s*NaN/g, ': null');
      return JSON.parse(cleanedString);
    } catch (error) {
      console.warn('Failed to parse JSON:', error);
      return { rawData: jsonString, parseError: error.message };
    }
  };

  // Comprehensive memory analysis per component
  const analyzeMemoryUsage = (data, totalFileSize) => {
    const components = {};
    const details = {};
    let totalUncompressed = 0;

    // Sample Metadata (Properties.xml)
    if (data.properties) {
      const size = calculateDataSize(data.properties);
      components['Sample Metadata'] = size;
      details['Sample Metadata'] = {
        source: 'Properties.xml',
        description: 'Experiment metadata, user info, instrument settings',
        size: size,
        compressed: estimateCompressedSize(data.properties)
      };
    }

    // Plate Layout (PlateLayout.xml)
    if (data.plateLayout) {
      const size = calculateDataSize(data.plateLayout);
      components['Plate Layout'] = size;
      details['Plate Layout'] = {
        source: 'PlateLayout.xml',
        description: 'Well positions, sample/target assignments, plate configuration',
        size: size,
        compressed: estimateCompressedSize(data.plateLayout),
        wellCount: extractWellCount(data.plateLayout)
      };
    }

    // Cq Results (ResultTable.xml)
    if (data.resultTable) {
      const size = calculateDataSize(data.resultTable);
      components['Cq Results'] = size;
      const resultStats = extractResultStats(data.resultTable);
      details['Cq Results'] = {
        source: 'ResultTable.xml',
        description: 'Cq values, targets, samples, analysis results per well',
        size: size,
        compressed: estimateCompressedSize(data.resultTable),
        ...resultStats
      };
    }

    // Amplification Curves (AmplificationData.xml)
    if (data.amplificationData) {
      const size = calculateDataSize(data.amplificationData);
      components['Amplification Curves'] = size;
      const ampStats = extractAmplificationStats(data.amplificationData);
      details['Amplification Curves'] = {
        source: 'AmplificationData.xml',
        description: 'Fluorescence values by cycle and well for amplification curves',
        size: size,
        compressed: estimateCompressedSize(data.amplificationData),
        ...ampStats
      };
    }

    // Melt Data (MeltCurve.xml)
    if (data.meltCurve) {
      const size = calculateDataSize(data.meltCurve);
      components['Melt Data'] = size;
      details['Melt Data'] = {
        source: 'MeltCurve.xml',
        description: 'Melt curve data for dissociation analysis',
        size: size,
        compressed: estimateCompressedSize(data.meltCurve)
      };
    }

    // Images
    if (data.images && data.images.length > 0) {
      const totalImageSize = data.images.reduce((sum, img) => sum + img.size, 0);
      components['Images'] = totalImageSize;
      details['Images'] = {
        source: 'Images/ directory',
        description: 'Embedded images and graphics',
        size: totalImageSize,
        compressed: totalImageSize, // Images are typically already compressed
        count: data.images.length,
        files: data.images.map(img => ({ name: img.name, size: img.size }))
      };
    }

    // Raw XML Storage
    if (data.rawXML) {
      const xmlSize = Object.values(data.rawXML).reduce((sum, xml) => sum + (xml ? xml.length : 0), 0);
      components['Raw XML'] = xmlSize;
      details['Raw XML'] = {
        source: 'Original XML files',
        description: 'Unprocessed XML content for reference',
        size: xmlSize,
        compressed: estimateCompressedSize(data.rawXML)
      };
    }

    // File Structure Metadata
    const structureSize = calculateDataSize(data.fileStructure);
    components['File Structure'] = structureSize;
    details['File Structure'] = {
      source: 'ZIP archive metadata',
      description: 'File organization and compression information',
      size: structureSize,
      compressed: estimateCompressedSize(data.fileStructure)
    };

    totalUncompressed = Object.values(components).reduce((sum, size) => sum + size, 0);
    const totalCompressedEstimate = Object.values(details).reduce((sum, detail) => sum + (detail.compressed || 0), 0);
    const compressionRatio = totalFileSize > 0 ? totalUncompressed / totalFileSize : 1;
    const compressionPercentage = totalUncompressed > 0 ? ((1 - (totalFileSize / totalUncompressed)) * 100).toFixed(1) : '0';

    return {
      components,
      details,
      totalUncompressed,
      totalCompressed: totalFileSize,
      totalCompressedEstimate,
      compressionRatio,
      compressionPercentage,
      efficiency: {
        actualCompression: compressionPercentage + '%',
        estimatedCompression: totalUncompressed > 0 ? ((1 - (totalCompressedEstimate / totalUncompressed)) * 100).toFixed(1) + '%' : '0%',
        spaceSavings: formatBytes(totalUncompressed - totalFileSize)
      }
    };
  };

  // Extract well count from plate layout
  const extractWellCount = (plateLayout) => {
    try {
      // Try to extract well count from various possible structures
      if (plateLayout.PlateLayout && plateLayout.PlateLayout.Wells) {
        const wells = plateLayout.PlateLayout.Wells;
        if (Array.isArray(wells)) return wells.length;
        if (wells.Well && Array.isArray(wells.Well)) return wells.Well.length;
      }
      return 'Unknown';
    } catch (error) {
      return 'Unknown';
    }
  };

  // Extract statistics from result table
  const extractResultStats = (resultTable) => {
    try {
      const stats = { wellCount: 0, targetCount: 0, validCq: 0 };
      // Implementation would depend on actual XML structure
      // This is a placeholder for the actual parsing logic
      return stats;
    } catch (error) {
      return { wellCount: 'Unknown', targetCount: 'Unknown', validCq: 'Unknown' };
    }
  };

  // Extract statistics from amplification data
  const extractAmplificationStats = (amplificationData) => {
    try {
      const stats = { wellCount: 0, cycleCount: 0, dataPoints: 0 };
      // Implementation would depend on actual XML structure
      // This is a placeholder for the actual parsing logic
      return stats;
    } catch (error) {
      return { wellCount: 'Unknown', cycleCount: 'Unknown', dataPoints: 'Unknown' };
    }
  };

  // Estimate compressed size using pako
  const estimateCompressedSize = (data) => {
    try {
      const jsonString = JSON.stringify(data);
      const compressed = pako.deflate(jsonString);
      return compressed.length;
    } catch (error) {
      // Fallback to rough estimation
      return Math.floor(calculateDataSize(data) * 0.3); // Assume ~70% compression
    }
  };

  const calculateDataSize = (obj) => {
    if (!obj) return 0;
    return new Blob([JSON.stringify(obj)]).size;
  };

  const calculateJSONSize = (obj) => {
    return calculateDataSize(obj);
  };

  // Extract property value from parsed XML structure
  const extractProperty = (xmlObj, propertyName) => {
    try {
      // Try multiple possible XML structures for property extraction
      if (xmlObj && xmlObj.Properties) {
        const props = xmlObj.Properties;
        if (props.Property) {
          // Handle array of properties
          if (Array.isArray(props.Property)) {
            const prop = props.Property.find(p => p['@_name'] === propertyName || p['@_Name'] === propertyName);
            return prop ? (prop['@_value'] || prop['@_Value'] || prop['#text']) : null;
          }
          // Handle single property object
          if (props.Property['@_name'] === propertyName || props.Property['@_Name'] === propertyName) {
            return props.Property['@_value'] || props.Property['@_Value'] || props.Property['#text'];
          }
        }
        // Direct property access
        if (props[propertyName]) {
          return props[propertyName];
        }
      }
      // Try direct access on root object
      if (xmlObj && xmlObj[propertyName]) {
        return xmlObj[propertyName];
      }
      return null;
    } catch (error) {
      console.warn(`Error extracting property ${propertyName}:`, error);
      return null;
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Create memory chart
  useEffect(() => {
    if (activeTab === 'memory' && edsData?.memoryProfile && memoryChartRef.current) {
      if (memoryChartInstance.current) {
        memoryChartInstance.current.destroy();
      }

      const ctx = memoryChartRef.current.getContext('2d');
      const components = edsData.memoryProfile.components;
      const labels = Object.keys(components);
      const data = Object.values(components);
      const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'];

      memoryChartInstance.current = new Chart(ctx, {
        type: 'pie',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: colors.slice(0, labels.length),
            borderWidth: 2,
            borderColor: '#fff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            title: { display: true, text: 'Memory Usage Distribution', font: { size: 16 } },
            legend: { position: 'bottom' },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const label = context.label || '';
                  const value = formatBytes(context.raw);
                  const percentage = ((context.raw / data.reduce((a, b) => a + b, 0)) * 100).toFixed(1);
                  return `${label}: ${value} (${percentage}%)`;
                }
              }
            }
          }
        }
      });
    }

    return () => {
      if (memoryChartInstance.current) {
        memoryChartInstance.current.destroy();
        memoryChartInstance.current = null;
      }
    };
  }, [activeTab, edsData]);

  const exportJSON = () => {
    if (!edsData) return;
    const experimentName = extractProperty(edsData.properties, 'ExperimentName') || 'Unknown';
    const exportData = {
      experiment: experimentName,
      metadata: {
        filename: edsData.filename,
        size: edsData.size,
        lastModified: new Date(edsData.lastModified).toISOString(),
        parsedAt: new Date().toISOString()
      },
      properties: edsData.properties,
      plateLayout: edsData.plateLayout,
      resultTable: edsData.resultTable,
      amplificationData: edsData.amplificationData,
      meltCurve: edsData.meltCurve,
      images: edsData.images,
      memoryProfile: edsData.memoryProfile,
      fileStructure: edsData.fileStructure
    };
    downloadFile(JSON.stringify(exportData, null, 2), `${experimentName}_comprehensive_analysis.json`, 'application/json');
  };

  const exportMemoryCSV = () => {
    if (!edsData?.memoryProfile) return;
    const profile = edsData.memoryProfile;
    const experimentName = extractProperty(edsData.properties, 'ExperimentName') || 'unknown';
    
    const csvRows = [
      ['Component', 'Source', 'Size (bytes)', 'Size (formatted)', 'Compressed (bytes)', 'Compressed (formatted)', 'Compression %', 'Description']
    ];
    
    Object.entries(profile.details).forEach(([name, details]) => {
      const compressionPercent = details.size > 0 ? ((1 - details.compressed / details.size) * 100).toFixed(1) : '0';
      csvRows.push([
        name,
        details.source,
        details.size,
        formatBytes(details.size),
        details.compressed,
        formatBytes(details.compressed),
        compressionPercent + '%',
        details.description
      ]);
    });
    
    // Add summary row
    csvRows.push([
      'TOTAL',
      'All components',
      profile.totalUncompressed,
      formatBytes(profile.totalUncompressed),
      profile.totalCompressed,
      formatBytes(profile.totalCompressed),
      profile.compressionPercentage + '%',
      'Complete EDS file analysis'
    ]);
    
    const csvContent = csvRows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    downloadFile(csvContent, `${experimentName}_comprehensive_memory_report.csv`, 'text/csv');
  };

  const downloadFile = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) processEDSFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files.length > 0) processEDSFile(files[0]);
  };

  const resetAnalysis = () => {
    setEdsData(null);
    setActiveTab('upload');
    setError(null);
    setExpandedFiles(new Set());
  };

  // Debug: Log edsData state changes
  React.useEffect(() => {
    console.log('edsData state changed:', {
      hasEdsData: !!edsData,
      hasRawFileContents: !!edsData?.rawFileContents,
      rawFileContentsKeys: edsData?.rawFileContents ? Object.keys(edsData.rawFileContents).length : 0,
      activeTab
    });
  }, [edsData, activeTab]);

  // Toggle file expansion
  const toggleFileExpansion = (filePath) => {
    const newExpanded = new Set(expandedFiles);
    if (newExpanded.has(filePath)) {
      newExpanded.delete(filePath);
    } else {
      newExpanded.add(filePath);
    }
    setExpandedFiles(newExpanded);
  };

  // Get file content for display
  const getFileContent = (file) => {
    console.log('getFileContent called with:', {
      fileName: file?.name,
      filePath: file?.path,
      hasEdsData: !!edsData,
      hasRawFileContents: !!edsData?.rawFileContents,
      rawFileContentsKeys: edsData?.rawFileContents ? Object.keys(edsData.rawFileContents).length : 0
    });
    
    if (!edsData || !edsData.rawFileContents) {
      console.log('No edsData or rawFileContents available');
      return {
        type: 'error',
        info: 'File content temporarily unavailable',
        error: 'EDS data not loaded or rawFileContents missing'
      };
    }

    const filePath = file.path;
    const rawContent = edsData.rawFileContents[filePath];
    
    console.log(`Getting content for ${file.name} (${filePath}):`, {
      fileType: file.type,
      category: file.category,
      hasRawContent: !!rawContent,
      contentType: typeof rawContent,
      contentLength: typeof rawContent === 'string' ? rawContent.length : 'N/A'
    });
    
    if (!rawContent) {
      console.log(`No raw content found for ${filePath}`);
      return {
        type: 'unknown',
        info: `File content not available for preview: ${file.name}`
      };
    }

    // Handle different content types
    if (typeof rawContent === 'object') {
      // Handle structured content (images, binary, errors)
      if (rawContent.type === 'image') {
        return {
          type: 'image',
          data: rawContent.data,
          mimeType: rawContent.mimeType,
          info: `Image file: ${file.name} (${formatBytes(file.uncompressedSize)})`
        };
      }
      
      if (rawContent.type === 'binary') {
        return {
          type: 'binary',
          info: `Binary file: ${file.name} (${formatBytes(rawContent.size || file.uncompressedSize)})`,
          details: rawContent.info
        };
      }
      
      if (rawContent.type === 'error') {
        return {
          type: 'error',
          info: `Error reading file: ${file.name}`,
          error: rawContent.error
        };
      }
    }
    
    // Handle text-based content
    if (typeof rawContent === 'string') {
      // XML files with parsed data
      if (file.name === 'Properties.xml' && edsData.properties) {
        return {
          type: 'xml',
          raw: rawContent,
          parsed: edsData.properties
        };
      }
      
      if (file.name === 'PlateLayout.xml' && edsData.plateLayout) {
        return {
          type: 'xml',
          raw: rawContent,
          parsed: edsData.plateLayout
        };
      }
      
      if (file.name === 'ResultTable.xml' && edsData.resultTable) {
        return {
          type: 'xml',
          raw: rawContent,
          parsed: edsData.resultTable
        };
      }
      
      if (file.name === 'AmplificationData.xml' && edsData.amplificationData) {
        return {
          type: 'xml',
          raw: rawContent,
          parsed: edsData.amplificationData
        };
      }
      
      if (file.name === 'MeltCurve.xml' && edsData.meltCurve) {
        return {
          type: 'xml',
          raw: rawContent,
          parsed: edsData.meltCurve
        };
      }
      
      // Other XML files
      if (file.type === 'xml' || file.name.endsWith('.xml')) {
        return {
          type: 'xml',
          raw: rawContent,
          parsed: null
        };
      }
      
      // JSON files
      if (file.type === 'json' || file.name.endsWith('.json')) {
        console.log(`Processing JSON file: ${file.name}, content length: ${rawContent.length}`);
        try {
          const parsed = JSON.parse(rawContent);
          console.log(`Successfully parsed JSON for ${file.name}`);
          return {
            type: 'json',
            raw: rawContent,
            parsed: parsed
          };
        } catch (e) {
          console.log(`JSON parsing error for ${file.name}:`, e.message);
          return {
            type: 'text',
            raw: rawContent,
            info: `JSON file with parsing error: ${e.message}`
          };
        }
      }
      
      // CSV files
      if (file.type === 'csv' || file.name.endsWith('.csv')) {
        return {
          type: 'csv',
          raw: rawContent,
          info: `CSV file: ${file.name} (${formatBytes(file.uncompressedSize)})`
        };
      }
      
      // Text files
      if (file.type === 'text' || file.name.endsWith('.txt')) {
        return {
          type: 'text',
          raw: rawContent,
          info: `Text file: ${file.name} (${formatBytes(file.uncompressedSize)})`
        };
      }
      
      // Default text content
      return {
        type: 'text',
        raw: rawContent,
        info: `File content: ${file.name} (${formatBytes(file.uncompressedSize)})`
      };
    }
    
    return {
      type: 'unknown',
      info: `File content not available for preview: ${file.name}`
    };
  };

  // Render file content based on type
  const renderFileContent = (content, file) => {
    console.log(`renderFileContent called for ${file?.name || 'unknown'}:`, {
      content,
      contentType: content?.type,
      hasContent: !!content
    });
    
    if (!content) {
      console.log(`No content provided for ${file?.name || 'unknown'}`);
      return null;
    }

    const contentStyle = {
      background: darkMode ? '#222' : '#f8f9fa',
      borderRadius: '6px',
      padding: '15px',
      margin: '10px 0',
      border: '1px solid #dee2e6',
      maxHeight: '400px',
      overflow: 'auto'
    };

    console.log(`Switching on content type: ${content.type}`);
    switch (content.type) {
      case 'xml':
        return (
          <div style={contentStyle}>
            <div style={{ marginBottom: '10px' }}>
              <button
                onClick={() => setActiveXMLView(activeXMLView === 'raw' ? 'parsed' : 'raw')}
                style={{
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                View {activeXMLView === 'raw' ? 'Parsed' : 'Raw XML'}
              </button>
            </div>
            {activeXMLView === 'raw' ? (
              <pre style={{
                color: darkMode ? '#ccc' : '#666',
                fontSize: '11px',
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {content.raw ? content.raw.substring(0, 3000) + (content.raw.length > 3000 ? '\n\n... (truncated)' : '') : 'No raw XML available'}
              </pre>
            ) : (
              <pre style={{
                color: darkMode ? '#ccc' : '#666',
                fontSize: '11px',
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {content.parsed ? JSON.stringify(content.parsed, null, 2).substring(0, 3000) + (JSON.stringify(content.parsed, null, 2).length > 3000 ? '\n\n... (truncated)' : '') : 'No parsed data available'}
              </pre>
            )}
          </div>
        );
      
      case 'json':
        return (
          <div style={contentStyle}>
            <div style={{ marginBottom: '10px' }}>
              <button
                onClick={() => setActiveXMLView(activeXMLView === 'raw' ? 'parsed' : 'raw')}
                style={{
                  background: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                View {activeXMLView === 'raw' ? 'Formatted' : 'Raw JSON'}
              </button>
            </div>
            {activeXMLView === 'raw' ? (
              <pre style={{
                color: darkMode ? '#ccc' : '#666',
                fontSize: '11px',
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {content.raw ? content.raw.substring(0, 3000) + (content.raw.length > 3000 ? '\n\n... (truncated)' : '') : 'No raw JSON available'}
              </pre>
            ) : (
              <pre style={{
                color: darkMode ? '#ccc' : '#666',
                fontSize: '11px',
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {content.parsed ? JSON.stringify(content.parsed, null, 2).substring(0, 3000) + (JSON.stringify(content.parsed, null, 2).length > 3000 ? '\n\n... (truncated)' : '') : 'No parsed JSON available'}
              </pre>
            )}
          </div>
        );
      
      case 'image':
        return (
          <div style={contentStyle}>
            <div style={{ textAlign: 'center', color: darkMode ? '#ccc' : '#666' }}>
              {content.data ? (
                <div>
                  <div style={{ marginBottom: '15px' }}>
                    <img 
                      src={`data:${content.mimeType};base64,${content.data}`}
                      alt={file.name}
                      style={{
                        maxWidth: '100%',
                        maxHeight: '300px',
                        border: '1px solid #dee2e6',
                        borderRadius: '4px'
                      }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'block';
                      }}
                    />
                    <div style={{ display: 'none' }}>
                      <div style={{ fontSize: '48px', marginBottom: '10px' }}>🖼️</div>
                      <p>Image preview failed to load</p>
                    </div>
                  </div>
                  <p style={{ fontSize: '12px' }}>{content.info}</p>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '48px', marginBottom: '10px' }}>🖼️</div>
                  <p>{content.info}</p>
                  <p style={{ fontSize: '12px', fontStyle: 'italic' }}>
                    Image preview not available - file is embedded in EDS archive
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      
      case 'csv':
        return (
          <div style={contentStyle}>
            <div style={{ marginBottom: '10px', color: darkMode ? '#fff' : '#333' }}>
              <strong>📊 CSV Data</strong>
              <p style={{ fontSize: '12px', margin: '5px 0', color: darkMode ? '#ccc' : '#666' }}>
                {content.info}
              </p>
            </div>
            <pre style={{
              color: darkMode ? '#ccc' : '#666',
              fontSize: '11px',
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              {content.raw ? content.raw.substring(0, 3000) + (content.raw.length > 3000 ? '\n\n... (truncated)' : '') : 'No CSV content available'}
            </pre>
          </div>
        );
      
      case 'text':
        return (
          <div style={contentStyle}>
            <div style={{ marginBottom: '10px', color: darkMode ? '#fff' : '#333' }}>
              <strong>📝 Text Content</strong>
              <p style={{ fontSize: '12px', margin: '5px 0', color: darkMode ? '#ccc' : '#666' }}>
                {content.info}
              </p>
            </div>
            <pre style={{
              color: darkMode ? '#ccc' : '#666',
              fontSize: '11px',
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              {content.raw ? content.raw.substring(0, 3000) + (content.raw.length > 3000 ? '\n\n... (truncated)' : '') : 'No text content available'}
            </pre>
          </div>
        );
      
      case 'binary':
        return (
          <div style={contentStyle}>
            <div style={{ textAlign: 'center', color: darkMode ? '#ccc' : '#666' }}>
              <div style={{ fontSize: '48px', marginBottom: '10px' }}>📦</div>
              <p>{content.info}</p>
              <p style={{ fontSize: '12px', fontStyle: 'italic' }}>
                {content.details}
              </p>
            </div>
          </div>
        );
      
      case 'error':
        return (
          <div style={{
            ...contentStyle,
            borderColor: '#dc3545',
            background: darkMode ? '#2d1b1b' : '#f8d7da'
          }}>
            <div style={{ textAlign: 'center', color: '#dc3545' }}>
              <div style={{ fontSize: '48px', marginBottom: '10px' }}>⚠️</div>
              <p>{content.info}</p>
              <p style={{ fontSize: '12px', fontStyle: 'italic' }}>
                {content.error}
              </p>
            </div>
          </div>
        );
      
      default:
        return (
          <div style={contentStyle}>
            <div style={{ textAlign: 'center', color: darkMode ? '#ccc' : '#666' }}>
              <div style={{ fontSize: '48px', marginBottom: '10px' }}>📄</div>
              <p>{content.info}</p>
            </div>
          </div>
        );
    }
  };

  const containerStyle = {
    minHeight: '80vh',
    padding: '20px',
    backgroundColor: darkMode ? '#1a1a1a' : '#f8f9fa',
    color: darkMode ? '#fff' : '#333'
  };

  const cardStyle = {
    backgroundColor: darkMode ? '#2a2a2a' : '#fff',
    border: `1px solid ${darkMode ? '#444' : '#dee2e6'}`,
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '20px'
  };

  return (
    <div style={containerStyle}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ margin: '0 0 10px 0', color: darkMode ? '#fff' : '#333' }}>🧬 EDS File Parser</h1>
              <p style={{ margin: 0, color: darkMode ? '#ccc' : '#666' }}>
                Comprehensive analysis tool for Thermo Fisher EDS qPCR experiment files
              </p>
            </div>
            {edsData && (
              <button onClick={resetAnalysis} style={{
                background: '#dc3545', color: 'white', border: 'none', borderRadius: '6px',
                padding: '8px 16px', cursor: 'pointer', fontSize: '14px'
              }}>
                New Analysis
              </button>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div style={{ ...cardStyle, backgroundColor: '#f8d7da', borderColor: '#f5c6cb', color: '#721c24' }}>
            <h4 style={{ margin: '0 0 10px 0' }}>❌ Error</h4>
            <p style={{ margin: 0 }}>{error}</p>
            <button onClick={() => setError(null)} style={{
              background: 'none', border: 'none', color: '#721c24', cursor: 'pointer',
              fontSize: '18px', float: 'right', marginTop: '-30px'
            }}>×</button>
          </div>
        )}

        {/* Processing Progress */}
        {isProcessing && (
          <div style={cardStyle}>
            <h3 style={{ margin: '0 0 15px 0', color: darkMode ? '#fff' : '#333' }}>⏳ Processing EDS File</h3>
            <div style={{
              width: '100%', height: '20px', backgroundColor: darkMode ? '#444' : '#e9ecef',
              borderRadius: '10px', overflow: 'hidden', marginBottom: '10px'
            }}>
              <div style={{
                width: `${processingProgress}%`, height: '100%', backgroundColor: '#28a745',
                transition: 'width 0.3s ease'
              }} />
            </div>
            <p style={{ margin: 0, color: darkMode ? '#ccc' : '#666' }}>
              {processingMessage} ({processingProgress}%)
            </p>
          </div>
        )}

        {/* Upload Section */}
        {!edsData && !isProcessing && (
          <div style={cardStyle}>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={(e) => e.preventDefault()}
              onDrop={handleDrop}
              style={{
                border: '2px dashed #ccc', borderRadius: '8px', padding: '40px', textAlign: 'center',
                backgroundColor: darkMode ? '#333' : '#f9f9f9', cursor: 'pointer'
              }}
              onClick={() => document.getElementById('edsFileInput').click()}
            >
              <div style={{ fontSize: '48px', marginBottom: '20px' }}>📤</div>
              <h3 style={{ margin: '0 0 10px 0', color: darkMode ? '#fff' : '#333' }}>Upload EDS File</h3>
              <p style={{ margin: '0 0 20px 0', color: darkMode ? '#ccc' : '#666' }}>
                Drag & drop your .eds file here or click to browse
              </p>
              <input id="edsFileInput" type="file" accept=".eds" onChange={handleFileUpload} style={{ display: 'none' }} />
              <button style={{
                background: '#667eea', color: 'white', border: 'none', borderRadius: '6px',
                padding: '10px 20px', cursor: 'pointer', fontSize: '16px'
              }}>
                Choose EDS File
              </button>
            </div>
          </div>
        )}

        {/* Analysis Results */}
        {edsData && !isProcessing && (
          <>
            {/* Tab Navigation */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {[
                  { id: 'summary', label: '📊 Summary' },
                  { id: 'structure', label: '📁 File Structure' },
                  { id: 'plate', label: '🧪 Plate Layout' },
                  { id: 'amplification', label: '📈 Amplification Data' },
                  { id: 'memory', label: '💾 Memory Analysis' },
                  { id: 'xml', label: '📄 Raw XML' },
                  { id: 'export', label: '📤 Export' }
                ].map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                    background: activeTab === tab.id ? '#667eea' : (darkMode ? '#444' : '#f8f9fa'),
                    color: activeTab === tab.id ? 'white' : (darkMode ? '#fff' : '#495057'),
                    border: '1px solid #dee2e6', borderRadius: '8px', padding: '12px 20px',
                    cursor: 'pointer', fontSize: '14px', fontWeight: '500', transition: 'all 0.2s ease'
                  }}>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div style={cardStyle}>
              {activeTab === 'structure' && (
                <div>
                  <h3 style={{ margin: '0 0 20px 0', color: darkMode ? '#fff' : '#333' }}>📁 Comprehensive File Structure Analysis</h3>
                  
                  {/* File Categories Overview */}
                  <div style={{ background: darkMode ? '#333' : '#f8f9fa', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
                    <h4 style={{ color: darkMode ? '#fff' : '#333', marginBottom: '15px' }}>File Categories Overview</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                      {edsData?.fileCategories && Object.entries(edsData.fileCategories).map(([category, files]) => {
                        const totalSize = files.reduce((sum, file) => sum + file.uncompressedSize, 0);
                        const totalCompressed = files.reduce((sum, file) => sum + file.compressedSize, 0);
                        const compressionRatio = totalSize > 0 ? ((1 - totalCompressed / totalSize) * 100).toFixed(1) : '0';
                        
                        const categoryIcons = {
                          metadata: '📋',
                          layout: '🧪',
                          results: '📊',
                          amplification: '📈',
                          melt: '🌡️',
                          images: '🖼️',
                          other: '📄'
                        };
                        
                        return (
                          <div key={category} style={{
                            background: darkMode ? '#444' : 'white',
                            borderRadius: '8px',
                            padding: '15px',
                            textAlign: 'center',
                            border: '1px solid #dee2e6'
                          }}>
                            <div style={{ fontSize: '24px', marginBottom: '8px' }}>{categoryIcons[category]}</div>
                            <h5 style={{ color: darkMode ? '#fff' : '#333', margin: '0 0 8px 0', textTransform: 'capitalize' }}>{category}</h5>
                            <div style={{ fontSize: '12px', color: darkMode ? '#ccc' : '#666' }}>
                              <div>{files.length} files</div>
                              <div>{formatBytes(totalSize)}</div>
                              <div>{compressionRatio}% compressed</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Detailed File Structure Table */}
                  <div style={{ background: darkMode ? '#333' : '#f8f9fa', borderRadius: '8px', padding: '20px' }}>
                    <h4 style={{ color: darkMode ? '#fff' : '#333', marginBottom: '15px' }}>Detailed File Analysis</h4>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        background: darkMode ? '#444' : 'white',
                        borderRadius: '8px',
                        overflow: 'hidden'
                      }}>
                        <thead>
                          <tr style={{ background: darkMode ? '#555' : '#f8f9fa' }}>
                            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6', color: darkMode ? '#fff' : '#333', width: '30px' }}></th>
                            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6', color: darkMode ? '#fff' : '#333' }}>File Name</th>
                            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6', color: darkMode ? '#fff' : '#333' }}>Category</th>
                            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6', color: darkMode ? '#fff' : '#333' }}>Size</th>
                            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6', color: darkMode ? '#fff' : '#333' }}>% of Total</th>
                            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6', color: darkMode ? '#fff' : '#333' }}>Compressed</th>
                            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6', color: darkMode ? '#fff' : '#333' }}>Compression</th>
                            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6', color: darkMode ? '#fff' : '#333' }}>Importance</th>
                            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6', color: darkMode ? '#fff' : '#333' }}>Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {edsData?.fileStructure && (() => {
                            const allFiles = Object.values(edsData.fileStructure).filter(file => !file.isDirectory);
                            const totalUncompressedSize = allFiles.reduce((sum, file) => sum + file.uncompressedSize, 0);
                            
                            return allFiles
                              .sort((a, b) => b.uncompressedSize - a.uncompressedSize)
                              .map((file, index) => {
                                const importanceColors = {
                                  'Critical': '#dc3545',
                                  'Important': '#fd7e14',
                                  'Optional': '#28a745',
                                  'Supporting': '#17a2b8',
                                  'Additional': '#6c757d'
                                };
                                
                                const percentageOfTotal = totalUncompressedSize > 0 ? 
                                  (file.uncompressedSize / totalUncompressedSize * 100).toFixed(1) : '0';
                                
                                const isExpanded = expandedFiles.has(file.path);
                                
                                // Debug: Check edsData state at render time
                                console.log(`Render time check for ${file.name}:`, {
                                  hasEdsData: !!edsData,
                                  hasRawFileContents: !!edsData?.rawFileContents,
                                  activeTab,
                                  isExpanded,
                                  rawFileContentsSize: edsData?.rawFileContents ? Object.keys(edsData.rawFileContents).length : 0
                                });
                                
                                const fileContent = getFileContent(file);
                                
                                return (
                                  <React.Fragment key={index}>
                                    <tr 
                                      style={{ 
                                        borderBottom: '1px solid #dee2e6',
                                        cursor: 'pointer',
                                        backgroundColor: isExpanded ? (darkMode ? '#333' : '#f8f9fa') : 'transparent'
                                      }}
                                      onClick={() => toggleFileExpansion(file.path)}
                                    >
                                      <td style={{ padding: '12px', textAlign: 'center' }}>
                                        <span style={{
                                          color: darkMode ? '#fff' : '#333',
                                          fontSize: '14px',
                                          transition: 'transform 0.2s ease'
                                        }}>
                                          {isExpanded ? '▼' : '▶'}
                                        </span>
                                      </td>
                                      <td style={{ padding: '12px', color: darkMode ? '#fff' : '#333' }}>
                                        <div style={{ fontWeight: '500' }}>{file.name}</div>
                                        <div style={{ fontSize: '11px', color: darkMode ? '#ccc' : '#666' }}>{file.directory || 'Root'}</div>
                                      </td>
                                      <td style={{ padding: '12px' }}>
                                        <span style={{
                                          background: darkMode ? '#555' : '#e9ecef',
                                          color: darkMode ? '#fff' : '#495057',
                                          padding: '4px 8px',
                                          borderRadius: '4px',
                                          fontSize: '12px',
                                          textTransform: 'capitalize'
                                        }}>
                                          {file.category}
                                        </span>
                                      </td>
                                      <td style={{ padding: '12px', color: darkMode ? '#fff' : '#333' }}>
                                        {formatBytes(file.uncompressedSize)}
                                      </td>
                                      <td style={{ padding: '12px' }}>
                                        <span style={{
                                          color: '#667eea',
                                          fontWeight: '600',
                                          fontSize: '13px'
                                        }}>
                                          {percentageOfTotal}%
                                        </span>
                                      </td>
                                      <td style={{ padding: '12px', color: darkMode ? '#fff' : '#333' }}>
                                        {formatBytes(file.compressedSize)}
                                      </td>
                                      <td style={{ padding: '12px', color: darkMode ? '#fff' : '#333' }}>
                                        {file.compressionPercentage}%
                                      </td>
                                      <td style={{ padding: '12px' }}>
                                        <span style={{
                                          color: importanceColors[file.importance] || '#6c757d',
                                          fontWeight: '500',
                                          fontSize: '12px'
                                        }}>
                                          {file.importance}
                                        </span>
                                      </td>
                                      <td style={{ padding: '12px', color: darkMode ? '#ccc' : '#666', fontSize: '12px', maxWidth: '300px' }}>
                                        <div style={{ marginBottom: '4px' }}>{file.description}</div>
                                        <div style={{ fontSize: '11px', fontStyle: 'italic', color: darkMode ? '#999' : '#888' }}>
                                          Purpose: {file.purpose}
                                        </div>
                                      </td>
                                    </tr>
                                    {isExpanded && (
                                      <tr>
                                        <td colSpan="9" style={{ padding: '0', border: 'none' }}>
                                          <div style={{
                                            background: darkMode ? '#2a2a2a' : '#f8f9fa',
                                            padding: '20px',
                                            borderTop: '1px solid #dee2e6'
                                          }}>
                                            <div style={{
                                              display: 'flex',
                                              justifyContent: 'space-between',
                                              alignItems: 'center',
                                              marginBottom: '15px'
                                            }}>
                                              <h5 style={{ color: darkMode ? '#fff' : '#333', margin: 0 }}>
                                                📄 File Content: {file.name}
                                              </h5>
                                              <div style={{ fontSize: '12px', color: darkMode ? '#ccc' : '#666' }}>
                                                Type: {file.type.toUpperCase()} | Category: {file.category}
                                              </div>
                                            </div>
                                            {(() => {
                                              console.log(`Rendering content for ${file.name}:`, {
                                                fileContent,
                                                hasContent: !!fileContent,
                                                contentType: fileContent?.type,
                                                contentKeys: fileContent ? Object.keys(fileContent) : 'none'
                                              });
                                              return renderFileContent(fileContent, file);
                                            })()}
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </React.Fragment>
                                );
                              });
                          })()
                          }
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* File Size Distribution */}
                  <div style={{ background: darkMode ? '#333' : '#f8f9fa', borderRadius: '8px', padding: '20px', marginTop: '20px' }}>
                    <h4 style={{ color: darkMode ? '#fff' : '#333', marginBottom: '15px' }}>File Size Distribution</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
                      {edsData?.fileCategories && Object.entries(edsData.fileCategories).map(([category, files]) => {
                        if (files.length === 0) return null;
                        
                        const totalSize = files.reduce((sum, file) => sum + file.uncompressedSize, 0);
                        const totalArchiveSize = Object.values(edsData.fileStructure)
                          .filter(f => !f.isDirectory)
                          .reduce((sum, file) => sum + file.uncompressedSize, 0);
                        const percentage = totalArchiveSize > 0 ? (totalSize / totalArchiveSize * 100).toFixed(1) : '0';
                        
                        return (
                          <div key={category} style={{
                            background: darkMode ? '#444' : 'white',
                            borderRadius: '8px',
                            padding: '15px',
                            border: '1px solid #dee2e6'
                          }}>
                            <h5 style={{ color: darkMode ? '#fff' : '#333', margin: '0 0 10px 0', textTransform: 'capitalize' }}>
                              {category} Files
                            </h5>
                            <div style={{ marginBottom: '10px' }}>
                              <div style={{
                                background: darkMode ? '#222' : '#f8f9fa',
                                borderRadius: '10px',
                                height: '8px',
                                overflow: 'hidden'
                              }}>
                                <div style={{
                                  background: '#667eea',
                                  height: '100%',
                                  width: `${percentage}%`,
                                  transition: 'width 0.3s ease'
                                }} />
                              </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: darkMode ? '#ccc' : '#666' }}>
                              <span>{formatBytes(totalSize)}</span>
                              <span>{percentage}% of total</span>
                            </div>
                            <div style={{ fontSize: '11px', color: darkMode ? '#999' : '#888', marginTop: '5px' }}>
                              {files.length} file{files.length !== 1 ? 's' : ''}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'summary' && (
                <div>
                  <h3 style={{ margin: '0 0 20px 0', color: darkMode ? '#fff' : '#333' }}>📊 Experiment Summary</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                    <div style={{
                      background: darkMode ? '#333' : 'white',
                      borderRadius: '8px',
                      padding: '20px',
                      border: '1px solid #dee2e6'
                    }}>
                      <h4 style={{ color: darkMode ? '#fff' : '#495057', marginBottom: '15px' }}>📋 Experiment Details</h4>
                      {edsData?.properties && (() => {
                        const props = edsData.properties;
                        const experimentData = {
                          'Experiment Name': extractProperty(props, 'ExperimentName') || 'Unknown',
                          'Run Date': extractProperty(props, 'RunDate') || 'Unknown',
                          'Instrument': extractProperty(props, 'InstrumentType') || 'Unknown',
                          'User': extractProperty(props, 'UserName') || 'Unknown',
                          'Protocol': extractProperty(props, 'ProtocolName') || 'Unknown',
                          'Software Version': extractProperty(props, 'SoftwareVersion') || 'Unknown'
                        };
                        return Object.entries(experimentData).map(([label, value]) => (
                          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f8f9fa' }}>
                            <span style={{ color: darkMode ? '#ccc' : '#6c757d', fontWeight: '500' }}>{label}:</span>
                            <span style={{ color: darkMode ? '#fff' : '#495057', fontWeight: '600' }}>{value}</span>
                          </div>
                        ));
                      })()}
                    </div>
                    <div style={{ background: darkMode ? '#333' : 'white', borderRadius: '8px', padding: '20px', border: '1px solid #dee2e6' }}>
                      <h4 style={{ color: darkMode ? '#fff' : '#495057', marginBottom: '15px' }}>📁 File Information</h4>
                      {Object.entries({
                        'Filename': edsData?.filename || 'Unknown',
                        'Size': formatBytes(edsData?.size || 0),
                        'Last Modified': new Date(edsData?.lastModified || 0).toLocaleString()
                      }).map(([label, value]) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f8f9fa' }}>
                          <span style={{ color: darkMode ? '#ccc' : '#6c757d', fontWeight: '500' }}>{label}:</span>
                          <span style={{ color: darkMode ? '#fff' : '#495057', fontWeight: '600' }}>{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'plate' && (
                <div>
                  <h3 style={{ margin: '0 0 20px 0', color: darkMode ? '#fff' : '#333' }}>🧪 Plate Layout</h3>
                  <div style={{ background: darkMode ? '#333' : '#f8f9fa', borderRadius: '8px', padding: '20px' }}>
                    {edsData?.plateLayout ? (
                      <div>
                        <h4 style={{ color: darkMode ? '#fff' : '#333', marginBottom: '15px' }}>Plate Configuration</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                          <div style={{ background: darkMode ? '#444' : 'white', borderRadius: '8px', padding: '15px' }}>
                            <h5 style={{ color: darkMode ? '#fff' : '#333', marginBottom: '10px' }}>Layout Summary</h5>
                            <p style={{ color: darkMode ? '#ccc' : '#666', margin: '5px 0' }}>Well Count: {extractWellCount(edsData.plateLayout)}</p>
                            <p style={{ color: darkMode ? '#ccc' : '#666', margin: '5px 0' }}>Plate Type: {extractProperty(edsData.plateLayout, 'PlateType') || 'Unknown'}</p>
                          </div>
                          <div style={{ background: darkMode ? '#444' : 'white', borderRadius: '8px', padding: '15px' }}>
                            <h5 style={{ color: darkMode ? '#fff' : '#333', marginBottom: '10px' }}>Data Structure</h5>
                            <pre style={{ color: darkMode ? '#ccc' : '#666', fontSize: '12px', overflow: 'auto', maxHeight: '200px' }}>
                              {JSON.stringify(edsData.plateLayout, null, 2).substring(0, 500)}...
                            </pre>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '40px' }}>
                        <div style={{ fontSize: '48px', marginBottom: '20px' }}>🧪</div>
                        <p style={{ color: darkMode ? '#ccc' : '#666' }}>No plate layout data found in this EDS file</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'amplification' && (
                <div>
                  <h3 style={{ margin: '0 0 20px 0', color: darkMode ? '#fff' : '#333' }}>📈 Amplification Data</h3>
                  <div style={{ background: darkMode ? '#333' : '#f8f9fa', borderRadius: '8px', padding: '20px' }}>
                    {edsData?.amplificationData ? (
                      <div>
                        <h4 style={{ color: darkMode ? '#fff' : '#333', marginBottom: '15px' }}>Fluorescence Curves</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                          <div style={{ background: darkMode ? '#444' : 'white', borderRadius: '8px', padding: '15px' }}>
                            <h5 style={{ color: darkMode ? '#fff' : '#333', marginBottom: '10px' }}>Data Summary</h5>
                            {(() => {
                              const stats = extractAmplificationStats(edsData.amplificationData);
                              return (
                                <div>
                                  <p style={{ color: darkMode ? '#ccc' : '#666', margin: '5px 0' }}>Wells: {stats.wellCount}</p>
                                  <p style={{ color: darkMode ? '#ccc' : '#666', margin: '5px 0' }}>Cycles: {stats.cycleCount}</p>
                                  <p style={{ color: darkMode ? '#ccc' : '#666', margin: '5px 0' }}>Data Points: {stats.dataPoints}</p>
                                </div>
                              );
                            })()}
                          </div>
                          <div style={{ background: darkMode ? '#444' : 'white', borderRadius: '8px', padding: '15px' }}>
                            <h5 style={{ color: darkMode ? '#fff' : '#333', marginBottom: '10px' }}>Memory Usage</h5>
                            <p style={{ color: darkMode ? '#ccc' : '#666', margin: '5px 0' }}>
                              Size: {formatBytes(edsData.memoryProfile?.components['Amplification Curves'] || 0)}
                            </p>
                            <p style={{ color: darkMode ? '#ccc' : '#666', margin: '5px 0' }}>
                              Compressed: {formatBytes(edsData.memoryProfile?.details['Amplification Curves']?.compressed || 0)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '40px' }}>
                        <div style={{ fontSize: '48px', marginBottom: '20px' }}>📈</div>
                        <p style={{ color: darkMode ? '#ccc' : '#666' }}>No amplification data found in this EDS file</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'memory' && edsData?.memoryProfile && (
                <div>
                  <h3 style={{ margin: '0 0 20px 0', color: darkMode ? '#fff' : '#333' }}>💾 Comprehensive Memory Analysis</h3>
                  
                  {/* Compression Efficiency Summary */}
                  <div style={{ background: darkMode ? '#333' : '#f8f9fa', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
                    <h4 style={{ color: darkMode ? '#fff' : '#333', marginBottom: '15px' }}>Compression Efficiency</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#667eea' }}>
                          {edsData.memoryProfile.efficiency.actualCompression}
                        </div>
                        <div style={{ color: darkMode ? '#ccc' : '#666', fontSize: '14px' }}>Actual Compression</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>
                          {edsData.memoryProfile.efficiency.estimatedCompression}
                        </div>
                        <div style={{ color: darkMode ? '#ccc' : '#666', fontSize: '14px' }}>Estimated Compression</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#17a2b8' }}>
                          {edsData.memoryProfile.efficiency.spaceSavings}
                        </div>
                        <div style={{ color: darkMode ? '#ccc' : '#666', fontSize: '14px' }}>Space Savings</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '30px', alignItems: 'start' }}>
                    <div style={{ background: darkMode ? '#333' : '#f8f9fa', borderRadius: '8px', padding: '20px' }}>
                      <h4 style={{ color: darkMode ? '#fff' : '#333', marginBottom: '15px' }}>Detailed Component Analysis</h4>
                      {Object.entries(edsData.memoryProfile.details).map(([component, details]) => (
                        <div key={component} style={{
                          background: darkMode ? '#444' : 'white',
                          borderRadius: '8px',
                          padding: '15px',
                          marginBottom: '15px',
                          border: '1px solid #dee2e6'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <h5 style={{ color: darkMode ? '#fff' : '#333', margin: 0 }}>{component}</h5>
                            <span style={{ color: '#667eea', fontWeight: 'bold' }}>{formatBytes(details.size)}</span>
                          </div>
                          <p style={{ color: darkMode ? '#ccc' : '#666', fontSize: '12px', margin: '5px 0' }}>{details.description}</p>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                            <span style={{ color: darkMode ? '#ccc' : '#666' }}>Source: {details.source}</span>
                            <span style={{ color: darkMode ? '#ccc' : '#666' }}>Compressed: {formatBytes(details.compressed)}</span>
                          </div>
                          {details.wellCount && (
                            <div style={{ fontSize: '12px', color: darkMode ? '#ccc' : '#666', marginTop: '5px' }}>
                              Wells: {details.wellCount} | Compression: {((1 - details.compressed / details.size) * 100).toFixed(1)}%
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div style={{ background: 'white', borderRadius: '8px', padding: '20px', textAlign: 'center' }}>
                      <canvas ref={memoryChartRef} width="400" height="400"></canvas>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'xml' && (
                <div>
                  <h3 style={{ margin: '0 0 20px 0', color: darkMode ? '#fff' : '#333' }}>📄 Raw XML Data</h3>
                  <div style={{ background: darkMode ? '#333' : '#f8f9fa', borderRadius: '8px', padding: '20px' }}>
                    {edsData?.rawXML && Object.keys(edsData.rawXML).length > 0 ? (
                      <div>
                        <h4 style={{ color: darkMode ? '#fff' : '#333', marginBottom: '15px' }}>XML Files</h4>
                        {Object.entries(edsData.rawXML).map(([fileName, xmlContent]) => (
                          <div key={fileName} style={{
                            background: darkMode ? '#444' : 'white',
                            borderRadius: '8px',
                            padding: '15px',
                            marginBottom: '15px',
                            border: '1px solid #dee2e6'
                          }}>
                            <h5 style={{ color: darkMode ? '#fff' : '#333', marginBottom: '10px' }}>{fileName}</h5>
                            <div style={{
                              background: darkMode ? '#222' : '#f8f9fa',
                              borderRadius: '4px',
                              padding: '10px',
                              maxHeight: '300px',
                              overflow: 'auto'
                            }}>
                              <pre style={{
                                color: darkMode ? '#ccc' : '#666',
                                fontSize: '11px',
                                margin: 0,
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-all'
                              }}>
                                {xmlContent ? xmlContent.substring(0, 2000) + (xmlContent.length > 2000 ? '\n\n... (truncated)' : '') : 'No content'}
                              </pre>
                            </div>
                            <div style={{ marginTop: '10px', fontSize: '12px', color: darkMode ? '#ccc' : '#666' }}>
                              Size: {formatBytes(xmlContent ? xmlContent.length : 0)}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '40px' }}>
                        <div style={{ fontSize: '48px', marginBottom: '20px' }}>📄</div>
                        <p style={{ color: darkMode ? '#ccc' : '#666' }}>No raw XML data available</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'export' && (
                <div>
                  <h3 style={{ margin: '0 0 20px 0', color: darkMode ? '#fff' : '#333' }}>📤 Export Data</h3>
                  <div style={{ background: darkMode ? '#333' : '#f8f9fa', borderRadius: '8px', padding: '30px', textAlign: 'center' }}>
                    <p style={{ color: darkMode ? '#ccc' : '#666', marginBottom: '30px' }}>
                      Export your EDS analysis data in various formats for further analysis or reporting.
                    </p>
                    <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button onClick={exportJSON} style={{
                        background: '#667eea', color: 'white', border: 'none', borderRadius: '8px',
                        padding: '15px 25px', cursor: 'pointer', fontSize: '16px', minWidth: '200px', fontWeight: '500'
                      }}>
                        📄 Export Complete Data (JSON)
                      </button>
                      <button onClick={exportMemoryCSV} style={{
                        background: '#28a745', color: 'white', border: 'none', borderRadius: '8px',
                        padding: '15px 25px', cursor: 'pointer', fontSize: '16px', minWidth: '200px', fontWeight: '500'
                      }}>
                        📊 Export Memory Report (CSV)
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default EDSParser;
