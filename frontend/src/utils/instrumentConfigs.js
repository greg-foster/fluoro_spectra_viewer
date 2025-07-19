// Utility functions for syncing instrument configs with backend

export async function fetchInstrumentConfigs() {
  const resp = await fetch(`${process.env.REACT_APP_API_BASE_URL || ""}/api/instrument_configs`);
  if (!resp.ok) throw new Error('Failed to fetch instrument configs');
  return await resp.json();
}

export async function saveInstrumentConfig(config) {
  const resp = await fetch(`${process.env.REACT_APP_API_BASE_URL || ""}/api/instrument_configs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });
  if (!resp.ok) throw new Error('Failed to save instrument config');
  return await resp.json();
}
