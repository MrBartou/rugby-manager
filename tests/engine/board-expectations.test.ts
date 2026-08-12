/**
 * Les attentes du board — V0.48.
 *
 * La propriété qui gouverne le module : le président réclame **ce qui manque à
 * ce club-là**. Formuler les quatre exigences à tout le monde reviendrait à
 * n'en formuler aucune, et demander de dégraisser à un club déjà sobre serait
 * du bruit.
 */

import { describe, expect, it } from 'vitest';
import {
  YOUTH_MINUTES_TARGET,
  computeExpectations,
  confidenceDelta,
  judgeExpectations,
  type ClubSituation,
} from '../../src/engine/season/board-expectations.js';
import type { Club, ClubId } from '../../src/engine/types.js';

function club(tier: Club['tier'] = 'BUDGET_MOYEN'): Club {
  return {
    id: 'c' as ClubId, name: 'Club', shortName: 'CLB', city: 'Ville',
    tier, tacticalIdentity: 'MIXTE',
    stadiumCapacity: 15_000, annualBudget: 20_000_000,
    salaryCapUsage: 0, jiffCount: 0, reputation: 55,
  };
}

const healthy: ClubSituation = {
  capUsage: 70, jiffHeadroom: 8, youthMinutesRatio: 0.2, seasonBalance: 5_000_000,
};

const sit = (over: Partial<ClubSituation> = {}): ClubSituation => ({ ...healthy, ...over });

describe('ce que le board réclame', () => {
  it('ne demande rien à un club sain', () => {
    expect(computeExpectations(club(), healthy)).toEqual([]);
  });

  it('demande de dégraisser au club qui frôle le plafond', () => {
    const out = computeExpectations(club(), sit({ capUsage: 96 }));
    expect(out.map(e => e.kind)).toContain('MASSE_SALARIALE');
  });

  it('demande de reconstituer le vivier JIFF quand la marge est nulle', () => {
    const out = computeExpectations(club(), sit({ jiffHeadroom: 1 }));
    expect(out.map(e => e.kind)).toContain('QUOTA_JIFF');
  });

  it('demande l\'équilibre au club déficitaire', () => {
    const out = computeExpectations(club(), sit({ seasonBalance: -2_000_000 }));
    expect(out.map(e => e.kind)).toContain('COMPTES_EQUILIBRES');
  });

  it('ne réclame pas de faire jouer les jeunes à un gros budget', () => {
    // Un club qui a les moyens d'acheter n'a pas d'excuse à former ; l'exigence
    // n'a de sens que pour celui qui n'en a pas.
    const petit = computeExpectations(club('PETIT_BUDGET'), sit({ youthMinutesRatio: 0.02 }));
    const gros = computeExpectations(club('GROS_BUDGET'), sit({ youthMinutesRatio: 0.02 }));
    expect(petit.map(e => e.kind)).toContain('JEUNES_AU_JEU');
    expect(gros.map(e => e.kind)).not.toContain('JEUNES_AU_JEU');
  });

  it('n\'en formule jamais plus de deux', () => {
    // Quatre exigences simultanées, c'est aucune exigence.
    const tout = computeExpectations(club('PETIT_BUDGET'), {
      capUsage: 99, jiffHeadroom: 0, youthMinutesRatio: 0, seasonBalance: -3_000_000,
    });
    expect(tout.length).toBeLessThanOrEqual(2);
  });

  it('sert d\'abord le plus menaçant', () => {
    // Une masse salariale hors des clous menace l'existence du club ; le temps
    // de jeu des jeunes est du confort.
    const tout = computeExpectations(club('PETIT_BUDGET'), {
      capUsage: 99, jiffHeadroom: 0, youthMinutesRatio: 0, seasonBalance: 1,
    });
    expect(tout[0]!.kind).toBe('MASSE_SALARIALE');
  });

  it('formule chaque exigence en toutes lettres', () => {
    for (const e of computeExpectations(club(), sit({ capUsage: 99, jiffHeadroom: 0 }))) {
      expect(e.wording.length).toBeGreaterThan(15);
    }
  });
});

describe('le verdict', () => {
  const capExpectation = computeExpectations(club(), sit({ capUsage: 96 }))[0]!;

  it('constate la réussite quand le club est redescendu', () => {
    const [r] = judgeExpectations([capExpectation], sit({ capUsage: 85 }));
    expect(r!.met).toBe(true);
    expect(r!.summary).toMatch(/85 %/);
  });

  it('constate l\'échec sinon', () => {
    const [r] = judgeExpectations([capExpectation], sit({ capUsage: 97 }));
    expect(r!.met).toBe(false);
  });

  it('dit le déficit quand les comptes sont dans le rouge', () => {
    const e = computeExpectations(club(), sit({ seasonBalance: -1 }))[0]!;
    const [r] = judgeExpectations([e], sit({ seasonBalance: -2_400_000 }));
    expect(r!.met).toBe(false);
    expect(r!.summary).toMatch(/Déficit/);
  });

  it('juge le temps de jeu des jeunes sur le seuil annoncé', () => {
    const e = computeExpectations(club('PETIT_BUDGET'), sit({ youthMinutesRatio: 0 }))[0]!;
    expect(judgeExpectations([e], sit({ youthMinutesRatio: YOUTH_MINUTES_TARGET }))[0]!.met).toBe(true);
    expect(judgeExpectations([e], sit({ youthMinutesRatio: 0.05 }))[0]!.met).toBe(false);
  });
});

describe('poids sur la confiance', () => {
  const e = computeExpectations(club(), sit({ capUsage: 96 }));

  it('récompense moins qu\'il ne punit', () => {
    const tenue = confidenceDelta(judgeExpectations(e, sit({ capUsage: 80 })));
    const ratee = confidenceDelta(judgeExpectations(e, sit({ capUsage: 99 })));
    expect(tenue).toBeGreaterThan(0);
    expect(Math.abs(ratee)).toBeGreaterThan(tenue);
  });

  it('reste plus léger que la mission sportive', () => {
    // Un objectif de classement raté coûte 20 points de confiance : ces
    // exigences sont de la gestion, pas la mission principale.
    const pire = confidenceDelta(judgeExpectations(
      computeExpectations(club('PETIT_BUDGET'), { capUsage: 99, jiffHeadroom: 0, youthMinutesRatio: 0, seasonBalance: -1 }),
      { capUsage: 99, jiffHeadroom: 0, youthMinutesRatio: 0, seasonBalance: -1 },
    ));
    expect(Math.abs(pire)).toBeLessThan(20);
  });

  it('ne bouge rien sans exigence', () => {
    expect(confidenceDelta([])).toBe(0);
  });
});
