import React from "react";
import Plot from "react-plotly.js";

export default function CrosstalkHeatmap({ dyes, filters, crosstalk }) {
  if (!dyes.length || !filters.length) return null;
  return (
    <div>
      <h2>Crosstalk Heatmap</h2>
      <Plot
        data={[
          {
            z: crosstalk,
            x: filters.map(f => f.name),
            y: dyes.map(d => d.name),
            type: "heatmap",
            colorscale: "YlOrRd",
            showscale: true,
            hoverongaps: false
          }
        ]}
        layout={{
          autosize: true,
          height: 350,
          margin: { t: 30, r: 10, l: 60, b: 60 },
          xaxis: { title: "Filter" },
          yaxis: { title: "Dye" },
          plot_bgcolor: "#f7f7f7",
          paper_bgcolor: "#fff"
        }}
        useResizeHandler
        style={{ width: "100%", minHeight: 300 }}
        config={{ responsive: true }}
      />
    </div>
  );
}
