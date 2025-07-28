// Crosstalk calculation utilities
// Integrate I_emission(lambda) * T_filter(lambda) over lambda

// Interpolate value at wl from a profile [[wavelength, value], ...]
function interpolateProfile(profile, wl) {
  if (!profile || profile.length === 0) return 1;
  const sorted = [...profile].sort((a, b) => a[0] - b[0]);
  for (let j = 0; j < sorted.length - 1; ++j) {
    const [w0, v0] = sorted[j];
    const [w1, v1] = sorted[j + 1];
    if (wl >= w0 && wl <= w1) {
      return v0 + (v1 - v0) * (wl - w0) / (w1 - w0);
    }
  }
  if (wl < sorted[0][0]) return sorted[0][1];
  if (wl > sorted[sorted.length - 1][0]) return sorted[sorted.length - 1][1];
  return 1;
}

export function integrateSignal(emission, filterProfile, qeProfile) {
  // emission: [[wavelength, intensity], ...]
  // filterProfile: [[wavelength, percent], ...]
  // Returns: sum of intensity * (percent/100) at interpolated filter transmission
  if (!emission || !filterProfile) return 0;
  let total = 0;
  let n = 0;
  // Sort filterProfile by wavelength just in case
  const sortedFilter = [...filterProfile].sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < emission.length; ++i) {
    const [wl, inten] = emission[i];
    // Linear interpolation for filter transmission at wl
    let fval = interpolateProfile(sortedFilter, wl);
    // QE profile interpolation (optional)
    let qeVal = qeProfile ? interpolateProfile(qeProfile, wl) : 100;
    total += inten * (fval / 100) * (qeVal / 100);
    n++;
  }
  // Debug: log if no overlap
  if (n === 0) {
    console.warn('No overlap in emission/filter wavelengths', {emission, filterProfile});
  }
  return total;
}

export function computeCrosstalkMatrix(dyes, filters, spectra, normalize = false, quantumYields = {}, qeProfile = null) {
  if (!dyes || !dyes.length || !filters || !filters.length || !spectra) return [];

  // dyes: [{id, name}], filters: [{name, profile}], spectra: {dyeId: {emission: ...}}
  // normalize: bool, quantumYields: {dyeId: value}
  return dyes.map(dye =>
    filters.map(filter => {
      const dyeSpec = spectra[dye.id];
      if (typeof window !== 'undefined') {
        console.log(`spectra[${dye.id}] structure:`, dyeSpec);
      }
      // Prefer direct .emission array if present
      let emission = Array.isArray(dyeSpec?.emission) ? dyeSpec.emission : undefined;
      // Fallback to nested path if not
      if (!emission) {
        emission = dyeSpec?.data?.[dye.id]?.emission?.[""] || [];
      }
      const filterProf = filter.profile;
      const result = integrateSignal(emission, filterProf, qeProfile);
      if (typeof window !== 'undefined') {
        console.log(`Crosstalk for dye ${dye.id} (${dye.name}) and filter ${filter.name}:`, {
          emission,
          filterProfile: filterProf,
          result
        });
      }
      return result;
    })
  );
}
