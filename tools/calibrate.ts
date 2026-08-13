/**
 * Harnais de calibration — lance N matchs et compare les distributions aux cibles V1.
 *
 * Usage :
 *   npm run calibrate              # 8000 matchs par scénario
 *   npm run calibrate -- 1000      # plus rapide, mais voir l'avertissement ci-dessous
 *
 * ## Pourquoi 8000 et non 1000 (V0.51)
 *
 * Le défaut était à 1000 matchs. Or « victoires de l'équipe forte » est un taux
 * autour de 0,78 : à N=1000, son erreur type vaut √(0,78 × 0,22 / 1000) ≈ 1,3
 * point, pour une cible dont la fenêtre haute est à 78 %. La mesure y était donc
 * **incapable de distinguer un vrai effet du bruit** — deux versions identiques
 * du moteur pouvaient afficher 77,6 % et 78,3 %, l'une verte et l'autre rouge.
 *
 * Constaté deux fois : en V0.50 sur le capitaine, puis sur l'élan, où un
 * balayage complet des amplitudes ne déplaçait pas le chiffre alors que la
 * cible passait du vert au rouge. Le contrôle à 8000 matchs a tranché — 76,8 %
 * dans les deux cas, écart-type des essais identique.
 *
 * Le passage à 8000 coûte quelques secondes et rend le portail lisible.
 *
 * Cibles V1 — référence : 14-tests-validation.md, section D.
 *   - 4-6 essais par match (écart-type < 2)
 *   - 60-70% pénalités/transformations réussies
 *   - 70-80 phases par match
 *   - < 8% de matchs nuls
 *   - Possession équipes équivalentes : 45-55 / 45-55
 *   - Écart de niveau (delta 30) : équipe forte gagne 65-75% des matchs
 *
 * On sort un tableau "métrique → valeur → cible → statut" pour deux scénarios :
 *   1. Équilibré (60 vs 60)
 *   2. Écart de niveau (75 vs 45)
 */

import { simulateMatch } from '../src/engine/match/simulate.js';
import { makeMatchInput } from '../tests/engine/fixtures.js';
import {
  CALIBRATION_SCENARIOS,
  CALIBRATION_TARGETS,
  type CalibrationTarget,
} from '../src/engine/match/calibration-targets.js';

// =============================================================================
// CLI
// =============================================================================

const N = Number(process.argv[2] ?? 8000);
if (!Number.isFinite(N) || N < 100) {
  console.error('N doit être un entier ≥ 100');
  process.exit(1);
}

// =============================================================================
// Cibles V1 (cf. 14-tests-validation.md)
// =============================================================================

// V0.61 : les cibles vivent dans le moteur, lues aussi par la suite statistique
// de l'intégration continue. Les recopier ici aurait fait deux sources de
// vérité pour le même contrat.
type Target = CalibrationTarget;
const T = CALIBRATION_TARGETS;

// =============================================================================
// Run scénario
// =============================================================================

interface Stats {
  N: number;
  tries: number[];
  homeWins: number;
  awayWins: number;
  draws: number;
  phases: number[];
  pointsHome: number[];
  pointsAway: number[];
  placeKickAttempts: number;
  placeKickMakes: number;
  homePossessionPhases: number[];
  awayPossessionPhases: number[];
  phasesByType: Record<string, number>;
}

function emptyStats(): Stats {
  return {
    N: 0,
    tries: [],
    homeWins: 0,
    awayWins: 0,
    draws: 0,
    phases: [],
    pointsHome: [],
    pointsAway: [],
    placeKickAttempts: 0,
    placeKickMakes: 0,
    homePossessionPhases: [],
    awayPossessionPhases: [],
    phasesByType: {},
  };
}

function runScenario(homeNiveau: number, awayNiveau: number, n: number, seedBase: number): Stats {
  const s = emptyStats();
  for (let i = 0; i < n; i++) {
    const input = makeMatchInput({
      homeNiveau,
      awayNiveau,
      matchId: `cal_${homeNiveau}_${awayNiveau}_${i}`,
    });
    const r = simulateMatch(input, String(seedBase + i));

    let triesH = 0;
    let triesA = 0;
    let homeP = 0;
    let awayP = 0;

    for (const phase of r.phases) {
      s.phasesByType[phase.type] = (s.phasesByType[phase.type] ?? 0) + 1;
      if (phase.outcome.tryScored === 'HOME') triesH++;
      if (phase.outcome.tryScored === 'AWAY') triesA++;
      if (phase.state.possession === 'HOME') homeP++;
      if (phase.state.possession === 'AWAY') awayP++;

      if (phase.type === 'CONVERSION') {
        s.placeKickAttempts++;
        if (phase.outcome.pointsScored?.type === 'CONVERSION') s.placeKickMakes++;
      }
      if (phase.type === 'PENALTY' &&
          (phase.outcome.summary.startsWith('pénalité réussie') ||
           phase.outcome.summary.startsWith('pénalité manquée'))) {
        s.placeKickAttempts++;
        if (phase.outcome.pointsScored?.type === 'PENALTY') s.placeKickMakes++;
      }
    }

    s.N++;
    s.tries.push(triesH + triesA);
    s.phases.push(r.phases.length);
    s.pointsHome.push(r.homeScore);
    s.pointsAway.push(r.awayScore);
    s.homePossessionPhases.push(homeP);
    s.awayPossessionPhases.push(awayP);

    if (r.homeScore > r.awayScore) s.homeWins++;
    else if (r.homeScore < r.awayScore) s.awayWins++;
    else s.draws++;
  }
  return s;
}

// =============================================================================
// Stats helpers
// =============================================================================

function mean(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  let acc = 0;
  for (const x of xs) acc += x;
  return acc / xs.length;
}

function stddev(xs: readonly number[]): number {
  const m = mean(xs);
  let v = 0;
  for (const x of xs) v += (x - m) ** 2;
  return Math.sqrt(v / xs.length);
}

function sumRatio(a: readonly number[], b: readonly number[]): number {
  let sa = 0;
  let sb = 0;
  for (const x of a) sa += x;
  for (const x of b) sb += x;
  return sa / Math.max(1, sa + sb);
}

// =============================================================================
// Affichage
// =============================================================================

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';

function color(s: string, c: string): string {
  return process.stdout.isTTY ? `${c}${s}${RESET}` : s;
}

function fmtTarget(t: Target): string {
  if (t.min !== undefined && t.max !== undefined) return `[${t.min} — ${t.max}]`;
  if (t.min !== undefined) return `≥ ${t.min}`;
  if (t.max !== undefined) return `≤ ${t.max}`;
  return '—';
}

function statusOf(value: number, t: Target): { ok: boolean; tag: string } {
  const tooLow = t.min !== undefined && value < t.min;
  const tooHigh = t.max !== undefined && value > t.max;
  if (tooLow) return { ok: false, tag: color('✗ TROP BAS', RED) };
  if (tooHigh) return { ok: false, tag: color('✗ TROP HAUT', RED) };
  return { ok: true, tag: color('✓', GREEN) };
}

function printRow(metric: string, value: string, target: string, tag: string): void {
  const M = metric.padEnd(36);
  const V = value.padStart(8);
  const T = target.padEnd(14);
  console.log(`  ${M}  ${V}  ${color(T, DIM)}  ${tag}`);
}

function printScenarioHeader(label: string): void {
  console.log('');
  console.log(color(`╭─ ${label} ─╮`, BOLD));
  console.log(color('  métrique                              valeur   cible           statut', DIM));
  console.log(color('  ─────────────────────────────────────────────────────────────────────────', DIM));
}

function printScenarioFooter(passed: number, total: number): void {
  const allGreen = passed === total;
  const summary = `  ${passed}/${total} cibles atteintes`;
  console.log(color(allGreen ? `${summary}  🎯` : summary, allGreen ? GREEN : YELLOW));
}

// =============================================================================
// Main
// =============================================================================

console.log('');
console.log(color(`Rugby Manager — calibration moteur V0.x`, BOLD));
console.log(color(`Référence cibles : 14-tests-validation.md, section D`, DIM));
console.log(color(`N = ${N} matchs / scénario`, DIM));

// -------------------------------------------------------------------------
// Scénario 1 : équilibré
// -------------------------------------------------------------------------
const t0 = performance.now();
const balanced = runScenario(
  CALIBRATION_SCENARIOS.balanced.home, CALIBRATION_SCENARIOS.balanced.away, N, 100_000,
);
const t1 = performance.now();

printScenarioHeader(
  `Scénario 1 : équilibré (${CALIBRATION_SCENARIOS.balanced.home} vs ${CALIBRATION_SCENARIOS.balanced.away})`,
);

const trM = mean(balanced.tries);
const trSD = stddev(balanced.tries);
const phM = mean(balanced.phases);
const drawR = balanced.draws / N;
const hwR = balanced.homeWins / N;
const possH = sumRatio(balanced.homePossessionPhases, balanced.awayPossessionPhases);
const pkR = balanced.placeKickAttempts > 0 ? balanced.placeKickMakes / balanced.placeKickAttempts : 0;
const totalAvg = (mean(balanced.pointsHome) + mean(balanced.pointsAway));

let pass1 = 0;
const checks1 = [
  ['Essais / match', trM.toFixed(2), T.triesPerMatch],
  ['Écart-type essais', trSD.toFixed(2), T.triesStdDev],
  ['Phases / match', phM.toFixed(1), T.phasesPerMatch],
  ['% tirs au but réussis', (pkR * 100).toFixed(1) + '%', { min: T.placeKickRate.min * 100, max: T.placeKickRate.max * 100 }],
  ['% matchs nuls', (drawR * 100).toFixed(1) + '%', { max: T.drawRate.max * 100 }],
  ['% victoires HOME', (hwR * 100).toFixed(1) + '%', { min: T.homeWinRateBalanced.min * 100, max: T.homeWinRateBalanced.max * 100 }],
  ['% possession HOME', (possH * 100).toFixed(1) + '%', { min: T.possessionBalanced.min * 100, max: T.possessionBalanced.max * 100 }],
  ['Points cumulés / match', totalAvg.toFixed(1), T.totalPointsBalanced],
] as const;

for (const [name, val, target] of checks1) {
  const num = parseFloat(val);
  const st = statusOf(num, target);
  if (st.ok) pass1++;
  printRow(name, val, fmtTarget(target), st.tag);
}
printScenarioFooter(pass1, checks1.length);

// -------------------------------------------------------------------------
// Scénario 2 : écart de niveau
// -------------------------------------------------------------------------
const skewed = runScenario(
  CALIBRATION_SCENARIOS.skewed.home, CALIBRATION_SCENARIOS.skewed.away, N, 200_000,
);
const t2 = performance.now();

printScenarioHeader(
  `Scénario 2 : écart de niveau (${CALIBRATION_SCENARIOS.skewed.home} vs ${CALIBRATION_SCENARIOS.skewed.away})`,
);

const swR = skewed.homeWins / N;
const possHS = sumRatio(skewed.homePossessionPhases, skewed.awayPossessionPhases);
const possLowS = 1 - possHS;

let pass2 = 0;
const checks2 = [
  ['% victoires équipe forte', (swR * 100).toFixed(1) + '%', { min: T.strongWinRateGap.min * 100, max: T.strongWinRateGap.max * 100 }],
  ['% possession équipe faible', (possLowS * 100).toFixed(1) + '%', { min: T.possessionGap.min * 100, max: T.possessionGap.max * 100 }],
  ['Essais HOME / match', mean(skewed.pointsHome).toFixed(1) + ' pts', { min: 25, max: 65 }],
  ['Essais AWAY / match', mean(skewed.pointsAway).toFixed(1) + ' pts', { min: 5, max: 25 }],
] as const;

for (const [name, val, target] of checks2) {
  const num = parseFloat(val);
  const st = statusOf(num, target);
  if (st.ok) pass2++;
  printRow(name, val, fmtTarget(target), st.tag);
}
printScenarioFooter(pass2, checks2.length);

// -------------------------------------------------------------------------
// Bonus : répartition phases
// -------------------------------------------------------------------------
console.log('');
console.log(color(`╭─ Répartition phases (scénario équilibré) ─╮`, BOLD));
const totalPhases = balanced.phases.reduce((a, b) => a + b, 0);
const sortedPhases = Object.entries(balanced.phasesByType).sort(([, a], [, b]) => b - a);
for (const [type, count] of sortedPhases) {
  const pct = (count / totalPhases * 100).toFixed(1);
  console.log(`  ${type.padEnd(12)} ${String(count).padStart(7)}  ${color(`(${pct}%)`, DIM)}`);
}

console.log('');
console.log(color(`Durée : ${((t2 - t0) / 1000).toFixed(2)}s (${((t1 - t0) / N).toFixed(2)}ms / match équilibré)`, DIM));
console.log('');

const totalPassed = pass1 + pass2;
const totalChecks = checks1.length + checks2.length;
if (totalPassed === totalChecks) {
  console.log(color(`✅ Calibration verte sur tous les scénarios (${totalPassed}/${totalChecks})`, GREEN + BOLD));
  process.exit(0);
} else {
  console.log(color(`⚠ ${totalPassed}/${totalChecks} cibles atteintes — itérer sur les coefficients`, YELLOW + BOLD));
  process.exit(1);
}
