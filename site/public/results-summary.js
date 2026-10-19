import { summarize } from './scoring.js';

// Match the database's case-insensitive name uniqueness without exposing ballot IDs.
export const voterKey = name => name.trim().replace(/[A-Z]/g, letter => letter.toLowerCase());

export function summarizeResults(ballots, pairs, scoringMode = 'zero', ignoredVoters = []) {
  const ignored = new Set([...ignoredVoters].map(voterKey));
  const counted = ballots.filter(ballot => !ignored.has(voterKey(ballot.name)));
  const summary = summarize(counted, pairs, scoringMode);
  return {
    ...summary,
    totalBallots: ballots.length,
    countedBallots: counted.length,
    ignoredBallots: ballots.length - counted.length,
    ignoredVoters: ballots.filter(ballot => ignored.has(voterKey(ballot.name))).map(ballot => ballot.name),
    ballots: ballots.map(({ name, ranking, updatedAt }) => ({
      name,
      ranking: typeof ranking === 'string' ? JSON.parse(ranking) : ranking,
      updatedAt,
      ignored: ignored.has(voterKey(name)),
    })),
  };
}
