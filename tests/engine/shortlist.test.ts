/**
 * La liste de suivi : V0.61.
 *
 * Repérer un joueur et le retrouver trois journées plus tard tenait de la
 * mémoire du manager. Le scouting répond à « que vaut-il », pas à « je le garde
 * à l'œil » : deux gestes différents, un seul existait.
 *
 * Ce qui est vérifié ici : la liste veille sans rien apprendre, une seule alerte
 * par joueur et la plus parlante, l'urgent remonte, et un joueur qui raccroche
 * sort de lui-même.
 */

import { describe, expect, it } from 'vitest';
import {
  alertFor,
  buildShortlist,
  toggleWatched,
  type ShortlistContext,
} from '@/engine/club/shortlist.js';
import type { ClubId, Player, PlayerId, Position } from '@/engine/types.js';

const n = 70;
function player(id: string, over: Partial<Player> = {}): Player {
  return {
    id: id as PlayerId,
    clubId: 'a' as ClubId,
    firstName: 'T', lastName: id, birthDate: '1996-01-01',
    position: 'OUVREUR' as Position, secondaryPositions: [], isJiff: true,
    technical: { passe: n, plaquage: n, jeuAuPiedPlace: n, jeuAuPiedDynamique: n, visionDeJeu: n, conservation: n, prisedeballeHaute: n, deblayage: n },
    physical: { vitesse: n, puissance: n, endurance: n, detente: n, robustesse: n },
    mental: { decision: n, leadership: n, sangFroid: n, agressivite: n, professionnalisme: n, discipline: n },
    positionSpecific: {}, traits: [],
    hidden: { potentiel: n, ambition: 50, determinisme: 50, loyaute: 60, adaptabilite: 50 },
    dynamic: { forme: 70, fatigue: 0, mood: 60, moodModifiers: [] },
    contract: { startSeason: 2025, endSeason: 2030, annualSalary: 100_000 },
    ...over,
  };
}

const ctx = (over: Partial<ShortlistContext> = {}): ShortlistContext => ({
  currentSeason: 2026,
  currentRound: 10,
  clubWhenAdded: new Map(),
  ...over,
});

describe('ce que la veille signale', () => {
  it('un joueur libre, tout de suite', () => {
    const a = alertFor(player('x', { freeAgent: true }), ctx());
    expect(a?.kind).toBe('LIBRE');
    expect(a?.urgent).toBe(true);
  });

  it('une fin de contrat, tout de suite aussi', () => {
    const a = alertFor(player('x', {
      contract: { startSeason: 2023, endSeason: 2026, annualSalary: 100_000 },
    }), ctx());
    expect(a?.kind).toBe('FIN_DE_CONTRAT');
    expect(a?.urgent).toBe(true);
  });

  it('la dernière année de contrat, sans urgence', () => {
    // Le signal le plus utile du lot : c'est là qu'un joueur se négocie bas.
    const a = alertFor(player('x', {
      contract: { startSeason: 2023, endSeason: 2027, annualSalary: 100_000 },
    }), ctx());
    expect(a?.kind).toBe('DERNIERE_ANNEE');
    expect(a?.urgent).toBe(false);
  });

  it('un changement de club depuis la mise en liste', () => {
    const a = alertFor(
      player('x', { clubId: 'ailleurs' as ClubId }),
      ctx({ clubWhenAdded: new Map([['x' as PlayerId, 'a']]) }),
    );
    expect(a?.kind).toBe('A_CHANGE_DE_CLUB');
  });

  it('et une blessure seulement quand elle est longue', () => {
    const court = alertFor(player('x', {
      dynamic: { forme: 70, fatigue: 0, mood: 60, moodModifiers: [], injury: { type: 'COMMOTION', startedAt: 9, estimatedReturnAt: 12, hasSequela: false } },
    }), ctx());
    expect(court).toBeUndefined();

    const long = alertFor(player('x', {
      dynamic: { forme: 70, fatigue: 0, mood: 60, moodModifiers: [], injury: { type: 'FRACTURE', startedAt: 9, estimatedReturnAt: 30, hasSequela: false } },
    }), ctx());
    expect(long?.kind).toBe('BLESSE_LONGUE_DUREE');
  });

  it('rien à dire sur un joueur installé et en bonne santé', () => {
    // Une alerte qui se déclenche tout le temps ne se lit plus.
    expect(alertFor(player('x'), ctx())).toBeUndefined();
  });
});

describe('une seule alerte, la plus parlante', () => {
  it('être libre prime sur tout le reste', () => {
    const a = alertFor(player('x', {
      freeAgent: true,
      contract: { startSeason: 2023, endSeason: 2026, annualSalary: 100_000 },
      dynamic: { forme: 70, fatigue: 0, mood: 60, moodModifiers: [], injury: { type: 'FRACTURE', startedAt: 1, estimatedReturnAt: 30, hasSequela: false } },
    }), ctx());
    expect(a?.kind).toBe('LIBRE');
  });
});

describe('la liste se lit de haut en bas', () => {
  const contexte = ctx();

  it('l\'urgent d\'abord, le muet en dernier', () => {
    const joueurs = [
      player('installe'),
      player('libre', { freeAgent: true }),
      player('derniere', { contract: { startSeason: 2023, endSeason: 2027, annualSalary: 100_000 } }),
    ];
    const liste = buildShortlist(
      joueurs.map(p => p.id),
      new Map(joueurs.map(p => [p.id, p])),
      contexte,
    );
    expect(liste.map(e => e.player.lastName)).toEqual(['libre', 'derniere', 'installe']);
  });

  it('un retraité sort de lui-même', () => {
    const parti = player('parti', { retired: true });
    const liste = buildShortlist([parti.id], new Map([[parti.id, parti]]), contexte);
    expect(liste).toEqual([]);
  });

  it('et un joueur disparu de la base ne casse rien', () => {
    expect(buildShortlist(['fantome' as PlayerId], new Map(), contexte)).toEqual([]);
  });
});

describe('mettre en liste et en retirer', () => {
  it('n\'ajoute jamais deux fois le même', () => {
    const un = toggleWatched([], 'a' as PlayerId);
    expect(un).toEqual(['a']);
    expect(toggleWatched(un, 'a' as PlayerId)).toEqual([]);
    expect(toggleWatched(un, 'b' as PlayerId)).toEqual(['a', 'b']);
  });
});
