/**
 * La surenchère — V0.64.
 *
 * Le manager négociait seul au monde depuis la V0.6. Ce que les tests
 * protègent : un concurrent ne se déplace que pour un joueur qui en vaut la
 * peine, il ne se déplace pas pour un poste qu'il a déjà couvert, et à
 * conditions égales le joueur reste avec celui qui l'a courtisé le premier.
 */

import { describe, expect, it } from 'vitest';
import {
  findChallenger,
  interestLevel,
  interestedClubs,
  resolveChallenge,
} from '../../src/engine/club/bidding-war.js';
import { createRng } from '../../src/engine/rng.js';
import { makeSquad } from './fixtures.js';
import type { Club, ClubId, Player } from '../../src/engine/types.js';

const SEASON = 2026;

const club = (id: string, budget = 25_000_000): Club => ({
  id: id as ClubId, name: `Club ${id}`, shortName: id.toUpperCase(), city: 'Ville',
  tier: 'BUDGET_MOYEN', tacticalIdentity: 'MIXTE',
  stadiumCapacity: 15_000, annualBudget: budget,
  salaryCapUsage: 0, jiffCount: 0, reputation: 60,
});

const FORT = makeSquad('vendeur' as ClubId, 82).players;
const FAIBLE = makeSquad('rival' as ClubId, 55).players;
const cible: Player = { ...FORT[9]!, birthDate: '2000-01-01' };

const base = {
  player: cible,
  clubs: [club('vendeur'), club('nous'), club('rival')],
  ownClubId: 'nous' as ClubId,
  currentSeason: SEASON,
  rosterOf: (id: ClubId) => (id === 'vendeur' ? FORT : FAIBLE),
};

describe('qui suit la cible', () => {
  it('ni nous, ni le club qui la vend', () => {
    const ids = interestedClubs(base).map(c => c.id);
    expect(ids).not.toContain('nous');
    expect(ids).not.toContain('vendeur');
  });

  it('un club déjà pourvu au poste ne bouge pas', () => {
    const pourvu = { ...base, rosterOf: () => FORT };
    expect(interestLevel(pourvu)).toBe(0);
  });

  it('un club qui ne peut pas porter le salaire ne bouge pas non plus', () => {
    const pauvre = {
      ...base,
      clubs: [club('vendeur'), club('nous'), club('rival', 100_000)],
    };
    expect(interestLevel(pauvre)).toBe(0);
  });

  it('sinon il se manifeste, et le manager le sait avant de miser', () => {
    expect(interestLevel(base)).toBe(1);
  });
});

describe('le concurrent qui s\'aligne', () => {
  const challengeArgs = {
    player: cible,
    candidates: [club('rival')],
    currentSeason: SEASON,
    rankOf: () => 4,
    reputationRankOf: () => 4,
  };

  it('se présente parfois sur un joueur de haut niveau', () => {
    const tirages = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
      .map(s => findChallenger({ ...challengeArgs, rng: createRng(s) }))
      .filter(c => c !== undefined);
    expect(tirages.length).toBeGreaterThan(0);
  });

  it('jamais sur un joueur qui n\'intéresse personne', () => {
    const modeste: Player = { ...FAIBLE[9]!, birthDate: '1990-01-01' };
    const tirages = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
      .map(s => findChallenger({ ...challengeArgs, player: modeste, rng: createRng(s) }))
      .filter(c => c !== undefined);
    expect(tirages).toHaveLength(0);
  });

  it('et jamais quand personne ne suit', () => {
    expect(findChallenger({ ...challengeArgs, candidates: [], rng: createRng('x') }))
      .toBeUndefined();
  });
});

describe('le choix du joueur', () => {
  const challenge = {
    clubId: 'rival' as ClubId, clubName: 'Rival', annualSalary: 400_000, years: 3, rank: 6,
  };
  const args = {
    challenge, player: cible, totalClubs: 14, ourRank: 6,
  };

  const perte = (over: Record<string, unknown>, seeds = 40): number => {
    let lost = 0;
    for (let i = 0; i < seeds; i++) {
      const res = resolveChallenge({ ...args, ourSalary: 400_000, ...over, rng: createRng(`s${i}`) });
      if (res.lost) lost++;
    }
    return lost / seeds;
  };

  it('à conditions égales, le joueur reste avec celui qui l\'a courtisé', () => {
    expect(perte({})).toBeLessThan(0.35);
  });

  it('un salaire nettement supérieur emporte la mise', () => {
    expect(perte({ ourSalary: 250_000 })).toBeGreaterThan(0.8);
  });

  it('un club nettement mieux classé aussi', () => {
    expect(perte({ challenge: { ...challenge, rank: 1 }, ourRank: 13 })).toBeGreaterThan(0.6);
  });

  it('et le refus dit lequel des deux arguments a pesé', () => {
    const res = resolveChallenge({ ...args, ourSalary: 200_000, rng: createRng('r') });
    expect(res.lost).toBe(true);
    expect(res.reason).toMatch(/propose davantage/);
  });
});
