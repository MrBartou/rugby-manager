/**
 * Joue un match et imprime les phases en clair.
 *
 * Usage avec clubs réels (data/players.csv) :
 *   npm run play                       # seed aléatoire, Toulouse vs UBB par défaut
 *   npm run play -- 42 toulouse ubb    # match précis, déterministe
 *   npm run play -- 42 toulouse usap -v
 *   npm run play -- list               # liste les clubs disponibles
 *
 * Usage générique (équipes synthétiques par niveau) :
 *   npm run play -- 42 -n 75 50        # seed=42, niveau home=75, away=50
 *   npm run play -- 42 -n 60 60 -v
 *
 * Sans -v, on n'affiche que les "moments forts".
 */

import { simulateMatch } from '../src/engine/match/simulate.js';
import { makeMatchInput } from '../tests/engine/fixtures.js';
import { listClubs, makeMatchInputFromSeed } from './seed-loader.js';
import type { PhaseRecord } from '../src/engine/match/types.js';
import type { Club } from '../src/engine/types.js';

// =============================================================================
// Parse CLI args
// =============================================================================

const args = process.argv.slice(2);
const verbose = args.includes('-v') || args.includes('--verbose');
const useNiveau = args.includes('-n');
const positional = args.filter(a => !a.startsWith('-'));

if (positional[0] === 'list') {
  console.log('\nClubs disponibles dans data/players.csv :\n');
  for (const c of listClubs()) {
    console.log(`  ${c.id.padEnd(12)} ${c.name}  (${c.tier}, niv. réputation ${c.reputation})`);
  }
  console.log('');
  process.exit(0);
}

const seed = positional[0] ?? String(Math.floor(Math.random() * 1_000_000));

let homeArg = positional[1];
let awayArg = positional[2];
if (!homeArg) homeArg = 'toulouse';
if (!awayArg) awayArg = 'ubb';

// =============================================================================
// Helpers d'affichage
// =============================================================================

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const MAGENTA = '\x1b[35m';

function color(s: string, c: string): string {
  return process.stdout.isTTY ? `${c}${s}${RESET}` : s;
}

function fmtMinute(min: number): string {
  return `${String(min).padStart(2, '0')}'`;
}

function fmtScore(home: number, away: number): string {
  return color(`${home.toString().padStart(2)}-${away.toString().padEnd(2)}`, BOLD);
}

function fmtField(pos: number, attacker: 'HOME' | 'AWAY' | 'CONTESTED'): string {
  // pos est dans le référentiel de l'attaquant (-50 = en-but propre, +50 = essai)
  // On mappe en référentiel HOME pour la lisibilité.
  const homePerspective = attacker === 'HOME' ? pos : attacker === 'AWAY' ? -pos : 0;
  // -50 = en-but HOME, +50 = en-but AWAY
  const tag = homePerspective > 35 ? 'AWAY 22' :
              homePerspective > 0  ? 'AWAY ½'  :
              homePerspective > -35? 'HOME ½'  :
                                      'HOME 22';
  return color(tag.padEnd(7), DIM);
}

function isHighlight(phase: PhaseRecord): boolean {
  if (phase.outcome.tryScored) return true;
  if (phase.outcome.pointsScored) return true;
  if (phase.outcome.penaltyAwarded) return true;
  if (phase.type === 'TRY') return true;
  if (phase.type === 'CONVERSION') return true;
  return false;
}

function summaryColor(phase: PhaseRecord): string {
  if (phase.outcome.tryScored) return GREEN + BOLD;
  if (phase.outcome.pointsScored?.type === 'PENALTY') return YELLOW;
  if (phase.outcome.pointsScored?.type === 'CONVERSION') return GREEN;
  if (phase.outcome.summary.includes('manquée')) return RED;
  if (phase.outcome.penaltyAwarded) return YELLOW;
  if (phase.type === 'SCRUM') return MAGENTA;
  if (phase.type === 'LINEOUT') return CYAN;
  return RESET;
}

function printPhase(phase: PhaseRecord): void {
  const min = fmtMinute(phase.state.minute);
  const score = fmtScore(phase.state.homeScore, phase.state.awayScore);
  const field = fmtField(phase.state.fieldPosition, phase.state.possession as 'HOME' | 'AWAY' | 'CONTESTED');
  const owner =
    phase.state.possession === 'HOME' ? color('HOME', BOLD) :
    phase.state.possession === 'AWAY' ? color('AWAY', BOLD) :
    color('????', DIM);
  const type = phase.type.padEnd(10);
  const summary = color(phase.outcome.summary, summaryColor(phase));

  console.log(`  ${min}  ${score}  ${field}  ${owner}  ${color(type, DIM)}  ${summary}`);
}

// =============================================================================
// Préparer le MatchInput (clubs réels OU niveaux synthétiques)
// =============================================================================

let input: ReturnType<typeof makeMatchInput> & { homeClub?: Club; awayClub?: Club };
let homeLabel: string;
let awayLabel: string;

if (useNiveau) {
  // -n : équipes synthétiques par niveau
  const homeNiveau = positional[1] ? Number(positional[1]) : 60;
  const awayNiveau = positional[2] ? Number(positional[2]) : 60;
  if (!Number.isFinite(homeNiveau) || !Number.isFinite(awayNiveau)) {
    console.error('Erreur : avec -n, les niveaux doivent être numériques (0-100)');
    process.exit(1);
  }
  input = makeMatchInput({ homeNiveau, awayNiveau, matchId: `play_${seed}` });
  homeLabel = `HOME (niv. ${homeNiveau})`;
  awayLabel = `AWAY (niv. ${awayNiveau})`;
} else {
  // mode club : utilise data/players.csv
  try {
    const seeded = makeMatchInputFromSeed({
      homeClubId: homeArg,
      awayClubId: awayArg,
      matchId: `play_${seed}`,
    });
    input = seeded;
    homeLabel = seeded.homeClub.name;
    awayLabel = seeded.awayClub.name;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`Erreur : ${msg}`);
    console.error(`Astuce : "npm run play -- list" pour voir les clubs disponibles.`);
    process.exit(1);
  }
}

// =============================================================================
// Run
// =============================================================================

console.log('');
console.log(color(`╭─ Rugby Manager — match de démo ─╮`, BOLD));
console.log(`  seed   : ${color(seed, CYAN)}`);
console.log(`  HOME   : ${color(homeLabel, CYAN)}`);
console.log(`  AWAY   : ${color(awayLabel, CYAN)}`);
console.log(`  mode   : ${verbose ? 'toutes les phases' : 'highlights'}`);
console.log('');

const start = performance.now();
const result = simulateMatch(input, seed);
const ms = (performance.now() - start).toFixed(1);

console.log(color(`╭─ Déroulé du match ─╮`, BOLD));
console.log('');
console.log(color('   min  score  pos.    poss.  type        action', DIM));
console.log(color('  ─────────────────────────────────────────────────────────', DIM));

let printed = 0;
for (const phase of result.phases) {
  if (verbose || isHighlight(phase)) {
    printPhase(phase);
    printed++;
  }
}

if (!verbose) {
  console.log(color(`  …${result.phases.length - printed} autres phases (rucks, mêlées, jeu courant)`, DIM));
}

console.log('');
console.log(color(`╭─ Résultat final ─╮`, BOLD));
console.log(`  ${color(homeLabel, BOLD)}  ${color(String(result.homeScore).padStart(2), BOLD)} — ${color(String(result.awayScore).padStart(2), BOLD)}  ${color(awayLabel, BOLD)}`);
console.log('');

const homeTries = result.phases.filter(p => p.outcome.tryScored === 'HOME').length;
const awayTries = result.phases.filter(p => p.outcome.tryScored === 'AWAY').length;
const placeKickAttempts = result.phases.filter(p =>
  (p.type === 'CONVERSION') ||
  (p.type === 'PENALTY' && (p.outcome.summary.startsWith('pénalité réussie') || p.outcome.summary.startsWith('pénalité manquée')))
).length;
const placeKickMakes = result.phases.filter(p =>
  p.outcome.pointsScored && (p.outcome.pointsScored.type === 'CONVERSION' || p.outcome.pointsScored.type === 'PENALTY')
).length;

console.log(color('  Stats :', DIM));
console.log(`    phases jouées       : ${result.phases.length}`);
console.log(`    essais              : HOME ${homeTries} — AWAY ${awayTries}`);
console.log(`    tirs au but         : ${placeKickMakes}/${placeKickAttempts} (${placeKickAttempts > 0 ? Math.round(placeKickMakes / placeKickAttempts * 100) : 0}%)`);
console.log(`    durée simulation    : ${ms} ms`);
console.log('');
