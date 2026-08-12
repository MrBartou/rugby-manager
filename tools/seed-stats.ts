/**
 * Stats agrégées sur N matchs entre deux clubs réels (data/players.csv).
 *
 * Usage :
 *   npm run play:stats -- toulouse usap 200
 *   npm run play:stats -- toulouse ubb 500
 */

import { simulateMatch } from '../src/engine/match/simulate.js';
import { makeMatchInputFromSeed, listClubs } from './seed-loader.js';

const args = process.argv.slice(2);
const homeArg = args[0];
const awayArg = args[1];
const N = Number(args[2] ?? 200);

if (!homeArg || !awayArg) {
  console.error('Usage : npm run play:stats -- <home> <away> [N]');
  console.error('Clubs : ' + listClubs().map(c => c.id).join(', '));
  process.exit(1);
}

let homeWins = 0;
let awayWins = 0;
let draws = 0;
let totalHomePts = 0;
let totalAwayPts = 0;
let totalTries = 0;
let totalPhases = 0;

for (let i = 0; i < N; i++) {
  const input = makeMatchInputFromSeed({ homeClubId: homeArg, awayClubId: awayArg, matchId: `s_${i}` });
  const r = simulateMatch(input, String(10_000 + i));
  if (r.homeScore > r.awayScore) homeWins++;
  else if (r.homeScore < r.awayScore) awayWins++;
  else draws++;
  totalHomePts += r.homeScore;
  totalAwayPts += r.awayScore;
  totalPhases += r.phases.length;
  for (const p of r.phases) if (p.outcome.tryScored) totalTries++;
}

const home = listClubs().find(c => c.id === homeArg);
const away = listClubs().find(c => c.id === awayArg);

console.log(`\n${home?.name ?? homeArg}  vs  ${away?.name ?? awayArg}  —  ${N} matchs simulés\n`);
console.log(`  Victoires HOME       : ${(homeWins / N * 100).toFixed(1)}% (${homeWins})`);
console.log(`  Victoires AWAY       : ${(awayWins / N * 100).toFixed(1)}% (${awayWins})`);
console.log(`  Nuls                 : ${(draws / N * 100).toFixed(1)}% (${draws})`);
console.log(`  Score moyen          : ${(totalHomePts / N).toFixed(1)} — ${(totalAwayPts / N).toFixed(1)}`);
console.log(`  Essais / match       : ${(totalTries / N).toFixed(2)}`);
console.log(`  Phases / match       : ${(totalPhases / N).toFixed(1)}`);
console.log('');
