/**
 * Le moral sur le terrain — V0.51.
 *
 * Le jeu porte depuis la V0.4 un système humain considérable : sept sources de
 * moral, trente traits, quatre cent trente-cinq paires de relations. S'y sont
 * ajoutés les conversations et les promesses (V0.48), la causerie (V0.45), les
 * demandes de départ (V0.49), le capitanat et la hiérarchie de l'effectif
 * (V0.50).
 *
 * Tout cela alimente `dynamic.mood`. Et **aucun des sept sous-systèmes de
 * match** — franchissement, jeu courant, ruck, mêlée, touche, défense de ligne,
 * jeu au pied — ne lisait cette valeur. Le moral n'apparaissait dans le moteur
 * que pour être *modifié* : cartons, blessures, causerie.
 *
 * Autrement dit : une équipe à 20 de moral jouait exactement comme une équipe à
 * 90. Tout ce qu'un manager fait avec des hommes était un jeu parallèle, sans
 * effet sur le résultat — le défaut « écrit mais jamais lu » à son échelle
 * maximale, et sur la prémisse même du genre.
 *
 * ## Deux grandeurs, pas une
 *
 *  - le **moral**, moyenne du XV aligné : ce que chacun a dans la tête ;
 *  - la **cohésion**, tirée du graphe de relations : ce qu'ils ont entre eux.
 *    Quinze bons joueurs qui ne se supportent pas ne font pas une équipe, et le
 *    graphe existait sans jamais peser sur un match.
 *
 * ## Pourquoi l'effet est asymétrique
 *
 * C'est le point de conception le plus important du module. Le moral monte
 * quand on gagne — la victoire est l'une des sept sources. Un bonus symétrique
 * créerait donc une boucle : gagner rend meilleur, ce qui fait gagner
 * davantage, et le championnat se fige au bout de dix journées.
 *
 * Or ce n'est pas ainsi que ça se passe dans un vestiaire. La confiance donne
 * **un peu** ; un groupe empoisonné coûte **beaucoup**. On plafonne donc le
 * gain très bas et on laisse la pénalité mordre, ce qui casse l'emballement :
 * celui qui gagne ne reçoit presque rien de plus, celui qui sombre paie.
 */

import type { Player } from '../types.js';
import type { RelationsState } from '../human/relationships.js';

/**
 * Moral d'un effectif au repos, tel que le seed et le harnais de calibration le
 * fixent tous deux.
 *
 * C'est le point neutre du module : à 60, tous les facteurs valent exactement 1
 * ou 0. La calibration existante reste donc valide **par construction**, et
 * toute dérive mesurée serait un vrai effet, pas un décalage d'origine.
 */
export const NEUTRAL_MOOD = 60;

// =============================================================================
// L'état du groupe
// =============================================================================

export interface TeamMorale {
  /** Moral moyen du XV sur le terrain, 0-100. */
  readonly mood: number;
  /**
   * Cohésion du XV aligné, -100 à +100.
   *
   * Compte les affinités et les inimitiés **entre joueurs alignés ensemble** :
   * deux joueurs en conflit qui ne se croisent jamais sur une feuille de match
   * ne coûtent rien.
   */
  readonly cohesion: number;
}

export const NEUTRAL_MORALE: TeamMorale = { mood: NEUTRAL_MOOD, cohesion: 0 };

/**
 * Seuils d'une vraie affinité et d'un vrai conflit.
 *
 * Ce sont ceux que [relationships](../human/relationships.ts) utilise lui-même
 * pour qualifier une relation d'`AMI` ou de `CONFLIT` : la cohésion se lit donc
 * avec le vocabulaire du module qui la produit, plutôt qu'avec un seuil inventé
 * ici.
 *
 * Conséquence mesurée en jeu : à la première journée d'une carrière, la
 * relation la plus forte d'un effectif du Top 14 plafonne vers +25, et la
 * cohésion vaut donc **zéro**. Elle se construit ensuite — environ deux points
 * par match disputé ensemble et gagné. C'est voulu : un groupe soudé se
 * fabrique sur une saison, il ne se décrète pas au premier entraînement.
 */
const AFFINITY = 50;
const CONFLICT = -50;

/**
 * État du groupe aligné.
 *
 * La cohésion est ramenée au nombre de paires possibles du XV, pas au nombre
 * de joueurs : un conflit pèse d'autant moins qu'il se dilue dans un groupe
 * nombreux, ce qui est aussi vrai dans un vestiaire.
 */
export function teamMorale(
  onField: readonly Player[],
  relations?: RelationsState,
): TeamMorale {
  if (onField.length === 0) return NEUTRAL_MORALE;

  const mood = onField.reduce((sum, p) => sum + p.dynamic.mood, 0) / onField.length;

  if (relations === undefined || onField.length < 2) {
    return { mood, cohesion: 0 };
  }

  const ids = new Set(onField.map(p => p.id));
  let affinities = 0;
  let conflicts = 0;
  for (const r of relations.byPair.values()) {
    if (!ids.has(r.fromId) || !ids.has(r.toId)) continue;
    if (r.score >= AFFINITY) affinities++;
    else if (r.score <= CONFLICT) conflicts++;
  }

  const pairs = (onField.length * (onField.length - 1)) / 2;
  // Un conflit pèse le double d'une affinité : on remarque bien plus celui qui
  // ne passe pas le ballon à son voisin que ceux qui s'entendent.
  const raw = ((affinities - conflicts * 2) / pairs) * 100;
  return { mood, cohesion: Math.max(-100, Math.min(100, Math.round(raw))) };
}

// =============================================================================
// Ce que le groupe change
// =============================================================================

export interface MoraleEffects {
  /** Bonus additif sur l'échelle 0-100 des phases, comme l'élan. */
  readonly confidence: number;
  /** Multiplicateur du risque d'erreur de manipulation. */
  readonly errorFactor: number;
  /** Multiplicateur de l'engagement défensif : sous 1, on plaque moins fort. */
  readonly tackleFactor: number;
  /** Multiplicateur d'indiscipline : un groupe qui va mal se sanctionne. */
  readonly indisciplineFactor: number;
}

export const NO_MORALE_EFFECT: MoraleEffects = {
  confidence: 0, errorFactor: 1, tackleFactor: 1, indisciplineFactor: 1,
};

/**
 * Plafond du gain, exprimé en fraction de l'amplitude de la pénalité.
 *
 * Mesuré sur 800 matchs à effectifs identiques : à 0,35 le groupe euphorique
 * gagnait +3,1 points de taux de victoire quand le groupe effondré en perdait
 * 6 — un rapport de deux pour un, insuffisant pour casser la boucle « je gagne
 * donc j'ai le moral donc je gagne ». À 0,20, le gain retombe sous les deux
 * points.
 */
const UPSIDE_CAP = 0.20;

/**
 * Écart au moral neutre, normalisé et **asymétrique**.
 *
 * Au-dessus de 60, le gain sature vite : un vestiaire heureux ne fait pas
 * gagner, il évite seulement de faire perdre. En dessous, la pente est franche
 * jusqu'au fond.
 *
 * Renvoie une valeur dans [-1, +UPSIDE_CAP]. Ce plafond bas est délibéré :
 * c'est lui qui empêche la boucle « je gagne donc j'ai le moral donc je gagne ».
 */
function moraleScale(mood: number): number {
  const clamped = Math.max(0, Math.min(100, mood));
  if (clamped >= NEUTRAL_MOOD) {
    return ((clamped - NEUTRAL_MOOD) / (100 - NEUTRAL_MOOD)) * UPSIDE_CAP;
  }
  return -((NEUTRAL_MOOD - clamped) / NEUTRAL_MOOD);
}

/** Effet de la cohésion, de même amplitude et de même asymétrie. */
function cohesionScale(cohesion: number): number {
  const c = Math.max(-100, Math.min(100, cohesion)) / 100;
  return c >= 0 ? c * UPSIDE_CAP : c;
}

/**
 * Ce qu'un état d'esprit vaut sur le terrain.
 *
 * Quatre canaux, choisis parce qu'ils correspondent à ce qu'on voit vraiment
 * chez une équipe qui doute : elle lâche des ballons, elle ne monte plus en
 * défense, elle prend des pénalités bêtes, et elle ose moins.
 *
 * Le moral porte les quatre ; la cohésion ne touche que ce qui se joue **entre
 * joueurs** — la manipulation et l'engagement collectif. Un homme malheureux
 * peut être discipliné ; un groupe divisé lâche des ballons.
 */
export function moraleEffects(morale: TeamMorale): MoraleEffects {
  const m = moraleScale(morale.mood);
  const c = cohesionScale(morale.cohesion);
  const together = m * 0.7 + c * 0.3;

  return {
    confidence: Math.round(m * 4 * 10) / 10,
    errorFactor: Math.round((1 - together * 0.30) * 1000) / 1000,
    tackleFactor: Math.round((1 + together * 0.16) * 1000) / 1000,
    indisciplineFactor: Math.round((1 - m * 0.25) * 1000) / 1000,
  };
}

/**
 * Ce que le staff en dit avant le coup d'envoi.
 *
 * Qualifie sans chiffrer, comme partout ailleurs : le manager doit sentir l'état
 * de son groupe, pas lire une jauge.
 */
export function moraleHint(morale: TeamMorale): string {
  const m = morale.mood;
  const c = morale.cohesion;

  if (m < 35) return 'Le groupe est au fond du trou. Ça va se voir sur le terrain.';
  if (m < 48) return 'Le vestiaire tire la langue. On sent que la confiance manque.';
  if (c <= -25) return 'Le moral tient, mais ce groupe ne joue pas ensemble.';
  if (m > 75 && c >= 20) return 'Groupe soudé et confiant. Rien à signaler.';
  if (m > 75) return 'Le moral est excellent.';
  return 'Le vestiaire est dans une disposition normale.';
}
