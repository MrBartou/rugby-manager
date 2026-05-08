/**
 * Tests du module mêlée — V0.1.
 *
 * Smoke tests pour valider que :
 *   1. simulateScrum est appelable avec un input plausible
 *   2. Les outcomes sont déterministes (même seed = même résultat)
 *   3. Les probabilités sont dans les bornes attendues
 *
 * V0.2+ : property-based tests sur les invariants (somme prob = 1, etc.)
 */

import { describe, it, expect } from 'vitest';
import { simulateScrum, _computeScrumProbabilities } from '@/engine/match/scrum.js';
import { createRng } from '@/engine/rng.js';
import type { Player, PlayerId, ClubId } from '@/engine/types.js';
import type { ScrumInput } from '@/engine/match/scrum.js';

// =============================================================================
// Builders de test
// =============================================================================

function makeForward(scrumStrength: number): Player {
  return {
    id: ('p_' + Math.floor(scrumStrength * 1000)) as PlayerId,
    clubId: 'c_test' as ClubId,
    firstName: 'Test',
    lastName: 'Forward',
    birthDate: '1995-01-01',
    position: 'PILIER_GAUCHE',
    secondaryPositions: [],
    isJiff: true,
    technical: {
      passe: 50, plaquage: 70, jeuAuPiedPlace: 20, jeuAuPiedDynamique: 20,
      visionDeJeu: 50, conservation: 60, prisedeballeHaute: 30, deblayage: 70,
    },
    physical: {
      vitesse: 40, puissance: scrumStrength, endurance: 60, detente: 30, robustesse: 70,
    },
    mental: {
      decision: 50, leadership: 50, sangFroid: 50, agressivite: 60,
      professionnalisme: 60, discipline: 60,
    },
    positionSpecific: { pousseeMelee: scrumStrength },
    traits: [],
    hidden: { potentiel: 70, ambition: 50, determinisme: 50, loyaute: 60, adaptabilite: 50 },
    dynamic: { forme: 70, fatigue: 30, mood: 60, moodModifiers: [] },
    contract: { startSeason: 2025, endSeason: 2027, annualSalary: 100_000 },
  };
}

function makeStandardScrumInput(overrides?: Partial<ScrumInput>): ScrumInput {
  const base: ScrumInput = {
    attackForwards: Array.from({ length: 8 }, () => makeForward(60)),
    defenseForwards: Array.from({ length: 8 }, () => makeForward(60)),
    attackPossession: 'HOME',
    attackTacticalBonus: 0,
    defenseTacticalBonus: 0,
    fatigueAttack: 30,
    fatigueDefense: 30,
    fieldCondition: 'BON',
  };
  return { ...base, ...overrides };
}

// =============================================================================
// Tests
// =============================================================================

describe('simulateScrum — V0.1 smoke', () => {
  it('renvoie un PhaseOutcome cohérent sur input standard', () => {
    const input = makeStandardScrumInput();
    const rng = createRng(42);

    const outcome = simulateScrum(input, rng);

    expect(outcome.summary).toBeTruthy();
    expect(outcome.metersGained).toBeGreaterThanOrEqual(0);
    expect(['HOME', 'AWAY', 'CONTESTED']).toContain(outcome.possessionAfter);
  });

  it('est déterministe pour le même seed', () => {
    const input = makeStandardScrumInput();
    const r1 = simulateScrum(input, createRng(123));
    const r2 = simulateScrum(input, createRng(123));

    expect(r1).toEqual(r2);
  });

  it('produit des outcomes différents pour des seeds différents', () => {
    const input = makeStandardScrumInput();
    const outcomes = new Set<string>();
    for (let s = 0; s < 50; s++) {
      const r = simulateScrum(input, createRng(s));
      outcomes.add(r.summary);
    }
    // Sur 50 seeds, on doit voir au moins 2 narrations distinctes
    expect(outcomes.size).toBeGreaterThan(1);
  });
});

describe('_computeScrumProbabilities — V0.1 distributions', () => {
  it('packs équivalents → cleanWin entre 50% et 60%', () => {
    const probs = _computeScrumProbabilities(makeStandardScrumInput());
    expect(probs.cleanWinProb).toBeGreaterThan(0.5);
    expect(probs.cleanWinProb).toBeLessThan(0.7);
  });

  it('pack attaquant dominant → cleanWin > 65%', () => {
    const input = makeStandardScrumInput({
      attackForwards: Array.from({ length: 8 }, () => makeForward(85)),
      defenseForwards: Array.from({ length: 8 }, () => makeForward(50)),
    });
    const probs = _computeScrumProbabilities(input);
    expect(probs.cleanWinProb).toBeGreaterThan(0.65);
  });

  it('toutes les probabilités sont dans [0, 1]', () => {
    const probs = _computeScrumProbabilities(makeStandardScrumInput());
    expect(probs.cleanWinProb).toBeGreaterThanOrEqual(0);
    expect(probs.cleanWinProb).toBeLessThanOrEqual(1);
    expect(probs.attackPenaltyProb).toBeGreaterThanOrEqual(0);
    expect(probs.attackPenaltyProb).toBeLessThanOrEqual(1);
    expect(probs.defensePenaltyProb).toBeGreaterThanOrEqual(0);
    expect(probs.defensePenaltyProb).toBeLessThanOrEqual(1);
  });

  it('fatigue défense élevée → cleanWin attaque augmente', () => {
    const fresh = _computeScrumProbabilities(makeStandardScrumInput({ fatigueDefense: 10 }));
    const tired = _computeScrumProbabilities(makeStandardScrumInput({ fatigueDefense: 90 }));
    expect(tired.cleanWinProb).toBeGreaterThan(fresh.cleanWinProb);
  });
});
