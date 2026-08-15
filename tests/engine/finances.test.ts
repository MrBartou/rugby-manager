/**
 * Tests V0.6 phase 2 — finances club.
 */

import { describe, it, expect } from 'vitest';
import {
  applyMovement,
  closeSeason,
  computeAnnualPayroll,
  closeSeasonForAllClubs,
  computeRoundPayroll,
  emptyFinances,
  initFinancesForAllClubs,
  REGULAR_ROUNDS,
} from '@/engine/club/finances.js';
import type { ClubFinances } from '@/engine/club/finances.js';
import type { Club, ClubId, Player, PlayerId } from '@/engine/types.js';

function makeClub(overrides: Partial<Club> = {}): Club {
  return {
    id: 'club_test' as ClubId,
    name: 'Test',
    shortName: 'TST',
    city: 'Test',
    tier: 'BUDGET_MOYEN',
    tacticalIdentity: 'MIXTE',
    stadiumCapacity: 20_000,
    annualBudget: 12_000_000,
    salaryCapUsage: 0,
    jiffCount: 0,
    reputation: 60,
    ...overrides,
  };
}

function makePlayer(salary: number, opts: Partial<Player> = {}): Player {
  return {
    id: ('p_' + salary) as PlayerId,
    clubId: 'club_test' as ClubId,
    firstName: 'P', lastName: String(salary), birthDate: '2000-01-01',
    position: 'OUVREUR', secondaryPositions: [], isJiff: true,
    technical: {
      passe: 70, plaquage: 70, jeuAuPiedPlace: 70, jeuAuPiedDynamique: 70,
      visionDeJeu: 70, conservation: 70, prisedeballeHaute: 70, deblayage: 70,
    },
    physical: { vitesse: 70, puissance: 70, endurance: 70, detente: 70, robustesse: 70 },
    mental: {
      decision: 70, leadership: 70, sangFroid: 70, agressivite: 70,
      professionnalisme: 70, discipline: 70,
    },
    positionSpecific: {}, traits: [],
    hidden: { potentiel: 70, ambition: 50, determinisme: 50, loyaute: 60, adaptabilite: 50 },
    dynamic: { forme: 70, fatigue: 0, mood: 60, moodModifiers: [] },
    contract: { startSeason: 2025, endSeason: 2027, annualSalary: salary },
    ...opts,
  };
}

describe('finances — calculs', () => {
  it('payroll annuel = somme des salaires actifs', () => {
    const players = [makePlayer(100_000), makePlayer(200_000), makePlayer(300_000)];
    expect(computeAnnualPayroll(players, 2025)).toBe(600_000);
  });

  it('payroll exclut les retraités', () => {
    const players = [
      makePlayer(100_000),
      makePlayer(500_000, { retired: true }),
    ];
    expect(computeAnnualPayroll(players, 2025)).toBe(100_000);
  });

  it('payroll par journée = annuel / 26', () => {
    const players = [makePlayer(2_600_000)];
    expect(computeRoundPayroll(players, 2025)).toBe(2_600_000 / REGULAR_ROUNDS);
  });

  it('la Pro D2 étale le même salaire sur ses trente journées', () => {
    // V0.60 : le 26 en dur ne facturait que 26 des 30 journées de Pro D2, soit
    // 15 % de masse salariale offerte à toute la division.
    const players = [makePlayer(3_000_000)];
    expect(computeRoundPayroll(players, 2025, 30)).toBe(100_000);
    expect(computeRoundPayroll(players, 2025, 30) * 30).toBe(3_000_000);
  });

  it('un salaire progressif coûte plus cher la quatrième année que la première', () => {
    // V0.64 : la masse salariale lit le salaire **en vigueur**. Sans cela, un
    // contrat qui monte de 8 % par an aurait été facturé au tarif de sa
    // signature pendant toute sa durée, et la progression n'aurait été qu'un
    // argument de négociation gratuit.
    const players = [makePlayer(200_000, {
      contract: { startSeason: 2025, endSeason: 2029, annualSalary: 200_000, salaryProgression: 0.08 },
    })];
    expect(computeAnnualPayroll(players, 2025)).toBe(200_000);
    expect(computeAnnualPayroll(players, 2028)).toBeGreaterThan(250_000);
  });

  it('et un nombre de journées absurde retombe sur la valeur par défaut', () => {
    const players = [makePlayer(2_600_000)];
    expect(computeRoundPayroll(players, 2025, 0)).toBe(computeRoundPayroll(players, 2025));
  });

  // V0.60 : la billetterie a quitté ce fichier. Elle vivait ici pour les clubs
  // IA et dans `club-management.ts` pour le club dirigé, avec des taux de
  // remplissage et un prix du billet différents. Elle est désormais testée là
  // où elle est calculée, une fois, pour tout le monde.
});

describe('finances — mutations', () => {
  it('applyMovement crédite revenue et balance', () => {
    const f0 = emptyFinances(2025, 1_000_000);
    const f1 = applyMovement(f0, { kind: 'SPONSOR', amount: 5_000_000 });
    expect(f1.balance).toBe(6_000_000);
    expect(f1.seasonRevenue).toBe(5_000_000);
    expect(f1.seasonExpenses).toBe(0);
  });

  it('applyMovement débit (négatif) impacte expenses, pas revenue', () => {
    const f0 = emptyFinances(2025, 1_000_000);
    const f1 = applyMovement(f0, { kind: 'PAYROLL', amount: -200_000 });
    expect(f1.balance).toBe(800_000);
    expect(f1.seasonExpenses).toBe(200_000);
    expect(f1.seasonRevenue).toBe(0);
  });

  it('closeSeason archive le bilan et reset compteurs', () => {
    let f = emptyFinances(2025, 0);
    f = applyMovement(f, { kind: 'SPONSOR', amount: 10_000_000 });
    f = applyMovement(f, { kind: 'PAYROLL', amount: -8_000_000 });
    const closed = closeSeason(f, 2026);
    expect(closed.seasonStart).toBe(2026);
    expect(closed.seasonRevenue).toBe(0);
    expect(closed.seasonExpenses).toBe(0);
    expect(closed.balance).toBe(2_000_000);
    expect(closed.pastSeasons).toHaveLength(1);
    expect(closed.pastSeasons[0]).toEqual({
      seasonStart: 2025,
      revenue: 10_000_000,
      expenses: 8_000_000,
      closingBalance: 2_000_000,
    });
  });
});

describe('finances — initialisation', () => {
  it('initFinancesForAllClubs crée une entrée par club avec sponsor encaissé', () => {
    const clubs = [
      makeClub({ id: 'a' as ClubId, annualBudget: 10_000_000 }),
      makeClub({ id: 'b' as ClubId, annualBudget: 20_000_000 }),
    ];
    const map = initFinancesForAllClubs(clubs, 2025);
    expect(map.size).toBe(2);
    const a = map.get('a' as ClubId)!;
    // Solde initial = 30% budget + sponsor (= budget) = 1.3 * budget
    expect(a.balance).toBe(13_000_000);
    expect(a.seasonRevenue).toBe(10_000_000);
  });
});

describe('la clôture d\'exercice, pour tout le championnat', () => {
  const club = (id: string, budget: number): Club =>
    makeClub({ id: id as ClubId, annualBudget: budget });

  const depart = (solde: number): ClubFinances => ({
    balance: solde,
    seasonStart: 2026,
    seasonRevenue: 1_000_000,
    seasonExpenses: 400_000,
    pastSeasons: [],
  });

  const entree = (over: Partial<Parameters<typeof closeSeasonForAllClubs>[0]> = {}) => ({
    previous: new Map([
      ['mine' as ClubId, depart(5_000_000)],
      ['autre' as ClubId, depart(3_000_000)],
    ]),
    clubs: [club('mine', 10_000_000), club('autre', 8_000_000)],
    playerClubId: 'mine' as ClubId,
    newSeason: 2027,
    playerClubCommercial: { sponsors: 12_000_000, merchandising: 900_000, campaignCost: 600_000 },
    ...over,
  });

  it('clôt la saison de chaque club', () => {
    const out = closeSeasonForAllClubs(entree());
    for (const f of out.values()) {
      expect(f.seasonStart).toBe(2027);
      expect(f.pastSeasons).toHaveLength(1);
    }
  });

  it('le club dirigé encaisse selon sa politique commerciale', () => {
    // Sans cette asymétrie, la direction du club serait un écran de réglages
    // sans conséquence : investir en marketing ne rapporterait rien.
    const out = closeSeasonForAllClubs(entree());
    const mine = out.get('mine' as ClubId)!;
    expect(mine.balance).toBe(5_000_000 + 12_000_000 + 900_000 - 600_000);
  });

  it('les autres gardent l\'enveloppe sèche de leur budget', () => {
    const out = closeSeasonForAllClubs(entree());
    expect(out.get('autre' as ClubId)!.balance).toBe(3_000_000 + 8_000_000);
  });

  it('une campagne à zéro ne débite rien', () => {
    const out = closeSeasonForAllClubs(entree({
      playerClubCommercial: { sponsors: 10_000_000, merchandising: 0, campaignCost: 0 },
    }));
    expect(out.get('mine' as ClubId)!.balance).toBe(5_000_000 + 10_000_000);
  });

  it('et un club absent de la liste ne ressort pas', () => {
    // Un club relégué hors du monde connu ne doit pas réapparaître par la
    // clôture : on ne sait plus quel budget lui appliquer.
    const out = closeSeasonForAllClubs(entree({ clubs: [club('mine', 10_000_000)] }));
    expect([...out.keys()]).toEqual(['mine']);
  });
});
