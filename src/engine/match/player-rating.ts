/**
 * La note du joueur, sur dix : V0.61.
 *
 * Le moteur produit treize statistiques individuelles par rencontre depuis la
 * V0.13. Elles n'ont jamais servi qu'à des agrégats de fin de saison. Après un
 * match, le manager lisait un score, un résumé narratif, et rien qui lui dise
 * qui avait tenu son poste.
 *
 * ## Ce que le moteur produit vraiment, par match et par joueur
 *
 * Mesuré sur 400 rencontres entre équipes de niveau 70, moyennes par match :
 *
 * | ligne | minutes | essais | plaquages | mètres | battus | franchis |
 * |---|---|---|---|---|---|---|
 * | 1ʳᵉ ligne | 40,1 | 0,04 | 1,09 | 1,5 | 0,09 | 0,02 |
 * | 2ᵉ ligne | 53,2 | 0,05 | 1,48 | 2,3 | 0,13 | 0,03 |
 * | 3ᵉ ligne | 59,9 | 0,05 | 1,61 | 3,5 | 0,20 | 0,05 |
 * | charnière | 43,1 | 0,12 | 0,38 | 1,9 | 0,11 | 0,03 |
 * | trois-quarts | 64,8 | 0,21 | 0,55 | 3,9 | 0,23 | 0,06 |
 *
 * C'est **très** en dessous du rugby réel, où un avant plaque douze fois par
 * match. L'attribution nominative du moteur est parcimonieuse : sur environ
 * soixante-quinze phases, seuls le porteur et le plaqueur de la phase résolue
 * sont crédités. La conséquence est une contrainte de conception, pas un détail
 * d'implémentation : **la moitié des joueurs ne produit rien de mesurable dans
 * un match donné**, et une note bâtie sur une échelle inventée serait du bruit
 * habillé en chiffre.
 *
 * ## D'où la note est un rang, pas un barème
 *
 * On calcule une contribution pondérée, ramenée à quatre-vingts minutes, puis
 * on la situe dans la distribution **de sa ligne**, mesurée sur les mêmes 400
 * rencontres :
 *
 * | ligne | médiane | 9ᵉ décile | 99ᵉ centile |
 * |---|---|---|---|
 * | 1ʳᵉ ligne | 2,3 | 12,6 | 40,5 |
 * | 2ᵉ ligne | 3,0 | 12,0 | 33,6 |
 * | 3ᵉ ligne | 3,6 | 13,7 | 31,5 |
 * | charnière | 2,4 | 18,9 | 73,8 |
 * | trois-quarts | 2,1 | 15,0 | 31,9 |
 *
 * Une note de 6 est donc une performance médiane à son poste, 7,5 le neuvième
 * décile, 9 le centième. Le chiffre veut dire quelque chose de vérifiable, et
 * il ne se compare qu'entre joueurs de la même ligne, ce qui est exactement la
 * façon dont on lit une feuille de match.
 *
 * On ne compare jamais un pilier à un ailier : c'est la même règle que pour les
 * honneurs de fin de saison ([../season/honours.ts](../season/honours.ts)), et
 * elle a la même raison d'être.
 */

import type { Player, PlayerId, Position } from '../types.js';
import type { IndividualMatchStats } from './types.js';

// =============================================================================
// La contribution
// =============================================================================

type Line = 'PREMIERE_LIGNE' | 'DEUXIEME_LIGNE' | 'TROISIEME_LIGNE' | 'CHARNIERE' | 'TROIS_QUARTS';

function lineOf(position: Position): Line {
  switch (position) {
    case 'PILIER_GAUCHE': case 'TALONNEUR': case 'PILIER_DROIT':
      return 'PREMIERE_LIGNE';
    case 'DEUXIEME_LIGNE_GAUCHE': case 'DEUXIEME_LIGNE_DROITE':
      return 'DEUXIEME_LIGNE';
    case 'TROISIEME_LIGNE_AILE_GAUCHE': case 'TROISIEME_LIGNE_AILE_DROITE': case 'NUMERO_8':
      return 'TROISIEME_LIGNE';
    case 'DEMI_DE_MELEE': case 'OUVREUR':
      return 'CHARNIERE';
    default:
      return 'TROIS_QUARTS';
  }
}

/**
 * Ce que vaut chaque geste, en points de contribution.
 *
 * Les mêmes pour tous les postes : c'est la distribution par ligne qui fait la
 * différence entre un pilier et un ailier, pas le prix d'un plaquage. Un
 * barème par poste **et** un rang par poste corrigerait deux fois la même
 * chose.
 */
const VALEUR = {
  essai: 12,
  butReussi: 3,
  franchissement: 4,
  defenseurBattu: 2,
  grattage: 6,
  plaquage: 1.5,
  metre: 0.15,
} as const;

/**
 * Ce que chaque faute retire.
 *
 * Le carton pèse lourd volontairement : dix minutes à quatorze coûtent à
 * l'équipe entière, et c'est la seule statistique individuelle du moteur dont
 * le manager voit immédiatement la conséquence au tableau d'affichage.
 */
const PENALITE = {
  plaquageManque: 1.5,
  fauteDeMain: 2,
  penaliteConcedee: 2.5,
  cartonJaune: 6,
  cartonRouge: 14,
} as const;

/** Contribution brute d'une feuille de statistiques. */
export function contribution(stats: IndividualMatchStats): number {
  return (
    stats.tries * VALEUR.essai
    + stats.placeKicks.made * VALEUR.butReussi
    + stats.lineBreaks * VALEUR.franchissement
    + stats.defendersBeaten * VALEUR.defenseurBattu
    + stats.turnoversWon * VALEUR.grattage
    + stats.tackles * VALEUR.plaquage
    + stats.metersWithBall * VALEUR.metre
    - stats.tacklesMissed * PENALITE.plaquageManque
    - stats.handlingErrors * PENALITE.fauteDeMain
    - stats.penaltiesConceded * PENALITE.penaliteConcedee
    - stats.cards.yellow * PENALITE.cartonJaune
    - stats.cards.red * PENALITE.cartonRouge
  );
}

// =============================================================================
// Le rang, converti en note
// =============================================================================

/**
 * Les points d'ancrage mesurés, par ligne : médiane, 9ᵉ décile, 99ᵉ centile.
 *
 * Mesurés sur 400 rencontres, contribution ramenée à quatre-vingts minutes.
 * Les mettre à jour si l'attribution individuelle du moteur change : ils
 * décrivent ce que le moteur produit, pas ce qu'on aimerait qu'il produise.
 */
const ANCRES: Readonly<Record<Line, { readonly mediane: number; readonly decile9: number; readonly centile99: number }>> = {
  PREMIERE_LIGNE: { mediane: 2.3, decile9: 12.6, centile99: 40.5 },
  DEUXIEME_LIGNE: { mediane: 3.0, decile9: 12.0, centile99: 33.6 },
  TROISIEME_LIGNE: { mediane: 3.6, decile9: 13.7, centile99: 31.5 },
  CHARNIERE: { mediane: 2.4, decile9: 18.9, centile99: 73.8 },
  TROIS_QUARTS: { mediane: 2.1, decile9: 15.0, centile99: 31.9 },
};

/** Interpolation linéaire entre deux ancrages. */
function entre(x: number, x0: number, x1: number, y0: number, y1: number): number {
  if (x1 <= x0) return y0;
  return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
}

/**
 * Une contribution par quatre-vingts minutes, située dans sa ligne.
 *
 * Cinq pour qui n'a rien produit de mesurable, six pour la médiane, sept et
 * demi pour le neuvième décile, neuf pour le centième. Au delà, on approche dix
 * sans jamais l'atteindre : la note parfaite n'existe pas, et un match
 * exceptionnel ne doit pas se confondre avec un match record.
 */
function noteDeLaContribution(par80: number, ligne: Line): number {
  const a = ANCRES[ligne];
  if (par80 <= 0) {
    // Territoire des fautes : carton, pénalités concédées, ballons perdus.
    return Math.max(1, entre(par80, -20, 0, 1, 5));
  }
  if (par80 <= a.mediane) return entre(par80, 0, a.mediane, 5, 6);
  if (par80 <= a.decile9) return entre(par80, a.mediane, a.decile9, 6, 7.5);
  if (par80 <= a.centile99) return entre(par80, a.decile9, a.centile99, 7.5, 9);
  // Asymptote : chaque tranche au dessus du centile rapporte deux fois moins.
  // La note ne touche jamais dix. Un match exceptionnel ne doit pas se
  // confondre avec un match record, et il n'existe pas de copie parfaite.
  return Math.min(9.9, 10 - 1 / (1 + (par80 - a.centile99) / a.centile99));
}

/**
 * Ce que le résultat collectif ajoute ou retire.
 *
 * Une feuille de match ne se lit pas hors du score : le même travail dans une
 * défaite de trente points ne s'apprécie pas comme dans une victoire. L'écart
 * reste volontairement petit, un quart de point, pour que la note dise d'abord
 * ce que le joueur a fait.
 */
const EFFET_RESULTAT = 0.25;

export interface RatingContext {
  /** Différence de points du point de vue du joueur, à la fin du match. */
  readonly pointsDifference: number;
}

export interface PlayerRating {
  readonly playerId: PlayerId;
  /** Note sur dix, à la décimale. */
  readonly rating: number;
  readonly minutesPlayed: number;
  /** Ce qui a fait la note, en clair, pour l'afficher sous le chiffre. */
  readonly highlight: string;
}

/**
 * Combien de minutes il faut avoir jouées pour être noté.
 *
 * Sous ce seuil, la contribution ramenée à quatre-vingts minutes s'emballe :
 * un remplaçant entré à la 78ᵉ qui marque sortirait à dix sur dix, ce qui n'est
 * pas une note mais une division par un petit nombre.
 */
export const MINUTES_MINIMUM = 15;

export function ratePlayer(
  player: Player,
  stats: IndividualMatchStats,
  context: RatingContext,
): PlayerRating | undefined {
  if (stats.minutesPlayed < MINUTES_MINIMUM) return undefined;

  const par80 = (contribution(stats) * 80) / stats.minutesPlayed;
  const base = noteDeLaContribution(par80, lineOf(player.position));
  const resultat = context.pointsDifference > 0 ? EFFET_RESULTAT
    : context.pointsDifference < 0 ? -EFFET_RESULTAT
      : 0;

  return {
    playerId: player.id,
    rating: Math.round(Math.max(1, Math.min(9.9, base + resultat)) * 10) / 10,
    minutesPlayed: stats.minutesPlayed,
    highlight: faitMarquant(stats),
  };
}

/**
 * La ligne qui accompagne la note.
 *
 * On cite ce qui sort de l'ordinaire, dans l'ordre où un commentateur le
 * citerait, et rien si la copie est propre sans être remarquable. Mieux vaut
 * ne rien dire que meubler.
 */
function faitMarquant(s: IndividualMatchStats): string {
  const bouts: string[] = [];
  if (s.cards.red > 0) bouts.push('carton rouge');
  else if (s.cards.yellow > 0) bouts.push(`${s.cards.yellow} carton${s.cards.yellow > 1 ? 's' : ''} jaune${s.cards.yellow > 1 ? 's' : ''}`);
  if (s.tries > 0) bouts.push(`${s.tries} essai${s.tries > 1 ? 's' : ''}`);
  if (s.placeKicks.made > 0) bouts.push(`${s.placeKicks.made}/${s.placeKicks.attempted} au pied`);
  if (s.turnoversWon > 0) bouts.push(`${s.turnoversWon} ballon${s.turnoversWon > 1 ? 's' : ''} gratté${s.turnoversWon > 1 ? 's' : ''}`);
  if (s.lineBreaks > 0) bouts.push(`${s.lineBreaks} franchissement${s.lineBreaks > 1 ? 's' : ''}`);
  if (bouts.length === 0 && s.tackles >= 4) bouts.push(`${s.tackles} plaquages`);
  if (bouts.length === 0 && s.metersWithBall >= 30) bouts.push(`${Math.round(s.metersWithBall)} m parcourus`);
  return bouts.slice(0, 2).join(', ');
}

// =============================================================================
// L'homme du match
// =============================================================================

export interface RatedSide {
  readonly players: readonly Player[];
  readonly pointsDifference: number;
}

export interface MatchRatings {
  readonly byPlayer: ReadonlyMap<PlayerId, PlayerRating>;
  /** Meilleure note de la rencontre, tous camps confondus. */
  readonly manOfTheMatch: PlayerRating | undefined;
}

/**
 * Note tout le monde, et désigne l'homme du match.
 *
 * Le titre revient à la meilleure note des deux camps. Le bonus de résultat
 * fait qu'à performance égale il penche vers le vainqueur, ce qui correspond à
 * l'usage sans l'imposer : un joueur énorme dans une défaite peut le décrocher,
 * et c'est bien ce qu'on veut voir arriver.
 */
export function rateMatch(
  sides: readonly RatedSide[],
  stats: ReadonlyMap<PlayerId, IndividualMatchStats>,
): MatchRatings {
  const byPlayer = new Map<PlayerId, PlayerRating>();
  for (const side of sides) {
    for (const player of side.players) {
      const s = stats.get(player.id);
      if (!s) continue;
      const note = ratePlayer(player, s, { pointsDifference: side.pointsDifference });
      if (note) byPlayer.set(player.id, note);
    }
  }

  let manOfTheMatch: PlayerRating | undefined;
  for (const note of byPlayer.values()) {
    if (!manOfTheMatch
      || note.rating > manOfTheMatch.rating
      || (note.rating === manOfTheMatch.rating && note.minutesPlayed > manOfTheMatch.minutesPlayed)) {
      manOfTheMatch = note;
    }
  }

  return { byPlayer, manOfTheMatch };
}
