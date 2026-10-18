let data;
const $ = selector => document.querySelector(selector);
const row = values => { const tr = document.createElement('tr'); for (const value of values) { const td = document.createElement('td'); td.textContent = value; tr.append(td); } return tr; };
$('#results-form').addEventListener('submit', async event => {
  event.preventDefault(); $('#results-status').textContent = 'Loading…'; $('#results').hidden = true;
  try {
    const response = await fetch('/api/results', { headers: { Authorization: `Bearer ${$('#key').value.trim()}` } });
    const result = await response.json(); if (!response.ok) throw new Error(result.error); data = result;
    $('#results-status').textContent = `${data.totalBallots} saved ${data.totalBallots === 1 ? 'vote' : 'votes'}. Ties are ordered by first-place votes, then filename.`;
    $('#scores').replaceChildren(...data.scores.map(score => row([`Frame ${String(score.frame).padStart(2, '0')}`, score.filename, score.points, score.firstPlaceVotes, score.rankedVotes])));
    $('#ballots').replaceChildren(...data.ballots.map(ballot => row([ballot.name, ballot.ranking.map((id, index) => `${index + 1}. ${id}`).join(' → '), new Date(ballot.updatedAt).toLocaleString()])));
    $('#results').hidden = false;
  } catch (error) { $('#results-status').textContent = error.message || 'Could not load results.'; }
});
$('#export').addEventListener('click', () => { if (!data) return; const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = 'glasses-vote-results.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); });
