/**
 * L'élan — V0.50.
 *
 * `homeMomentum` était déclaré « -100 à +100 » et valait 0 en dur : la barre
 * affichée pendant le match était une dérivée de la possession calculée dans
 * l'interface, sans le moindre effet sur la simulation.
 *
 * Ce qui est testé ici : l'élan monte sur ce qui fait lever un stade, il
 * redescend tout seul, et surtout **il ne s'emballe pas**. Une boucle de
 * rétroaction positive mal bridée transforme chaque rencontre en avalanche.
 */

import { describe, expect, it } from 'vitest';
import {
  MOMENTUM_CAP,
  advanceMomentum,
  momentumEffects,
  momentumFor,
  momentumLabel,
  momentumShift,
} from '../../src/engine/match/momentum.js';
import type { PhaseOutcome, PhaseType } from '../../src/engine/match/types.js';
import type { PlayerId } from '../../src/engine/types.js';

const outcome = (over: Partial<PhaseOutcome> = {}): PhaseOutcome => ({
  possessionAfter: 'HOME',
  metersGained: 3,
  nextPhase: 'RUCK',
  summary: 'phase',
  ...over,
});

const shift = (
  over: Partial<PhaseOutcome>,
  attackerBefore: 'HOME' | 'AWAY' = 'HOME',
  phaseType: PhaseType = 'OPEN_PLAY',
): number => momentumShift({ phaseType, outcome: outcome(over), attackerBefore });

describe('ce qui fait lever un stade', () => {
  it('l\'essai est le premier déclencheur, et de loin', () => {
    const essai = shift({ tryScored: 'HOME' });
    const penalite = shift({ penaltyAwarded: 'HOME' });
    expect(essai).toBeGreaterThan(penalite * 3);
  });

  it('le turnover vient juste après', () => {
    const turnover = shift({ possessionAfter: 'AWAY' }, 'HOME');
    const penalite = shift({ penaltyAwarded: 'AWAY' });
    expect(Math.abs(turnover)).toBeGreaterThan(Math.abs(penalite));
    expect(Math.abs(turnover)).toBeLessThan(Math.abs(shift({ tryScored: 'AWAY' })));
  });

  it('un carton casse l\'élan de celui qui le prend', () => {
    const card = shift({
      penaltyAwarded: 'HOME',
      cardIssued: { color: 'YELLOW', playerId: 'p' as PlayerId },
    });
    // La pénalité profite aux locaux, le carton frappe les visiteurs : les deux
    // vont dans le même sens.
    expect(card).toBeGreaterThan(shift({ penaltyAwarded: 'HOME' }));
    const rouge = shift({
      penaltyAwarded: 'HOME',
      cardIssued: { color: 'RED', playerId: 'p' as PlayerId },
    });
    expect(rouge).toBeGreaterThan(card);
  });

  it('une transformation ne soulève personne', () => {
    const conv = shift({ pointsScored: { team: 'HOME', value: 2, type: 'CONVERSION' } });
    const drop = shift({ pointsScored: { team: 'HOME', value: 3, type: 'DROP_GOAL' } });
    expect(conv).toBe(0);
    expect(drop).toBeGreaterThan(0);
  });

  it('ne compte pas un renvoi ni une transformation comme un turnover', () => {
    expect(shift({ possessionAfter: 'AWAY' }, 'HOME', 'KICKOFF')).toBe(0);
    expect(shift({ possessionAfter: 'AWAY' }, 'HOME', 'CONVERSION')).toBe(0);
  });

  it('reste symétrique : ce qui monte pour l\'un descend pour l\'autre', () => {
    expect(shift({ tryScored: 'HOME' })).toBe(-shift({ tryScored: 'AWAY' }));
    expect(shift({ possessionAfter: 'AWAY' }, 'HOME'))
      .toBe(-shift({ possessionAfter: 'HOME' }, 'AWAY'));
  });

  it('une phase quelconque ne produit aucun élan', () => {
    expect(shift({})).toBe(0);
  });

  it('la mêlée qui recule compte, sans plus', () => {
    const avec = momentumShift({
      phaseType: 'SCRUM', outcome: outcome(), attackerBefore: 'HOME', scrumDominanceShift: 40,
    });
    expect(avec).toBeGreaterThan(0);
    expect(avec).toBeLessThan(shift({ penaltyAwarded: 'HOME' }) + 1);
  });
});

describe('il redescend tout seul', () => {
  it('s\'érode à chaque phase, même sans rien faire', () => {
    let m = 50;
    for (let i = 0; i < 10; i++) m = advanceMomentum(m, 0, 'RUCK');
    expect(m).toBeLessThan(25);
  });

  it('retombe bien plus fort sur un renvoi qu\'en jeu courant', () => {
    expect(advanceMomentum(60, 0, 'KICKOFF')).toBeLessThan(advanceMomentum(60, 0, 'RUCK'));
  });

  it('érode avant d\'ajouter : un essai vaut sa pleine valeur au moment où il tombe', () => {
    expect(advanceMomentum(0, 18, 'RUCK')).toBe(18);
  });

  it('un pic d\'essai s\'éteint en une dizaine de phases', () => {
    let m = advanceMomentum(0, 18, 'RUCK');
    for (let i = 0; i < 10; i++) m = advanceMomentum(m, 0, 'RUCK');
    // Sous le seuil où le libellé parle encore d'ascendant.
    expect(m).toBeLessThan(12);
  });

  it('ne dépasse jamais ses bornes, même sous un déluge', () => {
    let m = 0;
    for (let i = 0; i < 200; i++) m = advanceMomentum(m, 18, 'RUCK');
    expect(m).toBeLessThanOrEqual(MOMENTUM_CAP);
    let n = 0;
    for (let i = 0; i < 200; i++) n = advanceMomentum(n, -18, 'RUCK');
    expect(n).toBeGreaterThanOrEqual(-MOMENTUM_CAP);
  });
});

describe('ses effets restent bridés', () => {
  it('un élan maximal pèse moins que de jouer chez soi', () => {
    // L'avantage du terrain vaut 5 sur la même échelle (session.ts).
    expect(momentumEffects(MOMENTUM_CAP).tacticalBonus).toBeLessThan(5);
  });

  it('joue dans les deux sens : celui qui subit lâche davantage', () => {
    const porté = momentumEffects(80);
    const subi = momentumEffects(-80);
    expect(porté.errorFactor).toBeLessThan(1);
    expect(subi.errorFactor).toBeGreaterThan(1);
    expect(porté.tacticalBonus).toBe(-subi.tacticalBonus);
  });

  it('ne change rien du tout quand le match est équilibré', () => {
    const neutre = momentumEffects(0);
    expect(neutre.tacticalBonus).toBe(0);
    expect(neutre.errorFactor).toBe(1);
    expect(neutre.kickAccuracyDelta).toBe(0);
  });

  it('reste borné même si on lui passe une valeur aberrante', () => {
    expect(momentumEffects(10_000).tacticalBonus)
      .toBe(momentumEffects(MOMENTUM_CAP).tacticalBonus);
  });

  it('se lit du point de vue de chaque camp', () => {
    expect(momentumFor(40, 'HOME')).toBe(40);
    expect(momentumFor(40, 'AWAY')).toBe(-40);
  });
});

describe('ce que le commentaire en dit', () => {
  it('se tait quand rien ne penche', () => {
    expect(momentumLabel(0)).toContain('équilibré');
    expect(momentumLabel(-8)).toContain('équilibré');
  });

  it('nomme le camp qui tient le match', () => {
    expect(momentumLabel(80)).toContain('locaux');
    expect(momentumLabel(-80)).toContain('visiteurs');
  });

  it('qualifie sans jamais chiffrer', () => {
    for (const m of [-100, -50, -20, 0, 20, 50, 100]) {
      expect(momentumLabel(m)).not.toMatch(/\d/);
    }
  });
});
