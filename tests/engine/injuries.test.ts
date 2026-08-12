/**
 * Tests V0.7 phase 3 — blessures dynamiques.
 */

import { describe, it, expect } from 'vitest';
import {
  isAvailable,
  progressInjuryRecovery,
  rollPostMatchInjuries,
} from '@/engine/match/injuries.js';
import type { Player, PlayerId, ClubId, Injury } from '@/engine/types.js';

function makePlayer(opts: { id?: string; robustesse?: number; fatigue?: number; injury?: Injury } = {}): Player {
  return {
    id: (opts.id ?? 'p_test') as PlayerId,
    clubId: 'c_test' as ClubId,
    firstName: 'P', lastName: opts.id ?? 'Test',
    birthDate: '2000-01-01',
    position: 'OUVREUR', secondaryPositions: [], isJiff: true,
    technical: { passe: 70, plaquage: 70, jeuAuPiedPlace: 70, jeuAuPiedDynamique: 70, visionDeJeu: 70, conservation: 70, prisedeballeHaute: 70, deblayage: 70 },
    physical: { vitesse: 70, puissance: 70, endurance: 70, detente: 70, robustesse: opts.robustesse ?? 70 },
    mental: { decision: 70, leadership: 70, sangFroid: 70, agressivite: 70, professionnalisme: 70, discipline: 70 },
    positionSpecific: {}, traits: [],
    hidden: { potentiel: 80, ambition: 50, determinisme: 50, loyaute: 60, adaptabilite: 50 },
    dynamic: {
      forme: 70, fatigue: opts.fatigue ?? 30, mood: 60, moodModifiers: [],
      ...(opts.injury ? { injury: opts.injury } : {}),
    },
    contract: { startSeason: 2025, endSeason: 2027, annualSalary: 100_000 },
  };
}

describe('rollPostMatchInjuries', () => {
  it('un non-titulaire ne se blesse jamais', () => {
    const benchwarmer = makePlayer({ id: 'b' });
    const result = rollPostMatchInjuries({
      players: [benchwarmer],
      starterIds: [],
      currentRound: 5,
      seed: 'seed',
    });
    expect(result.newInjuries).toEqual([]);
  });

  it('un joueur déjà blessé n\'est pas re-blessé', () => {
    const injured = makePlayer({
      id: 'i',
      injury: { type: 'LIGAMENTAIRE', startedAt: 1, estimatedReturnAt: 12, hasSequela: false },
    });
    const result = rollPostMatchInjuries({
      players: [injured],
      starterIds: [injured.id],
      currentRound: 5,
      seed: 'seed',
    });
    expect(result.newInjuries).toEqual([]);
    expect(result.players[0]!.dynamic.injury).toEqual(injured.dynamic.injury);
  });

  it('robustesse haute → moins de blessures', () => {
    const fragile = makePlayer({ id: 'f', robustesse: 30, fatigue: 80 });
    const solide = makePlayer({ id: 's', robustesse: 95, fatigue: 30 });
    let fragileCount = 0;
    let solideCount = 0;
    for (let i = 0; i < 200; i++) {
      const r = rollPostMatchInjuries({
        players: [fragile, solide],
        starterIds: [fragile.id, solide.id],
        currentRound: i,
        seed: `seed_${i}`,
      });
      for (const inj of r.newInjuries) {
        if (inj.playerId === fragile.id) fragileCount++;
        else solideCount++;
      }
    }
    expect(fragileCount).toBeGreaterThan(solideCount);
  });

  it('blessures déterministes par seed', () => {
    const players = [makePlayer({ id: 'a', robustesse: 50, fatigue: 70 })];
    const r1 = rollPostMatchInjuries({ players, starterIds: [players[0]!.id], currentRound: 5, seed: 'fixed' });
    const r2 = rollPostMatchInjuries({ players, starterIds: [players[0]!.id], currentRound: 5, seed: 'fixed' });
    expect(r1.newInjuries.length).toBe(r2.newInjuries.length);
  });
});

describe('progressInjuryRecovery', () => {
  it('lève la blessure quand round ≥ estimatedReturnAt', () => {
    const injured = makePlayer({
      id: 'i',
      injury: { type: 'MUSCULAIRE', startedAt: 1, estimatedReturnAt: 4, hasSequela: false },
    });
    const recovered = progressInjuryRecovery([injured], 5)[0]!;
    expect(recovered.dynamic.injury).toBeUndefined();
    expect(recovered.dynamic.forme).toBe(50);
    expect(recovered.dynamic.fatigue).toBe(0);
  });

  it('garde la blessure si round < estimatedReturnAt', () => {
    const injured = makePlayer({
      id: 'i',
      injury: { type: 'LIGAMENTAIRE', startedAt: 1, estimatedReturnAt: 15, hasSequela: false },
    });
    const stillOut = progressInjuryRecovery([injured], 10)[0]!;
    expect(stillOut.dynamic.injury).toBeDefined();
  });
});

describe('isAvailable', () => {
  it('exclut retraités, free agents, blessés', () => {
    expect(isAvailable(makePlayer())).toBe(true);
    expect(isAvailable({ ...makePlayer(), retired: true })).toBe(false);
    expect(isAvailable({ ...makePlayer(), freeAgent: true })).toBe(false);
    const injured = makePlayer({
      injury: { type: 'COUP', startedAt: 1, estimatedReturnAt: 3, hasSequela: false },
    });
    expect(isAvailable(injured)).toBe(false);
  });
});
