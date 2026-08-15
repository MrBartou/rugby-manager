/**
 * Le marché international (V0.63).
 *
 * Le défaut corrigé : le recrutement se faisait dans un pays fermé, où tout le
 * monde était JIFF. Un quota qui exige la moitié de joueurs formés en France
 * n'a alors aucune force contraignante.
 *
 * Ce qui est vérifié ici : les recrues sont bien étrangères et pèsent sur le
 * quota, les trois portes d'une offre se ferment chacune pour sa raison, et
 * vendre à l'étranger a un prix : la sélection.
 */

import { describe, expect, it } from 'vitest';
import {
  askingPriceFor,
  bidForInternationalTarget,
  generateForeignInterest,
  generateInternationalTargets,
  jiffImpact,
  reachableTargets,
  salaryDemandFor,
  sendAbroad,
  type InternationalTarget,
} from '../../src/engine/club/international-market.js';
import { createEuropeanWorld } from '../../src/engine/season/european-world.js';
import { isEligible } from '../../src/engine/season/national-team.js';
import { makeSquad } from './fixtures.js';
import type { Club, ClubId, Player } from '../../src/engine/types.js';

const SEASON = 2026;
const WORLD = createEuropeanWorld('m', SEASON);

const club = (reputation: number): Club => ({
  id: 'c1' as ClubId,
  name: 'Club test',
  shortName: 'CTS',
  city: 'Ville',
  tier: 'BUDGET_MOYEN',
  tacticalIdentity: 'MIXTE',
  stadiumCapacity: 15_000,
  annualBudget: 12_000_000,
  salaryCapUsage: 0,
  jiffCount: 0,
  reputation,
});

function cibles(): readonly InternationalTarget[] {
  return generateInternationalTargets({
    world: WORLD, currentSeason: SEASON, seed: 'g', window: 'ETE',
  });
}

describe('le vivier étranger', () => {
  it('ne propose que des non-JIFF, et toujours les mêmes', () => {
    const premier = cibles();
    expect(premier.length).toBeGreaterThan(5);
    expect(premier.every(t => !t.player.isJiff)).toBe(true);
    // Deux chargements de la même partie proposent les mêmes hommes.
    expect(cibles().map(t => t.player.id)).toEqual(premier.map(t => t.player.id));
  });

  it('l\'hiver offre moins de monde que l\'été', () => {
    const hiver = generateInternationalTargets({
      world: WORLD, currentSeason: SEASON, seed: 'g', window: 'HIVER',
    });
    expect(hiver.length).toBeLessThan(cibles().length);
  });

  it('nomme le club d\'origine', () => {
    expect(cibles().every(t => t.fromClubName.length > 0)).toBe(true);
  });

  it('un joueur plus fort coûte plus cher, un joueur vieillissant moins', () => {
    expect(askingPriceFor(80, 25)).toBeGreaterThan(askingPriceFor(66, 25));
    expect(askingPriceFor(80, 33)).toBeLessThan(askingPriceFor(80, 25));
    expect(salaryDemandFor(80, 25)).toBeGreaterThan(salaryDemandFor(66, 25));
  });

  it('une recrue étrangère abaisse le ratio JIFF de l\'effectif', () => {
    const roster = makeSquad('c1' as ClubId, 70).players
      .map<Player>(p => ({ ...p, isJiff: true }));
    const impact = jiffImpact(roster, 3);
    expect(impact.currentRatio).toBe(1);
    expect(impact.afterRatio).toBeLessThan(impact.currentRatio);
  });
});

describe('les trois portes d\'une offre', () => {
  const cible = (): InternationalTarget => cibles()[0]!;

  it('le club vendeur veut son indemnité', () => {
    const t = cible();
    const r = bidForInternationalTarget({
      target: t,
      bid: { transferFee: t.askingPrice - 1, annualSalary: t.salaryDemand, years: 3 },
      buyingClub: club(90),
      currentSeason: SEASON,
      round: 1,
      seed: 's',
    });
    expect(r.kind).toBe('REFUSE');
    if (r.kind === 'REFUSE') expect(r.reason).toContain(t.fromClubName);
  });

  it('le joueur veut son salaire', () => {
    const t = cible();
    const r = bidForInternationalTarget({
      target: t,
      bid: { transferFee: t.askingPrice, annualSalary: t.salaryDemand - 1, years: 3 },
      buyingClub: club(90),
      currentSeason: SEASON,
      round: 1,
      seed: 's',
    });
    expect(r.kind).toBe('REFUSE');
  });

  it('et il veut un club à sa hauteur : l\'argent ne suffit pas', () => {
    const t = [...cibles()].sort((a, b) => b.minimumReputation - a.minimumReputation)[0]!;
    const r = bidForInternationalTarget({
      target: t,
      // Trois fois le prix demandé, et un club de bas de tableau.
      bid: { transferFee: t.askingPrice * 3, annualSalary: t.salaryDemand * 3, years: 3 },
      buyingClub: club(t.minimumReputation - 5),
      currentSeason: SEASON,
      round: 1,
      seed: 's',
    });
    expect(r.kind).toBe('REFUSE');
  });

  it('les trois franchies, il signe : non-JIFF, et fraîchement arrivé', () => {
    // Le dernier filtre tient à l'homme : on essaie plusieurs cibles.
    const acceptee = cibles()
      .map(t => ({
        t,
        r: bidForInternationalTarget({
          target: t,
          bid: {
            transferFee: t.askingPrice,
            annualSalary: Math.round(t.salaryDemand * 1.3),
            years: 3,
          },
          buyingClub: club(95),
          currentSeason: SEASON,
          round: 7,
          seed: 's',
        }),
      }))
      .find(x => x.r.kind === 'ACCEPT');

    expect(acceptee).toBeDefined();
    if (acceptee?.r.kind !== 'ACCEPT') return;
    const recrue = acceptee.r.updatedPlayer;
    expect(recrue.clubId).toBe('c1');
    expect(recrue.isJiff).toBe(false);
    expect(recrue.contract.endSeason).toBe(SEASON + 3);
    // Il arrive sans repères : l'acclimatation le sait.
    expect(recrue.dynamic.joinedAtRound).toBe(7);
  });

  it('un club modeste ne voit qu\'une partie du marché', () => {
    const toutes = cibles();
    const modeste = reachableTargets(toutes, club(40));
    const grand = reachableTargets(toutes, club(95));
    expect(modeste.length).toBeLessThan(grand.length);
  });
});

describe('vendre à l\'étranger', () => {
  it('un départ hors de France coûte le maillot bleu', () => {
    const joueur: Player = { ...makeSquad('c1' as ClubId, 78).players[0]!, isJiff: true };
    expect(isEligible(joueur, SEASON)).toBe(true);
    const parti = sendAbroad(joueur, 'eu_ballymore' as ClubId, SEASON, 3, 400_000);
    expect(parti.abroad).toBe(true);
    expect(parti.clubId).toBe('eu_ballymore');
    expect(isEligible(parti, SEASON)).toBe(false);
  });

  it('les clubs européens paient au-dessus du marché français', () => {
    const roster = makeSquad('c1' as ClubId, 82).players.map<Player>(p => ({
      ...p,
      contract: { startSeason: SEASON, endSeason: SEASON + 2, annualSalary: 300_000 },
    }));
    // L'intérêt est rare : on balaie les journées jusqu'à en trouver un.
    let offre;
    for (let round = 1; round <= 60 && !offre; round++) {
      offre = generateForeignInterest({
        playerClubId: 'c1' as ClubId,
        roster,
        world: WORLD,
        round,
        currentSeason: SEASON,
        seed: 'v',
      })[0];
    }
    expect(offre).toBeDefined();
    if (!offre) return;
    // Deux ans de contrat restants à 300 k€ : au moins quatre fois le salaire.
    expect(offre.transferAmount).toBeGreaterThan(300_000 * 2 * 2);
    expect(offre.proposedAnnualSalary).toBeGreaterThan(300_000);
    expect(WORLD.clubs.some(c => c.id === offre.fromClubId)).toBe(true);
  });

  it('personne ne vient chercher un joueur déjà parti', () => {
    const roster = makeSquad('c1' as ClubId, 85).players.map<Player>(p => ({ ...p, abroad: true }));
    for (let round = 1; round <= 40; round++) {
      expect(generateForeignInterest({
        playerClubId: 'c1' as ClubId,
        roster,
        world: WORLD,
        round,
        currentSeason: SEASON,
        seed: 'v',
      })).toHaveLength(0);
    }
  });
});
