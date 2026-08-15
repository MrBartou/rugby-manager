/**
 * Les clauses du contrat : V0.64.
 *
 * Le contrat n'avait que deux chiffres, un salaire et une durée : négocier
 * revenait à pousser un curseur. Ce qui est vérifié ici, c'est que les clauses
 * ajoutées ouvrent de vrais arbitrages, et pas une martingale.
 *
 * Le point le plus important du fichier est le dernier : **une prime ne doit
 * jamais valoir plus qu'un euro garanti**. Le jour où elle vaudrait autant,
 * charger les primes permettrait de signer tout le championnat sans masse
 * salariale, et la contrainte financière du jeu tomberait.
 */

import { describe, expect, it } from 'vitest';
import {
  MAX_SELL_ON,
  averageSalary,
  bonusConfidence,
  bonusPayout,
  clampReleaseClause,
  exerciseOption,
  expectedEarningsForPlayer,
  optionPending,
  perceivedContractValue,
  projectedBonusCost,
  releaseClauseMet,
  salaryForSeason,
  sellOnDue,
} from '../../src/engine/club/contract-clauses.js';
import { makeSquad } from './fixtures.js';
import type { ClubId, Contract, Player } from '../../src/engine/types.js';

const SQUAD = makeSquad('c1' as ClubId, 70);
const BASE = SQUAD.players[0]!;

const contrat = (over: Partial<Contract> = {}): Contract => ({
  startSeason: 2025,
  endSeason: 2028,
  annualSalary: 200_000,
  ...over,
});

const joueur = (over: Partial<Player> = {}): Player => ({ ...BASE, ...over });

describe('le salaire en vigueur', () => {
  it('sans progression, c\'est le salaire signé, toutes saisons confondues', () => {
    const c = contrat();
    expect(salaryForSeason(c, 2025)).toBe(200_000);
    expect(salaryForSeason(c, 2028)).toBe(200_000);
  });

  it('la progression s\'applique une fois par année écoulée', () => {
    const c = contrat({ salaryProgression: 0.10 });
    expect(salaryForSeason(c, 2025)).toBe(200_000);
    expect(salaryForSeason(c, 2026)).toBe(220_000);
    expect(salaryForSeason(c, 2027)).toBe(242_000);
  });

  it('elle s\'arrête à la fin du contrat, elle ne court pas dans le vide', () => {
    const c = contrat({ salaryProgression: 0.10 });
    expect(salaryForSeason(c, 2032)).toBe(salaryForSeason(c, 2028));
  });

  it('le salaire moyen tient compte de la progression', () => {
    const plat = contrat();
    const montant = contrat({ salaryProgression: 0.10 });
    expect(averageSalary(plat)).toBe(200_000);
    expect(averageSalary(montant)).toBeGreaterThan(220_000);
  });
});

describe('les primes', () => {
  it('se paient au déclencheur', () => {
    const c = contrat({ bonuses: { perMatch: 4_000, perTry: 6_000, perCap: 20_000 } });
    expect(bonusPayout(c, { matches: 20, tries: 3, caps: 2 })).toBe(
      20 * 4_000 + 3 * 6_000 + 2 * 20_000,
    );
  });

  it('un contrat sans clause ne coûte rien de plus', () => {
    expect(bonusPayout(contrat(), { matches: 26, tries: 10, caps: 5 })).toBe(0);
  });

  it('le prévisionnel ignore les retraités et les agents libres', () => {
    const actif = joueur({ contract: contrat({ bonuses: { perMatch: 5_000 } }) });
    const parti = joueur({ id: 'x' as Player['id'], freeAgent: true, contract: contrat({ bonuses: { perMatch: 5_000 } }) });
    const total = projectedBonusCost([actif, parti], () => ({ matches: 10, tries: 0, caps: 0 }));
    expect(total).toBe(50_000);
  });

  it('un trois-quarts espère plus d\'essais qu\'un pilier', () => {
    const ailier = joueur({ position: 'AILIER_DROIT' });
    const pilier = joueur({ position: 'PILIER_GAUCHE' });
    const arg = { expectedPlayRatio: 1, roundsInSeason: 26 };
    expect(expectedEarningsForPlayer({ player: ailier, ...arg }).tries)
      .toBeGreaterThan(expectedEarningsForPlayer({ player: pilier, ...arg }).tries);
  });

  it('un joueur qui ne joue pas n\'espère pas de prime de match', () => {
    const e = expectedEarningsForPlayer({
      player: joueur(), expectedPlayRatio: 0, roundsInSeason: 26,
    });
    expect(e.matches).toBe(0);
    expect(e.tries).toBe(0);
  });
});

describe('ce qu\'une prime vaut au joueur', () => {
  it('un ambitieux au sang-froid mise sur lui-même plus qu\'un prudent', () => {
    const ambitieux = joueur({
      hidden: { ...BASE.hidden, ambition: 95 },
      mental: { ...BASE.mental, sangFroid: 90 },
    });
    const prudent = joueur({
      hidden: { ...BASE.hidden, ambition: 20 },
      mental: { ...BASE.mental, sangFroid: 30 },
    });
    expect(bonusConfidence(ambitieux)).toBeGreaterThan(bonusConfidence(prudent));
  });

  it('mais personne ne préfère la prime au salaire garanti', () => {
    // La règle qui protège la contrainte financière : la décote reste sous 1
    // même pour le joueur le plus téméraire du championnat.
    const temeraire = joueur({
      hidden: { ...BASE.hidden, ambition: 100 },
      mental: { ...BASE.mental, sangFroid: 100 },
    });
    expect(bonusConfidence(temeraire)).toBeLessThan(1);

    const garanti = contrat({ annualSalary: 300_000 });
    const primes = contrat({ annualSalary: 200_000, bonuses: { perMatch: 5_000 } });
    const earnings = { matches: 20, tries: 0, caps: 0 };   // 100 000 € de primes
    const value = (c: Contract) => perceivedContractValue({
      player: temeraire, contract: c, earnings, marketValue: 2_000_000,
    });
    expect(value(primes)).toBeLessThan(value(garanti));
  });

  it('une clause libératoire basse rend le contrat plus attirant', () => {
    const earnings = { matches: 0, tries: 0, caps: 0 };
    const value = (releaseClause?: number) => perceivedContractValue({
      player: joueur(),
      contract: contrat(releaseClause === undefined ? {} : { releaseClause }),
      earnings,
      marketValue: 2_000_000,
    });
    expect(value(2_200_000)).toBeGreaterThan(value(undefined));
    expect(value(2_200_000)).toBeGreaterThan(value(5_000_000));
  });

  it('une option tenue par le club se paie, une option tenue par le joueur se vend', () => {
    const earnings = { matches: 0, tries: 0, caps: 0 };
    const value = (holder: 'CLUB' | 'JOUEUR') => perceivedContractValue({
      player: joueur(),
      contract: contrat({ option: { years: 1, annualSalary: 220_000, holder } }),
      earnings,
      marketValue: 2_000_000,
    });
    expect(value('JOUEUR')).toBeGreaterThan(value('CLUB'));
  });
});

describe('la clause libératoire', () => {
  it('ne se déclenche qu\'atteinte, et un contrat sans clause ne se déclenche jamais', () => {
    const c = contrat({ releaseClause: 3_000_000 });
    expect(releaseClauseMet(c, 2_999_999)).toBe(false);
    expect(releaseClauseMet(c, 3_000_000)).toBe(true);
    expect(releaseClauseMet(contrat(), 50_000_000)).toBe(false);
  });

  it('un club ne brade pas son joueur par contrat', () => {
    expect(clampReleaseClause(2_000_000, 500_000)).toBe(2_200_000);
    expect(clampReleaseClause(2_000_000, 6_000_000)).toBe(6_000_000);
  });
});

describe('l\'année en option', () => {
  it('se lève une fois, et prolonge au salaire convenu', () => {
    const c = contrat({ endSeason: 2027, option: { years: 1, annualSalary: 260_000, holder: 'CLUB' } });
    const leve = exerciseOption(c, 2027);
    expect(leve.endSeason).toBe(2028);
    expect(leve.annualSalary).toBe(260_000);
    expect(leve.optionExercised).toBe(true);
    // La seconde levée ne doit rien prolonger de plus.
    expect(exerciseOption(leve, 2028)).toEqual(leve);
  });

  it('ne se décide que la dernière année du contrat', () => {
    const c = contrat({ endSeason: 2028, option: { years: 1, annualSalary: 260_000, holder: 'CLUB' } });
    expect(optionPending(c, 2026)).toBe(false);
    expect(optionPending(c, 2028)).toBe(true);
    expect(optionPending(contrat(), 2028)).toBe(false);
  });
});

describe('le pourcentage à la revente', () => {
  const revente = (percent: number, fee: number): number => sellOnDue(
    contrat({ sellOn: { beneficiaryClubId: 'ancien' as ClubId, percent } }),
    fee,
  );

  it('se prélève sur l\'indemnité de la revente', () => {
    expect(revente(0.15, 4_000_000)).toBe(600_000);
  });

  it('se plafonne, sinon plus personne n\'achète le joueur', () => {
    expect(revente(0.90, 4_000_000)).toBe(4_000_000 * MAX_SELL_ON);
  });

  it('un contrat sans clause ne doit rien à personne', () => {
    expect(sellOnDue(contrat(), 4_000_000)).toBe(0);
  });
});
