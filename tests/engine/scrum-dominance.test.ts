/**
 * Tests V0.2 mêlée — sous-scores, dominance cumulée, sanctions.
 *
 * Référence : 06-moteur-match.md, "Mêlée → modèle de duel technique".
 */

import { describe, it, expect } from 'vitest';
import {
  simulateScrum,
  computeScrumDominanceShift,
  _computeScrumProbabilities,
  type ScrumInput,
} from '@/engine/match/scrum.js';
import { createRng } from '@/engine/rng.js';
import type { Player, PlayerId, ClubId } from '@/engine/types.js';

// =============================================================================
// Builder
// =============================================================================

interface Profile {
  /** Force de poussée (pousseeMelee). */
  poussee: number;
  /** Stabilité (endurance + robustesse). */
  gainage: number;
  /** Discipline + decision. */
  technique: number;
}

function makeFwd(profile: Profile, idx: number): Player {
  const c = (x: number) => Math.max(1, Math.min(99, x));
  return {
    id: ('p' + idx) as PlayerId,
    clubId: 'c_test' as ClubId,
    firstName: 'F', lastName: 'F',
    birthDate: '1995-01-01',
    position: 'PILIER_GAUCHE',
    secondaryPositions: [],
    isJiff: true,
    technical: { passe: 50, plaquage: 70, jeuAuPiedPlace: 20, jeuAuPiedDynamique: 20, visionDeJeu: 50, conservation: 60, prisedeballeHaute: 30, deblayage: 70 },
    physical: { vitesse: 40, puissance: c(profile.poussee), endurance: c(profile.gainage), detente: 30, robustesse: c(profile.gainage) },
    mental: { decision: c(profile.technique), leadership: 50, sangFroid: 50, agressivite: 60, professionnalisme: 60, discipline: c(profile.technique) },
    positionSpecific: { pousseeMelee: c(profile.poussee) },
    traits: [],
    hidden: { potentiel: 70, ambition: 50, determinisme: 50, loyaute: 60, adaptabilite: 50 },
    dynamic: { forme: 70, fatigue: 0, mood: 60, moodModifiers: [] },
    contract: { startSeason: 2025, endSeason: 2027, annualSalary: 100_000 },
  };
}

function makePack(profile: Profile, side: 'a' | 'd'): Player[] {
  return Array.from({ length: 8 }, (_, i) => makeFwd(profile, i + (side === 'a' ? 0 : 100)));
}

function baseInput(att: Profile, def: Profile, overrides?: Partial<ScrumInput>): ScrumInput {
  return {
    attackForwards: makePack(att, 'a'),
    defenseForwards: makePack(def, 'd'),
    attackPossession: 'HOME',
    attackTacticalBonus: 0,
    defenseTacticalBonus: 0,
    fatigueAttack: 0,
    fatigueDefense: 0,
    fieldCondition: 'BON',
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('Scrum V0.2 — sous-scores indépendants', () => {
  const balanced: Profile = { poussee: 60, gainage: 60, technique: 60 };
  const strongPush: Profile = { poussee: 85, gainage: 60, technique: 60 };
  const weakStability: Profile = { poussee: 60, gainage: 40, technique: 60 };
  const sloppyTechnique: Profile = { poussee: 60, gainage: 60, technique: 40 };

  it('équipe avec forte poussée → cleanWinProb augmente', () => {
    const probsBase = _computeScrumProbabilities(baseInput(balanced, balanced));
    const probsStrong = _computeScrumProbabilities(baseInput(strongPush, balanced));
    expect(probsStrong.cleanWinProb).toBeGreaterThan(probsBase.cleanWinProb);
  });

  it('défense avec gainage faible → attackPenaltyProb augmente', () => {
    const probsBase = _computeScrumProbabilities(baseInput(balanced, balanced));
    const probsWeakDef = _computeScrumProbabilities(baseInput(balanced, weakStability));
    expect(probsWeakDef.attackPenaltyProb).toBeGreaterThan(probsBase.attackPenaltyProb);
  });

  it('défense avec technique faible → attackPenaltyProb augmente', () => {
    const probsBase = _computeScrumProbabilities(baseInput(balanced, balanced));
    const probsSloppy = _computeScrumProbabilities(baseInput(balanced, sloppyTechnique));
    expect(probsSloppy.attackPenaltyProb).toBeGreaterThan(probsBase.attackPenaltyProb);
  });
});

describe('Scrum V0.2 — dominance cumulée', () => {
  const balanced: Profile = { poussee: 60, gainage: 60, technique: 60 };
  const dominant: Profile = { poussee: 80, gainage: 75, technique: 65 };

  it('dominance positive → cleanWinProb attaquant augmente', () => {
    const probsNoHistory = _computeScrumProbabilities(
      baseInput(balanced, balanced, { cumulativeDominance: 0 })
    );
    const probsDominated = _computeScrumProbabilities(
      baseInput(balanced, balanced, { cumulativeDominance: 40 })
    );
    expect(probsDominated.cleanWinProb).toBeGreaterThan(probsNoHistory.cleanWinProb);
  });

  it('dominance négative → defensePenaltyProb augmente (l\'arbitre suit la dominance)', () => {
    const probsNoHistory = _computeScrumProbabilities(
      baseInput(balanced, balanced, { cumulativeDominance: 0 })
    );
    const probsDominated = _computeScrumProbabilities(
      baseInput(balanced, balanced, { cumulativeDominance: -40 })
    );
    expect(probsDominated.defensePenaltyProb).toBeGreaterThan(probsNoHistory.defensePenaltyProb);
  });

  it('computeScrumDominanceShift : pack supérieur → shift positif', () => {
    const shift = computeScrumDominanceShift(baseInput(dominant, balanced));
    expect(shift).toBeGreaterThan(0);
  });

  it('computeScrumDominanceShift : pack inférieur → shift négatif', () => {
    const shift = computeScrumDominanceShift(baseInput(balanced, dominant));
    expect(shift).toBeLessThan(0);
  });

  it('packs identiques → shift quasi-nul', () => {
    const shift = computeScrumDominanceShift(baseInput(balanced, balanced));
    expect(Math.abs(shift)).toBeLessThan(1);
  });
});

describe('Scrum V0.2 — outcomes plausibles', () => {
  const balanced: Profile = { poussee: 60, gainage: 60, technique: 60 };

  it('renvoie un outcome valide sur input standard (smoke)', () => {
    const outcome = simulateScrum(baseInput(balanced, balanced), createRng(7));
    expect(outcome.summary).toBeTruthy();
    expect(outcome.metersGained).toBeGreaterThanOrEqual(0);
    expect(['HOME', 'AWAY', 'CONTESTED']).toContain(outcome.possessionAfter);
  });

  it('déterministe pour un même seed', () => {
    const inp = baseInput(balanced, balanced);
    const a = simulateScrum(inp, createRng(99));
    const b = simulateScrum(inp, createRng(99));
    expect(a).toEqual(b);
  });

  it('toutes les probabilités sont dans [0, 1]', () => {
    const p = _computeScrumProbabilities(baseInput(balanced, balanced));
    expect(p.cleanWinProb).toBeGreaterThanOrEqual(0);
    expect(p.cleanWinProb).toBeLessThanOrEqual(1);
    expect(p.attackPenaltyProb).toBeGreaterThanOrEqual(0);
    expect(p.attackPenaltyProb).toBeLessThanOrEqual(1);
    expect(p.defensePenaltyProb).toBeGreaterThanOrEqual(0);
    expect(p.defensePenaltyProb).toBeLessThanOrEqual(1);
  });
});
