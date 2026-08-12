/**
 * Tests V0.9 phase 3 — objectifs board.
 */

import { describe, it, expect } from 'vitest';
import {
  boardConfidenceLabel,
  checkObjectiveMet,
  computeObjective,
  INITIAL_BOARD_CONFIDENCE,
  updateBoardConfidence,
} from '@/engine/season/board-objective.js';
import type { Club, ClubId } from '@/engine/types.js';

function club(tier: Club['tier']): Club {
  return {
    id: 'c' as ClubId, name: 'Test', shortName: 'TST', city: 'Test',
    tier, tacticalIdentity: 'MIXTE', stadiumCapacity: 20_000,
    annualBudget: 12_000_000, salaryCapUsage: 0, jiffCount: 0, reputation: 60,
  };
}

describe('computeObjective', () => {
  it('GROS_BUDGET + réputation moyenne → TOP_4', () => {
    expect(computeObjective(club('GROS_BUDGET'), 50).kind).toBe('TOP_4');
  });

  it('GROS_BUDGET + réputation haute → CHAMPION', () => {
    expect(computeObjective(club('GROS_BUDGET'), 80).kind).toBe('CHAMPION');
  });

  it('BUDGET_MOYEN par défaut → TOP_10', () => {
    expect(computeObjective(club('BUDGET_MOYEN'), 30).kind).toBe('TOP_10');
  });

  it('PETIT_BUDGET par défaut → MAINTIEN', () => {
    expect(computeObjective(club('PETIT_BUDGET'), 30).kind).toBe('MAINTIEN');
  });
});

describe('checkObjectiveMet', () => {
  it('CHAMPION : OK seulement si champion', () => {
    expect(checkObjectiveMet({
      objective: { kind: 'CHAMPION', targetRank: 1, label: '' },
      playerClubFinalRank: 1, playerClubChampion: true,
    }).met).toBe(true);
    expect(checkObjectiveMet({
      objective: { kind: 'CHAMPION', targetRank: 1, label: '' },
      playerClubFinalRank: 1, playerClubChampion: false,
    }).met).toBe(false);
  });

  it('TOP_4 : OK si rang ≤ 4', () => {
    const obj = { kind: 'TOP_4' as const, targetRank: 4, label: '' };
    expect(checkObjectiveMet({ objective: obj, playerClubFinalRank: 3, playerClubChampion: false }).met).toBe(true);
    expect(checkObjectiveMet({ objective: obj, playerClubFinalRank: 5, playerClubChampion: false }).met).toBe(false);
  });
});

describe('updateBoardConfidence', () => {
  it('objectif atteint : confiance monte', () => {
    const r = updateBoardConfidence({ ...INITIAL_BOARD_CONFIDENCE }, true, false);
    expect(r.score).toBeGreaterThan(INITIAL_BOARD_CONFIDENCE.score);
    expect(r.consecutiveFailures).toBe(0);
  });

  it('objectif raté : confiance baisse + failures s\'accumulent', () => {
    let conf = INITIAL_BOARD_CONFIDENCE;
    conf = updateBoardConfidence(conf, false, false);
    expect(conf.consecutiveFailures).toBe(1);
    conf = updateBoardConfidence(conf, false, false);
    expect(conf.consecutiveFailures).toBe(2);
  });

  it('licenciement après 2 échecs consécutifs si confiance < 15', () => {
    let conf = { score: 40, consecutiveFailures: 0, fired: false };
    conf = updateBoardConfidence(conf, false, false);  // 40 - 20 = 20, fail#1
    conf = updateBoardConfidence(conf, false, false);  // 20 - 20 = 0, fail#2 → fired
    expect(conf.fired).toBe(true);
  });

  it('victoire titre : bonus +25', () => {
    const r = updateBoardConfidence(INITIAL_BOARD_CONFIDENCE, true, true);
    expect(r.score).toBe(85);
  });
});

describe('boardConfidenceLabel', () => {
  it('mappe correctement', () => {
    expect(boardConfidenceLabel(80)).toBe('Confiance totale');
    expect(boardConfidenceLabel(40)).toBe('Confiance fragilisée');
    expect(boardConfidenceLabel(10)).toContain('Licenciement');
  });
});
