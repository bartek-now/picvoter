import { sortPairs, photoCrop, photoLabel } from './pair-utils.js';
import { createPhotoLoader } from './photo-loader.js';
let data, loadedKey = '', busy = false;
let pairsById = new Map();
const $ = selector => document.querySelector(selector);
const keyStorage = 'glasses-results-key-v1';
function savedResultsKey() {
  try { return sessionStorage.getItem(keyStorage) || ''; } catch { return ''; }
}
function rememberResultsKey(key) {
  try { sessionStorage.setItem(keyStorage, key); } catch { /* Manual loading still works if storage is blocked. */ }
}
function clearSavedResultsKey() {
  try { sessionStorage.removeItem(keyStorage); } catch { /* No saved key when storage is blocked. */ }
}
const pairPreview = document.createElement('div');
pairPreview.className = 'hover-preview results-hover-preview';
pairPreview.hidden = true;
pairPreview.setAttribute('aria-hidden', 'true');
pairPreview.innerHTML = '<div class="results-hover-photos"></div><p></p>';
document.body.append(pairPreview);
const previewLoaders = [createPhotoLoader(), createPhotoLoader()];
let previewTimer, previewVersion = 0;
function hidePairPreview() {
  clearTimeout(previewTimer); previewVersion++;
  previewLoaders.forEach(loader => loader.cancel());
  pairPreview.hidden = true;
}
function applyPhotoCrop(image, pair, view) {
  const { x = 0, y = 0, size = 1 } = photoCrop(pair, view) || {};
  image.style.width = `${100 / size}%`; image.style.left = `${-100 * x / size}%`; image.style.top = `${-100 * y / size}%`;
}
async function showPairPreview(source, pair) {
  const version = ++previewVersion;
  const images = [];
  const ready = await Promise.all(pair.photos.map((file, view) => previewLoaders[view].load({
    src: `/photos/${file}`,
    prepare(image) { image.alt = ''; applyPhotoCrop(image, pair, view); },
    onReady(image) { images[view] = image; },
  })));
  if (version !== previewVersion || !ready.every(Boolean)) return;
  pairPreview.querySelector('.results-hover-photos').replaceChildren(...images.map(image => {
    const pane = document.createElement('div'); pane.className = 'hover-photo-view'; pane.append(image); return pane;
  }));
  pairPreview.querySelector('p').textContent = `${pair.frameLabel} · photo pair`;
  const width = Math.min(620, window.innerWidth - 32, (window.innerHeight - 80) * 1.5);
  pairPreview.style.width = `${width}px`;
  pairPreview.hidden = false;
  const rect = source.getBoundingClientRect(), height = pairPreview.getBoundingClientRect().height;
  const right = rect.right + 16;
  const left = right + width <= window.innerWidth - 16 ? right : rect.left - width - 16;
  pairPreview.style.left = `${Math.max(16, Math.min(left, window.innerWidth - width - 16))}px`;
  pairPreview.style.top = `${Math.max(16, Math.min(rect.top + (rect.height - height) / 2, window.innerHeight - height - 16))}px`;
}
window.addEventListener('scroll', hidePairPreview, { capture: true, passive: true });
window.addEventListener('resize', hidePairPreview);
document.addEventListener('keydown', event => { if (event.key === 'Escape') hidePairPreview(); });
const row = values => {
  const tr = document.createElement('tr');
  for (const value of values) { const td = document.createElement('td'); td.textContent = value; tr.append(td); }
  return tr;
};
function setBusy(value) {
  busy = value;
  document.querySelectorAll('#results button, #results-form button').forEach(button => { button.disabled = value; });
}
function pairThumbnail(pair, compact = false) {
  const preview = document.createElement('div');
  preview.className = `results-pair${compact ? ' compact' : ''}`;
  preview.tabIndex = 0;
  preview.setAttribute('aria-label', `Preview ${pair.frameLabel} photo pair`);
  preview.addEventListener('pointerenter', event => {
    if (event.pointerType !== 'mouse' || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    hidePairPreview(); previewTimer = setTimeout(() => showPairPreview(preview, pair), 140);
  });
  preview.addEventListener('pointerleave', hidePairPreview);
  preview.addEventListener('focus', () => { if (preview.matches(':focus-visible')) { hidePairPreview(); showPairPreview(preview, pair); } });
  preview.addEventListener('blur', hidePairPreview);
  pair.photos.forEach((file, view) => {
    const photo = document.createElement('span'); photo.className = 'results-photo';
    const image = document.createElement('img');
    image.src = `/photos/${file}`; image.alt = `${pair.frameLabel}, ${photoLabel(pair, view)}`;
    image.loading = 'lazy'; image.decoding = 'async'; image.width = compact ? 40 : 76; image.height = compact ? 54 : 102;
    applyPhotoCrop(image, pair, view);
    photo.append(image); preview.append(photo);
  });
  return preview;
}
function renderResults() {
  hidePairPreview();
  $('#scores').replaceChildren(...data.scores.map(score => {
    const tr = row([`Frame ${String(score.frame).padStart(2, '0')}`, score.filename, score.points, score.firstPlaceVotes, score.rankedVotes]);
    const photos = document.createElement('td');
    const pair = pairsById.get(score.filename);
    if (pair) photos.append(pairThumbnail(pair));
    tr.insertBefore(photos, tr.children[1]);
    return tr;
  }));
  $('#ballots').replaceChildren(...data.ballots.map(ballot => {
    const tr = row([ballot.name, '', new Date(ballot.updatedAt).toLocaleString()]);
    const ranking = document.createElement('ol'); ranking.className = 'results-ranking';
    ballot.ranking.forEach((id, index) => {
      const choice = document.createElement('li');
      const pair = pairsById.get(id);
      if (pair) choice.append(pairThumbnail(pair, true));
      const label = document.createElement('span'); label.textContent = `${index + 1}. ${pair?.frameLabel || id}`;
      label.title = id; choice.append(label); ranking.append(choice);
    });
    tr.children[1].append(ranking);
    const actions = document.createElement('td');
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'delete-vote'; button.textContent = 'Delete vote';
    button.setAttribute('aria-label', `Delete vote from ${ballot.name}`);
    button.addEventListener('click', () => deleteVote(ballot));
    actions.append(button); tr.append(actions);
    return tr;
  }));
  $('#results').hidden = false;
}
async function loadResults(key, notice = '') {
  const response = await fetch('/api/results', { headers: { Authorization: `Bearer ${key}` }, cache: 'no-store' });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401) clearSavedResultsKey();
    throw new Error(result.error || 'Could not load results.');
  }
  const pairsResponse = await fetch('/pairs.json', { cache: 'no-store' });
  if (!pairsResponse.ok) throw new Error('Could not load photo previews. Please try again.');
  const pairs = sortPairs(await pairsResponse.json());
  pairsById = new Map(pairs.map((pair, index) => [pair.id, { ...pair, frameLabel: `Frame ${String(index + 1).padStart(2, '0')}` }]));
  data = result; loadedKey = key;
  rememberResultsKey(key);
  renderResults();
  $('#results-status').textContent = `${notice}${notice ? ' ' : ''}${data.totalBallots} saved ${data.totalBallots === 1 ? 'vote' : 'votes'}. Ties are ordered by first-place votes, then filename.`;
}
async function deleteVote(ballot) {
  if (busy || !window.confirm(`Delete the vote from ${ballot.name}? This cannot be undone.`)) return;
  setBusy(true);
  $('#results-status').textContent = `Deleting vote from ${ballot.name}…`;
  let deleted = false;
  try {
    const response = await fetch('/api/results', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${loadedKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: ballot.name, updatedAt: ballot.updatedAt }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not delete the vote.');
    deleted = true; data = undefined; $('#results').hidden = true;
    await loadResults(loadedKey, `Deleted vote from ${ballot.name}.`);
  } catch (error) {
    $('#results-status').textContent = deleted ? 'Vote deleted, but results could not refresh. Load results again.' : error.message || 'Could not delete the vote.';
  } finally { setBusy(false); }
}
async function refreshResults() {
  if (busy) return;
  setBusy(true); data = undefined; $('#results').hidden = true; $('#results-status').textContent = 'Loading…';
  try { await loadResults($('#key').value.trim()); }
  catch (error) { $('#results-status').textContent = error.message || 'Could not load results.'; }
  finally { setBusy(false); }
}
$('#results-form').addEventListener('submit', event => {
  event.preventDefault();
  refreshResults();
});
$('#forget-key').addEventListener('click', () => {
  if (busy) return;
  clearSavedResultsKey(); hidePairPreview();
  loadedKey = ''; data = undefined; $('#key').value = ''; $('#results').hidden = true;
  $('#results-status').textContent = 'Key cleared from this tab.';
  $('#key').focus();
});
$('#export').addEventListener('click', () => {
  if (!data || busy) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'glasses-vote-results.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
const rememberedKey = savedResultsKey();
if (rememberedKey) {
  $('#key').value = rememberedKey;
  refreshResults();
}
