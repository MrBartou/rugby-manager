/**
 * Tests V0.7 phase 2 — état dynamique post-match.
 */

import { describe, it, expect } from 'vitest';
import { applyMatchToPlayerStates } from '@/engine/match/player-state.js';
import type { Player, PlayerId, ClubId } from '@/engine/types.js';

function makePlayer(id: string, fatigue = 30, forme = 70): Player {
  return {
    id: id as PlayerId, clubId: 'c' as ClubId,
    firstName: 'P', lastName: id, birthDate: '2000-01-01',
    position: 'OUVREUR', secondaryPositions: [], isJiff: true,
    technical: { passe: 70, plaquage: 70, jeuAuPiedPlace: 70, jeuAuPiedDynamique: 70, visionDeJeu: 70, conservation: 70, prisedeballeHaute: 70, deblayage: 70 },
    physical: { vitesse: 70, puissance: 70, endurance: 70, detente: 70, robustesse: 70 },
    mental: { decision: 70, leadership: 70, sangFroid: 70, agressivite: 70, professionnalisme: 70, discipline: 70 },
    positionSpecific: {}, traits: [],
    hidden: { potentiel: 80, ambition: 50, determinisme: 50, loyaute: 60, adaptabilite: 50 },
    dynamic: { forme, fatigue, mood: 60, moodModifiers: [] },
    contract: { startSeason: 2025, endSeason: 2027, annualSalary: 100_000 },
  };
}

describe('applyMatchToPlayerStates', () => {
  it('titulaire victorieux : +fatigue, forme tend vers 80', () => {
    const p = makePlayer('s1', 30, 60);
    const updated = applyMatchToPlayerStates({
      players: [p],
      starterIds: [p.id],
      subIds: [],
      result: 'WIN',
    })[0]!;
    expect(updated.dynamic.fatigue).toBe(55);
    expect(updated.dynamic.forme).toBeGreaterThan(60);
  });

  it('joueur hors compo récupère (fatigue baisse)', () => {
    const p = makePlayer('rest', 50, 70);
    const updated = applyMatchToPlayerStates({
      players: [p],
      starterIds: ['other' as PlayerId],
      subIds: [],
      result: 'WIN',
    })[0]!;
    expect(updated.dynamic.fatigue).toBe(35);
    expect(updated.dynamic.forme).toBe(70);
  });

  it('défaite tire la forme vers le bas', () => {
    const p = makePlayer('s1', 30, 80);
    const updated = applyMatchToPlayerStates({
      players: [p],
      starterIds: [p.id],
      subIds: [],
      result: 'LOSS',
    })[0]!;
    expect(updated.dynamic.forme).toBeLessThan(80);
  });

  it('borne fatigue à [0, 100]', () => {
    const tired = makePlayer('tired', 95, 70);
    const fresh = makePlayer('fresh', 5, 70);
    const updated = applyMatchToPlayerStates({
      players: [tired, fresh],
      starterIds: [tired.id],
      subIds: [],
      result: 'WIN',
    });
    expect(updated[0]!.dynamic.fatigue).toBe(100);  // borné
    expect(updated[1]!.dynamic.fatigue).toBe(0);    // 5 - 15 = -10 → borné à 0
  });

  it('un blessé n\'est pas modifié', () => {
    const injured: Player = {
      ...makePlayer('inj', 30, 70),
      dynamic: {
        forme: 70, fatigue: 30, mood: 60, moodModifiers: [],
        injury: { type: 'MUSCULAIRE', startedAt: 0, estimatedReturnAt: 100, hasSequela: false },
      },
    };
    const updated = applyMatchToPlayerStates({
      players: [injured],
      starterIds: [injured.id],
      subIds: [],
      result: 'WIN',
    })[0]!;
    expect(updated).toBe(injured);
  });

  it('remplaçant : fatigue intermédiaire', () => {
    const p = makePlayer('sub', 30, 70);
    const updated = applyMatchToPlayerStates({
      players: [p],
      starterIds: [],
      subIds: [p.id],
      result: 'WIN',
    })[0]!;
    expect(updated.dynamic.fatigue).toBe(42);
  });
});
