/**
 * Le moral sur le terrain — V0.51.
 *
 * Aucun des sept sous-systèmes de match ne lisait `dynamic.mood` : une équipe à
 * 20 de moral jouait exactement comme une équipe à 90, et tout le système
 * humain était un jeu parallèle sans effet sur le résultat.
 *
 * Deux propriétés sont testées ici, et la seconde compte autant que la première :
 *
 *  1. un vestiaire qui va mal **perd réellement des matchs** — c'est la preuve
 *     que le câblage existe, et elle se fait sur des matchs entiers ;
 *  2. l'effet est **asymétrique** — un groupe heureux ne gagne presque rien.
 *     Sans ce plafond, gagner donnerait le moral qui ferait gagner davantage, et
 *     le championnat se figerait au bout de dix journées.
 */

import { describe, expect, it } from 'vitest';
import {
  NEUTRAL_MOOD,
  moraleEffects,
  moraleHint,
  teamMorale,
} from '../../src/engine/match/morale.js';
import { simulateMatch } from '../../src/engine/match/simulate.js';
import { makeMatchInput, makeSquad } from './fixtures.js';
import { updateRelationScore } from '../../src/engine/human/relationships.js';
import type { RelationsState } from '../../src/engine/human/relationships.js';
import type { ClubId, MatchId, Player, PlayerId } from '../../src/engine/types.js';
import type { MatchInput } from '../../src/engine/match/types.js';

const SQUAD = makeSquad('c1' as ClubId, 70);

const withMood = (mood: number): readonly Player[] =>
  SQUAD.players.map(p => ({ ...p, dynamic: { ...p.dynamic, mood } }));

// =============================================================================
// L'état du groupe
// =============================================================================

describe('l\'état du groupe se lit sur le XV aligné', () => {
  it('fait la moyenne des quinze présents, pas de l\'effectif', () => {
    const onField = withMood(40).slice(0, 15);
    expect(teamMorale(onField).mood).toBe(40);
  });

  it('sans graphe de relations, la cohésion est neutre', () => {
    expect(teamMorale(withMood(60).slice(0, 15)).cohesion).toBe(0);
  });

  it('compte les affinités et les conflits entre joueurs alignés ensemble', () => {
    const onField = withMood(60).slice(0, 15);
    const empty: RelationsState = { byPair: new Map() };
    let rel = updateRelationScore(empty, onField[0]!.id, onField[1]!.id, 80, 'amis');
    rel = updateRelationScore(rel, onField[2]!.id, onField[3]!.id, 75, 'amis');
    const soudé = teamMorale(onField, rel).cohesion;

    const brouille = updateRelationScore(empty, onField[0]!.id, onField[1]!.id, -80, 'clash');
    expect(soudé).toBeGreaterThan(0);
    expect(teamMorale(onField, brouille).cohesion).toBeLessThan(0);
  });

  it('ignore une brouille entre deux joueurs qui ne jouent pas ensemble', () => {
    const onField = withMood(60).slice(0, 15);
    const absent = SQUAD.players[20]!;
    const empty: RelationsState = { byPair: new Map() };
    const rel = updateRelationScore(empty, absent.id, SQUAD.players[21]!.id, -90, 'clash');
    expect(teamMorale(onField, rel).cohesion).toBe(0);
  });

  it('ne dit rien d\'un groupe vide plutôt que de diviser par zéro', () => {
    expect(teamMorale([]).mood).toBe(NEUTRAL_MOOD);
  });
});

// =============================================================================
// L'asymétrie
// =============================================================================

describe('la confiance donne peu, le doute coûte beaucoup', () => {
  const neutre = moraleEffects({ mood: NEUTRAL_MOOD, cohesion: 0 });

  it('ne change rigoureusement rien au moral de référence', () => {
    // C'est ce qui garantit que la calibration existante reste valide.
    expect(neutre.confidence).toBe(0);
    expect(neutre.errorFactor).toBe(1);
    expect(neutre.tackleFactor).toBe(1);
    expect(neutre.indisciplineFactor).toBe(1);
  });

  it('le gain d\'un vestiaire au sommet est bien plus petit que la perte d\'un vestiaire au fond', () => {
    const sommet = moraleEffects({ mood: 100, cohesion: 0 });
    const fond = moraleEffects({ mood: 0, cohesion: 0 });
    expect(sommet.confidence).toBeLessThan(Math.abs(fond.confidence) / 2);
    expect(Math.abs(1 - sommet.errorFactor)).toBeLessThan(Math.abs(1 - fond.errorFactor) / 2);
  });

  it('un groupe qui doute lâche plus de ballons, plaque moins et se sanctionne', () => {
    const fond = moraleEffects({ mood: 25, cohesion: 0 });
    expect(fond.errorFactor).toBeGreaterThan(1);
    expect(fond.tackleFactor).toBeLessThan(1);
    expect(fond.indisciplineFactor).toBeGreaterThan(1);
    expect(fond.confidence).toBeLessThan(0);
  });

  it('la division du vestiaire pèse sur le collectif, pas sur la discipline', () => {
    const divisé = moraleEffects({ mood: NEUTRAL_MOOD, cohesion: -80 });
    expect(divisé.errorFactor).toBeGreaterThan(1);
    expect(divisé.tackleFactor).toBeLessThan(1);
    // Un homme malheureux peut rester discipliné ; c'est le moral qui décide là.
    expect(divisé.indisciplineFactor).toBe(1);
  });

  it('reste borné même sur des valeurs aberrantes', () => {
    for (const m of [-500, 500]) {
      const e = moraleEffects({ mood: m, cohesion: m });
      // Jamais au-delà de l'avantage du terrain (5) : le moral pèse sur un
      // match, il ne le décide pas.
      expect(Math.abs(e.confidence)).toBeLessThan(5);
      expect(e.errorFactor).toBeGreaterThan(0.7);
      expect(e.errorFactor).toBeLessThan(1.35);
      expect(e.tackleFactor).toBeGreaterThan(0.8);
      expect(e.indisciplineFactor).toBeLessThan(1.3);
    }
  });
});

// =============================================================================
// La preuve : sur des matchs entiers
// =============================================================================

describe('un vestiaire qui va mal perd des matchs', () => {
  /** Taux de victoire des locaux sur N matchs, à moral imposé de chaque côté. */
  const winRate = (homeMood: number, awayMood: number, n = 300): number => {
    let wins = 0;
    for (let i = 0; i < n; i++) {
      const base = makeMatchInput({
        homeNiveau: 70, awayNiveau: 70, matchId: `mor_${homeMood}_${awayMood}_${i}`,
      });
      const players = new Map<PlayerId, Player>();
      for (const [id, p] of base.playersById) {
        const isHome = base.home.squad.starters.some(e => e.playerId === id)
          || base.home.squad.substitutes.some(e => e.playerId === id);
        players.set(id, {
          ...p,
          dynamic: { ...p.dynamic, mood: isHome ? homeMood : awayMood },
        });
      }
      const input: MatchInput = {
        ...base,
        matchId: `mor_${homeMood}_${awayMood}_${i}` as MatchId,
        playersById: players,
      };
      const r = simulateMatch(input, `s${i}`);
      if (r.homeScore > r.awayScore) wins++;
    }
    return wins / n;
  };

  // Les seuils se lisent **par rapport à la référence mesurée**, pas dans
  // l'absolu : l'avantage du terrain décale déjà le taux de victoire des
  // locaux, et le fixer en dur ferait échouer ce test au premier réglage de
  // l'avantage à domicile.
  const REFERENCE = winRate(NEUTRAL_MOOD, NEUTRAL_MOOD);

  it('à moral égal, le terrain reste le seul juge', () => {
    expect(REFERENCE).toBeGreaterThan(0.4);
    expect(REFERENCE).toBeLessThan(0.6);
  });

  it('un groupe au fond du trou perd sensiblement plus souvent', () => {
    // Mesuré à ~6 points de taux de victoire : sur une saison de 26 journées,
    // cela vaut une victoire et demie. Perceptible sans écraser le niveau des
    // joueurs, qui doit rester le premier facteur.
    expect(winRate(15, NEUTRAL_MOOD)).toBeLessThan(REFERENCE - 0.035);
  });

  it('mais un groupe euphorique ne domine pas pour autant', () => {
    // On n'affirme **que** l'asymétrie, et surtout pas que le gain est
    // strictement positif : mesuré à moins de deux points sur 800 matchs, il
    // est plus petit que l'erreur type d'un échantillon de 300 et peut donc
    // parfaitement en ressortir négatif. Le signe du gain se vérifie sur les
    // coefficients, qui sont déterministes — voir le bloc « la confiance donne
    // peu » plus haut.
    const gain = winRate(100, NEUTRAL_MOOD) - REFERENCE;
    const perte = REFERENCE - winRate(15, NEUTRAL_MOOD);
    expect(gain).toBeLessThan(perte / 2);
  });
});

describe('ce que le staff en dit', () => {
  it('alerte quand le groupe est au fond', () => {
    expect(moraleHint({ mood: 25, cohesion: 0 })).toContain('fond');
  });

  it('signale un groupe divisé même quand le moral tient', () => {
    expect(moraleHint({ mood: 65, cohesion: -40 })).toContain('ensemble');
  });

  it('ne dramatise pas un vestiaire ordinaire', () => {
    expect(moraleHint({ mood: NEUTRAL_MOOD, cohesion: 0 })).toContain('normale');
  });

  it('qualifie sans jamais chiffrer', () => {
    for (const mood of [10, 30, 50, 60, 80, 95]) {
      expect(moraleHint({ mood, cohesion: 0 })).not.toMatch(/\d/);
    }
  });
});
