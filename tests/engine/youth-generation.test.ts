/**
 * Tests V0.7 phase 4 — génération de jeunes.
 */

import { describe, it, expect } from 'vitest';
import { defaultAcademyLevel, generateYouthIntake } from '@/engine/club/youth-generation.js';
import type { Club, ClubId } from '@/engine/types.js';

function makeClub(tier: Club['tier'] = 'BUDGET_MOYEN'): Club {
  return {
    id: 'c_test' as ClubId,
    name: 'Test', shortName: 'TST', city: 'Test',
    tier,
    tacticalIdentity: 'MIXTE',
    stadiumCapacity: 20_000,
    annualBudget: 12_000_000,
    salaryCapUsage: 0,
    jiffCount: 0,
    reputation: 60,
  };
}

describe('generateYouthIntake', () => {
  it('produit 3-6 jeunes par promo', () => {
    for (let i = 0; i < 20; i++) {
      const youth = generateYouthIntake({
        club: makeClub(),
        currentSeason: 2025,
        academyLevel: 3,
        seed: `s${i}`,
        existingPlayerIds: new Set(),
      });
      expect(youth.length).toBeGreaterThanOrEqual(3);
      expect(youth.length).toBeLessThanOrEqual(6);
    }
  });

  it('jeunes ont 18-20 ans', () => {
    const youth = generateYouthIntake({
      club: makeClub(),
      currentSeason: 2025,
      academyLevel: 3,
      seed: 'fixed',
      existingPlayerIds: new Set(),
    });
    for (const p of youth) {
      const age = 2025 - Number(p.birthDate.slice(0, 4));
      expect(age).toBeGreaterThanOrEqual(18);
      expect(age).toBeLessThanOrEqual(20);
    }
  });

  it('jeunes sont JIFF', () => {
    const youth = generateYouthIntake({
      club: makeClub(),
      currentSeason: 2025,
      academyLevel: 3,
      seed: 'fixed',
      existingPlayerIds: new Set(),
    });
    expect(youth.every(p => p.isJiff)).toBe(true);
  });

  it('un meilleur centre produit un meilleur potentiel moyen', () => {
    let lowSum = 0;
    let highSum = 0;
    for (let i = 0; i < 30; i++) {
      const low = generateYouthIntake({
        club: makeClub(), currentSeason: 2025, academyLevel: 1,
        seed: `low_${i}`, existingPlayerIds: new Set(),
      });
      const high = generateYouthIntake({
        club: makeClub(), currentSeason: 2025, academyLevel: 5,
        seed: `high_${i}`, existingPlayerIds: new Set(),
      });
      for (const p of low) lowSum += p.hidden.potentiel;
      for (const p of high) highSum += p.hidden.potentiel;
    }
    expect(highSum).toBeGreaterThan(lowSum);
  });

  it('contrat de 3 ans, salaire bas', () => {
    const youth = generateYouthIntake({
      club: makeClub(),
      currentSeason: 2025,
      academyLevel: 3,
      seed: 'fixed',
      existingPlayerIds: new Set(),
    });
    for (const p of youth) {
      expect(p.contract.startSeason).toBe(2025);
      expect(p.contract.endSeason).toBe(2028);
      expect(p.contract.annualSalary).toBeGreaterThanOrEqual(50_000);
      expect(p.contract.annualSalary).toBeLessThanOrEqual(100_000);
    }
  });

  it('IDs uniques (collision avec existants évitée)', () => {
    const conflicting = new Set(['c_test_youth_2025_antoine_martin_0']);
    const youth = generateYouthIntake({
      club: makeClub(),
      currentSeason: 2025,
      academyLevel: 3,
      seed: 'collision_test',
      existingPlayerIds: conflicting,
    });
    for (const p of youth) {
      expect(conflicting.has(p.id as string)).toBe(false);
    }
  });

  it('déterministe par seed', () => {
    const a = generateYouthIntake({
      club: makeClub(), currentSeason: 2025, academyLevel: 3,
      seed: 'same', existingPlayerIds: new Set(),
    });
    const b = generateYouthIntake({
      club: makeClub(), currentSeason: 2025, academyLevel: 3,
      seed: 'same', existingPlayerIds: new Set(),
    });
    expect(a.length).toBe(b.length);
    expect(a[0]!.id).toBe(b[0]!.id);
  });
});

describe('defaultAcademyLevel', () => {
  it('mappe tier → niveau', () => {
    expect(defaultAcademyLevel(makeClub('GROS_BUDGET'))).toBe(4);
    expect(defaultAcademyLevel(makeClub('BUDGET_MOYEN'))).toBe(3);
    expect(defaultAcademyLevel(makeClub('PETIT_BUDGET'))).toBe(2);
  });
});
