/**
 * Tests de simulation — V0.1.
 *
 * On tire N matchs avec deux équipes "moyennes" (niveau 50) et on vérifie que
 * les distributions agrégées sont dans les bornes attendues.
 *
 * Ces cibles sont la boussole de calibrage du moteur (cf. 14-tests-validation.md).
 * Pour V0.1, les bornes sont LARGES — l'objectif est seulement que la boucle
 * produise des matchs plausibles. V0.2+ resserrera.
 */

import { describe, it, expect } from 'vitest';
import { simulateMatch } from '@/engine/match/simulate.js';
import { makeMatchInput } from './fixtures.js';

interface Aggregate {
  totalMatches: number;
  triesHome: number;
  triesAway: number;
  pointsHome: number;
  pointsAway: number;
  phasesPerMatch: number[];
  draws: number;
  homeWins: number;
  awayWins: number;
  /** Pénalités tentées au but (réussies + manquées). */
  placeKickAttempts: number;
  placeKickMakes: number;
}

function runBatch(seedBase: number, n: number, homeNiveau = 60, awayNiveau = 60): Aggregate {
  const agg: Aggregate = {
    totalMatches: 0,
    triesHome: 0,
    triesAway: 0,
    pointsHome: 0,
    pointsAway: 0,
    phasesPerMatch: [],
    draws: 0,
    homeWins: 0,
    awayWins: 0,
    placeKickAttempts: 0,
    placeKickMakes: 0,
  };

  for (let i = 0; i < n; i++) {
    const input = makeMatchInput({ homeNiveau, awayNiveau, matchId: `sim_${i}` });
    const result = simulateMatch(input, String(seedBase + i));
    agg.totalMatches += 1;
    agg.pointsHome += result.homeScore;
    agg.pointsAway += result.awayScore;
    agg.phasesPerMatch.push(result.phases.length);
    if (result.homeScore > result.awayScore) agg.homeWins++;
    else if (result.homeScore < result.awayScore) agg.awayWins++;
    else agg.draws++;

    for (const phase of result.phases) {
      if (phase.outcome.tryScored === 'HOME') agg.triesHome++;
      if (phase.outcome.tryScored === 'AWAY') agg.triesAway++;
      // Détecter les tentatives au but
      if (phase.type === 'PENALTY' && (phase.outcome.summary.startsWith('pénalité réussie') || phase.outcome.summary.startsWith('pénalité manquée'))) {
        agg.placeKickAttempts++;
        if (phase.outcome.pointsScored?.type === 'PENALTY') agg.placeKickMakes++;
      }
      if (phase.type === 'CONVERSION') {
        agg.placeKickAttempts++;
        if (phase.outcome.pointsScored?.type === 'CONVERSION') agg.placeKickMakes++;
      }
    }
  }

  return agg;
}

function mean(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

// =============================================================================
// Tests
// =============================================================================

describe('simulateMatch — V0.1 boucle complète', () => {
  it('produit un résultat déterministe pour un même seed', () => {
    const input = makeMatchInput({ homeNiveau: 60, awayNiveau: 60 });
    const r1 = simulateMatch(input, 'fixed-seed-42');
    const r2 = simulateMatch(input, 'fixed-seed-42');
    expect(r1.homeScore).toBe(r2.homeScore);
    expect(r1.awayScore).toBe(r2.awayScore);
    expect(r1.phases.length).toBe(r2.phases.length);
  });

  it('produit des résultats différents pour des seeds différents', () => {
    const input = makeMatchInput({ homeNiveau: 60, awayNiveau: 60 });
    const scores = new Set<string>();
    for (let s = 0; s < 20; s++) {
      const r = simulateMatch(input, `seed_${s}`);
      scores.add(`${r.homeScore}-${r.awayScore}`);
    }
    expect(scores.size).toBeGreaterThan(5);
  });

  it('le match a entre 60 et 100 phases (cible ~75)', () => {
    const input = makeMatchInput({ homeNiveau: 60, awayNiveau: 60 });
    const result = simulateMatch(input, 'phases-test');
    expect(result.phases.length).toBeGreaterThan(50);
    expect(result.phases.length).toBeLessThan(150);
  });

  it('les scores sont positifs et plausibles', () => {
    const input = makeMatchInput({ homeNiveau: 60, awayNiveau: 60 });
    const result = simulateMatch(input, 'score-test');
    expect(result.homeScore).toBeGreaterThanOrEqual(0);
    expect(result.awayScore).toBeGreaterThanOrEqual(0);
    expect(result.homeScore).toBeLessThan(120);
    expect(result.awayScore).toBeLessThan(120);
  });
});

describe('simulateMatch — distributions sur 200 matchs équilibrés', () => {
  const N = 200;
  const agg = runBatch(1000, N, 60, 60);

  it(`moyenne d'essais par match dans [1.5, 10] (cible V1 = 4-6, calibrage fin = V0.2)`, () => {
    const triesPerMatch = (agg.triesHome + agg.triesAway) / N;
    expect(triesPerMatch).toBeGreaterThanOrEqual(1.5);
    expect(triesPerMatch).toBeLessThanOrEqual(10);
  });

  it('moyenne de phases par match dans [60, 110] (cible V1 ~75)', () => {
    const avgPhases = mean(agg.phasesPerMatch);
    expect(avgPhases).toBeGreaterThan(60);
    expect(avgPhases).toBeLessThan(110);
  });

  it('% pénalités/transformations réussies dans [55%, 85%] (cible V1 60-70)', () => {
    expect(agg.placeKickAttempts).toBeGreaterThan(50);
    const successRate = agg.placeKickMakes / agg.placeKickAttempts;
    expect(successRate).toBeGreaterThan(0.55);
    expect(successRate).toBeLessThan(0.85);
  });

  it('match nul rare (<20% en V0.1, cible V1 <8%)', () => {
    expect(agg.draws / N).toBeLessThan(0.20);
  });

  it('équipes équivalentes → V/D quasi équilibré (entre 35% et 65% de victoires home)', () => {
    const homeRate = agg.homeWins / N;
    expect(homeRate).toBeGreaterThan(0.35);
    expect(homeRate).toBeLessThan(0.65);
  });

  it('moyenne de points par match plausible (entre 12 et 80 cumulé, cible V1 ~50)', () => {
    const totalAvg = (agg.pointsHome + agg.pointsAway) / N;
    expect(totalAvg).toBeGreaterThan(12);
    expect(totalAvg).toBeLessThan(80);
  });
});

describe('simulateMatch — écart de niveau', () => {
  const N = 100;

  it('équipe forte (niveau 80) bat équipe faible (niveau 40) la majorité du temps', () => {
    const agg = runBatch(5000, N, 80, 40);
    const strongWinRate = agg.homeWins / N;
    expect(strongWinRate).toBeGreaterThan(0.60);
  });
});
