/**
 * Plan tactique de match — V0.32.
 *
 * Deux garanties structurelles priment sur les valeurs elles-mêmes :
 *   - le plan neutre est **exactement** l'identité, sans quoi la calibration du
 *     moteur mesurerait un jeu déjà orienté ;
 *   - chaque réglage a une contrepartie, sans quoi il n'y aurait pas de choix.
 */

import { describe, expect, it } from 'vitest';
import {
  NEUTRAL_PLAN,
  NEUTRAL_TACTICS,
  planForIdentity,
  resolveTactics,
} from '../../src/engine/match/tactics.js';
import type { PreMatchTacticalPlan } from '../../src/engine/match/types.js';
import { simulateMatch } from '../../src/engine/match/simulate.js';
import { makeMatchInput } from './fixtures.js';

const plan = (over: Partial<PreMatchTacticalPlan> = {}): PreMatchTacticalPlan =>
  ({ ...NEUTRAL_PLAN, ...over });

describe('traduction du plan en effets', () => {
  it('le plan neutre ne modifie rien', () => {
    expect(resolveTactics(NEUTRAL_PLAN)).toEqual(NEUTRAL_TACTICS);
  });

  it('un plan absent équivaut au plan neutre', () => {
    expect(resolveTactics(undefined)).toEqual(NEUTRAL_TACTICS);
  });

  it('l\'occupation haute troque le ballon contre du terrain', () => {
    const m = resolveTactics(plan({ occupation: 'HAUTE' }));
    expect(m.kickTendency).toBeGreaterThan(1);
    expect(m.tryConceded).toBeLessThan(1);
  });

  it('le ballon en main garde la balle mais expose', () => {
    const m = resolveTactics(plan({ occupation: 'BASSE' }));
    expect(m.kickTendency).toBeLessThan(1);
    expect(m.ownErrorRisk).toBeGreaterThan(1);
    expect(m.tryConceded).toBeGreaterThan(1);
  });

  it('la défense montante gratte plus et fait plus de fautes', () => {
    const m = resolveTactics(plan({ defensiveLine: 'MONTANTE' }));
    expect(m.pressureOnAttack).toBeGreaterThan(1);
    expect(m.penaltyRisk).toBeGreaterThan(1);
    expect(m.tryConceded).toBeGreaterThan(1);
  });

  it('la défense reculée fait moins de fautes et gratte moins', () => {
    const m = resolveTactics(plan({ defensiveLine: 'STAND_OFF' }));
    expect(m.penaltyRisk).toBeLessThan(1);
    expect(m.pressureOnAttack).toBeLessThan(1);
  });

  it('chaque axe de conquête travaillé se paie en jeu courant', () => {
    const aucun = resolveTactics(plan({ setPiecesFocus: ['NONE'] }));
    const un = resolveTactics(plan({ setPiecesFocus: ['MELEE'] }));
    const trois = resolveTactics(plan({ setPiecesFocus: ['MELEE', 'TOUCHE', 'MAUL'] }));

    expect(aucun.openPlayMalus).toBe(0);
    expect(un.scrumBonus).toBeGreaterThan(0);
    expect(un.openPlayMalus).toBeGreaterThan(0);
    // Trois axes coûtent trois fois plus : cocher toutes les cases n'est pas gratuit.
    expect(trois.openPlayMalus).toBeGreaterThan(un.openPlayMalus);
  });

  it('le focus maul impose la philosophie de touche correspondante', () => {
    expect(resolveTactics(plan({ setPiecesFocus: ['MAUL'] })).lineoutPhilosophy).toBe('MAUL_LOURD');
    expect(resolveTactics(plan({ setPiecesFocus: ['MELEE'] })).lineoutPhilosophy).toBeUndefined();
  });

  it('les effets se composent entre curseurs', () => {
    // Occupation haute (essais concédés ×0,80) et défense montante (×1,14).
    const m = resolveTactics(plan({ occupation: 'HAUTE', defensiveLine: 'MONTANTE' }));
    expect(m.tryConceded).toBeCloseTo(0.80 * 1.14, 5);
  });
});

describe('plans de l\'IA', () => {
  it('donne à chaque identité une manière de jouer distincte', () => {
    const avants = planForIdentity('JEU_AVANTS');
    const ecart = planForIdentity('GRAND_ECART');
    const fer = planForIdentity('DEFENSE_DE_FER');

    expect(avants.setPiecesFocus).toContain('MELEE');
    expect(ecart.occupation).toBe('BASSE');
    expect(fer.defensiveLine).toBe('STAND_OFF');
    expect(new Set([avants, ecart, fer].map(p => JSON.stringify(p))).size).toBe(3);
  });

  it('un club sans identité marquée joue le plan neutre', () => {
    expect(planForIdentity('MIXTE')).toEqual(NEUTRAL_PLAN);
  });
});

// =============================================================================
// Effet mesurable sur le moteur
// =============================================================================

/** Moyennes sur un échantillon de matchs entre équipes de niveau égal. */
function sample(homePlan: PreMatchTacticalPlan, n = 300): {
  penaltiesConceded: number;
  kicks: number;
  scrumWinRate: number;
} {
  let pen = 0, kicks = 0, scrumWin = 0, scrumN = 0;
  for (let i = 0; i < n; i++) {
    const base = makeMatchInput({ homeNiveau: 70, awayNiveau: 70, matchId: `t${i}` });
    const input = { ...base, home: { ...base.home, tacticalPlan: homePlan } };
    const r = simulateMatch(input, `s${i}`);
    for (const ph of r.phases) {
      if (ph.outcome.penaltyAwarded === 'AWAY') pen++;
      if (ph.type === 'KICK') kicks++;
      if (ph.type === 'SCRUM' && ph.state.possession === 'HOME') {
        scrumN++;
        if (ph.outcome.possessionAfter === 'HOME') scrumWin++;
      }
    }
  }
  return {
    penaltiesConceded: pen / n,
    kicks: kicks / n,
    scrumWinRate: scrumWin / Math.max(1, scrumN),
  };
}

describe('le plan se voit dans le déroulé du match', () => {
  const neutre = sample(NEUTRAL_PLAN);

  it('l\'occupation haute fait taper davantage', () => {
    expect(sample(plan({ occupation: 'HAUTE' })).kicks).toBeGreaterThan(neutre.kicks);
  });

  it('la défense montante concède plus de pénalités que la reculée', () => {
    const montante = sample(plan({ defensiveLine: 'MONTANTE' })).penaltiesConceded;
    const reculee = sample(plan({ defensiveLine: 'STAND_OFF' })).penaltiesConceded;
    expect(montante).toBeGreaterThan(neutre.penaltiesConceded);
    expect(reculee).toBeLessThan(neutre.penaltiesConceded);
  });

  it('travailler la mêlée améliore la conquête', () => {
    expect(sample(plan({ setPiecesFocus: ['MELEE'] })).scrumWinRate)
      .toBeGreaterThan(neutre.scrumWinRate);
  });
});
