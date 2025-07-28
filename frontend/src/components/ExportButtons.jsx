import React from "react";
import Plotly from "plotly.js-dist";
import * as XLSX from "xlsx";

export default function ExportButtons({ plotId, tableRef, filenameBase }) {
  // Export Plot as PNG/SVG
  const exportPlot = (format) => {
    Plotly.downloadImage(plotId, {
      format,
      filename: filenameBase + "_spectra",
      width: 900,
      height: 500,
      scale: 2
    });
  };

  // Export Table as CSV
  const exportTableCSV = () => {
    if (!tableRef.current) return;
    let csv = "";
    const rows = tableRef.current.querySelectorAll("tr");
    rows.forEach(row => {
      let rowData = [];
      row.querySelectorAll("th,td").forEach(cell => {
        rowData.push('"' + cell.innerText.replace(/"/g, '""') + '"');
      });
      csv += rowData.join(",") + "\n";
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filenameBase + ".csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export Table as XLSX
  const exportTableXLSX = () => {
    if (!tableRef.current) return;
    const rows = Array.from(tableRef.current.querySelectorAll("tr")).map(row =>
      Array.from(row.querySelectorAll("th,td")).map(cell => cell.innerText)
    );
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Crosstalk");
    XLSX.writeFile(wb, filenameBase + ".xlsx");
  };

  return (
    <div style={{ margin: "1rem 0", display: "flex", gap: "1rem" }}>
      <button onClick={() => exportPlot("png")}>Export Plot (PNG)</button>
      <button onClick={() => exportPlot("svg")}>Export Plot (SVG)</button>
      <button onClick={exportTableCSV}>Export Table (CSV)</button>
      <button onClick={exportTableXLSX}>Export Table (XLSX)</button>
    </div>
  );
}
