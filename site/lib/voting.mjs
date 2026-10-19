export { summarize } from '../public/scoring.js';

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
