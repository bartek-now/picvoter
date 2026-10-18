export function validateBallot(value, pairs) {
  if (!value || typeof value !== 'object') throw new Error('Invalid vote.');
  const { ballotId, name, ranking } = value;
  if (typeof ballotId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ballotId)) throw new Error('Invalid ballot ID. Refresh the page and try again.');
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 80 || /[\u0000-\u001f\u007f]/.test(name)) throw new Error('Please enter a name between 1 and 80 characters.');
  if (!Array.isArray(ranking) || ranking.length < 1 || ranking.length > pairs.length || new Set(ranking).size !== ranking.length || ranking.some(id => !pairs.some(pair => pair.id === id))) throw new Error('Choose each frame at most once, and choose at least one.');
  return { id: ballotId, name: name.trim().replace(/\s+/g, ' '), ranking: JSON.stringify(ranking), updatedAt: new Date().toISOString() };
}
export function isNameConflict(error) {
  for (let depth = 0; error && depth < 8; depth++, error = error.cause) {
    if (/unique constraint failed/i.test(String(error.message)) && /ballots_name_unique/i.test(String(error.message))) return true;
  }
  return false;
}
export function summarize(ballots, pairs) {
  const rows = pairs.map((pair, index) => ({ filename: pair.id, frame: index + 1, points: 0, firstPlaceVotes: 0, rankedVotes: 0, ranks: Array(pairs.length).fill(0) }));
  for (const ballot of ballots) {
    const ranking = typeof ballot.ranking === 'string' ? JSON.parse(ballot.ranking) : ballot.ranking;
    ranking.forEach((id, index) => {
      const row = rows.find(item => item.filename === id);
      if (!row) return;
      row.points += pairs.length - index; row.rankedVotes++; row.ranks[index]++;
      if (index === 0) row.firstPlaceVotes++;
    });
  }
  rows.sort((a, b) => b.points - a.points || b.firstPlaceVotes - a.firstPlaceVotes || a.filename.localeCompare(b.filename));
  return { totalBallots: ballots.length, scores: rows, ballots: ballots.map(({ name, ranking, updatedAt }) => ({ name, ranking: typeof ranking === 'string' ? JSON.parse(ranking) : ranking, updatedAt })) };
}
