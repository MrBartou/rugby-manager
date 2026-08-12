/**
 * L'élan — V0.50.
 *
 * `MatchStateSnapshot.homeMomentum` était déclaré « -100 à +100 » depuis la
 * V0.2 et valait `0` en dur dans la session. La barre d'élan que le joueur
 * regarde pendant la rencontre était calculée **dans l'interface**, à partir de
 * la possession des huit dernières phases : elle ne décidait de rien.
 *
 * Conséquence sur le jeu : un match ne basculait jamais. Il additionnait des
 * phases indépendantes, chacune tirée sur les mêmes probabilités que la
 * précédente. Un essai encaissé à la 60ᵉ ne changeait rien à la 61ᵉ ; une
 * remontée au score n'existait que comme addition de points, jamais comme un
 * moment où l'on sent que ça tourne.
 *
 * ## Ce que l'élan est ici
 *
 * Un scalaire signé, positif pour les locaux, qui **monte par à-coups et
 * redescend tout seul**. Il ne se construit pas sur la possession — garder le
 * ballon sans avancer n'a jamais soulevé un stade — mais sur ce qui fait lever
 * le public : un essai, un turnover, une pénalité arrachée, une mêlée qui
 * recule en face.
 *
 * ## Pourquoi il est bridé
 *
 * L'élan est une boucle de rétroaction positive : bien joué, il rend les fins
 * de match vivantes ; mal bridé, il transforme chaque rencontre en avalanche et
 * fait exploser la variance des scores. Trois garde-fous :
 *
 *  - **il s'érode à chaque phase**, y compris sans rien faire ;
 *  - **il retombe fortement sur un renvoi**, parce qu'un arrêt de jeu casse un
 *    élan — c'est exactement ce que cherche l'équipe qui subit ;
 *  - **ses effets sont plafonnés** à une amplitude comparable à l'avantage du
 *    terrain, pas au-delà.
 */

import type { PhaseOutcome, PhaseType } from './types.js';

/** Borne du compteur, des deux côtés. */
export const MOMENTUM_CAP = 100;

/**
 * Érosion par phase.
 *
 * 0,93 fait retomber un pic d'essai (18) sous le seuil du perceptible en une
 * dizaine de phases, soit deux à trois minutes de jeu. Au-delà, l'élan durerait
 * une mi-temps entière ; en deçà, il s'éteindrait avant d'avoir servi.
 */
const DECAY = 0.93;

/**
 * Érosion supplémentaire sur un renvoi.
 *
 * Après un score, tout le monde se remet en place et la tension retombe. C'est
 * aussi ce qui empêche une équipe lancée d'empiler trois essais sur son seul
 * élan : le renvoi la ramène vers zéro à chaque fois.
 */
const KICKOFF_DECAY = 0.55;

// =============================================================================
// Ce qui fait bouger l'élan
// =============================================================================

/**
 * Variation d'élan produite par une phase, du point de vue des locaux.
 *
 * Les poids se lisent les uns par rapport aux autres : un essai vaut trois
 * turnovers, un turnover vaut deux pénalités arrachées, une percée ne vaut
 * presque rien toute seule. C'est l'ordre qu'on retrouve dans un stade.
 */
export function momentumShift(input: {
  readonly phaseType: PhaseType;
  readonly outcome: PhaseOutcome;
  /** Camp en possession **avant** la phase. */
  readonly attackerBefore: 'HOME' | 'AWAY';
  /** Variation de dominance en mêlée sur cette phase, signée pour les locaux. */
  readonly scrumDominanceShift?: number;
}): number {
  const { outcome, attackerBefore } = input;
  const sign = (team: 'HOME' | 'AWAY'): number => (team === 'HOME' ? 1 : -1);
  let shift = 0;

  if (outcome.tryScored) shift += 18 * sign(outcome.tryScored);

  // Un coup de pied réussi entretient l'élan sans l'embraser : c'est un point
  // pris, pas un stade debout.
  if (outcome.pointsScored && outcome.pointsScored.type !== 'CONVERSION') {
    shift += 6 * sign(outcome.pointsScored.team);
  }

  if (outcome.penaltyAwarded) shift += 4 * sign(outcome.penaltyAwarded);

  // Un carton casse un élan et donne le sien à l'adversaire.
  if (outcome.cardIssued) {
    // Le sanctionné est du camp qui n'a pas obtenu la pénalité ; à défaut,
    // du camp qui défendait.
    const punished = outcome.penaltyAwarded
      ? (outcome.penaltyAwarded === 'HOME' ? 'AWAY' : 'HOME')
      : (attackerBefore === 'HOME' ? 'AWAY' : 'HOME');
    shift -= (outcome.cardIssued.color === 'RED' ? 14 : 9) * sign(punished);
  }

  // Turnover : le ballon change de camp sans coup de sifflet. C'est le
  // deuxième déclencheur du jeu, après l'essai.
  const turnedOver =
    outcome.possessionAfter !== 'CONTESTED'
    && outcome.possessionAfter !== attackerBefore
    && outcome.tryScored === undefined
    && outcome.penaltyAwarded === undefined
    && input.phaseType !== 'KICKOFF'
    && input.phaseType !== 'CONVERSION';
  if (turnedOver) shift += 8 * sign(outcome.possessionAfter);

  // Une percée franche entretient, sans plus.
  if (outcome.metersGained >= 15) shift += 2 * sign(attackerBefore);

  // La mêlée qui recule en face : petit, mais c'est le seul endroit où une
  // domination lente se traduit en élan.
  if (input.scrumDominanceShift !== undefined) {
    shift += Math.max(-3, Math.min(3, input.scrumDominanceShift * 0.25));
  }

  return shift;
}

/**
 * Élan après une phase : on érode, puis on ajoute la secousse.
 *
 * L'érosion passe **avant** l'ajout : un essai doit valoir dix-huit points
 * d'élan pleins au moment où il tombe, pas seize.
 */
export function advanceMomentum(
  current: number,
  shift: number,
  nextPhase: PhaseType,
): number {
  const decayed = current * (nextPhase === 'KICKOFF' ? KICKOFF_DECAY : DECAY);
  const next = decayed + shift;
  return Math.max(-MOMENTUM_CAP, Math.min(MOMENTUM_CAP, Math.round(next * 10) / 10));
}

// =============================================================================
// Ce que l'élan change
// =============================================================================

export interface MomentumEffects {
  /** Bonus additif sur l'échelle 0-100 des phases, comme l'avantage du terrain. */
  readonly tacticalBonus: number;
  /** Multiplicateur de risque d'erreur : sous 1, on lâche moins de ballons. */
  readonly errorFactor: number;
  /** Variation de réussite au pied, en points de pourcentage. */
  readonly kickAccuracyDelta: number;
}

/**
 * Effets pour un camp donné, à partir de son élan (signé de son point de vue).
 *
 * L'amplitude maximale du bonus tactique est de 3 sur une échelle où l'avantage
 * du terrain vaut 5 : un élan maximal pèse moins que de jouer chez soi. C'est
 * volontaire — l'élan doit se sentir sans décider du résultat.
 *
 * L'effet est **symétrique** : celui qui subit lâche davantage de ballons et
 * manque davantage de coups de pied. Ne bonifier que celui qui domine ferait de
 * l'élan un gain net, et le match ne basculerait toujours pas — il
 * s'emballerait seulement dans un sens.
 */
export function momentumEffects(momentumForSide: number): MomentumEffects {
  const m = Math.max(-MOMENTUM_CAP, Math.min(MOMENTUM_CAP, momentumForSide)) / MOMENTUM_CAP;
  return {
    tacticalBonus: Math.round(m * 3 * 10) / 10,
    errorFactor: Math.round((1 - m * 0.15) * 1000) / 1000,
    kickAccuracyDelta: Math.round(m * 3 * 10) / 10,
  };
}

/** Élan du point de vue d'un camp, à partir du compteur signé pour les locaux. */
export function momentumFor(homeMomentum: number, side: 'HOME' | 'AWAY'): number {
  return side === 'HOME' ? homeMomentum : -homeMomentum;
}

/**
 * Ce que le commentaire en dit.
 *
 * Sans qualification, la barre reste un curseur muet ; avec des chiffres, elle
 * devient un tableau de bord. On nomme, on ne mesure pas.
 */
export function momentumLabel(homeMomentum: number): string {
  const abs = Math.abs(homeMomentum);
  if (abs < 12) return 'Match équilibré';
  const who = homeMomentum > 0 ? 'les locaux' : 'les visiteurs';
  if (abs < 35) return `Léger ascendant pour ${who}`;
  if (abs < 65) return `${who === 'les locaux' ? 'Les locaux' : 'Les visiteurs'} ont le match en main`;
  return `Le stade est debout — ${who} déroulent`;
}
