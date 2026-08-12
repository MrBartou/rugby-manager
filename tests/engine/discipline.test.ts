/**
 * Tests de la discipline — V0.13.
 *
 * Avant ce module, `discipline` et `agressivite` étaient des attributs décoratifs :
 * le moteur sifflait 2,8 pénalités par match à taux fixe. On vérifie ici que ces
 * attributs pilotent réellement l'indiscipline, et que le volume de sanctions est
 * revenu à un ordre de grandeur crédible.
 */

import { describe, expect, it } from 'vitest';
import { indisciplineMultiplier, pickOffender } from '../../src/engine/match/discipline.js';
import { createRng } from '../../src/engine/rng.js';
import { simulateMatch } from '../../src/engine/match/simulate.js';
import { makeMatchInput, makeSquad } from './fixtures.js';
import type { ClubId, Player } from '../../src/engine/types.js';

function playersOf(niveau: number): Player[] {
  return makeSquad('club_home' as ClubId, niveau).players;
}

/** Clone un joueur en forçant ses attributs mentaux. */
function withMental(p: Player, discipline: number, agressivite: number): Player {
  return { ...p, mental: { ...p.mental, discipline, agressivite } };
}

describe('multiplicateur d\'indiscipline', () => {
  it('vaut environ 1 pour un effectif moyen et frais', () => {
    const squad = playersOf(60).map(p => withMental(p, 60, 55));
    expect(indisciplineMultiplier(squad, 0)).toBeCloseTo(1, 1);
  });

  it('une équipe disciplinée concède moins qu\'une équipe indisciplinée', () => {
    const base = playersOf(60);
    const sages = base.map(p => withMental(p, 90, 45));
    const bouchers = base.map(p => withMental(p, 25, 85));

    expect(indisciplineMultiplier(sages, 0)).toBeLessThan(indisciplineMultiplier(bouchers, 0));
  });

  it('l\'agressivité augmente l\'indiscipline à discipline égale', () => {
    const base = playersOf(60);
    const calme = base.map(p => withMental(p, 60, 30));
    const teigneux = base.map(p => withMental(p, 60, 95));

    expect(indisciplineMultiplier(teigneux, 0)).toBeGreaterThan(indisciplineMultiplier(calme, 0));
  });

  it('la fatigue dégrade la discipline', () => {
    const squad = playersOf(60);
    expect(indisciplineMultiplier(squad, 90)).toBeGreaterThan(indisciplineMultiplier(squad, 0));
  });

  it('reste borné même avec des attributs extrêmes', () => {
    const base = playersOf(60);
    const parfaits = base.map(p => withMental(p, 99, 1));
    const catastrophiques = base.map(p => withMental(p, 1, 99));

    expect(indisciplineMultiplier(parfaits, 0)).toBeGreaterThanOrEqual(0.62);
    expect(indisciplineMultiplier(catastrophiques, 100)).toBeLessThanOrEqual(1.55);
  });

  it('renvoie 1 pour une liste vide (pas de division par zéro)', () => {
    expect(indisciplineMultiplier([], 50)).toBe(1);
  });
});

describe('désignation du fautif', () => {
  it('désigne toujours un joueur du groupe', () => {
    const squad = playersOf(60);
    const ids = new Set(squad.map(p => p.id));
    for (let i = 0; i < 200; i++) {
      const offender = pickOffender(squad, createRng(`off_${i}`));
      expect(offender && ids.has(offender.id)).toBe(true);
    }
  });

  it('sanctionne plus souvent le joueur le moins discipliné', () => {
    const base = playersOf(60).slice(0, 5);
    const squad = base.map((p, i) => withMental(p, i === 0 ? 10 : 90, i === 0 ? 90 : 30));
    const cible = squad[0]!;

    let hits = 0;
    const n = 2000;
    for (let i = 0; i < n; i++) {
      if (pickOffender(squad, createRng(`pick_${i}`))?.id === cible.id) hits++;
    }
    // Sans pondération il sortirait 1 fois sur 5 (20 %).
    expect(hits / n).toBeGreaterThan(0.35);
  });

  it('renvoie undefined pour une liste vide', () => {
    expect(pickOffender([], createRng('x'))).toBeUndefined();
  });
});

describe('volume de sanctions en match', () => {
  it('siffle un nombre de pénalités crédible', () => {
    let penalties = 0;
    const matches = 200;
    for (let i = 0; i < matches; i++) {
      const r = simulateMatch(makeMatchInput({ homeNiveau: 60, awayNiveau: 60 }), `disc_${i}`);
      penalties += r.phases.filter(p => p.outcome.penaltyAwarded).length;
    }
    const perMatch = penalties / matches;
    // Avant V0.13 : 2,8 par match, ce qui rendait le tir au but quasi inexistant.
    expect(perMatch).toBeGreaterThan(6);
    expect(perMatch).toBeLessThan(14);
  });

  it('les coups de pied de pénalité pèsent réellement dans le score', () => {
    let penaltyPoints = 0;
    const matches = 200;
    for (let i = 0; i < matches; i++) {
      const r = simulateMatch(makeMatchInput({ homeNiveau: 60, awayNiveau: 60 }), `pts_${i}`);
      for (const phase of r.phases) {
        if (phase.outcome.pointsScored?.type === 'PENALTY') penaltyPoints += 3;
      }
    }
    // Avant V0.13 : 2,2 points par match. Cible réaliste : 5 à 12.
    expect(penaltyPoints / matches).toBeGreaterThan(4.5);
  });

  it('une équipe indisciplinée concède plus de pénalités que son adversaire', () => {
    const input = makeMatchInput({ homeNiveau: 60, awayNiveau: 60 });
    const players = new Map(input.playersById);
    const awayIds = input.away.squad.starters.map(s => s.playerId);

    // On rend l'équipe extérieure très indisciplinée.
    for (const id of awayIds) {
      const p = players.get(id);
      if (p) players.set(id, withMental(p, 15, 90));
    }
    const rigged = { ...input, playersById: players };

    let homeAwarded = 0;
    let awayAwarded = 0;
    for (let i = 0; i < 300; i++) {
      const r = simulateMatch(rigged, `rig_${i}`);
      for (const phase of r.phases) {
        if (phase.outcome.penaltyAwarded === 'HOME') homeAwarded++;
        if (phase.outcome.penaltyAwarded === 'AWAY') awayAwarded++;
      }
    }
    // HOME bénéficie des fautes d'AWAY : il doit obtenir nettement plus de pénalités.
    expect(homeAwarded).toBeGreaterThan(awayAwarded);
  });
});
