/**
 * Plan tactique de match — V0.32.
 *
 * `PreMatchTacticalPlan` existait depuis les premières versions : déclaré dans
 * les types, transporté dans chaque `MatchInput`, affiché nulle part et — c'est
 * le point — **lu par aucun sous-système**. Les deux équipes de tous les matchs
 * du jeu partaient avec la même valeur codée en dur.
 *
 * Le moteur simule cinq sous-systèmes en profondeur ; le manager n'avait que
 * deux boutons (charge d'entraînement, focus avants/arrières) pour l'infléchir.
 * Ce module comble l'écart : il traduit un plan en coefficients que la session
 * injecte dans les phases.
 *
 * ## Trois curseurs, trois arbitrages
 *
 * Aucun réglage n'est gratuit. Occuper le terrain, c'est rendre le ballon ;
 * monter en défense, c'est ouvrir des brèches ; travailler la mêlée, c'est ne
 * pas travailler le reste. Un plan sans contrepartie serait un plan qu'on
 * choisit une fois pour toutes.
 *
 * ## Le plan neutre
 *
 * `MEDIANE / RIDEAU / NONE` renvoie exactement l'identité (multiplicateurs à 1,
 * bonus à 0). C'est ce que joue le harnais de calibration : les cibles
 * statistiques du moteur restent mesurées sur un jeu sans parti pris.
 *
 * ## Ce qu'on a cherché à obtenir
 *
 * Aucun plan ne doit dominer. Mesuré sur 1500 matchs entre équipes de niveau
 * égal, le différentiel de points s'étale de +0,7 à −1,1 autour du plan neutre —
 * en dessous du bruit d'un match isolé. Ce qui change nettement, ce sont les
 * **profils** : l'occupation haute produit des matchs fermés (18/17), le ballon
 * en main des matchs ouverts (18/19), la défense montante récupère le plus de
 * ballons mais concède une pénalité de plus par match, la défense reculée en
 * concède une de moins, et le travail de la mêlée fait passer sa conquête de
 * 76 % à 81 %.
 *
 * Un plan ne fait donc pas gagner en soi : il décide *comment* on joue, et donc
 * quels adversaires et quels effectifs il avantage. C'est la seule façon d'avoir
 * un choix tactique qui reste intéressant après dix matchs.
 */

import type { LineoutPhilosophy, PreMatchTacticalPlan } from './types.js';
import type { TacticalIdentity } from '../types.js';

// =============================================================================
// Effets
// =============================================================================

export interface TacticalModifiers {
  /** Fréquence du jeu au pied depuis le jeu courant. */
  readonly kickTendency: number;
  /** Erreurs de manipulation de cette équipe quand elle attaque. */
  readonly ownErrorRisk: number;
  /** Erreurs que cette défense force chez l'attaque adverse. */
  readonly pressureOnAttack: number;
  /** Pénalités concédées par cette défense. */
  readonly penaltyRisk: number;
  /** Essais concédés par cette défense. */
  readonly tryConceded: number;
  /** Bonus tactique appliqué en mêlée. */
  readonly scrumBonus: number;
  /** Bonus tactique appliqué en touche. */
  readonly lineoutBonus: number;
  /** Malus tactique en jeu courant : le prix de la spécialisation. */
  readonly openPlayMalus: number;
  /** Philosophie de touche imposée par un focus MAUL, si aucune n'est déjà fixée. */
  readonly lineoutPhilosophy?: LineoutPhilosophy;
}

export const NEUTRAL_TACTICS: TacticalModifiers = {
  kickTendency: 1,
  ownErrorRisk: 1,
  pressureOnAttack: 1,
  penaltyRisk: 1,
  tryConceded: 1,
  scrumBonus: 0,
  lineoutBonus: 0,
  openPlayMalus: 0,
};

/** Plan sans parti pris — référence du moteur et valeur de repli. */
export const NEUTRAL_PLAN: PreMatchTacticalPlan = {
  occupation: 'MEDIANE',
  defensiveLine: 'RIDEAU',
  setPiecesFocus: ['NONE'],
};

// =============================================================================
// Traduction
// =============================================================================

export function resolveTactics(plan: PreMatchTacticalPlan | undefined): TacticalModifiers {
  if (!plan) return NEUTRAL_TACTICS;

  let m = { ...NEUTRAL_TACTICS } as {
    -readonly [K in keyof TacticalModifiers]: TacticalModifiers[K];
  };

  // ---- Occupation : où l'on veut jouer -------------------------------------
  switch (plan.occupation) {
    case 'HAUTE':
      // On rend le ballon pour jouer dans le camp adverse. Le pied prend le pas
      // sur la construction : moins d'occasions bâties, meilleure position.
      m.kickTendency = 3.2;
      m.ownErrorRisk = 0.84;
      // La contrepartie du ballon rendu : l'adversaire repart de plus loin.
      // Sans ce gain, occuper le terrain n'était qu'une façon de perdre.
      m.tryConceded *= 0.80;
      break;
    case 'BASSE':
      // On garde le ballon, y compris depuis chez soi. Plus de temps de jeu,
      // mais chaque ballon porté près de sa ligne est un risque assumé.
      m.kickTendency = 0.20;
      m.ownErrorRisk = 1.30;
      // On ne dégage pas : quand le ballon est perdu, il l'est près de chez soi.
      m.tryConceded *= 1.10;
      break;
    case 'MEDIANE':
    default:
      break;
  }

  // ---- Ligne défensive : agressivité ---------------------------------------
  switch (plan.defensiveLine) {
    case 'MONTANTE':
      // Défense montante : on étouffe l'attaque, on force la faute de main —
      // et on s'expose au décalage comme à la sanction de l'arbitre.
      // Le gratte doit payer : la faute de main part d'une base dix fois plus
      // basse que la pénalité, si bien qu'un multiplicateur modeste sur l'une ne
      // compensait jamais un multiplicateur modeste sur l'autre.
      m.pressureOnAttack = 2.8;
      m.penaltyRisk = 1.30;
      m.tryConceded *= 1.14;
      break;
    case 'STAND_OFF':
      // Rideau reculé : on ne prend aucun risque, on concède le terrain et la
      // possession plutôt que la brèche.
      m.pressureOnAttack = 0.70;
      m.penaltyRisk = 0.65;
      // On laisse venir : moins de fautes, mais l'adversaire finit par passer.
      // Lui accorder aussi moins d'essais faisait du rideau reculé un choix sans
      // aucun inconvénient — donc le seul choix rationnel.
      m.tryConceded *= 1.0;
      break;
    case 'RIDEAU':
    default:
      break;
  }

  // ---- Phases arrêtées : ce qu'on a travaillé à l'entraînement --------------
  const focus = plan.setPiecesFocus.filter(f => f !== 'NONE');
  for (const f of focus) {
    if (f === 'MELEE') m.scrumBonus += 10;
    if (f === 'TOUCHE') m.lineoutBonus += 10;
    if (f === 'MAUL') {
      m.lineoutBonus += 6;
      m.lineoutPhilosophy = 'MAUL_LOURD';
    }
  }
  // La semaine n'est pas extensible : chaque axe travaillé se paie en jeu
  // courant. Sans ce coût, tout manager cocherait les trois cases.
  m.openPlayMalus = focus.length * 2;

  return m;
}

// =============================================================================
// Plans de l'IA
// =============================================================================

/**
 * Plan choisi par un club non dirigé par l'utilisateur.
 *
 * Adossé à l'identité du club plutôt qu'à un tirage : affronter Castres ou le
 * Stade Français doit se sentir différemment, et de façon reproductible. Sans
 * cela, le manager serait le seul du championnat à avoir un plan de match.
 */
export function planForIdentity(identity: TacticalIdentity): PreMatchTacticalPlan {
  switch (identity) {
    case 'JEU_AVANTS':
      // Occupation, conquête, maul : on joue devant et on avance au pied.
      return { occupation: 'HAUTE', defensiveLine: 'RIDEAU', setPiecesFocus: ['MELEE', 'MAUL'] };
    case 'GRAND_ECART':
      // Ballon en main d'un bord à l'autre, quitte à jouer de loin.
      return { occupation: 'BASSE', defensiveLine: 'MONTANTE', setPiecesFocus: ['TOUCHE'] };
    case 'DEFENSE_DE_FER':
      // On ne concède rien : rideau discipliné, terrain rendu au pied.
      return { occupation: 'HAUTE', defensiveLine: 'STAND_OFF', setPiecesFocus: ['NONE'] };
    case 'MIXTE':
    default:
      return NEUTRAL_PLAN;
  }
}

// =============================================================================
// Libellés
// =============================================================================

export const OCCUPATION_LABEL: Readonly<Record<PreMatchTacticalPlan['occupation'], string>> = {
  HAUTE: 'Occupation haute',
  MEDIANE: 'Équilibrée',
  BASSE: 'Ballon en main',
};

export const OCCUPATION_HINT: Readonly<Record<PreMatchTacticalPlan['occupation'], string>> = {
  HAUTE: 'On tape pour prendre le terrain. Meilleure position, moins de ballons joués.',
  MEDIANE: 'Ni parti pris territorial ni prise de risque.',
  BASSE: 'On garde le ballon, même de loin. Plus de jeu, plus d\'erreurs.',
};

export const DEFENSIVE_LINE_LABEL: Readonly<Record<PreMatchTacticalPlan['defensiveLine'], string>> = {
  MONTANTE: 'Montante',
  RIDEAU: 'Rideau',
  STAND_OFF: 'Reculée',
};

export const DEFENSIVE_LINE_HINT: Readonly<Record<PreMatchTacticalPlan['defensiveLine'], string>> = {
  MONTANTE: 'On étouffe l\'attaque. Beaucoup de ballons grattés, plus de pénalités et de brèches.',
  RIDEAU: 'Défense de référence, sans excès dans un sens ni dans l\'autre.',
  STAND_OFF: 'On ne prend aucun risque. Peu de fautes, mais l\'adversaire garde le ballon.',
};

export const SET_PIECE_LABEL: Readonly<Record<'MELEE' | 'TOUCHE' | 'MAUL', string>> = {
  MELEE: 'Mêlée',
  TOUCHE: 'Touche',
  MAUL: 'Maul',
};
