/**
 * Tests V0.8 phase 3 — trêves internationales.
 */

import { describe, it, expect } from 'vitest';
import {
  buildCallUpSchedule,
  INTERNATIONAL_BREAK_ROUNDS,
  isCalledUp,
  isInternationalBreak,
} from '@/engine/season/internationals.js';
import type { ClubId, Player, PlayerId } from '@/engine/types.js';

function p(id: string, isJiff: boolean, overall = 70, opts: { retired?: boolean } = {}): Player {
  const N = overall;
  return {
    id: id as PlayerId, clubId: 'c' as ClubId,
    firstName: 'P', lastName: id, birthDate: '2000-01-01',
    position: 'OUVREUR', secondaryPositions: [], isJiff,
    technical: { passe: N, plaquage: N, jeuAuPiedPlace: N, jeuAuPiedDynamique: N, visionDeJeu: N, conservation: N, prisedeballeHaute: N, deblayage: N },
    physical: { vitesse: N, puissance: N, endurance: N, detente: N, robustesse: N },
    mental: { decision: N, leadership: N, sangFroid: N, agressivite: N, professionnalisme: N, discipline: N },
    positionSpecific: {}, traits: [],
    hidden: { potentiel: 80, ambition: 50, determinisme: 50, loyaute: 60, adaptabilite: 50 },
    dynamic: { forme: 70, fatigue: 0, mood: 60, moodModifiers: [] },
    contract: { startSeason: 2025, endSeason: 2027, annualSalary: 100_000 },
    ...opts,
  };
}

describe('isInternationalBreak', () => {
  it('reconnaît les rounds de trêve', () => {
    for (const r of INTERNATIONAL_BREAK_ROUNDS) {
      expect(isInternationalBreak(r)).toBe(true);
    }
    expect(isInternationalBreak(1)).toBe(false);
    expect(isInternationalBreak(20)).toBe(false);
  });
});

describe('buildCallUpSchedule', () => {
  it('appelle les top JIFF de chaque club', () => {
    const clubA = [
      p('a_star', true, 90),
      p('a_mid', true, 75),
      p('a_low', true, 60),
      p('a_extra', true, 55),
      p('a_etranger', false, 95),    // exclu : non JIFF
    ];
    const clubB = [
      p('b_star', true, 85),
      p('b_mid', true, 72),
      p('b_low', true, 65),
    ];
    const map = new Map<ClubId, readonly Player[]>();
    map.set('A' as ClubId, clubA);
    map.set('B' as ClubId, clubB);
    const sched = buildCallUpSchedule(map);

    for (const round of INTERNATIONAL_BREAK_ROUNDS) {
      const ids = sched.byRound.get(round)!;
      // 3 par club × 2 clubs = 6
      expect(ids.size).toBe(6);
      expect(ids.has('a_star' as PlayerId)).toBe(true);
      expect(ids.has('a_mid' as PlayerId)).toBe(true);
      expect(ids.has('a_low' as PlayerId)).toBe(true);
      expect(ids.has('a_etranger' as PlayerId)).toBe(false);
    }
  });

  it('ne sélectionne pas les retraités', () => {
    const players = [
      p('star_retired', true, 95, { retired: true }),
      p('mid', true, 70),
    ];
    const map = new Map<ClubId, readonly Player[]>();
    map.set('A' as ClubId, players);
    const sched = buildCallUpSchedule(map);
    const ids = sched.byRound.get(INTERNATIONAL_BREAK_ROUNDS[0]!)!;
    expect(ids.has('star_retired' as PlayerId)).toBe(false);
    expect(ids.has('mid' as PlayerId)).toBe(true);
  });
});

describe('isCalledUp', () => {
  it('retourne true pour un sélectionné dans un round de trêve', () => {
    const players = [p('star', true, 90)];
    const map = new Map<ClubId, readonly Player[]>();
    map.set('A' as ClubId, players);
    const sched = buildCallUpSchedule(map);
    expect(isCalledUp(sched, 'star' as PlayerId, INTERNATIONAL_BREAK_ROUNDS[0]!)).toBe(true);
    expect(isCalledUp(sched, 'star' as PlayerId, 1)).toBe(false);          // pas un round de trêve
    expect(isCalledUp(sched, 'unknown' as PlayerId, INTERNATIONAL_BREAK_ROUNDS[0]!)).toBe(false);
  });
});
