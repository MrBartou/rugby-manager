/**
 * La note du joueur, sur dix : V0.61.
 *
 * Le moteur capture treize statistiques individuelles depuis la V0.13 et ne les
 * montrait qu'en agrégats de fin de saison. Après un match, rien ne disait qui
 * avait tenu son poste.
 *
 * La difficulté est mesurée, pas supposée : l'attribution nominative du moteur
 * est parcimonieuse, et **la moitié des joueurs ne produit rien de mesurable**
 * dans une rencontre donnée. Une note bâtie sur une échelle inventée serait du
 * bruit habillé en chiffre. Elle est donc bâtie sur le rang dans la
 * distribution de sa ligne, mesurée sur 400 rencontres.
 *
 * Ce qui est vérifié ici : l'échelle veut dire ce qu'elle annonce, un poste ne
 * se compare qu'à lui-même, les fautes coûtent, et l'homme du match n'est pas
 * mécaniquement un joueur du camp vainqueur.
 */

import { describe, expect, it } from 'vitest';
import {
  MINUTES_MINIMUM,
  contribution,
  rateMatch,
  ratePlayer,
} from '@/engine/match/player-rating.js';
import { simulateMatch } from '@/engine/match/simulate.js';
import type { IndividualMatchStats } from '@/engine/match/types.js';
import type { Player } from '@/engine/types.js';
import { makeMatchInput, makeSquad } from './fixtures.js';
import type { ClubId, Position } from '@/engine/types.js';

const VIDE: IndividualMatchStats = {
  minutesPlayed: 80,
  tries: 0, tackles: 0, tacklesMissed: 0, metersWithBall: 0, carries: 0,
  turnoversWon: 0, handlingErrors: 0, penaltiesConceded: 0,
  cards: { yellow: 0, red: 0 },
  kicksFromHand: 0, placeKicks: { attempted: 0, made: 0 },
  defendersBeaten: 0, lineBreaks: 0,
};

const SQUAD = makeSquad('c1' as ClubId, 70);
const joueurA = (position: Position): Player =>
  SQUAD.players.find(p => p.position === position)!;

const note = (position: Position, stats: Partial<IndividualMatchStats>, diff = 0): number =>
  ratePlayer(joueurA(position), { ...VIDE, ...stats }, { pointsDifference: diff })!.rating;

describe('l\'échelle dit ce qu\'elle annonce', () => {
  it('une feuille vide vaut cinq, pas zéro', () => {
    // Ne rien produire de mesurable est le cas médian d'un avant : ce n'est pas
    // une contre-performance, c'est le silence de la statistique.
    expect(note('PILIER_GAUCHE', {})).toBe(5);
  });

  it('la médiane de la ligne vaut six', () => {
    // 2,3 points de contribution par 80 minutes pour une première ligne.
    expect(note('PILIER_GAUCHE', { tackles: 1, metersWithBall: 5 })).toBeCloseTo(6, 0);
  });

  it('un match hors norme approche neuf sans l\'atteindre facilement', () => {
    const n = note('AILIER_GAUCHE', { tries: 2, metersWithBall: 60, defendersBeaten: 4, lineBreaks: 2 });
    expect(n).toBeGreaterThan(8);
    expect(n).toBeLessThan(10);
  });

  it('et dix reste hors de portée', () => {
    const n = note('AILIER_GAUCHE', {
      tries: 6, metersWithBall: 300, defendersBeaten: 20, lineBreaks: 10, turnoversWon: 5,
    }, 40);
    expect(n).toBeLessThan(10);
  });
});

describe('on ne compare pas un pilier à un ailier', () => {
  it('la même feuille ne vaut pas la même note selon la ligne', () => {
    // Trois franchissements, c'est un match de rêve pour un pilier et une bonne
    // soirée pour un ailier. Sans cela, le trophée irait toujours aux mêmes.
    const feuille = { metersWithBall: 30, defendersBeaten: 2, lineBreaks: 1 };
    expect(note('PILIER_GAUCHE', feuille)).toBeGreaterThan(note('AILIER_GAUCHE', feuille));
  });
});

describe('les fautes coûtent', () => {
  it('un carton jaune fait tomber la note sous la moyenne', () => {
    const propre = note('TROISIEME_LIGNE_AILE_GAUCHE', { tackles: 3, metersWithBall: 10 });
    const carton = note('TROISIEME_LIGNE_AILE_GAUCHE', {
      tackles: 3, metersWithBall: 10, cards: { yellow: 1, red: 0 },
    });
    expect(carton).toBeLessThan(propre);
    expect(carton).toBeLessThanOrEqual(5);
  });

  it('un rouge coûte plus cher qu\'un jaune', () => {
    const jaune = note('TALONNEUR', { cards: { yellow: 1, red: 0 } });
    const rouge = note('TALONNEUR', { cards: { yellow: 0, red: 1 } });
    expect(rouge).toBeLessThan(jaune);
  });

  it('et la note ne descend jamais sous un', () => {
    expect(note('TALONNEUR', {
      cards: { yellow: 2, red: 1 }, penaltiesConceded: 6, handlingErrors: 6, tacklesMissed: 10,
    }, -40)).toBeGreaterThanOrEqual(1);
  });
});

describe('ce qui n\'est pas noté', () => {
  it('une entrée en fin de match ne reçoit pas de note', () => {
    // Ramener quelques minutes à quatre-vingts ferait sortir un remplaçant
    // entré à la 78ᵉ à dix sur dix : c'est une division par un petit nombre,
    // pas une performance.
    const joueur = joueurA('ARRIERE');
    const stats = { ...VIDE, minutesPlayed: MINUTES_MINIMUM - 1, tries: 1 };
    expect(ratePlayer(joueur, stats, { pointsDifference: 0 })).toBeUndefined();
  });

  it('mais le temps de jeu rapporte la contribution à quatre-vingts minutes', () => {
    const court = note('NUMERO_8', { minutesPlayed: 20, tackles: 2 });
    const long = note('NUMERO_8', { minutesPlayed: 80, tackles: 2 });
    expect(court).toBeGreaterThan(long);
  });
});

describe('la contribution brute', () => {
  it('additionne les gestes et retranche les fautes', () => {
    expect(contribution({ ...VIDE, tries: 1 })).toBe(12);
    expect(contribution({ ...VIDE, cards: { yellow: 0, red: 1 } })).toBe(-14);
    expect(contribution({ ...VIDE, tries: 1, cards: { yellow: 1, red: 0 } })).toBe(6);
  });
});

describe('l\'homme du match', () => {
  /** Une rencontre réelle, notée des deux côtés. */
  function noter(seed: string) {
    const input = makeMatchInput({ homeNiveau: 70, awayNiveau: 70, matchId: seed });
    const result = simulateMatch(input, seed);
    const camp = (side: 'home' | 'away'): readonly Player[] =>
      [...input[side].squad.starters, ...input[side].squad.substitutes]
        .map(e => input.playersById.get(e.playerId)!);
    const diff = result.homeScore - result.awayScore;
    return {
      result,
      ratings: rateMatch([
        { players: camp('home'), pointsDifference: diff },
        { players: camp('away'), pointsDifference: -diff },
      ], result.individualStats),
    };
  }

  it('est la meilleure note de la rencontre', () => {
    const { ratings } = noter('motm_1');
    const meilleure = Math.max(...[...ratings.byPlayer.values()].map(n => n.rating));
    expect(ratings.manOfTheMatch?.rating).toBe(meilleure);
  });

  it('note les deux camps, titulaires et remplaçants entrés', () => {
    const { ratings } = noter('motm_2');
    expect(ratings.byPlayer.size).toBeGreaterThan(20);
    for (const n of ratings.byPlayer.values()) {
      expect(n.minutesPlayed).toBeGreaterThanOrEqual(MINUTES_MINIMUM);
    }
  });

  it('peut revenir à un joueur battu', () => {
    // Le bonus de résultat penche vers le vainqueur sans l'imposer : mesuré sur
    // 400 rencontres, 14 % des distinctions vont au camp perdant. Un titre qui
    // suivrait mécaniquement le score ne dirait rien du joueur.
    let perdant = 0;
    for (let i = 0; i < 60; i++) {
      const { result, ratings } = noter(`motm_${i}`);
      const homme = ratings.manOfTheMatch;
      if (!homme || result.homeScore === result.awayScore) continue;
      const stats = result.individualStats.get(homme.playerId);
      if (!stats) continue;
      const cotéHome = [...result.individualStats.keys()].indexOf(homme.playerId) < 23;
      const gagnantHome = result.homeScore > result.awayScore;
      if (cotéHome !== gagnantHome) perdant++;
    }
    expect(perdant).toBeGreaterThan(0);
  });
});
