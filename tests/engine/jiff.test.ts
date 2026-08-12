/**
 * Tests V0.8 phase 1 — compteur JIFF.
 */

import { describe, it, expect } from 'vitest';
import { computeClubJiffStats, computeJiffStats, JIFF_MIN_COUNT_FEUILLE_23 } from '@/engine/club/jiff.js';
import type { Player, PlayerId, ClubId } from '@/engine/types.js';

function p(id: string, isJiff: boolean, opts: { retired?: boolean; freeAgent?: boolean } = {}): Player {
  return {
    id: id as PlayerId, clubId: 'c' as ClubId,
    firstName: 'P', lastName: id, birthDate: '2000-01-01',
    position: 'OUVREUR', secondaryPositions: [], isJiff,
    technical: { passe: 70, plaquage: 70, jeuAuPiedPlace: 70, jeuAuPiedDynamique: 70, visionDeJeu: 70, conservation: 70, prisedeballeHaute: 70, deblayage: 70 },
    physical: { vitesse: 70, puissance: 70, endurance: 70, detente: 70, robustesse: 70 },
    mental: { decision: 70, leadership: 70, sangFroid: 70, agressivite: 70, professionnalisme: 70, discipline: 70 },
    positionSpecific: {}, traits: [],
    hidden: { potentiel: 80, ambition: 50, determinisme: 50, loyaute: 60, adaptabilite: 50 },
    dynamic: { forme: 70, fatigue: 0, mood: 60, moodModifiers: [] },
    contract: { startSeason: 2025, endSeason: 2027, annualSalary: 100_000 },
    ...opts,
  };
}

describe('computeJiffStats', () => {
  it('feuille 23 avec 14 JIFF → conforme (≥12)', () => {
    const players = [
      ...Array.from({ length: 14 }, (_, i) => p(`j${i}`, true)),
      ...Array.from({ length: 9 }, (_, i) => p(`n${i}`, false)),
    ];
    const stats = computeJiffStats(players);
    expect(stats.total).toBe(23);
    expect(stats.jiffCount).toBe(14);
    expect(stats.belowThreshold).toBe(false);
    expect(stats.shortfall).toBe(0);
  });

  it('feuille 23 avec 10 JIFF → en-dessous du seuil', () => {
    const players = [
      ...Array.from({ length: 10 }, (_, i) => p(`j${i}`, true)),
      ...Array.from({ length: 13 }, (_, i) => p(`n${i}`, false)),
    ];
    const stats = computeJiffStats(players);
    expect(stats.belowThreshold).toBe(true);
    expect(stats.shortfall).toBe(JIFF_MIN_COUNT_FEUILLE_23 - 10);
  });

  it('feuille vide → ratio 0', () => {
    const stats = computeJiffStats([]);
    expect(stats.ratio).toBe(0);
    expect(stats.shortfall).toBe(0);
  });
});

describe('computeClubJiffStats', () => {
  it('exclut retraités et free agents du calcul', () => {
    const roster = [
      p('a', true),
      p('b', true, { retired: true }),
      p('c', false, { freeAgent: true }),
      p('d', false),
    ];
    const stats = computeClubJiffStats(roster);
    expect(stats.total).toBe(2);
    expect(stats.jiffCount).toBe(1);
  });
});
