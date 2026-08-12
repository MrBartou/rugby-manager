/**
 * Tests V0.6 phase 2 — finances club.
 */

import { describe, it, expect } from 'vitest';
import {
  applyMovement,
  closeSeason,
  computeAnnualPayroll,
  computeMatchRevenue,
  computeRoundPayroll,
  emptyFinances,
  initFinancesForAllClubs,
  REGULAR_ROUNDS,
} from '@/engine/club/finances.js';
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
    expect(computeAnnualPayroll(players)).toBe(600_000);
  });

  it('payroll exclut les retraités', () => {
    const players = [
      makePlayer(100_000),
      makePlayer(500_000, { retired: true }),
    ];
    expect(computeAnnualPayroll(players)).toBe(100_000);
  });

  it('payroll par journée = annuel / 26', () => {
    const players = [makePlayer(2_600_000)];
    expect(computeRoundPayroll(players)).toBe(2_600_000 / REGULAR_ROUNDS);
  });

  it('match revenue dépend du tier et du form', () => {
    const small = makeClub({ tier: 'PETIT_BUDGET', stadiumCapacity: 10_000 });
    const big = makeClub({ tier: 'GROS_BUDGET', stadiumCapacity: 30_000 });
    expect(computeMatchRevenue(big, 0.7)).toBeGreaterThan(computeMatchRevenue(small, 0.7));
  });

  it('match revenue augmente avec les victoires', () => {
    const club = makeClub();
    const losing = computeMatchRevenue(club, 0.2);
    const winning = computeMatchRevenue(club, 0.8);
    expect(winning).toBeGreaterThan(losing);
  });
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
