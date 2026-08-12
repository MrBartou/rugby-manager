/**
 * Modèle de mêlée — V0.2.
 *
 * Référence : 06-moteur-match.md, section "Plan de travail".
 *
 * V0.1 (déprécié) : score plat des 8 avants, sigmoïde simple → outcome.
 *
 * V0.2 — modèle de duel technique :
 *   - **Poussée** : force brute (pousseeMelee + puissance) → qui gagne le push
 *   - **Technique** : discipline + décision → qui contrôle le bind (sanctions techniques)
 *   - **Gainage** : endurance + robustesse → qui craque sous la pression (écroulement)
 *
 * + Dominance cumulée à travers les mêlées du match : si une équipe a dominé
 *   physiquement les mêlées précédentes, l'arbitre est plus enclin à siffler en sa faveur,
 *   et l'équipe dominée perd en gainage (effet psychologique).
 *
 * C'est le premier sous-système discriminant du pilier 1 (rugby pris au sérieux).
 */

import type { Player, PlayerId } from '../types.js';
import type { Rng } from '../rng.js';
import type { PhaseOutcome, Possession } from './types.js';

// =============================================================================
// Entrée
// =============================================================================

export interface ScrumInput {
  readonly attackForwards: readonly Player[];          // 8 (pack en mêlée)
  readonly defenseForwards: readonly Player[];         // 8
  readonly attackPossession: 'HOME' | 'AWAY';
  readonly attackTacticalBonus: number;                // -10 à +10 (philosophie + plan pré-match)
  readonly defenseTacticalBonus: number;
  readonly fatigueAttack: number;                      // 0-100
  readonly fatigueDefense: number;
  readonly fieldCondition: 'BON' | 'GRAS' | 'DUR';
  /**
   * Dominance accumulée par l'attaquant sur le défenseur depuis le début du match.
   * Positif = attaquant a dominé les mêlées précédentes (l'arbitre l'a remarqué).
   * Plage typique : -50 à +50. Par défaut 0 (première mêlée du match).
   */
  readonly cumulativeDominance?: number;
  /** Index de la mêlée dans le match (0 = première). Optionnel, à des fins de debug/log. */
  readonly scrumIndex?: number;
}

// =============================================================================
// Sous-scores d'un pack
// =============================================================================

interface PackSubScores {
  readonly drive: number;        // poussée brute
  readonly technique: number;    // discipline du bind, timing
  readonly stability: number;    // gainage / résistance à l'écroulement
}

function packSubScores(forwards: readonly Player[], fatigue: number): PackSubScores {
  if (forwards.length === 0) return { drive: 0, technique: 0, stability: 0 };
  const fatigueMul = 1 - (fatigue / 100) * 0.30;
  let drive = 0;
  let technique = 0;
  let stability = 0;
  for (const f of forwards) {
    // Poussée : pousseeMelee si défini (avants spécialisés), sinon dérivé de la puissance
    drive += f.positionSpecific.pousseeMelee ?? f.physical.puissance * 0.7;
    // Technique : discipline + décision
    technique += f.mental.discipline * 0.6 + f.mental.decision * 0.4;
    // Gainage : endurance + robustesse + puissance (le gainage tient avec ces trois)
    stability += f.physical.endurance * 0.4 + f.physical.robustesse * 0.4 + f.physical.puissance * 0.2;
  }
  const n = forwards.length;
  return {
    drive: (drive / n) * fatigueMul,
    technique: (technique / n) * fatigueMul,
    stability: (stability / n) * (fatigueMul * 0.5 + 0.5),  // gainage moins sensible à la fatigue (entraîné)
  };
}

/** Sigmoïde centrée sur 0, pente ajustable. */
function sigmoid(x: number, scale: number): number {
  return 1 / (1 + Math.exp(-x / scale));
}

// =============================================================================
// Calcul de la dominance produite par une mêlée
// =============================================================================

/**
 * Quantifie l'écart de domination physique d'une mêlée — sert à alimenter
 * la dominance cumulée à travers le match.
 *
 * Positif = attaquant a dominé. Plage typique : -15 à +15 par mêlée.
 */
export function computeScrumDominanceShift(input: ScrumInput): number {
  const att = packSubScores(input.attackForwards, input.fatigueAttack);
  const def = packSubScores(input.defenseForwards, input.fatigueDefense);
  // La dominance se construit surtout sur la poussée et la stabilité, pas sur la technique
  const driveDelta = att.drive - def.drive;
  const stabilityDelta = att.stability - def.stability;
  return (driveDelta * 0.6 + stabilityDelta * 0.4) / 5;
}

// =============================================================================
// Simulation V0.2
// =============================================================================

/**
 * Simule UNE mêlée — V0.2.
 *
 * Logique :
 *   1. Calcul des trois sous-scores pour chaque pack
 *   2. Application de la dominance cumulée (effet psychologique sur l'écrasé,
 *      pression arbitrale sur le dominant)
 *   3. Probabilités d'outcome dérivées de la combinaison drive × technique × stability
 *   4. Tirage de l'outcome
 */
export function simulateScrum(input: ScrumInput, rng: Rng): PhaseOutcome {
  const att = packSubScores(input.attackForwards, input.fatigueAttack);
  const def = packSubScores(input.defenseForwards, input.fatigueDefense);

  const fieldDriveMod = input.fieldCondition === 'GRAS' ? -3 : input.fieldCondition === 'DUR' ? +2 : 0;

  const cumulative = input.cumulativeDominance ?? 0;
  // L'équipe dominée perd en stabilité (psychologique), l'arbitre tend à siffler contre eux.
  const psychPressure = Math.tanh(cumulative / 30);              // -1..+1

  const driveDelta =
    att.drive - def.drive
    + (input.attackTacticalBonus - input.defenseTacticalBonus) * 3
    + fieldDriveMod
    + psychPressure * 4;                                          // dominance cumulée pèse sur le push

  const techniqueDelta = att.technique - def.technique;
  const stabilityDelta =
    att.stability - def.stability
    + psychPressure * 6;                                          // l'écrasé craque davantage si déjà dominé

  // -----------------------------------------------------------------
  // Probabilités V0.2
  // -----------------------------------------------------------------
  // Clean win (introduction conservée, ballon utilisable) : favorisée par drive ET technique
  const cleanWinBase = 0.55 + sigmoid(driveDelta, 60) * 0.18 + sigmoid(techniqueDelta, 40) * 0.07;
  const cleanWinProb = Math.min(0.88, cleanWinBase);

  // Pénalité POUR l'attaque : la défense craque (gainage faible) ou perd technique (binding)
  // → stabilityDelta/techniqueDelta positifs = att > def = défense plus faible = attaque récolte
  const attackPenaltyProb =
    sigmoid(driveDelta, 50) * 0.10
    + Math.max(0, stabilityDelta / 100) * 0.06     // défense moins stable, +6%
    + Math.max(0, techniqueDelta / 100) * 0.04;    // défense moins propre, +4%

  // Pénalité CONTRE l'attaque : symétrique (att plus faible → attaque sanctionnée)
  const defensePenaltyProb =
    (1 - sigmoid(driveDelta, 50)) * 0.08
    + Math.max(0, -stabilityDelta / 100) * 0.04
    + Math.max(0, -techniqueDelta / 100) * 0.04;

  // Free kick (faute technique mineure, écrouler avant l'engagement, etc.)
  const freeKickProb = 0.04 - Math.abs(sigmoid(techniqueDelta, 50) - 0.5) * 0.02;

  // Renvoi (mêlée écroulée non sanctionnée) — diminue quand technique haute
  const resetProb = Math.max(0.03, 0.10 - sigmoid(techniqueDelta, 50) * 0.06);

  // -----------------------------------------------------------------
  // Tirage
  // -----------------------------------------------------------------
  const r = rng.next();
  let acc = 0;

  if (r < (acc += cleanWinProb)) {
    // Conservation propre. Mètres gagnés = fonction de driveDelta (push agrressif vs poussée subie).
    const meters = Math.max(0, driveDelta / 25);
    const summary =
      driveDelta > 30 ? 'mêlée dominée — gros push' :
      driveDelta > 10 ? 'mêlée gagnée avec poussée' :
                        'mêlée gagnée proprement';
    return {
      possessionAfter: input.attackPossession,
      metersGained: meters,
      nextPhase: 'OPEN_PLAY',
      summary,
    };
  }

  if (r < (acc += attackPenaltyProb)) {
    return {
      possessionAfter: input.attackPossession,
      metersGained: 0,
      nextPhase: 'PENALTY',
      penaltyAwarded: input.attackPossession,
      summary: stabilityDelta < -10 ? 'pénalité — défense écroulée' : 'pénalité obtenue en mêlée',
    };
  }

  if (r < (acc += defensePenaltyProb)) {
    const otherSide: Possession = input.attackPossession === 'HOME' ? 'AWAY' : 'HOME';
    return {
      possessionAfter: otherSide,
      metersGained: 0,
      nextPhase: 'PENALTY',
      penaltyAwarded: otherSide,
      summary: techniqueDelta < -10 ? 'pénalité — bind illégal' : 'pénalité contre — sanctionnée en mêlée',
    };
  }

  if (r < (acc += freeKickProb)) {
    // Free kick → tap and go pour le bénéficiaire (50/50 ici, V0.3 raffinera)
    const beneficiary: 'HOME' | 'AWAY' = rng.next() < 0.5
      ? input.attackPossession
      : (input.attackPossession === 'HOME' ? 'AWAY' : 'HOME');
    return {
      possessionAfter: beneficiary,
      metersGained: 0,
      nextPhase: 'OPEN_PLAY',
      summary: 'coup-franc pour faute technique',
    };
  }

  if (r < (acc += resetProb)) {
    return {
      possessionAfter: 'CONTESTED',
      metersGained: 0,
      nextPhase: 'SCRUM',
      summary: 'mêlée écroulée — à refaire',
    };
  }

  // Reliquat : ballon perdu (pile-up), mêlée pour la défense
  const otherSide: Possession = input.attackPossession === 'HOME' ? 'AWAY' : 'HOME';
  return {
    possessionAfter: otherSide,
    metersGained: 0,
    nextPhase: 'SCRUM',
    summary: 'ballon perdu en mêlée — défense récupère',
  };
}

// =============================================================================
// Helpers de debug / tests
// =============================================================================

export interface ScrumDistributionPoint {
  readonly cleanWinProb: number;
  readonly attackPenaltyProb: number;
  readonly defensePenaltyProb: number;
}

export function _computeScrumProbabilities(input: ScrumInput): ScrumDistributionPoint {
  const att = packSubScores(input.attackForwards, input.fatigueAttack);
  const def = packSubScores(input.defenseForwards, input.fatigueDefense);
  const fieldDriveMod = input.fieldCondition === 'GRAS' ? -3 : input.fieldCondition === 'DUR' ? +2 : 0;
  const cumulative = input.cumulativeDominance ?? 0;
  const psychPressure = Math.tanh(cumulative / 30);

  const driveDelta =
    att.drive - def.drive
    + (input.attackTacticalBonus - input.defenseTacticalBonus) * 3
    + fieldDriveMod
    + psychPressure * 4;
  const techniqueDelta = att.technique - def.technique;
  const stabilityDelta = att.stability - def.stability + psychPressure * 6;

  return {
    cleanWinProb: Math.min(0.88, 0.55 + sigmoid(driveDelta, 60) * 0.18 + sigmoid(techniqueDelta, 40) * 0.07),
    attackPenaltyProb:
      sigmoid(driveDelta, 50) * 0.10
      + Math.max(0, stabilityDelta / 100) * 0.06
      + Math.max(0, techniqueDelta / 100) * 0.04,
    defensePenaltyProb:
      (1 - sigmoid(driveDelta, 50)) * 0.08
      + Math.max(0, -stabilityDelta / 100) * 0.04
      + Math.max(0, -techniqueDelta / 100) * 0.04,
  };
}

export const _internals = {
  packSubScores,
  sigmoid,
  computeScrumDominanceShift,
} satisfies Record<string, unknown>;

export type _PlayerIdForTest = PlayerId;
