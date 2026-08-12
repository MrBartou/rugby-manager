/**
 * Cartons — V0.8, refondu en V0.52.
 *
 * Le tirage post-match indépendant a disparu : les cartons sont désormais
 * sifflés pendant la rencontre, et ce module n'en applique plus que les suites.
 * Les tests suivent ce déplacement — ils vérifient la sanction, plus le tirage.
 */

import { describe, it, expect } from 'vitest';
import { applyMatchCards, clearExpiredSuspensions, isAvailable } from '@/engine/match/cards.js';
import type { Player, PlayerId, ClubId } from '@/engine/types.js';

function p(id: string, opts: { discipline?: number; agressivite?: number; fatigue?: number } = {}): Player {
  const N = 70;
  return {
    id: id as PlayerId, clubId: 'c' as ClubId,
    firstName: 'P', lastName: id, birthDate: '2000-01-01',
    position: 'OUVREUR', secondaryPositions: [], isJiff: true,
    technical: { passe: N, plaquage: N, jeuAuPiedPlace: N, jeuAuPiedDynamique: N, visionDeJeu: N, conservation: N, prisedeballeHaute: N, deblayage: N },
    physical: { vitesse: N, puissance: N, endurance: N, detente: N, robustesse: N },
    mental: {
      decision: N, leadership: N, sangFroid: N,
      agressivite: opts.agressivite ?? 50,
      professionnalisme: N,
      discipline: opts.discipline ?? 70,
    },
    positionSpecific: {}, traits: [],
    hidden: { potentiel: 80, ambition: 50, determinisme: 50, loyaute: 60, adaptabilite: 50 },
    dynamic: { forme: 70, fatigue: opts.fatigue ?? 30, mood: 60, moodModifiers: [] },
    contract: { startSeason: 2025, endSeason: 2027, annualSalary: 100_000 },
  };
}

describe('les suites d\'un carton', () => {
  it('un rouge coûte deux journées et une part du moral', () => {
    const rebel = p('r');
    const r = applyMatchCards({
      players: [rebel],
      cards: [{ playerId: rebel.id, color: 'RED' }],
      currentRound: 5,
    });
    const updated = r.players[0]!;
    expect(updated.dynamic.suspendedUntilRound).toBe(7);
    expect(updated.dynamic.mood).toBe(50);
    expect(r.cards).toHaveLength(1);
  });

  it('un jaune ne coûte que le moral — on ne rate pas la journée suivante', () => {
    const sanctionné = p('j');
    const r = applyMatchCards({
      players: [sanctionné],
      cards: [{ playerId: sanctionné.id, color: 'YELLOW' }],
      currentRound: 5,
    });
    expect(r.players[0]!.dynamic.suspendedUntilRound).toBeUndefined();
    expect(r.players[0]!.dynamic.mood).toBe(56);
  });

  it('le rouge l\'emporte quand le même homme a déjà pris un jaune', () => {
    const brutal = p('b');
    const r = applyMatchCards({
      players: [brutal],
      cards: [
        { playerId: brutal.id, color: 'YELLOW' },
        { playerId: brutal.id, color: 'RED' },
      ],
      currentRound: 3,
    });
    expect(r.cards).toHaveLength(1);
    expect(r.cards[0]!.type).toBe('RED');
    expect(r.players[0]!.dynamic.suspendedUntilRound).toBe(5);
  });

  it('ne touche à personne quand la rencontre s\'est bien tenue', () => {
    const calme = p('c');
    const r = applyMatchCards({ players: [calme], cards: [], currentRound: 1 });
    expect(r.cards).toEqual([]);
    expect(r.players[0]).toBe(calme);
  });

  it('ignore un carton attribué à un joueur absent de l\'effectif', () => {
    const calme = p('c');
    const r = applyMatchCards({
      players: [calme],
      cards: [{ playerId: 'inconnu' as PlayerId, color: 'RED' }],
      currentRound: 1,
    });
    expect(r.cards).toEqual([]);
  });
});

describe('clearExpiredSuspensions', () => {
  it('lève la suspension quand round atteint', () => {
    const suspended: Player = {
      ...p('s'),
      dynamic: { forme: 70, fatigue: 0, mood: 50, moodModifiers: [], suspendedUntilRound: 5 },
    };
    const cleared = clearExpiredSuspensions([suspended], 6)[0]!;
    expect(cleared.dynamic.suspendedUntilRound).toBeUndefined();
  });

  it('garde la suspension si round encore en cours', () => {
    const suspended: Player = {
      ...p('s'),
      dynamic: { forme: 70, fatigue: 0, mood: 50, moodModifiers: [], suspendedUntilRound: 8 },
    };
    const stillOut = clearExpiredSuspensions([suspended], 5)[0]!;
    expect(stillOut.dynamic.suspendedUntilRound).toBe(8);
  });
});

describe('isAvailable (cartons)', () => {
  it('joueur suspendu = indisponible', () => {
    const suspended: Player = {
      ...p('s'),
      dynamic: { forme: 70, fatigue: 0, mood: 50, moodModifiers: [], suspendedUntilRound: 8 },
    };
    expect(isAvailable(suspended, 5)).toBe(false);
    expect(isAvailable(suspended, 8)).toBe(true);
  });
});
