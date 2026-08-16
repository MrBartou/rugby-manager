/**
 * Les consignes individuelles : V0.65.
 *
 * Le manager disposait de dix-neuf rôles (V0.34) et de trois curseurs de plan
 * (V0.32). Tout cela est collectif : personne ne pouvait dire « celui-là, tu ne
 * le lâches pas », ni « tape derrière leur ailier, il monte trop vite ». Ce sont
 * pourtant les deux phrases qu'un entraîneur prononce le plus souvent depuis un
 * bord de touche.
 *
 * ## Deux consignes, et pas vingt
 *
 * Le marquage d'un homme et la consigne au pied. Elles ont été retenues parce
 * qu'elles sont les seules qui **se lisent dans le dossier d'avant-match** : la
 * menace repérée chez l'adversaire, et la ligne défensive qu'il joue. Une
 * consigne qui ne se décide pas sur un renseignement n'est pas une décision,
 * c'est un réglage de plus.
 *
 * ## Chacune se paie
 *
 * Marquer un homme, c'est en distraire un des siens : le marqueur joue moins
 * bien lui-même. Taper derrière l'ailier ne vaut que si l'ailier monte
 * vraiment ; contre une défense en rideau, on rend le ballon pour rien. C'est
 * ce qui empêche de tout activer et d'oublier l'écran.
 *
 * ## Le point neutre
 *
 * Sans consigne, tout ici renvoie zéro. La calibration ne connaît pas ce
 * module : ses cibles restent valides sans avoir à la rejouer.
 */

import type { Player, PlayerId } from '../types.js';
import type { PreMatchTacticalPlan } from './types.js';

// =============================================================================
// Ce que le manager demande
// =============================================================================

export type KickingInstruction =
  /** Taper derrière leur ailier, qui monte en défense. */
  | 'DERRIERE_AILIER'
  /** Chandelles sous leur arrière, pour le mettre sous pression. */
  | 'CHANDELLE'
  /** Aucune consigne : on joue ce qui se présente. */
  | 'AUCUNE';

export interface IndividualInstructions {
  /** Un des nôtres ne lâche pas un adversaire précis. */
  readonly marking?: {
    readonly markerId: PlayerId;
    readonly targetId: PlayerId;
  };
  readonly kicking?: KickingInstruction;
}

export const NO_INSTRUCTIONS: IndividualInstructions = { kicking: 'AUCUNE' };

// =============================================================================
// Le marquage
// =============================================================================

export interface MarkingEffect {
  /** Retiré à la valeur offensive de l'adversaire marqué. */
  readonly targetPenalty: number;
  /** Retiré à la nôtre : le marqueur regarde un homme, pas le ballon. */
  readonly markerPenalty: number;
  readonly summary: string;
}

export const NO_MARKING: MarkingEffect = { targetPenalty: 0, markerPenalty: 0, summary: '' };

/**
 * Ce que vaut un marquage.
 *
 * Le rendement dépend de l'écart entre les deux hommes, et c'est ce qui rend le
 * choix intéressant : envoyer son meilleur défenseur sur leur meilleur joueur
 * annule à peu près les deux, ce qui est une bonne affaire quand le leur est
 * bien meilleur, et une mauvaise quand il ne l'est pas.
 *
 * On plafonne volontairement : un homme n'en efface jamais un autre. Sans
 * plafond, la consigne serait devenue la réponse à tout adversaire doté d'une
 * vedette, c'est-à-dire à tous.
 */
export function markingEffect(input: {
  readonly marker: Player | undefined;
  readonly target: Player | undefined;
  /** Note défensive du marqueur, 0-100. */
  readonly markerDefence: number;
  /** Note offensive de la cible, 0-100. */
  readonly targetAttack: number;
}): MarkingEffect {
  if (!input.marker || !input.target) return NO_MARKING;

  const efficacite = Math.max(0.15, Math.min(1, input.markerDefence / Math.max(1, input.targetAttack)));
  const targetPenalty = Math.round(input.targetAttack * 0.18 * efficacite * 10) / 10;
  // Le marqueur se distrait, quel que soit son talent : c'est le prix fixe de
  // la consigne, et c'est lui qui empêche de marquer tout le monde.
  const markerPenalty = Math.round(input.markerDefence * 0.10 * 10) / 10;

  return {
    targetPenalty,
    markerPenalty,
    summary: `${input.marker.lastName} ne lâche pas ${input.target.lastName}.`,
  };
}

// =============================================================================
// La consigne au pied
// =============================================================================

export interface KickingEffect {
  /** Multiplie la fréquence du jeu au pied de notre côté. */
  readonly kickTendencyMul: number;
  /** Ajouté au gain attendu d'un coup de pied. */
  readonly kickGainDelta: number;
  readonly summary: string;
}

export const NO_KICKING: KickingEffect = { kickTendencyMul: 1, kickGainDelta: 0, summary: '' };

/**
 * Ce que vaut une consigne au pied, **contre cette défense-là**.
 *
 * C'est le seul endroit du moteur où une décision du manager est jugée sur ce
 * que fait l'adversaire, et non sur ses propres joueurs. Taper derrière un
 * ailier qui monte est le coup gagnant du rugby moderne ; le même coup contre
 * une défense qui recule rend le ballon à trente mètres de chez soi.
 */
export function kickingEffect(
  instruction: KickingInstruction | undefined,
  opponentPlan: PreMatchTacticalPlan | undefined,
): KickingEffect {
  if (!instruction || instruction === 'AUCUNE') return NO_KICKING;
  const ligne = opponentPlan?.defensiveLine;

  if (instruction === 'DERRIERE_AILIER') {
    if (ligne === 'MONTANTE') {
      return {
        kickTendencyMul: 1.35,
        kickGainDelta: 6,
        summary: 'Leur ailier monte : le coup de pied par-dessus paie.',
      };
    }
    if (ligne === 'STAND_OFF') {
      return {
        kickTendencyMul: 1.1,
        kickGainDelta: -4,
        summary: 'Ils défendent reculés : taper derrière leur rend le ballon.',
      };
    }
    return { kickTendencyMul: 1.2, kickGainDelta: 0, summary: 'Coups de pied par-dessus, sans certitude.' };
  }

  // La chandelle : elle vise un homme, pas un espace. Elle vaut contre une
  // défense qui monte aussi, mais moins, et elle ne se retourne jamais
  // complètement contre nous : le ballon retombe au milieu du terrain.
  return {
    kickTendencyMul: 1.15,
    kickGainDelta: ligne === 'MONTANTE' ? 3 : 1,
    summary: 'Chandelles sous leur arrière.',
  };
}

/**
 * Ce que le bord de touche annonce, en une phrase.
 *
 * Sert au compte rendu et à l'écran de match : une consigne qu'on donne sans
 * jamais la voir reprise est une consigne dont on doute qu'elle serve.
 */
export function instructionsSummary(
  marking: MarkingEffect,
  kicking: KickingEffect,
): string {
  return [marking.summary, kicking.summary].filter(s => s.length > 0).join(' ');
}
