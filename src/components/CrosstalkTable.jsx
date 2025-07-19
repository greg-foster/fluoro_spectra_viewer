import React, { useRef, useState } from "react";
import ExportButtons from "./ExportButtons";

export default function CrosstalkTable({ dyes, filters, crosstalk, filterOrder, setFilterOrder, darkMode = false }) {
  // Update filterOrder if filters change
  const tableRef = useRef();
  const [useGlobalNorm, setUseGlobalNorm] = useState(false);
  if (!dyes.length || !filters.length) return <div style={{color:'red',margin:'1em 0'}}>No dyes or filters selected. Please select at least one dye and one filter.</div>;
  if (!crosstalk || !crosstalk.length || !crosstalk[0] || !crosstalk[0].length) {
    return <div style={{color:'red',margin:'1em 0'}}>No crosstalk data available. Check that spectra and filters are loaded and valid.</div>;
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
      <table ref={tableRef} style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th>Dye \ Filter</th>
            {orderedFilters.map((f, j) => (
              <th key={j} style={{whiteSpace:'nowrap'}}>
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
              fontWeight: 'bold'
            }}>Row Sum</th>
          </tr>
        </thead>
        <tbody>
          {dyes.map((dye, i) => {
            const rowSum = normalized?.[i]?.reduce((a, b) => a + b, 0) || 0;
            return (
              <tr key={dye.id}>
                <td>{dye.name}</td>
                {orderedFilters.map((f, j) => (
                  <td key={j} style={{ textAlign: "right", padding: 4 }}>
                    {normalized?.[i]?.[j] !== undefined ? normalized[i][j].toFixed(2) : "0"}
                  </td>
                ))}
                <td style={{
                  textAlign: 'right',
                  fontWeight: 'bold',
                  background: darkMode ? '#222' : '#f0f0f0',
                  color: darkMode ? '#fff' : '#000'
                }}>{rowSum.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      <tfoot>
        <tr>
          <td style={{fontWeight:'bold', background: darkMode ? '#222' : '#f0f0f0', color: darkMode ? '#fff' : '#000'}}>Col Sum</td>
          {orderedFilters.map((f, j) => {
            const colSum = (normalized && normalized.length)
              ? normalized.map(row => row?.[j] || 0).reduce((a, b) => a + b, 0)
              : 0;
            return (
              <td key={j} style={{ textAlign: 'right', fontWeight: 'bold', background: darkMode ? '#222' : '#f0f0f0', color: darkMode ? '#fff' : '#000' }}>{colSum.toFixed(2)}</td>
            );
          })}
          {/* Row sums column total: sum of all normalized values */}
          <td style={{ textAlign: 'right', fontWeight: 'bold', background: darkMode ? '#222' : '#f0f0f0', color: darkMode ? '#fff' : '#000' }}>
            {(normalized && normalized.length)
              ? normalized.reduce((total, row) => total + (row?.reduce((a, b) => a + b, 0) || 0), 0).toFixed(2)
              : '0.00'}
          </td>
        </tr>
      </tfoot>
      </table>
    </div>
  );
}
