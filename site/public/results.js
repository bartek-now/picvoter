let data, loadedKey = '', busy = false;
const $ = selector => document.querySelector(selector);
const row = values => {
  const tr = document.createElement('tr');
  for (const value of values) { const td = document.createElement('td'); td.textContent = value; tr.append(td); }
  return tr;
};
function setBusy(value) {
  busy = value;
  document.querySelectorAll('#results button, #results-form button').forEach(button => { button.disabled = value; });
}
function renderResults() {
  $('#scores').replaceChildren(...data.scores.map(score => row([`Frame ${String(score.frame).padStart(2, '0')}`, score.filename, score.points, score.firstPlaceVotes, score.rankedVotes])));
  $('#ballots').replaceChildren(...data.ballots.map(ballot => {
    const tr = row([ballot.name, ballot.ranking.map((id, index) => `${index + 1}. ${id}`).join(' → '), new Date(ballot.updatedAt).toLocaleString()]);
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
  if (!response.ok) throw new Error(result.error || 'Could not load results.');
  data = result; loadedKey = key;
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
$('#results-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (busy) return;
  setBusy(true); data = undefined; $('#results').hidden = true; $('#results-status').textContent = 'Loading…';
  try { await loadResults($('#key').value.trim()); }
  catch (error) { $('#results-status').textContent = error.message || 'Could not load results.'; }
  finally { setBusy(false); }
});
$('#export').addEventListener('click', () => {
  if (!data || busy) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'glasses-vote-results.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
