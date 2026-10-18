const $ = (selector) => document.querySelector(selector);
const ordinal = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th')}`;
let pairs = [], photoViews = [], ranking = [], busy = false, currentPhoto = 0, saved = false;
const storageKey = 'glasses-ballot-v1';
let ballotId = crypto.randomUUID();
let revision = 0;
const status = (message, kind = '') => { $('#status').textContent = message; $('#status').className = kind; };
function remember() {
  try { localStorage.setItem(storageKey, JSON.stringify({ ballotId, ranking, name: $('#name').value, saved })); } catch { /* Voting also works without browser storage. */ }
}
function changed() { revision++; saved = false; status(''); remember(); }
function render() {
  $('#pick-count').textContent = `${ranking.length} / ${pairs.length}`;
  $('#empty-ranking').hidden = ranking.length > 0;
  $('#clear').hidden = !ranking.length;
  $('#submit').disabled = busy || !ranking.length;
  $('#submit').textContent = busy ? 'Saving your picks…' : saved ? 'Picks saved ✓' : 'Send my picks ↗';
  for (const [index, pair] of pairs.entries()) {
    const card = document.getElementById(`frame-${index}`);
    const rank = ranking.indexOf(pair.id);
    card.classList.toggle('selected', rank >= 0);
    const button = card.querySelector('.pick-button');
    button.textContent = rank >= 0 ? `${ordinal(rank + 1)} pick ✓` : `Pick ${ordinal(ranking.length + 1)} +`;
    button.setAttribute('aria-pressed', String(rank >= 0));
    button.setAttribute('aria-label', rank >= 0 ? `Remove Frame ${index + 1}, your ${ordinal(rank + 1)} pick` : `Choose Frame ${index + 1} as your ${ordinal(ranking.length + 1)} pick`);
  }
  $('#ranking').replaceChildren(...ranking.map((id, index) => {
    const frame = pairs.findIndex(pair => pair.id === id);
    const li = document.createElement('li');
    li.className = 'rank-row';
    li.innerHTML = `<span class="rank-number">${ordinal(index + 1)}</span><img src="/photos/${pairs[frame].photos[1]}" alt=""><span class="rank-label">Frame ${String(frame + 1).padStart(2, '0')}</span><div class="rank-controls"><button type="button" data-action="up" aria-label="Move Frame ${frame + 1} up">↑</button><button type="button" data-action="down" aria-label="Move Frame ${frame + 1} down">↓</button><button type="button" data-action="remove" aria-label="Remove Frame ${frame + 1}">×</button></div>`;
    li.querySelector('[data-action="up"]').disabled = index === 0;
    li.querySelector('[data-action="down"]').disabled = index === ranking.length - 1;
    li.addEventListener('click', event => {
      const action = event.target.closest('button')?.dataset.action;
      if (!action) return;
      let focusIndex = index;
      if (action === 'remove') { ranking.splice(index, 1); focusIndex = Math.min(index, ranking.length - 1); }
      else { focusIndex = index + (action === 'up' ? -1 : 1); [ranking[index], ranking[focusIndex]] = [ranking[focusIndex], ranking[index]]; }
      changed(); render();
      const nextRow = $('#ranking').children[focusIndex];
      if (nextRow) (nextRow.querySelector(`[data-action="${action}"]:not(:disabled)`) || nextRow.querySelector('[data-action="remove"]')).focus();
      else document.querySelector('.pick-button').focus();
    });
    return li;
  }));
}
function applyCrop(img, crop) {
  const { x = 0, y = 0, size = 1 } = crop || {};
  img.style.width = `${100 / size}%`;
  img.style.left = `${-100 * x / size}%`;
  img.style.top = `${-100 * y / size}%`;
}
const hoverPreview = document.createElement('div');
hoverPreview.className = 'hover-preview';
hoverPreview.hidden = true;
hoverPreview.setAttribute('aria-hidden', 'true');
hoverPreview.innerHTML = '<div class="hover-photo-view"><img alt=""></div><p></p>';
document.body.append(hoverPreview);
let previewTimer;
function hidePreview() {
  clearTimeout(previewTimer);
  hoverPreview.hidden = true;
}
function showPreview(button, index) {
  if ($('#photo-dialog').open) return;
  const { frame, file, label, crop } = photoViews[index];
  const image = hoverPreview.querySelector('img');
  image.src = `/photos/${file}`;
  applyCrop(image, crop);
  hoverPreview.querySelector('p').textContent = `Frame ${String(frame + 1).padStart(2, '0')} · ${label}`;
  const width = Math.min(360, window.innerWidth - 32, (window.innerHeight - 80) * 3 / 4);
  hoverPreview.style.width = `${width}px`;
  hoverPreview.hidden = false;
  const rect = button.getBoundingClientRect();
  const height = hoverPreview.getBoundingClientRect().height;
  const right = rect.right + 16;
  const left = right + width <= window.innerWidth - 16 ? right : rect.left - width - 16;
  hoverPreview.style.left = `${Math.max(16, Math.min(left, window.innerWidth - width - 16))}px`;
  hoverPreview.style.top = `${Math.max(16, Math.min(rect.top + (rect.height - height) / 2, window.innerHeight - height - 16))}px`;
}
function attachPreview(button, index) {
  button.addEventListener('pointerenter', event => {
    if (event.pointerType !== 'mouse' || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    hidePreview();
    previewTimer = setTimeout(() => showPreview(button, index), 140);
  });
  button.addEventListener('pointerleave', hidePreview);
  button.addEventListener('focus', () => { if (button.matches(':focus-visible')) showPreview(button, index); });
  button.addEventListener('blur', hidePreview);
}
window.addEventListener('scroll', hidePreview, { capture: true, passive: true });
window.addEventListener('resize', hidePreview);
document.addEventListener('keydown', event => { if (event.key === 'Escape') hidePreview(); });
function showPhoto(index) {
  hidePreview();
  currentPhoto = (index + photoViews.length) % photoViews.length;
  const { frame, file, label, crop } = photoViews[currentPhoto];
  $('#large-photo').src = `/photos/${file}`;
  $('#large-photo').alt = `Frame ${frame + 1}, ${label}`;
  applyCrop($('#large-photo'), crop);
  $('#photo-caption').textContent = `Frame ${String(frame + 1).padStart(2, '0')} · ${label}`;
  if (!$('#photo-dialog').open) $('#photo-dialog').showModal();
}
$('#close-photo').addEventListener('click', () => $('#photo-dialog').close());
$('#photo-dialog').addEventListener('click', event => { if (event.target === $('#photo-dialog')) { const r = event.target.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) event.target.close(); } });
$('#previous-photo').addEventListener('click', () => showPhoto(currentPhoto - 1));
$('#next-photo').addEventListener('click', () => showPhoto(currentPhoto + 1));
$('#photo-dialog').addEventListener('keydown', event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); showPhoto(currentPhoto + (event.key === 'ArrowLeft' ? -1 : 1)); } });
$('#clear').addEventListener('click', () => { ranking = []; changed(); render(); document.querySelector('.pick-button').focus(); });
$('#name').addEventListener('input', () => { $('#name').removeAttribute('aria-invalid'); changed(); render(); });
$('#vote-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (busy || !ranking.length) return;
  const name = $('#name').value.trim();
  if (!name) { status('Please enter your name.', 'error'); $('#name').focus(); return; }
  busy = true; render(); status('');
  const sentRevision = revision;
  try {
    const response = await fetch('/api/votes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ballotId, name, ranking: [...ranking] }) });
    const result = await response.json();
    if (result.code === 'NAME_TAKEN') { $('#name').setAttribute('aria-invalid', 'true'); $('#name').focus(); }
    if (!response.ok) throw new Error(result.error || 'Could not save your vote. Please try again.');
    saved = revision === sentRevision; remember();
    status(saved ? `Thanks, ${name}! Your picks are saved. You can change them and send again to update your vote.` : 'Your vote was saved. Send again to save your latest changes.', 'success');
  } catch (error) { status(error.message || 'Could not connect. Your picks are still here; please try again.', 'error'); }
  finally { busy = false; render(); }
});
async function init() {
  try {
    const response = await fetch('/pairs.json');
    if (!response.ok) throw new Error('Could not load the photos. Refresh to try again.');
    pairs = await response.json();
    photoViews = pairs.flatMap((pair, frame) => [
      ...pair.photos.map((file, view) => ({ frame, file, label: view ? 'Selfie' : 'Mirror close-up', crop: view ? null : pair.mirrorCrop })),
      ...(pair.extraPhotos || []).map(photo => ({ frame, file: photo.file, label: photo.label, crop: null })),
    ]);
    $('#options-count').textContent = `${pairs.length} frames · paired views`;
    try {
      const draft = JSON.parse(localStorage.getItem(storageKey));
      if (draft && /^[0-9a-f-]{36}$/i.test(draft.ballotId)) {
        ballotId = draft.ballotId;
        ranking = [...new Set(Array.isArray(draft.ranking) ? draft.ranking : [])].filter(id => pairs.some(pair => pair.id === id));
        $('#name').value = typeof draft.name === 'string' ? draft.name.slice(0, 80) : '';
      }
    } catch { /* A bad draft must never prevent voting. */ }
    $('#gallery').replaceChildren(...pairs.map((pair, index) => {
      const card = document.createElement('article'); card.className = 'frame-card'; card.id = `frame-${index}`;
      card.innerHTML = `<div class="photos">${pair.photos.map((photo, view) => `<button type="button" class="photo" aria-label="Enlarge Frame ${index + 1}, ${view ? 'selfie' : 'mirror close-up'}"><img src="/photos/${photo}" alt="Person wearing Frame ${index + 1}, ${view ? 'selfie' : 'mirror close-up'}" width="1050" height="1400" ${index > 1 ? 'loading="lazy"' : 'fetchpriority="high"'}><span>${view ? 'Selfie' : 'Mirror close-up'} ↗</span></button>`).join('')}</div><div class="card-info"><span class="frame-name"><span>${String(index + 1).padStart(2, '0')}</span> Frame ${String(index + 1).padStart(2, '0')}</span><button type="button" class="pick-button"></button></div>`;
      card.querySelectorAll('.photo').forEach((button, view) => {
        applyCrop(button.querySelector('img'), view ? null : pair.mirrorCrop);
        const photoIndex = photoViews.findIndex(photo => photo.frame === index && photo.file === pair.photos[view]);
        attachPreview(button, photoIndex);
        button.addEventListener('click', () => showPhoto(photoIndex));
      });
      for (const photo of pair.extraPhotos || []) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'extra-photo'; button.textContent = `${photo.label} ↗`;
        button.addEventListener('click', () => showPhoto(photoViews.findIndex(view => view.frame === index && view.file === photo.file)));
        card.append(button);
      }
      card.querySelector('.pick-button').addEventListener('click', () => { ranking = ranking.includes(pair.id) ? ranking.filter(id => id !== pair.id) : [...ranking, pair.id]; changed(); render(); });
      return card;
    }));
    render();
  } catch (error) { $('#gallery').textContent = error.message; }
  finally { $('#gallery').setAttribute('aria-busy', 'false'); }
}
init();
