// Utility to load dye spectra from local JSON files (development mode)
// In production, fetch from backend or static server

export async function fetchDyeList() {
  try {
    const resp = await fetch(`${process.env.REACT_APP_API_BASE_URL || ""}/api/dyes`);
    if (!resp.ok) throw new Error('Failed to fetch dye list');
    return await resp.json();
  } catch (e) {
    return [];
  }
}

function getFirstSpectra(obj) {
  if (!obj) return [];
  if (obj[""]) return obj[""];
  const keys = Object.keys(obj);
  if (keys.length > 0) return obj[keys[0]];
  return [];
}

export async function fetchDyeSpectrum(dyeId) {
  try {
    const resp = await fetch(`${process.env.REACT_APP_API_BASE_URL || ""}/api/dyes/${dyeId}`);
    if (!resp.ok) throw new Error("Not found");
    return await resp.json();
  } catch (e) {
    return null;
  }
}


export async function fetchFilterList() {
  const resp = await fetch(`${process.env.REACT_APP_API_BASE_URL || ""}/api/filters`);
  if (!resp.ok) return [];
  return await resp.json();
}

export async function loadUserSettings() {
  const resp = await fetch(`${process.env.REACT_APP_API_BASE_URL || ""}/api/settings`);
  if (!resp.ok) return {};
  return await resp.json();
}

export async function saveUserSettings(settings) {
  await fetch(`${process.env.REACT_APP_API_BASE_URL || ""}/api/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings)
  });
}
