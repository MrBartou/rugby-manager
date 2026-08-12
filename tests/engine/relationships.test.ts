/**
 * Tests V0.4 phase 2 — relations entre joueurs.
 */

import { describe, it, expect } from 'vitest';
import {
  applyMatchToRelations,
  computeRelationsForMood,
  generateInitialRelations,
  getRelation,
  topRelationsForPlayer,
  updateRelationScore,
} from '@/engine/human/relationships.js';
import type { Player, PlayerId, ClubId, TraitId } from '@/engine/types.js';

function makePlayer(opts: {
  id: string;
  position: Player['position'];
  birthYear: number;
  isJiff: boolean;
  traits?: readonly string[];
  leadership?: number;
}): Player {
  return {
    id: opts.id as PlayerId,
    clubId: 'test_club' as ClubId,
    firstName: 'F',
    lastName: 'L',
    birthDate: `${opts.birthYear}-01-01`,
    position: opts.position,
    secondaryPositions: [],
    isJiff: opts.isJiff,
    technical: { passe: 60, plaquage: 60, jeuAuPiedPlace: 50, jeuAuPiedDynamique: 50, visionDeJeu: 60, conservation: 60, prisedeballeHaute: 50, deblayage: 50 },
    physical: { vitesse: 60, puissance: 60, endurance: 60, detente: 50, robustesse: 60 },
    mental: { decision: 60, leadership: opts.leadership ?? 60, sangFroid: 60, agressivite: 60, professionnalisme: 60, discipline: 60 },
    positionSpecific: {},
    traits: (opts.traits ?? []) as readonly TraitId[],
    hidden: { potentiel: 70, ambition: 50, determinisme: 50, loyaute: 60, adaptabilite: 50 },
    dynamic: { forme: 70, fatigue: 0, mood: 60, moodModifiers: [] },
    contract: { startSeason: 2025, endSeason: 2027, annualSalary: 100_000 },
  };
}

describe('Initial relations', () => {
  it('deux joueurs même poste = relation tendanciellement négative', () => {
    // Test sur plusieurs paires pour lisser le bruit aléatoire
    let totalScore = 0;
    for (let i = 0; i < 10; i++) {
      const a = makePlayer({ id: `a${i}`, position: 'OUVREUR', birthYear: 1995, isJiff: true });
      const b = makePlayer({ id: `b${i}`, position: 'OUVREUR', birthYear: 1996, isJiff: true });
      const state = generateInitialRelations([a, b], 2025, `seed_${i}`);
      totalScore += getRelation(state, a.id, b.id).score;
    }
    expect(totalScore / 10).toBeLessThan(-3);
  });

  it('vieux + jeune même poste = mentor potentiel (positif)', () => {
    const old = makePlayer({ id: 'old', position: 'OUVREUR', birthYear: 1988, isJiff: true, traits: ['mentor'] });
    const young = makePlayer({ id: 'young', position: 'OUVREUR', birthYear: 2002, isJiff: true });
    const state = generateInitialRelations([old, young], 2025, 'seed');
    const r = getRelation(state, old.id, young.id);
    expect(r.score).toBeGreaterThan(10);
  });

  it('JIFF entre eux = bonus modeste', () => {
    const a = makePlayer({ id: 'a', position: 'PILIER_GAUCHE', birthYear: 1995, isJiff: true });
    const b = makePlayer({ id: 'b', position: 'CENTRE_INTERIEUR', birthYear: 1996, isJiff: true });
    const state = generateInitialRelations([a, b], 2025, 'seed');
    const r = getRelation(state, a.id, b.id);
    // Postes différents donc pas de rivalité, et JIFF entre eux
    expect(r.score).toBeGreaterThanOrEqual(0);
  });

  it('génération déterministe pour le même seed', () => {
    const players = [
      makePlayer({ id: 'a', position: 'OUVREUR', birthYear: 1995, isJiff: true }),
      makePlayer({ id: 'b', position: 'OUVREUR', birthYear: 2000, isJiff: false }),
    ];
    const s1 = generateInitialRelations(players, 2025, 'fixed');
    const s2 = generateInitialRelations(players, 2025, 'fixed');
    expect(getRelation(s1, players[0]!.id, players[1]!.id).score).toEqual(getRelation(s2, players[0]!.id, players[1]!.id).score);
  });
});

describe('Update + topRelations', () => {
  const a = makePlayer({ id: 'a', position: 'PILIER_GAUCHE', birthYear: 1995, isJiff: true });
  const b = makePlayer({ id: 'b', position: 'CENTRE_INTERIEUR', birthYear: 1996, isJiff: true });
  const c = makePlayer({ id: 'c', position: 'AILIER_GAUCHE', birthYear: 1998, isJiff: false });

  it('updateRelationScore modifie le score', () => {
    let state = generateInitialRelations([a, b, c], 2025, 'seed');
    state = updateRelationScore(state, a.id, b.id, 30, 'test');
    const r = getRelation(state, a.id, b.id);
    expect(r.score).toBeGreaterThanOrEqual(30);
  });

  it('topRelationsForPlayer renvoie les paires les plus extrêmes', () => {
    let state = generateInitialRelations([a, b, c], 2025, 'seed');
    state = updateRelationScore(state, a.id, b.id, 80, 'amitié');
    state = updateRelationScore(state, a.id, c.id, -70, 'conflit');
    const top = topRelationsForPlayer(state, a.id, 5);
    expect(top.length).toBeGreaterThanOrEqual(2);
    // Le plus extrême en valeur absolue est en premier
    expect(Math.abs(top[0]!.score)).toBeGreaterThanOrEqual(Math.abs(top[1]!.score));
  });
});

describe('applyMatchToRelations', () => {
  const a = makePlayer({ id: 'a', position: 'PILIER_GAUCHE', birthYear: 1995, isJiff: true });
  const b = makePlayer({ id: 'b', position: 'CENTRE_INTERIEUR', birthYear: 1996, isJiff: true });

  it('victoire entre titulaires → relation s\'améliore', () => {
    const initial = generateInitialRelations([a, b], 2025, 'seed');
    const initialScore = getRelation(initial, a.id, b.id).score;
    const after = applyMatchToRelations(initial, {
      starterIds: [a.id, b.id],
      resultDelta: 18,    // grosse victoire
    });
    const newScore = getRelation(after, a.id, b.id).score;
    expect(newScore).toBeGreaterThan(initialScore);
  });

  it('défaite cinglante entre titulaires → relation se dégrade', () => {
    const initial = generateInitialRelations([a, b], 2025, 'seed');
    const initialScore = getRelation(initial, a.id, b.id).score;
    const after = applyMatchToRelations(initial, {
      starterIds: [a.id, b.id],
      resultDelta: -25,
    });
    const newScore = getRelation(after, a.id, b.id).score;
    expect(newScore).toBeLessThan(initialScore);
  });
});

describe('computeRelationsForMood', () => {
  const a = makePlayer({ id: 'a', position: 'PILIER_GAUCHE', birthYear: 1995, isJiff: true });
  const b = makePlayer({ id: 'b', position: 'CENTRE_INTERIEUR', birthYear: 1996, isJiff: true });
  const c = makePlayer({ id: 'c', position: 'AILIER_GAUCHE', birthYear: 1998, isJiff: false });

  it('compte correctement les conflits et relations positives', () => {
    let state = generateInitialRelations([a, b, c], 2025, 'seed');
    state = updateRelationScore(state, a.id, b.id, 60, 'amitié');
    state = updateRelationScore(state, a.id, c.id, -60, 'conflit');
    const factors = computeRelationsForMood(state, a.id);
    expect(factors.positiveCount).toBeGreaterThanOrEqual(1);
    expect(factors.conflictCount).toBeGreaterThanOrEqual(1);
  });
});
