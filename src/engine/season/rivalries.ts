/**
 * Les rivalités — V0.48.
 *
 * Un Top 14 sans Toulouse–Toulon, sans Bayonne–Biarritz, sans Clermont–Toulouse
 * n'est pas un Top 14. Rien dans le moteur ni dans les données ne distinguait
 * pourtant ces rencontres d'une journée quelconque : mêmes tribunes, même
 * vestiaire, même lendemain.
 *
 * ## Ce qu'un derby change
 *
 * Trois choses, et aucune n'est décorative :
 *
 *  - **l'enceinte se remplit**, quel que soit le classement ;
 *  - **le vestiaire se tend** : on gagne davantage de moral en gagnant, on en
 *    perd davantage en perdant ;
 *  - **la mémoire compte** : une série de défaites contre le voisin pèse sur le
 *    match suivant, et c'est ce qui fait qu'un derby n'est jamais un match
 *    comme un autre même quand les deux équipes sont médiocres.
 *
 * ## Pourquoi une table plutôt qu'une règle
 *
 * Une rivalité n'est pas une fonction de la géographie ni du classement : c'est
 * une histoire. Toulon et Toulouse ne sont pas voisins ; Bayonne et Biarritz le
 * sont trop. On l'écrit donc, on ne la calcule pas.
 */

import type { ClubId } from '../types.js';

// =============================================================================
// Le tableau des rivalités
// =============================================================================

export type RivalryIntensity = 'DERBY' | 'CLASSIQUE';

export interface Rivalry {
  readonly a: ClubId;
  readonly b: ClubId;
  readonly intensity: RivalryIntensity;
  /** Ce que la presse en dit, en une formule. */
  readonly name: string;
}

const R = (a: string, b: string, intensity: RivalryIntensity, name: string): Rivalry =>
  ({ a: a as ClubId, b: b as ClubId, intensity, name });

/**
 * Rivalités du Top 14 et de la Pro D2.
 *
 * Les **derbies** sont géographiques et charrient plus que du sport ; les
 * **classiques** opposent deux places fortes sans voisinage. Les premiers
 * enflamment les tribunes, les seconds pèsent au classement.
 */
export const RIVALRIES: readonly Rivalry[] = [
  R('bayonne', 'prod2_biarritz', 'DERBY', 'Derby de la côte basque'),
  R('toulouse', 'castres', 'DERBY', 'Derby occitan'),
  R('toulouse', 'usap', 'DERBY', 'Derby du Sud'),
  R('pau', 'bayonne', 'DERBY', 'Derby du Sud-Ouest'),
  R('lyon', 'clermont', 'DERBY', 'Derby auvergnat-rhodanien'),
  R('racing', 'stade', 'DERBY', 'Derby parisien'),
  R('prod2_agen', 'prod2_montauban', 'DERBY', 'Derby du Lot-et-Garonne'),
  R('prod2_brive', 'clermont', 'DERBY', 'Derby du Massif central'),

  R('toulouse', 'toulon', 'CLASSIQUE', 'Le classique'),
  R('toulouse', 'clermont', 'CLASSIQUE', 'Choc des géants'),
  R('larochelle', 'toulouse', 'CLASSIQUE', 'La finale permanente'),
  R('ubb', 'larochelle', 'CLASSIQUE', 'Duel de l\'Atlantique'),
  R('toulon', 'montpellier', 'CLASSIQUE', 'Choc méditerranéen'),
];

/** Rivalité entre deux clubs, s'il en existe une. */
export function rivalryBetween(a: ClubId, b: ClubId): Rivalry | undefined {
  return RIVALRIES.find(r =>
    (r.a === a && r.b === b) || (r.a === b && r.b === a));
}

/** Tous les rivaux d'un club. */
export function rivalsOf(clubId: ClubId): readonly ClubId[] {
  return RIVALRIES
    .filter(r => r.a === clubId || r.b === clubId)
    .map(r => (r.a === clubId ? r.b : r.a));
}

// =============================================================================
// Ce qu'un derby change
// =============================================================================

/**
 * Supplément de remplissage un jour de rivalité.
 *
 * Un derby se joue à guichets fermés même quand les deux équipes sont
 * médiocres — c'est précisément ce qui le distingue d'un match ordinaire.
 */
export function attendanceBonus(intensity: RivalryIntensity): number {
  return intensity === 'DERBY' ? 0.12 : 0.07;
}

/**
 * Multiplicateur d'effet sur le moral, en victoire comme en défaite.
 *
 * Symétrique à dessein : gagner un derby fait plus de bien, le perdre fait plus
 * de mal. Ne bonifier que la victoire ferait du derby une aubaine.
 */
export function moodMultiplier(intensity: RivalryIntensity): number {
  return intensity === 'DERBY' ? 2 : 1.5;
}

// =============================================================================
// La mémoire des confrontations
// =============================================================================

export interface HeadToHead {
  readonly wins: number;
  readonly draws: number;
  readonly losses: number;
  /** Série en cours, positive si l'on gagne, négative si l'on perd. */
  readonly streak: number;
}

export const EMPTY_HEAD_TO_HEAD: HeadToHead = { wins: 0, draws: 0, losses: 0, streak: 0 };

export function recordResult(h2h: HeadToHead, outcome: 'V' | 'N' | 'D'): HeadToHead {
  if (outcome === 'N') {
    return { ...h2h, draws: h2h.draws + 1, streak: 0 };
  }
  if (outcome === 'V') {
    return {
      ...h2h,
      wins: h2h.wins + 1,
      streak: h2h.streak >= 0 ? h2h.streak + 1 : 1,
    };
  }
  return {
    ...h2h,
    losses: h2h.losses + 1,
    streak: h2h.streak <= 0 ? h2h.streak - 1 : -1,
  };
}

/**
 * Poids de l'histoire sur la rencontre à venir, en points de moral.
 *
 * Une série de défaites contre le voisin pèse : c'est ce qui empêche un derby
 * d'être un match comme un autre entre deux équipes médiocres. On borne, sinon
 * une longue disette rendrait le club durablement inapte à jouer ce match.
 */
export function historyPressure(h2h: HeadToHead): number {
  return Math.max(-6, Math.min(6, h2h.streak * 2));
}

/** Ce que la presse rappelle avant le coup d'envoi. */
export function rivalryContext(rivalry: Rivalry, h2h: HeadToHead): string {
  if (h2h.streak <= -3) {
    return `${rivalry.name} — ${-h2h.streak} défaites de rang contre eux. La presse ne parle que de ça.`;
  }
  if (h2h.streak >= 3) {
    return `${rivalry.name} — ${h2h.streak} victoires de rang. L'ascendant est net.`;
  }
  if (h2h.wins + h2h.draws + h2h.losses === 0) {
    return `${rivalry.name} — première confrontation de votre mandat.`;
  }
  return `${rivalry.name} — ${h2h.wins}V ${h2h.draws}N ${h2h.losses}D depuis votre arrivée.`;
}
