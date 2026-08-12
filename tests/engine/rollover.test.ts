/**
 * Tests V0.6 phase 1 — rollover de saison.
 */

import { describe, it, expect } from 'vitest';
import { rolloverSeason } from '@/engine/season/rollover.js';
import type { Player, PlayerId, ClubId } from '@/engine/types.js';

function makePlayer(overrides: Partial<Player> = {}): Player {
  const base: Player = {
    id: 'p_test' as PlayerId,
    clubId: 'c_test' as ClubId,
    firstName: 'Test',
    lastName: 'Player',
    birthDate: '1995-01-01',
    position: 'OUVREUR',
    secondaryPositions: [],
    isJiff: true,
    technical: {
      passe: 70, plaquage: 70, jeuAuPiedPlace: 70, jeuAuPiedDynamique: 70,
      visionDeJeu: 70, conservation: 70, prisedeballeHaute: 70, deblayage: 70,
    },
    physical: { vitesse: 70, puissance: 70, endurance: 70, detente: 70, robustesse: 70 },
    mental: {
      decision: 70, leadership: 70, sangFroid: 70, agressivite: 70,
      professionnalisme: 70, discipline: 70,
    },
    positionSpecific: {},
    traits: [],
    hidden: { potentiel: 70, ambition: 50, determinisme: 50, loyaute: 60, adaptabilite: 50 },
    dynamic: { forme: 50, fatigue: 80, mood: 30, moodModifiers: [] },
    contract: { startSeason: 2025, endSeason: 2027, annualSalary: 100_000 },
  };
  return { ...base, ...overrides };
}

describe('rolloverSeason', () => {
  it('incrémente la saison', () => {
    const result = rolloverSeason({ players: [], currentSeason: 2025, seed: 'test' });
    expect(result.newSeason).toBe(2026);
  });

  it('reset l\'état dynamique des joueurs actifs', () => {
    const young = makePlayer({
      birthDate: '2000-01-01',
      dynamic: { forme: 30, fatigue: 95, mood: 20, moodModifiers: [] },
    });
    const result = rolloverSeason({ players: [young], currentSeason: 2025, seed: 'test' });
    const after = result.players[0]!;
    expect(after.retired).toBeUndefined();
    expect(after.dynamic.forme).toBe(70);
    expect(after.dynamic.fatigue).toBe(0);
    expect(after.dynamic.mood).toBe(60);
    expect(after.dynamic.moodModifiers).toEqual([]);
  });

  it('force la retraite à 38 ans et plus', () => {
    // 2026 (newSeason) - 1988 = 38 ans
    const veteran = makePlayer({ id: 'p_vet' as PlayerId, birthDate: '1988-01-01' });
    const result = rolloverSeason({ players: [veteran], currentSeason: 2025, seed: 'test' });
    expect(result.retired).toEqual(['p_vet']);
    expect(result.players[0]!.retired).toBe(true);
    expect(result.players[0]!.retirementSeason).toBe(2026);
  });

  it('ne déclenche pas de retraite probabiliste pour un joueur 35-37 ans de bon niveau', () => {
    // 2026 - 1989 = 37 ans, mais overall ~ 70 → pas de retraite
    const star = makePlayer({ id: 'p_star' as PlayerId, birthDate: '1989-01-01' });
    const result = rolloverSeason({ players: [star], currentSeason: 2025, seed: 'test' });
    expect(result.retired).toEqual([]);
    expect(result.players[0]!.retired).toBeUndefined();
  });

  it('peut déclencher une retraite probabiliste pour un joueur 35-37 ans de niveau bas', () => {
    // 2026 - 1989 = 37 ans, overall bas (~40) → forte proba de retraite
    const aging = makePlayer({
      id: 'p_aging' as PlayerId,
      birthDate: '1989-01-01',
      technical: {
        passe: 40, plaquage: 40, jeuAuPiedPlace: 40, jeuAuPiedDynamique: 40,
        visionDeJeu: 40, conservation: 40, prisedeballeHaute: 40, deblayage: 40,
      },
      physical: { vitesse: 40, puissance: 40, endurance: 40, detente: 40, robustesse: 40 },
      mental: {
        decision: 40, leadership: 40, sangFroid: 40, agressivite: 40,
        professionnalisme: 40, discipline: 40,
      },
    });
    // Sur 50 seeds, on s'attend à ce qu'un joueur à 37 ans avec overall bas (proba 0.7) se retire majoritairement
    let retiredCount = 0;
    for (let i = 0; i < 50; i++) {
      const result = rolloverSeason({ players: [aging], currentSeason: 2025, seed: `seed_${i}` });
      if (result.retired.length > 0) retiredCount++;
    }
    expect(retiredCount).toBeGreaterThan(25);
    expect(retiredCount).toBeLessThan(50);
  });

  it('est déterministe pour un seed donné', () => {
    const players = [
      makePlayer({ id: 'p1' as PlayerId, birthDate: '1989-01-01' }),
      makePlayer({ id: 'p2' as PlayerId, birthDate: '1990-01-01' }),
      makePlayer({ id: 'p3' as PlayerId, birthDate: '1991-01-01' }),
    ];
    const r1 = rolloverSeason({ players, currentSeason: 2025, seed: 'fixed' });
    const r2 = rolloverSeason({ players, currentSeason: 2025, seed: 'fixed' });
    expect(r1.retired).toEqual(r2.retired);
  });

  it('ignore les joueurs déjà retirés (idempotence)', () => {
    const old = makePlayer({
      id: 'p_old' as PlayerId,
      birthDate: '1985-01-01',
      retired: true,
      retirementSeason: 2024,
    });
    const result = rolloverSeason({ players: [old], currentSeason: 2025, seed: 'test' });
    expect(result.retired).toEqual([]);
    expect(result.players[0]).toBe(old); // référence inchangée
  });

  it('ne modifie pas les contrats (géré en Phase 3)', () => {
    const p = makePlayer({ birthDate: '2000-01-01' });
    const before = p.contract;
    const result = rolloverSeason({ players: [p], currentSeason: 2025, seed: 'test' });
    expect(result.players[0]!.contract).toEqual(before);
  });

  it('flag freeAgent les contrats expirés au passage à la nouvelle saison', () => {
    // contrat fini en 2025, on rollover de 2025 → 2026 → expiré
    const p = makePlayer({
      id: 'p_expired' as PlayerId,
      birthDate: '2000-01-01',
      contract: { startSeason: 2023, endSeason: 2025, annualSalary: 100_000 },
    });
    const result = rolloverSeason({ players: [p], currentSeason: 2025, seed: 'test' });
    expect(result.freeAgents).toEqual(['p_expired']);
    expect(result.players[0]!.freeAgent).toBe(true);
  });
});
