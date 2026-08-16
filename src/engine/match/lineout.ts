/**
 * Modèle de touche : V0.8.
 *
 * Référence : 06-moteur-match.md.
 *
 * V0.1 : score combiné lancer + saut + lift vs contre, puis outcome.
 * V0.8 : philosophie pré-match (MAUL_LOURD / SAUT_RAPIDE / SAUT_LONG) et outcome
 *        MAUL avec gain de mètres ou essai direct sur lancement.
 * V0.65 : la philosophie n'est plus qu'un repli. Ce qui commande désormais, c'est
 *         la **combinaison appelée** (`match/playbook.ts`), avec son alignement,
 *         son sauteur et son option, et le fait qu'elle soit lue ou non par
 *         l'adversaire. Sans combinaison, rien ne change : c'est ce qui garde la
 *         calibration valide.
 */

import type { Player, PlayerId } from '../types.js';
import type { Rng } from '../rng.js';
import {
  NEUTRAL_LINEOUT_MODIFIERS,
  lineoutModifiers,
  type LineoutCall,
  type LineoutModifiers,
} from './playbook.js';
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
  /** V0.65 : la combinaison appelée sur cette touche. */
  readonly call?: LineoutCall;
  /** V0.65 : à quel point l'adversaire l'attend, 0 à 1. */
  readonly read?: number;
}

function jumpOf(p: Player): number {
  return p.positionSpecific.sautEnTouche ?? p.physical.detente * 0.6;
}

function lineoutStrength(pack: readonly Player[], fatigue: number): number {
  if (pack.length === 0) return 0;
  const fatigueMul = 1 - (fatigue / 100) * 0.25;
  let total = 0;
  for (const p of pack) {
    const lancer = p.positionSpecific.qualiteLancer ?? 0;
    const saut = jumpOf(p);
    const lift = p.positionSpecific.liftEnTouche ?? p.physical.puissance * 0.5;
    total += lancer * 0.4 + saut * 0.4 + lift * 0.2;
  }
  return (total / pack.length) * fatigueMul;
}

/**
 * Ce que change le fait d'avoir désigné un sauteur : V0.65.
 *
 * S'il est sur le terrain, c'est lui qui saute, et non la moyenne du paquet :
 * un sauteur d'exception tire la touche vers le haut au lieu d'être dilué par
 * ses coéquipiers. S'il n'y est plus, la combinaison a été dessinée autour d'un
 * absent, et cela se paie. C'est ce qui donne un poids réel au fait de confier
 * sa touche à un homme, plutôt qu'un libellé de plus sur une fiche.
 */
function designatedJumperEffect(
  pack: readonly Player[],
  jumperId: PlayerId | undefined,
): number {
  if (jumperId === undefined) return 0;
  const jumper = pack.find(p => p.id === jumperId);
  if (!jumper) return -4;
  const average = pack.reduce((sum, p) => sum + jumpOf(p), 0) / pack.length;
  return (jumpOf(jumper) - average) * 0.5;
}

/** Sigmoid borné, plus doux que tanh sur l'intervalle [-50, +50]. */
function squash(x: number, scale: number): number {
  return Math.tanh(x / scale);
}

/**
 * Le repli, pour qui n'a pas dessiné de carnet.
 *
 * La philosophie de la V0.8 reste lue quand aucune combinaison n'est appelée :
 * une sauvegarde antérieure, un club géré par la machine, ou le harnais de
 * calibration. Elle produit exactement les mêmes chiffres qu'avant, et c'est
 * délibéré : le point neutre d'un nouveau facteur doit valoir la fixture.
 */
function biasForPhilosophy(p: LineoutPhilosophy | undefined): LineoutModifiers {
  switch (p) {
    case 'MAUL_LOURD':
      return { cleanWinDelta: -0.02, stealDelta: -0.05, maulProb: 0.45, maulMeters: [10, 25], maulTryProb: 0.06, quickBallMeters: 0 };
    case 'SAUT_RAPIDE':
      return { cleanWinDelta: +0.06, stealDelta: -0.02, maulProb: 0.05, maulMeters: [3, 8], maulTryProb: 0.0, quickBallMeters: 0 };
    case 'SAUT_LONG':
      return { cleanWinDelta: -0.04, stealDelta: +0.03, maulProb: 0.18, maulMeters: [5, 18], maulTryProb: 0.02, quickBallMeters: 0 };
    default:
      return NEUTRAL_LINEOUT_MODIFIERS;
  }
}

export function simulateLineout(input: LineoutInput, rng: Rng): PhaseOutcome {
  const att = lineoutStrength(input.attackPack, input.fatigueAttack)
    + (input.attackBonus ?? 0)
    + designatedJumperEffect(input.attackPack, input.call?.jumperId);
  const def = lineoutStrength(input.defensePack, input.fatigueDefense) + (input.defenseBonus ?? 0);
  const delta = att - def;
  // La combinaison commande quand il y en a une ; sinon, la philosophie.
  const bias = input.call
    ? lineoutModifiers(input.call, input.read ?? 0)
    : biasForPhilosophy(input.philosophy);

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
        summary: input.call
          ? `${input.call.name} : maul pénétrant +${meters}m`
          : `maul pénétrant +${meters}m`,
      };
    }
    // Ballon rapide : la ligne part avec de l'avance plutôt qu'avec du terrain
    // déjà gagné. Les mètres sont modestes exprès, c'est le tempo qui compte.
    if (bias.quickBallMeters > 0) {
      return {
        possessionAfter: input.attackPossession,
        metersGained: bias.quickBallMeters,
        nextPhase: 'OPEN_PLAY',
        summary: input.call
          ? `${input.call.name} : ballon rapide`
          : 'touche conservée, ballon rapide',
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
      // Un ballon perdu sur une combinaison lue doit se dire : c'est ainsi que
      // le manager comprend qu'il se répète, sans avoir à lire un tableau.
      summary: (input.read ?? 0) > 0.5
        ? 'touche lue par la défense et contrée'
        : 'touche contestée et perdue',
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
