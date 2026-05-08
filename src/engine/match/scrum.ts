/**
 * Modèle de mêlée — V0.1 simplifié.
 *
 * Référence : 06-moteur-match.md, section "Plan de travail (proto Excel V0.1)".
 *
 * NOTE : ce module contient le portage des formules calibrées dans le proto Excel.
 * Tant que le calibrage Excel n'est pas terminé, les coefficients sont des
 * placeholders "raisonnables" qui produisent un résultat plausible.
 *
 * V0.2 : approfondissement → modèle de duel technique (poussée + technique + gainage),
 * sanctions, dominance progressive sur multiples phases.
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
}

// =============================================================================
// Calculs
// =============================================================================

/**
 * Score combiné d'un pack en mêlée (V0.1).
 * Somme de l'attribut "pousseeMelee" des 8 avants, pondérée par fatigue.
 */
function packScrumStrength(forwards: readonly Player[], fatigue: number): number {
  const fatigueMultiplier = 1 - (fatigue / 100) * 0.3;  // jusqu'à -30% à fatigue max
  let total = 0;
  for (const fwd of forwards) {
    const pousseeMelee = fwd.positionSpecific.pousseeMelee ?? fwd.physical.puissance * 0.7;
    total += pousseeMelee;
  }
  return total * fatigueMultiplier;
}

/** Sigmoid centré sur 0, échelle ajustable. */
function sigmoid(x: number, scale: number): number {
  return 1 / (1 + Math.exp(-x / scale));
}

// =============================================================================
// Simulation V0.1
// =============================================================================

/**
 * Simule UNE mêlée (~10-15 mêlées par match).
 *
 * V0.1 : score combiné des 8 avants vs 8 avants + bonus tactique + RNG → outcome.
 * Outcomes possibles :
 *   - Mêlée propre côté attaque (défaut)
 *   - Pénalité côté attaque (sanction défense)
 *   - Pénalité côté défense (sanction attaque)
 *   - Renvoi sur introduction (mêlée tournée / écroulée non sanctionnée)
 */
export function simulateScrum(input: ScrumInput, rng: Rng): PhaseOutcome {
  const fieldMod = input.fieldCondition === 'GRAS' ? -5 : input.fieldCondition === 'DUR' ? +2 : 0;

  const attackScore =
    packScrumStrength(input.attackForwards, input.fatigueAttack) +
    input.attackTacticalBonus * 5 +
    fieldMod;

  const defenseScore =
    packScrumStrength(input.defenseForwards, input.fatigueDefense) +
    input.defenseTacticalBonus * 5;

  const delta = attackScore - defenseScore;

  // Probabilités V0.1 (à recalibrer post-Excel)
  const cleanWinProb = 0.55 + sigmoid(delta, 80) * 0.20;             // 0.35 - 0.75
  const attackPenaltyProb = sigmoid(delta, 60) * 0.18;                // 0 - 0.18
  const defensePenaltyProb = (1 - sigmoid(delta, 60)) * 0.18;         // 0 - 0.18
  // Le reste = renvoi/mêlée écroulée non sanctionnée

  const r = rng.next();

  let summary: string;
  let possessionAfter: Possession;
  let penaltyAwarded: 'HOME' | 'AWAY' | undefined;
  let metersGained = 0;

  if (r < cleanWinProb) {
    // Conservation propre côté attaque
    summary = delta > 30 ? 'mêlée dominée par les avants' : 'mêlée gagnée proprement';
    possessionAfter = input.attackPossession;
    metersGained = Math.max(0, delta / 30); // jusqu'à ~3m sur dominance forte
  } else if (r < cleanWinProb + attackPenaltyProb) {
    // Pénalité côté attaque (défense sanctionnée)
    summary = 'pénalité obtenue en mêlée';
    possessionAfter = input.attackPossession;
    penaltyAwarded = input.attackPossession;
  } else if (r < cleanWinProb + attackPenaltyProb + defensePenaltyProb) {
    // Pénalité contre l'attaque
    summary = 'mêlée sanctionnée — pénalité contre';
    possessionAfter = input.attackPossession === 'HOME' ? 'AWAY' : 'HOME';
    penaltyAwarded = possessionAfter;
  } else {
    // Mêlée à refaire / non-sanctionnée — possession contestée
    summary = 'mêlée écroulée — à refaire';
    possessionAfter = 'CONTESTED';
  }

  const result: PhaseOutcome = {
    possessionAfter,
    metersGained,
    nextPhase: penaltyAwarded ? 'PENALTY' : 'OPEN_PLAY',
    summary,
    ...(penaltyAwarded !== undefined ? { penaltyAwarded } : {}),
  };

  return result;
}

// =============================================================================
// Calculs auxiliaires utiles aux tests
// =============================================================================

/** Sortie utilisée par les property-based tests pour vérifier les invariants. */
export interface ScrumDistributionPoint {
  readonly cleanWinProb: number;
  readonly attackPenaltyProb: number;
  readonly defensePenaltyProb: number;
}

export function _computeScrumProbabilities(input: ScrumInput): ScrumDistributionPoint {
  const fieldMod = input.fieldCondition === 'GRAS' ? -5 : input.fieldCondition === 'DUR' ? +2 : 0;
  const attackScore =
    packScrumStrength(input.attackForwards, input.fatigueAttack) +
    input.attackTacticalBonus * 5 +
    fieldMod;
  const defenseScore =
    packScrumStrength(input.defenseForwards, input.fatigueDefense) +
    input.defenseTacticalBonus * 5;
  const delta = attackScore - defenseScore;

  return {
    cleanWinProb: 0.55 + sigmoid(delta, 80) * 0.20,
    attackPenaltyProb: sigmoid(delta, 60) * 0.18,
    defensePenaltyProb: (1 - sigmoid(delta, 60)) * 0.18,
  };
}

/** Pour les tests d'intégration — accès interne aux helpers. */
export const _internals = {
  packScrumStrength,
  sigmoid,
} satisfies Record<string, unknown>;
// (`satisfies` plutôt que `as` pour conserver les signatures précises)
export type _PlayerIdForTest = PlayerId;
