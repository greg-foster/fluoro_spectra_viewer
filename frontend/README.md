# Fluorescent Dye Spectra Viewer & Crosstalk Calculator

A browser-based tool to visualize excitation/emission spectra of fluorescent dyes, manage optical filters, and calculate crosstalk.

## Features
- Select dyes and plot their excitation/emission spectra
- (Planned) Upload/define bandpass filters and overlay on plot
- (Planned) Calculate and visualize crosstalk matrix
- Export plots and tables

## Tech Stack
- React + Plotly.js (frontend)
- Data: JSON (dye spectra), CSV/JSON (filters)

## Getting Started

1. **Install dependencies:**
   ```sh
   npm install
   ```
2. **Start the app:**
   ```sh
   npm start
   ```
3. **Add your dye spectra:**
   - Place your dye spectra JSON files in a `dye_spectra_data` folder in the project root, or configure the frontend to fetch from your backend/static server.

## Directory Structure
```
fluoro_spectra_viewer/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   ├── utils/
│   ├── App.jsx
│   ├── index.js
│   └── styles.css
├── dye_spectra_data/   # <- your dye spectra JSONs
├── package.json
└── README.md
```

## Next Steps
- Connect to real dye spectra JSONs
- Implement filter upload/definition
- Add crosstalk calculation and heatmap/table
- Polish UI and export features

---

*For questions or feature requests, open an issue or contact the developer.*
