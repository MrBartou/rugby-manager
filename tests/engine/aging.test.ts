/**
 * Tests V0.7 phase 1 — vieillissement des stats.
 */

import { describe, it, expect } from 'vitest';
import { applyAgingToAll } from '@/engine/season/aging.js';
import type { Player, PlayerId, ClubId } from '@/engine/types.js';

function makePlayer(opts: { id?: string; birthYear?: number; potentiel?: number; baseStat?: number } = {}): Player {
  const N = opts.baseStat ?? 70;
  return {
    id: (opts.id ?? 'p_test') as PlayerId,
    clubId: 'c_test' as ClubId,
    firstName: 'P', lastName: 'T',
    birthDate: `${opts.birthYear ?? 2000}-01-01`,
    position: 'OUVREUR', secondaryPositions: [], isJiff: true,
    technical: {
      passe: N, plaquage: N, jeuAuPiedPlace: N, jeuAuPiedDynamique: N,
      visionDeJeu: N, conservation: N, prisedeballeHaute: N, deblayage: N,
    },
    physical: { vitesse: N, puissance: N, endurance: N, detente: N, robustesse: N },
    mental: { decision: N, leadership: N, sangFroid: N, agressivite: N, professionnalisme: N, discipline: N },
    positionSpecific: {}, traits: [],
    hidden: { potentiel: opts.potentiel ?? 80, ambition: 50, determinisme: 50, loyaute: 60, adaptabilite: 50 },
    dynamic: { forme: 70, fatigue: 0, mood: 60, moodModifiers: [] },
    contract: { startSeason: 2025, endSeason: 2027, annualSalary: 100_000 },
  };
}

describe('aging', () => {
  it('un jeune (20 ans) progresse en moyenne', () => {
    // 20 ans en 2026, base 60, potentiel 90
    const young = makePlayer({ birthYear: 2006, baseStat: 60, potentiel: 90 });
    // Sur 50 seeds, on attend une moyenne supérieure à 60 sur les techniques
    let sum = 0;
    for (let i = 0; i < 50; i++) {
      const aged = applyAgingToAll([young], 2026, `seed_${i}`)[0]!;
      sum += aged.technical.passe;
    }
    expect(sum / 50).toBeGreaterThan(60);
  });

  it('un ancien (35 ans) décline en physique', () => {
    const old = makePlayer({ birthYear: 1991, baseStat: 70, potentiel: 80 });
    let sumVitesse = 0;
    for (let i = 0; i < 50; i++) {
      const aged = applyAgingToAll([old], 2026, `seed_${i}`)[0]!;
      sumVitesse += aged.physical.vitesse;
    }
    expect(sumVitesse / 50).toBeLessThan(70);
  });

  it('le potentiel plafonne la croissance', () => {
    // Joueur de 20 ans déjà à 75, potentiel 75 → ne peut pas dépasser 75
    const capped = makePlayer({ birthYear: 2006, baseStat: 75, potentiel: 75 });
    const aged = applyAgingToAll([capped], 2026, 'test')[0]!;
    expect(aged.technical.passe).toBeLessThanOrEqual(75);
    expect(aged.physical.vitesse).toBeLessThanOrEqual(75);
  });

  it('un retraité reste inchangé', () => {
    const retired: Player = { ...makePlayer({ birthYear: 1985 }), retired: true };
    const aged = applyAgingToAll([retired], 2026, 'test')[0]!;
    expect(aged).toBe(retired);  // même référence
  });

  it('déterministe pour un seed donné', () => {
    const players = [
      makePlayer({ id: 'a', birthYear: 1995, baseStat: 70, potentiel: 80 }),
      makePlayer({ id: 'b', birthYear: 2000, baseStat: 65, potentiel: 85 }),
    ];
    const r1 = applyAgingToAll(players, 2026, 'fixed');
    const r2 = applyAgingToAll(players, 2026, 'fixed');
    expect(r1[0]!.technical.passe).toBe(r2[0]!.technical.passe);
    expect(r1[1]!.physical.vitesse).toBe(r2[1]!.physical.vitesse);
  });

  it('stats restent dans [1, 99]', () => {
    const extreme = makePlayer({ birthYear: 1985, baseStat: 99, potentiel: 99 });   // très vieux
    for (let i = 0; i < 50; i++) {
      const aged = applyAgingToAll([extreme], 2026, `seed_${i}`)[0]!;
      expect(aged.physical.vitesse).toBeGreaterThanOrEqual(1);
      expect(aged.physical.vitesse).toBeLessThanOrEqual(99);
    }
  });
});
