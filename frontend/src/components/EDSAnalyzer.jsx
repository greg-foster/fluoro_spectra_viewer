import React, { useState, useEffect } from 'react';
import Chart from 'chart.js/auto';

const EDSAnalyzer = ({ darkMode }) => {
  const [edsData, setEdsData] = useState(null);
  const [activeTab, setActiveTab] = useState('summary');
  const [memoryChart, setMemoryChart] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  // EDS file processing
  const processEDSFile = async (file) => {
    try {
      if (!file.name.toLowerCase().endsWith('.eds')) {
        throw new Error('Please select a valid .eds file');
      }

      // Read file as array buffer
      const arrayBuffer = await file.arrayBuffer();
      
      // Extract ZIP contents using JSZip
      const JSZip = window.JSZip;
      if (!JSZip) {
        throw new Error('JSZip library not loaded');
      }

      const zip = new JSZip();
      const zipContent = await zip.loadAsync(arrayBuffer);
      
      // Parse EDS contents
      const parsedData = await parseEDSContents(zipContent);
      
      // Analyze memory usage
      const memoryProfile = analyzeMemoryUsage(parsedData, file.size);
      
      const result = {
        filename: file.name,
        size: file.size,
        lastModified: file.lastModified,
        summary: parsedData.summary,
        plateSetup: parsedData.plateSetup,
        analysisResult: parsedData.analysisResult,
        amplificationData: parsedData.amplificationData,
        fileStructure: parsedData.fileStructure,
        memoryProfile: memoryProfile
      };

      setEdsData(result);
      setIsVisible(true);
      
    } catch (error) {
      console.error('EDS parsing error:', error);
      alert(`Failed to parse EDS file: ${error.message}`);
    }
  };

  // Parse EDS contents from ZIP
  const parseEDSContents = async (zip) => {
    const result = {
      summary: null,
      plateSetup: null,
      analysisResult: null,
      amplificationData: null,
      fileStructure: {}
    };

    try {
      // Extract summary.json
      const summaryFile = zip.file('summary.json');
      if (summaryFile) {
        const summaryText = await summaryFile.async('text');
        result.summary = parseJSONWithNaN(summaryText);
      }

      // Extract plate_setup.json
      const plateSetupFile = zip.file('plate_setup.json');
      if (plateSetupFile) {
        const plateSetupText = await plateSetupFile.async('text');
        result.plateSetup = parseJSONWithNaN(plateSetupText);
      }

      // Extract analysis_result.json
      const analysisResultFile = zip.file('analysis_result.json');
      if (analysisResultFile) {
        const analysisResultText = await analysisResultFile.async('text');
        result.analysisResult = parseJSONWithNaN(analysisResultText);
      }

      // Extract amplification data
      const amplificationFile = zip.file('amplification_data.json');
      if (amplificationFile) {
        const amplificationText = await amplificationFile.async('text');
        result.amplificationData = parseJSONWithNaN(amplificationText);
      }

      // Build file structure map
      zip.forEach((relativePath, file) => {
        result.fileStructure[relativePath] = {
          uncompressedSize: file._data ? file._data.uncompressedSize : 0,
          compressedSize: file._data ? file._data.compressedSize : 0,
          isDirectory: file.dir
        };
      });

      return result;
    } catch (error) {
      console.error('Error parsing EDS contents:', error);
      throw error;
    }
  };

  // Parse JSON with NaN handling
  const parseJSONWithNaN = (jsonString) => {
    try {
      const cleanedString = jsonString.replace(/:\s*NaN/g, ': null');
      return JSON.parse(cleanedString);
    } catch (error) {
      console.warn('Failed to parse JSON:', error);
      return { rawData: jsonString, parseError: error.message };
    }
  };

  // Analyze memory usage
  const analyzeMemoryUsage = (data, totalFileSize) => {
    const components = {};
    let totalUncompressed = 0;

    if (data.summary) {
      components['Summary Data'] = calculateJSONSize(data.summary);
    }
    if (data.plateSetup) {
      components['Plate Setup'] = calculateJSONSize(data.plateSetup);
    }
    if (data.analysisResult) {
      components['Analysis Results'] = calculateJSONSize(data.analysisResult);
    }
    if (data.amplificationData) {
      components['Amplification Data'] = calculateJSONSize(data.amplificationData);
    }
    if (data.fileStructure) {
      components['File Structure'] = calculateJSONSize(data.fileStructure);
    }

    totalUncompressed = Object.values(components).reduce((sum, size) => sum + size, 0);
    const compressionRatio = totalFileSize > 0 ? totalUncompressed / totalFileSize : 1;

    return {
      components,
      totalUncompressed,
      totalCompressed: totalFileSize,
      compressionRatio,
      compressionPercentage: ((1 - (totalFileSize / totalUncompressed)) * 100).toFixed(1)
    };
  };

  // Calculate JSON size
  const calculateJSONSize = (obj) => {
    return new Blob([JSON.stringify(obj)]).size;
  };

  // Format bytes
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Create memory chart
  useEffect(() => {
    if (activeTab === 'memory' && edsData?.memoryProfile && !memoryChart) {
      const canvas = document.getElementById('edsMemoryChart');
      if (canvas && window.Chart) {
        const ctx = canvas.getContext('2d');
        const components = edsData.memoryProfile.components;
        const labels = Object.keys(components);
        const data = Object.values(components);
        const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'];

        const chart = new Chart(ctx, {
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
              title: {
                display: true,
                text: 'Memory Usage Distribution'
              },
              legend: {
                position: 'bottom'
              },
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

        setMemoryChart(chart);
      }
    }

    return () => {
      if (memoryChart) {
        memoryChart.destroy();
        setMemoryChart(null);
      }
    };
  }, [activeTab, edsData, memoryChart]);

  // Export functions
  const exportJSON = () => {
    if (!edsData) return;
    
    const exportData = {
      experiment: edsData.summary?.name || 'Unknown',
      summary: edsData.summary,
      plateSetup: edsData.plateSetup,
      analysisResult: edsData.analysisResult,
      memoryProfile: edsData.memoryProfile
    };

    downloadFile(
      JSON.stringify(exportData, null, 2),
      `${exportData.experiment}_parsed.json`,
      'application/json'
    );
  };

  const exportMemoryCSV = () => {
    if (!edsData?.memoryProfile) return;

    const profile = edsData.memoryProfile;
    const csvRows = [['Component', 'Size (bytes)', 'Size (formatted)', 'Percentage']];

    Object.entries(profile.components).forEach(([name, size]) => {
      const percentage = (size / profile.totalUncompressed * 100).toFixed(2);
      csvRows.push([name, size, formatBytes(size), percentage + '%']);
    });

    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    downloadFile(csvContent, `${edsData.summary?.name || 'unknown'}_memory_report.csv`, 'text/csv');
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

  // File upload handler
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      processEDSFile(file);
    }
  };

  if (!isVisible) {
    return (
      <div style={{ 
        padding: '20px', 
        border: '2px dashed #ccc', 
        borderRadius: '8px', 
        textAlign: 'center',
        margin: '20px 0',
        backgroundColor: darkMode ? '#2a2a2a' : '#f9f9f9'
      }}>
        <h3 style={{ color: darkMode ? '#fff' : '#333' }}>🧬 EDS File Analysis</h3>
        <p style={{ color: darkMode ? '#ccc' : '#666' }}>
          Upload a Thermo Fisher EDS file to analyze qPCR experiment data
        </p>
        <input
          type="file"
          accept=".eds"
          onChange={handleFileUpload}
          style={{ margin: '10px 0' }}
        />
      </div>
    );
  }

  return (
    <div style={{ 
      margin: '20px 0', 
      padding: '20px', 
      border: '1px solid #ddd', 
      borderRadius: '8px',
      backgroundColor: darkMode ? '#2a2a2a' : '#fff'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ color: darkMode ? '#fff' : '#333', margin: 0 }}>🧬 EDS Analysis: {edsData?.filename}</h3>
        <button 
          onClick={() => setIsVisible(false)}
          style={{ 
            background: 'none', 
            border: 'none', 
            fontSize: '20px', 
            cursor: 'pointer',
            color: darkMode ? '#fff' : '#333'
          }}
        >
          ×
        </button>
      </div>

      {/* Tab Navigation */}
      <div style={{ 
        display: 'flex', 
        gap: '10px', 
        marginBottom: '20px', 
        borderBottom: `2px solid ${darkMode ? '#444' : '#ddd'}`,
        paddingBottom: '10px'
      }}>
        {[
          { id: 'summary', label: '📊 Summary' },
          { id: 'memory', label: '💾 Memory Analysis' },
          { id: 'plate', label: '🧪 Plate Layout' },
          { id: 'export', label: '📤 Export' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: activeTab === tab.id ? '#667eea' : (darkMode ? '#444' : '#f8f9fa'),
              color: activeTab === tab.id ? 'white' : (darkMode ? '#fff' : '#495057'),
              border: '1px solid #dee2e6',
              borderRadius: '8px',
              padding: '10px 15px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ minHeight: '300px' }}>
        {activeTab === 'summary' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
              {/* Experiment Details */}
              <div style={{ 
                background: darkMode ? '#333' : 'white', 
                borderRadius: '8px', 
                padding: '20px', 
                border: '1px solid #dee2e6' 
              }}>
                <h4 style={{ color: darkMode ? '#fff' : '#495057', marginBottom: '15px' }}>📋 Experiment Details</h4>
                {edsData?.summary && Object.entries({
                  'Name': edsData.summary.name || 'Unknown',
                  'Date': edsData.summary.date || 'Unknown',
                  'Instrument': edsData.summary.instrument || 'Unknown',
                  'Protocol': edsData.summary.protocol || 'Unknown'
                }).map(([label, value]) => (
                  <div key={label} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    padding: '8px 0', 
                    borderBottom: '1px solid #f8f9fa' 
                  }}>
                    <span style={{ color: darkMode ? '#ccc' : '#6c757d', fontWeight: '500' }}>{label}:</span>
                    <span style={{ color: darkMode ? '#fff' : '#495057', fontWeight: '600' }}>{value}</span>
                  </div>
                ))}
              </div>

              {/* File Information */}
              <div style={{ 
                background: darkMode ? '#333' : 'white', 
                borderRadius: '8px', 
                padding: '20px', 
                border: '1px solid #dee2e6' 
              }}>
                <h4 style={{ color: darkMode ? '#fff' : '#495057', marginBottom: '15px' }}>📁 File Information</h4>
                {Object.entries({
                  'Filename': edsData?.filename || 'Unknown',
                  'Size': formatBytes(edsData?.size || 0),
                  'Last Modified': new Date(edsData?.lastModified || 0).toLocaleString()
                }).map(([label, value]) => (
                  <div key={label} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    padding: '8px 0', 
                    borderBottom: '1px solid #f8f9fa' 
                  }}>
                    <span style={{ color: darkMode ? '#ccc' : '#6c757d', fontWeight: '500' }}>{label}:</span>
                    <span style={{ color: darkMode ? '#fff' : '#495057', fontWeight: '600' }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'memory' && edsData?.memoryProfile && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '30px', alignItems: 'start' }}>
            <div style={{ 
              background: darkMode ? '#333' : '#f8f9fa', 
              borderRadius: '8px', 
              padding: '20px' 
            }}>
              <h4 style={{ color: darkMode ? '#fff' : '#333', marginBottom: '15px' }}>💾 Memory Usage Breakdown</h4>
              {Object.entries(edsData.memoryProfile.components).map(([component, size]) => {
                const percentage = (size / edsData.memoryProfile.totalUncompressed * 100).toFixed(1);
                return (
                  <div key={component} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    padding: '10px 0', 
                    borderBottom: '1px solid #dee2e6' 
                  }}>
                    <span style={{ color: darkMode ? '#ccc' : '#6c757d', fontWeight: '500' }}>{component}</span>
                    <span style={{ color: darkMode ? '#fff' : '#667eea', fontWeight: '600' }}>
                      {formatBytes(size)} ({percentage}%)
                    </span>
                  </div>
                );
              })}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                padding: '10px 0', 
                fontWeight: 'bold',
                color: darkMode ? '#fff' : '#333'
              }}>
                <span>Total Uncompressed</span>
                <span>{formatBytes(edsData.memoryProfile.totalUncompressed)}</span>
              </div>
            </div>
            <div style={{ 
              background: 'white', 
              borderRadius: '8px', 
              padding: '20px', 
              textAlign: 'center' 
            }}>
              <canvas id="edsMemoryChart" width="400" height="400"></canvas>
            </div>
          </div>
        )}

        {activeTab === 'plate' && (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <h4 style={{ color: darkMode ? '#fff' : '#333' }}>🧪 Plate Layout Visualization</h4>
            <p style={{ color: darkMode ? '#ccc' : '#666' }}>
              Plate layout visualization would be implemented here based on the plate setup data.
            </p>
          </div>
        )}

        {activeTab === 'export' && (
          <div style={{ 
            background: darkMode ? '#333' : '#f8f9fa', 
            borderRadius: '8px', 
            padding: '25px', 
            textAlign: 'center' 
          }}>
            <h4 style={{ color: darkMode ? '#fff' : '#333', marginBottom: '20px' }}>Export EDS Data</h4>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={exportJSON}
                style={{
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 20px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  minWidth: '200px'
                }}
              >
                📄 Export Complete Data (JSON)
              </button>
              <button
                onClick={exportMemoryCSV}
                style={{
                  background: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 20px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  minWidth: '200px'
                }}
              >
                📊 Export Memory Report (CSV)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EDSAnalyzer;
