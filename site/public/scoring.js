import { sortPairs } from './pair-utils.js';

export function summarize(ballots, pairs, scoringMode = 'zero') {
  if (!['zero', 'average'].includes(scoringMode)) throw new Error('Invalid scoring mode.');
  const rows = sortPairs(pairs).map((pair, index) => ({ filename: pair.id, frame: index + 1, points: 0, firstPlaceVotes: 0, rankedVotes: 0, ranks: Array(pairs.length).fill(0) }));
  for (const ballot of ballots) {
    const ranking = typeof ballot.ranking === 'string' ? JSON.parse(ballot.ranking) : ballot.ranking;
    const unranked = new Set(rows);
    let unusedPoints = pairs.length * (pairs.length + 1) / 2;
    ranking.forEach((id, index) => {
      const row = rows.find(item => item.filename === id);
      if (!row) return;
      const points = pairs.length - index;
      row.points += points; row.rankedVotes++; row.ranks[index]++;
      if (index === 0) row.firstPlaceVotes++;
      unusedPoints -= points;
      unranked.delete(row);
    });
    if (scoringMode === 'average' && unranked.size) {
      const average = unusedPoints / unranked.size;
      for (const row of unranked) row.points += average;
    }
  }
  rows.sort((a, b) => b.points - a.points || b.firstPlaceVotes - a.firstPlaceVotes || a.filename.localeCompare(b.filename));
  return { scoringMode, totalBallots: ballots.length, scores: rows, ballots: ballots.map(({ name, ranking, updatedAt }) => ({ name, ranking: typeof ranking === 'string' ? JSON.parse(ranking) : ranking, updatedAt })) };
}
