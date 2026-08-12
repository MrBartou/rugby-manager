/**
 * Modèle de touche — V0.8.
 *
 * Référence : 06-moteur-match.md.
 *
 * V0.1 : score combiné lancer + saut + lift vs contre → outcome.
 * V0.8 : philosophie pré-match (MAUL_LOURD / SAUT_RAPIDE / SAUT_LONG) + outcome MAUL
 *        avec gain de mètres ou essai direct sur lancement.
 */

import type { Player } from '../types.js';
import type { Rng } from '../rng.js';
import type { LineoutPhilosophy, PhaseOutcome, Possession } from './types.js';

export interface LineoutInput {
  readonly attackPack: readonly Player[];     // 7-8 avants présents (incl. talonneur)
  readonly defensePack: readonly Player[];
  readonly attackPossession: 'HOME' | 'AWAY';
  readonly fatigueAttack: number;              // 0-100
  readonly fatigueDefense: number;
  /** V0.8 — philosophie choisie pré-match. */
  readonly philosophy?: LineoutPhilosophy;
  /**
   * V0.32 — bonus issus du focus « touche » du plan de match, exprimés sur
   * l'échelle 0-100 comme les attributs. Zéro par défaut.
   */
  readonly attackBonus?: number;
  readonly defenseBonus?: number;
}

function lineoutStrength(pack: readonly Player[], fatigue: number): number {
  if (pack.length === 0) return 0;
  const fatigueMul = 1 - (fatigue / 100) * 0.25;
  let total = 0;
  for (const p of pack) {
    const lancer = p.positionSpecific.qualiteLancer ?? 0;
    const saut = p.positionSpecific.sautEnTouche ?? p.physical.detente * 0.6;
    const lift = p.positionSpecific.liftEnTouche ?? p.physical.puissance * 0.5;
    total += lancer * 0.4 + saut * 0.4 + lift * 0.2;
  }
  return (total / pack.length) * fatigueMul;
}

/** Sigmoid borné, plus doux que tanh sur l'intervalle [-50, +50]. */
function squash(x: number, scale: number): number {
  return Math.tanh(x / scale);
}

interface PhilosophyBias {
  readonly cleanWinDelta: number;       // ajusté à cleanWinProb
  readonly stealDelta: number;          // ajusté à stealProb (peut être négatif)
  readonly maulProb: number;            // proba qu'un clean win se transforme en maul
  readonly maulMeters: readonly [number, number]; // min..max
  readonly maulTryProb: number;         // proba qu'un maul se transforme en essai
}

function biasForPhilosophy(p: LineoutPhilosophy | undefined): PhilosophyBias {
  switch (p) {
    case 'MAUL_LOURD':
      return { cleanWinDelta: -0.02, stealDelta: -0.05, maulProb: 0.45, maulMeters: [10, 25], maulTryProb: 0.06 };
    case 'SAUT_RAPIDE':
      return { cleanWinDelta: +0.06, stealDelta: -0.02, maulProb: 0.05, maulMeters: [3, 8], maulTryProb: 0.0 };
    case 'SAUT_LONG':
      return { cleanWinDelta: -0.04, stealDelta: +0.03, maulProb: 0.18, maulMeters: [5, 18], maulTryProb: 0.02 };
    default:
      return { cleanWinDelta: 0, stealDelta: 0, maulProb: 0.10, maulMeters: [3, 12], maulTryProb: 0.01 };
  }
}

export function simulateLineout(input: LineoutInput, rng: Rng): PhaseOutcome {
  const att = lineoutStrength(input.attackPack, input.fatigueAttack) + (input.attackBonus ?? 0);
  const def = lineoutStrength(input.defensePack, input.fatigueDefense) + (input.defenseBonus ?? 0);
  const delta = att - def;
  const bias = biasForPhilosophy(input.philosophy);

  const cleanWinProb = 0.72 + squash(delta, 30) * 0.13 + bias.cleanWinDelta;
  const stealProb = Math.max(0, (1 - cleanWinProb) * 0.55 + bias.stealDelta);
  const penaltyAttackProb = 0.04;
  const penaltyDefenseProb = 0.04;

  const r = rng.next();
  let acc = 0;

  if (r < (acc += cleanWinProb)) {
    // V0.8 : sur clean win, possibilité de maul pénétrant
    if (rng.nextBool(bias.maulProb)) {
      const meters = rng.nextInt(bias.maulMeters[0], bias.maulMeters[1]);
      // Si on est près de l'en-but (heuristique : meters >= 18 = essai direct possible)
      if (rng.nextBool(bias.maulTryProb)) {
        return {
          possessionAfter: input.attackPossession,
          metersGained: meters,
          nextPhase: 'TRY',
          summary: 'maul pénétrant et essai !',
        };
      }
      return {
        possessionAfter: input.attackPossession,
        metersGained: meters,
        nextPhase: 'RUCK',
        summary: `maul pénétrant +${meters}m`,
      };
    }
    return {
      possessionAfter: input.attackPossession,
      metersGained: 0,
      nextPhase: 'OPEN_PLAY',
      summary: delta > 20 ? 'touche dominée et conservée' : 'touche conservée',
    };
  }
  if (r < (acc += stealProb)) {
    const other: Possession = input.attackPossession === 'HOME' ? 'AWAY' : 'HOME';
    return {
      possessionAfter: other,
      metersGained: 0,
      nextPhase: 'OPEN_PLAY',
      summary: 'touche contestée et perdue',
    };
  }
  if (r < (acc += penaltyAttackProb)) {
    return {
      possessionAfter: input.attackPossession,
      metersGained: 0,
      nextPhase: 'PENALTY',
      penaltyAwarded: input.attackPossession,
      summary: 'pénalité obtenue en touche',
    };
  }
  if (r < (acc += penaltyDefenseProb)) {
    const other: 'HOME' | 'AWAY' = input.attackPossession === 'HOME' ? 'AWAY' : 'HOME';
    return {
      possessionAfter: other,
      metersGained: 0,
      nextPhase: 'PENALTY',
      penaltyAwarded: other,
      summary: 'lancer non droit — pénalité contre',
    };
  }

  const other: 'HOME' | 'AWAY' = input.attackPossession === 'HOME' ? 'AWAY' : 'HOME';
  return {
    possessionAfter: other,
    metersGained: 0,
    nextPhase: 'SCRUM',
    summary: 'ballon perdu en touche',
  };
}
