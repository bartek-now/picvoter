export function sortPairs(pairs) {
  return [...pairs].sort((a, b) => a.photos[0].localeCompare(b.photos[0], 'en', { numeric: true }));
}

export function photoCrop(pair, view) {
  return pair.photoCrops?.[view] ?? (view === 0 ? pair.mirrorCrop : null);
}

export function photoLabel(pair, view) {
  return pair.photoLabels?.[view] || (view === 0 ? 'Mirror close-up' : 'Selfie');
}
