/**
 * Les deux étages du championnat — V0.44.
 *
 * La propriété qui tient tout : **chaque division garde son effectif** — quatorze
 * clubs en Top 14, seize en Pro D2 depuis la V0.56. Le calendrier round-robin
 * exige un effectif pair et les phases finales supposent un top 6 ; une division
 * à treize clubs ne se construirait plus, et la saison suivante serait morte
 * avant d'avoir commencé.
 */

import { describe, expect, it } from 'vitest';
import {
  PRO_D2_CLUBS,
  TOP14_CLUBS,
  buildProD2Clubs,
  clubsOfDivision,
  divisionOf,
  exchangeClubs,
  initialDivisions,
  resolvePromotions,
  shadowRng,
  shadowSeason,
  type DivisionState,
} from '../../src/engine/season/divisions.js';
import { createRng } from '../../src/engine/rng.js';
import type { Club, ClubId } from '../../src/engine/types.js';

function club(id: string): Club {
  return {
    id: id as ClubId, name: id, shortName: id.slice(0, 3), city: id,
    tier: 'BUDGET_MOYEN', tacticalIdentity: 'MIXTE',
    stadiumCapacity: 15_000, annualBudget: 20_000_000,
    salaryCapUsage: 0, jiffCount: 0, reputation: 50,
  };
}

const TOP14 = Array.from({ length: 14 }, (_, i) => club(`t${i}`));
const PROD2 = buildProD2Clubs();
const STATE: DivisionState = initialDivisions(TOP14, PROD2);

const ranking = (state: DivisionState, div: 'TOP14' | 'PRO_D2'): readonly ClubId[] =>
  clubsOfDivision(state, div);

describe('les clubs de Pro D2', () => {
  it('en fournit seize, comme la vraie Pro D2', () => {
    // Deux de plus que le Top 14, donc quatre journées de plus : une saison de
    // deuxième division est plus longue, et c'est une part de ce qui rend la
    // remontée difficile.
    expect(PROD2).toHaveLength(PRO_D2_CLUBS);
    expect(PRO_D2_CLUBS).toBeGreaterThan(TOP14_CLUBS);
  });

  it('les fabrique nettement plus pauvres', () => {
    // Sans cet écart, descendre ne serait pas une sanction.
    const richestD2 = Math.max(...PROD2.map(c => c.annualBudget));
    expect(richestD2).toBeLessThan(TOP14[0]!.annualBudget);
    expect(PROD2.every(c => c.tier === 'PETIT_BUDGET')).toBe(true);
  });

  it('les rend stables d\'un appel à l\'autre', () => {
    // Un club battu en Pro D2 doit être le même quand on le retrouve trois
    // saisons plus tard : le module d'origine les tirait au hasard chaque année.
    expect(buildProD2Clubs().map(c => c.id)).toEqual(PROD2.map(c => c.id));
  });
});

describe('répartition', () => {
  it('situe chaque club à son étage', () => {
    expect(divisionOf(STATE, TOP14[0]!.id)).toBe('TOP14');
    expect(divisionOf(STATE, PROD2[0]!.id)).toBe('PRO_D2');
  });

  it('échange un descendant contre un montant', () => {
    const next = exchangeClubs(STATE, [TOP14[13]!.id], [PROD2[0]!.id]);
    expect(divisionOf(next, TOP14[13]!.id)).toBe('PRO_D2');
    expect(divisionOf(next, PROD2[0]!.id)).toBe('TOP14');
  });

  it('garde chaque division à son effectif, quoi qu\'on lui donne', () => {
    // Un déséquilibre casserait le calendrier round-robin, qui exige un
    // effectif pair — la saison suivante ne se construirait plus.
    const desequilibre = exchangeClubs(STATE, [TOP14[13]!.id, TOP14[12]!.id], [PROD2[0]!.id]);
    expect(desequilibre.top14).toHaveLength(TOP14_CLUBS);
    expect(desequilibre.proD2).toHaveLength(PRO_D2_CLUBS);
  });

  it('ne bouge rien quand il n\'y a rien à échanger', () => {
    expect(exchangeClubs(STATE, [], [PROD2[0]!.id])).toBe(STATE);
  });
});

describe('le championnat qu\'on ne joue pas', () => {
  const strong = new Map(PROD2.map((c, i) => [c.id as string, 70 - i * 2]));
  const strengthOf = (id: ClubId): number => strong.get(id as string) ?? 50;

  it('classe du premier au dernier sans trou', () => {
    const table = shadowSeason(PROD2.map(c => c.id), strengthOf, createRng('s'));
    expect(table.map(r => r.rank)).toEqual(PROD2.map((_, i) => i + 1));
  });

  it('est déterministe pour une même graine', () => {
    const a = shadowSeason(PROD2.map(c => c.id), strengthOf, shadowRng('x', 2026, 'PRO_D2'));
    const b = shadowSeason(PROD2.map(c => c.id), strengthOf, shadowRng('x', 2026, 'PRO_D2'));
    expect(a).toEqual(b);
  });

  it('laisse place à la surprise', () => {
    // Un championnat où le plus fort finit toujours premier n'a aucun intérêt :
    // le manager relégué saurait dès août qui il doit battre.
    let upsets = 0;
    for (let i = 0; i < 60; i++) {
      const table = shadowSeason(PROD2.map(c => c.id), strengthOf, createRng(`u${i}`));
      if (table[0]!.clubId !== PROD2[0]!.id) upsets++;
    }
    expect(upsets).toBeGreaterThan(5);
    expect(upsets).toBeLessThan(55);
  });
});

describe('montées et descentes', () => {
  const top14Ranking = TOP14.map(c => c.id);
  const proD2Ranking = PROD2.map(c => c.id);

  it('fait descendre le dernier et monter le champion', () => {
    const out = resolvePromotions(
      { top14Ranking, proD2Ranking, strengthOf: () => 60 }, createRng('p'),
    );
    expect(out.relegated).toContain(top14Ranking[13]);
    expect(out.promoted).toContain(proD2Ranking[0]);
  });

  it('joue toujours le barrage du treizième', () => {
    const out = resolvePromotions(
      { top14Ranking, proD2Ranking, strengthOf: () => 60 }, createRng('b'),
    );
    expect(out.barrage).toBeDefined();
    expect(out.barrage!.top14ClubId).toBe(top14Ranking[12]);
    expect(out.barrage!.challengerId).toBe(proD2Ranking[1]);
  });

  it('ne conclut jamais le barrage sur un score nul', () => {
    // Un barrage nul laisserait la question ouverte et bloquerait l'échange.
    for (let i = 0; i < 80; i++) {
      const out = resolvePromotions(
        { top14Ranking, proD2Ranking, strengthOf: () => 55 }, createRng(`n${i}`),
      );
      expect(out.barrage!.top14Score).not.toBe(out.barrage!.challengerScore);
    }
  });

  it('descend deux clubs quand le barrage est perdu, un seul sinon', () => {
    for (let i = 0; i < 40; i++) {
      const out = resolvePromotions(
        { top14Ranking, proD2Ranking, strengthOf: () => 55 }, createRng(`c${i}`),
      );
      expect(out.relegated).toHaveLength(out.barrage!.top14Survives ? 1 : 2);
      expect(out.promoted).toHaveLength(out.relegated.length);
    }
  });

  it('donne sa chance au deuxième de Pro D2', () => {
    // Si le treizième gagnait toujours, le barrage ne serait qu'une formalité
    // et le bas de tableau n'aurait aucun enjeu.
    let challengerWins = 0;
    for (let i = 0; i < 80; i++) {
      const out = resolvePromotions(
        { top14Ranking, proD2Ranking, strengthOf: id => (id === proD2Ranking[1] ? 58 : 55) },
        createRng(`w${i}`),
      );
      if (!out.barrage!.top14Survives) challengerWins++;
    }
    expect(challengerWins).toBeGreaterThan(10);
  });

  it('ne fait rien sur un classement incomplet', () => {
    const out = resolvePromotions(
      { top14Ranking: top14Ranking.slice(0, 5), proD2Ranking, strengthOf: () => 60 },
      createRng('short'),
    );
    expect(out.relegated).toEqual([]);
    expect(out.promoted).toEqual([]);
  });

  it('produit un échange que la répartition accepte', () => {
    // Le bout en bout : ce que décide le format doit se traduire en deux
    // divisions valides.
    const out = resolvePromotions(
      { top14Ranking, proD2Ranking, strengthOf: () => 55 }, createRng('e2e'),
    );
    const next = exchangeClubs(STATE, out.relegated, out.promoted);
    expect(next.top14).toHaveLength(TOP14_CLUBS);
    expect(next.proD2).toHaveLength(PRO_D2_CLUBS);
    expect(new Set([...next.top14, ...next.proD2]).size).toBe(TOP14_CLUBS + PRO_D2_CLUBS);
    expect(ranking(next, 'TOP14')).not.toContain(out.relegated[0]);
  });
});
