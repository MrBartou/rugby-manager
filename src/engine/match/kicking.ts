/**
 * Modèle de jeu au pied — V0.1 simplifié.
 *
 * Référence : 06-moteur-match.md, plan de travail "tous simplifiés".
 *
 * Deux modes :
 *   - placeKick : pénalités et transformations (calcul probabiliste pur, pas un PhaseOutcome)
 *   - tacticalKick : occupation, chandelle, dégagement (PhaseOutcome)
 *
 * V0.2+ : duels aériens, contre-attaques qualifiées, butées sous pression.
 */

import type { Player } from '../types.js';
import type { Rng } from '../rng.js';
import type { PhaseOutcome, Possession } from './types.js';

// =============================================================================
// Place kick (pénalité au but, transformation)
// =============================================================================

export interface PlaceKickInput {
  readonly kicker: Player;
  /** Distance au point de tir, en mètres. */
  readonly distance: number;
  /** 1.0 = face aux poteaux, 0.7 = angle ferme. */
  readonly angleFactor: number;
  readonly fatigue: number;
  readonly weather: 'SEC' | 'PLUIE' | 'VENT' | 'EXTREME';
}

/**
 * Probabilité de réussir un coup de pied placé.
 * Calibrage cible : ~65-70% sur l'ensemble (cf. 14-tests-validation.md).
 */
export function placeKickSuccessProb(input: PlaceKickInput): number {
  const skill = input.kicker.technical.jeuAuPiedPlace;
  // V0.13 : recentrage. La fatigue passée au buteur est maintenant la sienne
  // (0-85 en fin de match) et non plus une moyenne d'équipe plafonnée à ~37 ;
  // sans ce recentrage le taux de réussite tombait sous la cible de 60 %.
  const skillFactor = 0.46 + (skill / 100) * 0.55;       // 46% à 100% sur skill seul
  const distancePenalty = Math.max(0, (input.distance - 25) / 100); // -1pt par mètre au-delà de 25m
  const fatiguePenalty = (input.fatigue / 100) * 0.10;
  const weatherPenalty =
    input.weather === 'PLUIE' ? 0.05 :
    input.weather === 'VENT' ? 0.10 :
    input.weather === 'EXTREME' ? 0.15 : 0;

  const prob = skillFactor * input.angleFactor - distancePenalty - fatiguePenalty - weatherPenalty;
  return Math.max(0.05, Math.min(0.98, prob));
}

// =============================================================================
// Tactical kick (jeu au pied dynamique)
// =============================================================================

export interface TacticalKickInput {
  readonly kicker: Player;
  readonly attackPossession: 'HOME' | 'AWAY';
  readonly fieldPosition: number;
  readonly fatigue: number;
}

export function simulateTacticalKick(input: TacticalKickInput, rng: Rng): PhaseOutcome {
  const skill = input.kicker.technical.jeuAuPiedDynamique;

  // Outcomes :
  // - Trouve la touche (gain territorial → lineout pour l'attaquant)
  // - Chandelle / contestée → ballon disputé
  // - Récupéré par la défense → contre-attaque
  const toTouchProb = 0.35 + (skill / 100) * 0.25;        // 35-60%
  const chandelleProb = 0.20;
  // reliquat → adversaire récupère

  const r = rng.next();
  let acc = 0;

  if (r < (acc += toTouchProb)) {
    return {
      possessionAfter: input.attackPossession,
      metersGained: 25,
      nextPhase: 'LINEOUT',
      summary: 'touche trouvée — gain de terrain',
    };
  }
  if (r < (acc += chandelleProb)) {
    return {
      possessionAfter: 'CONTESTED',
      metersGained: 15,
      nextPhase: 'OPEN_PLAY',
      summary: 'chandelle — duel aérien',
    };
  }

  const other: Possession = input.attackPossession === 'HOME' ? 'AWAY' : 'HOME';
  return {
    possessionAfter: other,
    metersGained: 5,
    nextPhase: 'OPEN_PLAY',
    summary: 'jeu au pied récupéré par la défense',
  };
}
