import React, { useRef, useState } from "react";
import ExportButtons from "./ExportButtons";

export default function CrosstalkTable({ dyes, filters, crosstalk, filterOrder, setFilterOrder, darkMode = false }) {
  // Update filterOrder if filters change
  const tableRef = useRef();
  const [useGlobalNorm, setUseGlobalNorm] = useState(false);
  // Show empty table structure when no data is available
  const showEmptyTable = !dyes.length || !filters.length || !crosstalk || !crosstalk.length || !crosstalk[0] || !crosstalk[0].length;
  
  if (showEmptyTable) {
    // Create placeholder data for empty table
    const placeholderDyes = dyes.length > 0 ? dyes : [
      { id: 'placeholder1', name: 'Select dyes...' },
      { id: 'placeholder2', name: 'to see crosstalk' },
      { id: 'placeholder3', name: 'analysis here' }
    ];
    const placeholderFilters = filters.length > 0 ? filters : [
      { name: 'Filter 1' },
      { name: 'Filter 2' },
      { name: 'Filter 3' }
    ];
    
    return (
      <div>
        <h2>
          Crosstalk Table (Normalized: {useGlobalNorm ? 'Global' : 'Per-Filter'})
          <button style={{marginLeft:8}} onClick={() => setUseGlobalNorm(v => !v)}>
            Toggle to {useGlobalNorm ? 'Per-Filter' : 'Global'}
          </button>
        </h2>
        <ExportButtons tableRef={tableRef} filenameBase="crosstalk" />
        <div style={{ 
          overflowX: 'auto', 
          maxWidth: '100%',
          border: '1px solid #ddd',
          borderRadius: '4px',
          marginTop: '10px',
          opacity: 0.6
        }}>
          <table ref={tableRef} style={{ 
            minWidth: "100%", 
            borderCollapse: "collapse",
            fontSize: '14px'
          }}>
            <thead>
              <tr>
                <th style={{
                  padding: '8px 4px',
                  minWidth: '120px',
                  textAlign: 'center',
                  borderBottom: '2px solid #ddd'
                }}>Dye \ Filter</th>
                {placeholderFilters.map((f, j) => (
                  <th key={j} style={{
                    whiteSpace:'nowrap',
                    padding: '8px 4px',
                    minWidth: '120px',
                    textAlign: 'center',
                    borderBottom: '2px solid #ddd'
                  }}>
                    {f.name}
                  </th>
                ))}
                <th style={{
                  textAlign:'right',
                  background: darkMode ? '#222' : '#f0f0f0',
                  color: darkMode ? '#fff' : '#000',
                  fontWeight: 'bold',
                  padding: '8px 4px',
                  minWidth: '80px',
                  borderBottom: '2px solid #ddd'
                }}>Row Sum</th>
              </tr>
            </thead>
            <tbody>
              {placeholderDyes.map((dye, i) => (
                <tr key={dye.id}>
                  <td style={{
                    padding: '6px 8px',
                    fontWeight: 'bold',
                    minWidth: '120px',
                    whiteSpace: 'nowrap',
                    borderRight: '1px solid #ddd',
                    fontStyle: dye.id.includes('placeholder') ? 'italic' : 'normal',
                    color: dye.id.includes('placeholder') ? '#888' : 'inherit'
                  }}>{dye.name}</td>
                  {placeholderFilters.map((f, j) => (
                    <td key={j} style={{ 
                      textAlign: "right", 
                      padding: '6px 4px',
                      minWidth: '60px',
                      borderRight: '1px solid #eee',
                      color: '#888'
                    }}>
                      --
                    </td>
                  ))}
                  <td style={{
                    textAlign: 'right',
                    fontWeight: 'bold',
                    background: darkMode ? '#222' : '#f0f0f0',
                    color: darkMode ? '#fff' : '#888',
                    padding: '6px 4px',
                    minWidth: '80px'
                  }}>--</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td style={{
                  fontWeight:'bold', 
                  background: darkMode ? '#222' : '#f0f0f0', 
                  color: darkMode ? '#fff' : '#000',
                  padding: '6px 8px',
                  minWidth: '120px',
                  borderRight: '1px solid #ddd'
                }}>Col Sum</td>
                {placeholderFilters.map((f, j) => (
                  <td key={j} style={{ 
                    textAlign: 'right', 
                    fontWeight: 'bold', 
                    background: darkMode ? '#222' : '#f0f0f0', 
                    color: darkMode ? '#fff' : '#888',
                    padding: '6px 4px',
                    minWidth: '60px',
                    borderRight: '1px solid #eee'
                  }}>--</td>
                ))}
                <td style={{ 
                  textAlign: 'right', 
                  fontWeight: 'bold', 
                  background: darkMode ? '#222' : '#f0f0f0', 
                  color: darkMode ? '#fff' : '#888',
                  padding: '6px 4px',
                  minWidth: '80px'
                }}>--</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div style={{
          textAlign: 'center',
          color: '#666',
          fontStyle: 'italic',
          marginTop: '10px',
          padding: '10px',
          background: '#f9f9f9',
          borderRadius: '4px'
        }}>
          Select dyes and filters to see crosstalk analysis
        </div>
      </div>
    );
  }
  // Reorder filters and crosstalk columns, skipping undefined
  const orderedFilters = filterOrder.map(i => filters[i]).filter(f => !!f);
  let validIndices = filterOrder.map((i, idx) => filters[i] ? i : null).filter(i => i !== null);
  let orderedCrosstalk = crosstalk;
  if (crosstalk && crosstalk.length && filters.length) {
    orderedCrosstalk = crosstalk.map(row => validIndices.map(i => row[i]));
  }
  // Normalization logic
  let normalized = [];
  if (orderedCrosstalk && orderedCrosstalk.length && orderedFilters.length) {
    if (useGlobalNorm) {
      const globalMax = Math.max(...crosstalk.flat());
      normalized = crosstalk.map(row =>
        row.map(val => globalMax > 0 ? val / globalMax : 0)
      );
    } else {
      // Per-column normalization
      const maxes = filters.map((_, j) => Math.max(...crosstalk.map(row => row[j] || 0)));
      normalized = crosstalk.map(row =>
        row.map((val, j) => maxes[j] > 0 ? val / maxes[j] : 0)
      );
    }
  }

  return (
    <div>
      <h2>
        Crosstalk Table (Normalized: {useGlobalNorm ? 'Global' : 'Per-Filter'})
        <button style={{marginLeft:8}} onClick={() => setUseGlobalNorm(v => !v)}>
          Toggle to {useGlobalNorm ? 'Per-Filter' : 'Global'}
        </button>
      </h2>
      <ExportButtons tableRef={tableRef} filenameBase="crosstalk" />
      <div style={{ 
        overflowX: 'auto', 
        maxWidth: '100%',
        border: '1px solid #ddd',
        borderRadius: '4px',
        marginTop: '10px'
      }}>
        <table ref={tableRef} style={{ 
          minWidth: "100%", 
          borderCollapse: "collapse",
          fontSize: '14px'
        }}>
        <thead>
          <tr>
            <th>Dye \ Filter</th>
            {orderedFilters.map((f, j) => (
              <th key={j} style={{
                whiteSpace:'nowrap',
                padding: '8px 4px',
                minWidth: '120px',
                textAlign: 'center',
                borderBottom: '2px solid #ddd'
              }}>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    if (j > 0) {
                      const newOrder = [...filterOrder];
                      [newOrder[j-1], newOrder[j]] = [newOrder[j], newOrder[j-1]];
                      setFilterOrder(newOrder);
                    }
                  }}
                  disabled={j===0}
                  style={{marginRight:2}}
                  title="Move Left"
                >&larr;</button>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    if (j < orderedFilters.length-1) {
                      const newOrder = [...filterOrder];
                      [newOrder[j], newOrder[j+1]] = [newOrder[j+1], newOrder[j]];
                      setFilterOrder(newOrder);
                    }
                  }}
                  disabled={j===orderedFilters.length-1}
                  style={{marginRight:4}}
                  title="Move Right"
                >&rarr;</button>
                {f.name}
              </th>
            ))}
            <th style={{
              textAlign:'right',
              background: darkMode ? '#222' : '#f0f0f0',
              color: darkMode ? '#fff' : '#000',
              fontWeight: 'bold',
              padding: '8px 4px',
              minWidth: '80px',
              borderBottom: '2px solid #ddd'
            }}>Row Sum</th>
          </tr>
        </thead>
        <tbody>
          {dyes.map((dye, i) => {
            const rowSum = normalized?.[i]?.reduce((a, b) => a + b, 0) || 0;
            return (
              <tr key={dye.id}>
                <td style={{
                  padding: '6px 8px',
                  fontWeight: 'bold',
                  minWidth: '120px',
                  whiteSpace: 'nowrap',
                  borderRight: '1px solid #ddd'
                }}>{dye.name}</td>
                {orderedFilters.map((f, j) => (
                  <td key={j} style={{ 
                    textAlign: "right", 
                    padding: '6px 4px',
                    minWidth: '60px',
                    borderRight: '1px solid #eee'
                  }}>
                    {normalized?.[i]?.[j] !== undefined ? normalized[i][j].toFixed(2) : "0"}
                  </td>
                ))}
                <td style={{
                  textAlign: 'right',
                  fontWeight: 'bold',
                  background: darkMode ? '#222' : '#f0f0f0',
                  color: darkMode ? '#fff' : '#000',
                  padding: '6px 4px',
                  minWidth: '80px'
                }}>{rowSum.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      <tfoot>
        <tr>
          <td style={{
            fontWeight:'bold', 
            background: darkMode ? '#222' : '#f0f0f0', 
            color: darkMode ? '#fff' : '#000',
            padding: '6px 8px',
            minWidth: '120px',
            borderRight: '1px solid #ddd'
          }}>Col Sum</td>
          {orderedFilters.map((f, j) => {
            const colSum = (normalized && normalized.length)
              ? normalized.map(row => row?.[j] || 0).reduce((a, b) => a + b, 0)
              : 0;
            return (
              <td key={j} style={{ 
                textAlign: 'right', 
                fontWeight: 'bold', 
                background: darkMode ? '#222' : '#f0f0f0', 
                color: darkMode ? '#fff' : '#000',
                padding: '6px 4px',
                minWidth: '60px',
                borderRight: '1px solid #eee'
              }}>{colSum.toFixed(2)}</td>
            );
          })}
          {/* Row sums column total: sum of all normalized values */}
          <td style={{ 
            textAlign: 'right', 
            fontWeight: 'bold', 
            background: darkMode ? '#222' : '#f0f0f0', 
            color: darkMode ? '#fff' : '#000',
            padding: '6px 4px',
            minWidth: '80px'
          }}>
            {(normalized && normalized.length)
              ? normalized.reduce((total, row) => total + (row?.reduce((a, b) => a + b, 0) || 0), 0).toFixed(2)
              : '0.00'}
          </td>
        </tr>
      </tfoot>
        </table>
      </div>
    </div>
  );
}
