/**
 * Centre de formation — V0.39.
 *
 * Ce qui fait de la formation une décision, c'est sa **lenteur** : investir une
 * saison puis couper ne doit rien donner. C'est la propriété qu'on protège ici,
 * avec l'arbitrage entre orientation et qualité.
 */

import { describe, expect, it } from 'vitest';
import {
  academyCost,
  advanceAcademy,
  defaultAcademyState,
  focusBonusFor,
  positionPoolFor,
  targetLevel,
  type AcademyInvestment,
  type AcademyState,
} from '../../src/engine/club/academy.js';
import { generateYouthIntake } from '../../src/engine/club/youth-generation.js';
import { ALL_POSITIONS, type Club, type ClubId } from '../../src/engine/types.js';
import { isForwardPosition } from '../../src/engine/match/bench.js';

function club(tier: Club['tier'] = 'BUDGET_MOYEN'): Club {
  return {
    id: 'c' as ClubId, name: 'Club', shortName: 'CLB', city: 'Ville',
    tier, tacticalIdentity: 'MIXTE',
    stadiumCapacity: 15_000, annualBudget: 20_000_000,
    salaryCapUsage: 0, jiffCount: 0, reputation: 60,
  };
}

function run(state: AcademyState, c: Club, seasons: number): AcademyState {
  let s = state;
  for (let i = 0; i < seasons; i++) s = advanceAcademy(s, c);
  return s;
}

describe('convergence du centre', () => {
  const c = club();

  it('une saison d\'investissement ne change presque rien', () => {
    const départ = defaultAcademyState(c);
    const après = advanceAcademy({ ...départ, investment: 'MAXIMAL' }, c);
    // C'est tout l'enjeu : pousser le curseur une année ne rattrape rien.
    expect(après.level - départ.level).toBeCloseTo(0.35, 2);
  });

  it('plusieurs saisons de suite portent leurs fruits', () => {
    const départ = defaultAcademyState(c);
    const après = run({ ...départ, investment: 'MAXIMAL' }, c, 6);
    expect(après.level).toBeGreaterThan(départ.level + 1);
  });

  it('converge vers la cible sans la dépasser', () => {
    const c2 = club('GROS_BUDGET');
    const après = run({ level: 1, investment: 'MAXIMAL', focus: 'EQUILIBRE' }, c2, 40);
    expect(après.level).toBeCloseTo(targetLevel('MAXIMAL', c2), 1);
  });

  it('un centre délaissé se dégrade lentement', () => {
    const après = run({ level: 4, investment: 'MINIMAL', focus: 'EQUILIBRE' }, c, 3);
    expect(après.level).toBeLessThan(4);
    // Plus lentement qu'il ne se construit : le désinvestissement est tentant à
    // court terme, coûteux à long terme.
    expect(après.level).toBeGreaterThan(3);
  });

  it('un petit club ne peut pas viser le niveau d\'un gros', () => {
    expect(targetLevel('MAXIMAL', club('PETIT_BUDGET')))
      .toBeLessThan(targetLevel('MAXIMAL', club('GROS_BUDGET')));
  });

  it('le coût suit l\'ambition', () => {
    const levels: AcademyInvestment[] = ['MINIMAL', 'MODERE', 'SOUTENU', 'MAXIMAL'];
    for (let i = 1; i < levels.length; i++) {
      expect(academyCost(levels[i]!, c)).toBeGreaterThan(academyCost(levels[i - 1]!, c));
    }
  });
});

describe('orientation', () => {
  it('penche vers les avants sans jamais fermer l\'autre versant', () => {
    const pool = positionPoolFor('AVANTS');
    const forwards = pool.filter(isForwardPosition).length;
    expect(forwards / pool.length).toBeGreaterThan(0.6);
    // Une orientation tenue trois saisons ne doit pas laisser le club sans le
    // moindre trois-quarts formé.
    expect(pool.some(p => !isForwardPosition(p))).toBe(true);
  });

  it('reste équilibrée par défaut', () => {
    const pool = positionPoolFor('EQUILIBRE');
    expect(new Set(pool).size).toBe(ALL_POSITIONS.length);
    for (const p of ALL_POSITIONS) expect(focusBonusFor('EQUILIBRE', p)).toBe(0);
  });

  it('avantage les postes travaillés et pénalise les autres', () => {
    expect(focusBonusFor('AVANTS', 'PILIER_GAUCHE')).toBeGreaterThan(0);
    expect(focusBonusFor('AVANTS', 'ARRIERE')).toBeLessThan(0);
    expect(focusBonusFor('TROIS_QUARTS', 'ARRIERE')).toBeGreaterThan(0);
  });
});

describe('effet sur la promotion', () => {
  const c = club();
  const base = {
    club: c,
    currentSeason: 2027,
    seed: 'academy',
    existingPlayerIds: new Set<string>(),
  };

  it('un meilleur centre sort de meilleurs potentiels', () => {
    const faible = generateYouthIntake({ ...base, academyLevel: 1 });
    const fort = generateYouthIntake({ ...base, academyLevel: 5 });
    const moyenne = (list: readonly { hidden: { potentiel: number } }[]) =>
      list.reduce((s, p) => s + p.hidden.potentiel, 0) / list.length;
    expect(moyenne(fort)).toBeGreaterThan(moyenne(faible));
  });

  it('l\'orientation change les postes formés', () => {
    const avants = generateYouthIntake({ ...base, academyLevel: 3, focus: 'AVANTS', seed: 'a' });
    const troisQuarts = generateYouthIntake({ ...base, academyLevel: 3, focus: 'TROIS_QUARTS', seed: 'a' });
    const partAvants = (list: readonly { position: Parameters<typeof isForwardPosition>[0] }[]) =>
      list.filter(p => isForwardPosition(p.position)).length / list.length;
    expect(partAvants(avants)).toBeGreaterThan(partAvants(troisQuarts));
  });

  it('sans orientation, la promotion reste celle d\'avant', () => {
    const sans = generateYouthIntake({ ...base, academyLevel: 3, seed: 'x' });
    const équilibre = generateYouthIntake({ ...base, academyLevel: 3, focus: 'EQUILIBRE', seed: 'x' });
    expect(sans.map(p => p.position)).toEqual(équilibre.map(p => p.position));
  });
});
