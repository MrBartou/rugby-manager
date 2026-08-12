/**
 * Joker médical — V0.37.
 *
 * Règle propre au rugby professionnel français : un club privé d'un joueur pour
 * une longue durée peut le remplacer **hors fenêtre de mercato**. C'est la
 * seule dérogation au calendrier posé en V0.30, et elle n'existe que depuis
 * V0.31 — avant, les blessures n'étaient simulées que pour le club de
 * l'utilisateur, si bien qu'aucun club adverse n'aurait jamais pu y prétendre.
 *
 * ## Une dérogation, pas une porte dérobée
 *
 * Sans conditions strictes, le joker deviendrait un moyen de recruter toute
 * l'année en gardant un blessé sous le coude. Quatre garde-fous :
 *
 *  - il faut une **absence longue**, pas un joueur touché deux journées ;
 *  - le remplaçant joue au **même poste** que le blessé ;
 *  - il ne peut pas être **meilleur** que celui qu'il remplace — on répare un
 *    effectif, on ne le renforce pas ;
 *  - un seul joker **par blessé**, et le droit s'éteint à son retour.
 */

import type { Player, PlayerId, Position } from '../types.js';
import { canCover } from '../match/bench.js';
import { approximateOverall } from './development.js';

// =============================================================================
// Conditions
// =============================================================================

/**
 * Journées d'absence restantes à partir desquelles un joker est ouvert.
 *
 * Calé sur les profils de blessure du moteur : ligamentaire (8-16) et fracture
 * (12-24) y donnent droit, commotion (3-6) et musculaire (2-4) non. Le joker
 * doit rester l'exception d'une saison compromise, pas la routine.
 */
export const JOKER_MIN_ABSENCE = 8;

/**
 * Marge de niveau tolérée entre le blessé et son joker.
 *
 * Nulle serait trop rigide — on ne trouve jamais le clone exact d'un joueur —
 * mais la laisser large ferait du joker une aubaine : se blesser deviendrait
 * une bonne nouvelle.
 */
export const JOKER_LEVEL_MARGIN = 3;

export interface JokerEligibility {
  readonly eligible: boolean;
  /** Motif du refus, à afficher tel quel. */
  readonly reason?: string;
  /** Journée du retour prévu, quand le joueur y ouvre droit. */
  readonly returnsAtRound?: number;
}

/**
 * Ce blessé ouvre-t-il droit à un joker médical ?
 *
 * `alreadyUsedFor` porte les blessés pour lesquels un joker a déjà été signé :
 * le droit s'épuise à l'usage, sinon un seul joueur au long cours autoriserait
 * un recrutement par journée.
 */
export function jokerEligibility(
  player: Player,
  currentRound: number,
  alreadyUsedFor: ReadonlySet<PlayerId>,
): JokerEligibility {
  if (alreadyUsedFor.has(player.id)) {
    return { eligible: false, reason: 'Un joker a déjà été signé pour ce joueur.' };
  }
  if (player.retired || player.freeAgent) {
    return { eligible: false, reason: 'Ce joueur ne fait plus partie de l\'effectif.' };
  }

  const injury = player.dynamic.injury;
  if (!injury) {
    return { eligible: false, reason: 'Ce joueur n\'est pas blessé.' };
  }

  const remaining = injury.estimatedReturnAt - currentRound;
  if (remaining < JOKER_MIN_ABSENCE) {
    return {
      eligible: false,
      reason: `Absence trop courte : ${Math.max(0, remaining)} journée(s) restantes, il en faut ${JOKER_MIN_ABSENCE}.`,
    };
  }

  return { eligible: true, returnsAtRound: injury.estimatedReturnAt };
}

/** Blessés du club ouvrant droit à un joker, du plus longuement absent au moins. */
export function jokerCandidates(
  roster: readonly Player[],
  currentRound: number,
  alreadyUsedFor: ReadonlySet<PlayerId>,
): readonly Player[] {
  return roster
    .filter(p => jokerEligibility(p, currentRound, alreadyUsedFor).eligible)
    .sort((a, b) =>
      (b.dynamic.injury?.estimatedReturnAt ?? 0) - (a.dynamic.injury?.estimatedReturnAt ?? 0));
}

// =============================================================================
// Remplaçants admissibles
// =============================================================================

export interface JokerTargetCheck {
  readonly allowed: boolean;
  readonly reason?: string;
}

/**
 * Ce joueur libre peut-il être signé comme joker de ce blessé ?
 *
 * Volontairement limité aux **agents libres** : autoriser un joker sur un
 * joueur sous contrat rouvrirait le marché des transferts hors fenêtre, ce que
 * V0.30 ferme précisément.
 */
export function canBeJoker(
  injured: Player,
  candidate: Player,
  position: Position = injured.position,
): JokerTargetCheck {
  if (!candidate.freeAgent || candidate.retired) {
    return { allowed: false, reason: 'Seul un joueur libre peut être signé comme joker médical.' };
  }
  if (candidate.dynamic.injury) {
    return { allowed: false, reason: 'Ce joueur est lui-même blessé.' };
  }
  if (!canCover(candidate, position)) {
    return { allowed: false, reason: `${candidate.lastName} ne couvre pas le poste de ${injured.lastName}.` };
  }

  const injuredLevel = approximateOverall(injured);
  const candidateLevel = approximateOverall(candidate);
  if (candidateLevel > injuredLevel + JOKER_LEVEL_MARGIN) {
    return {
      allowed: false,
      reason: `Le joker ne peut pas être meilleur que le blessé (${Math.round(candidateLevel)} contre ${Math.round(injuredLevel)}).`,
    };
  }

  return { allowed: true };
}

/** Agents libres signables comme joker de ce blessé, du meilleur au moins bon. */
export function eligibleJokers(
  injured: Player,
  freeAgents: readonly Player[],
): readonly Player[] {
  return freeAgents
    .filter(p => canBeJoker(injured, p).allowed)
    .sort((a, b) => approximateOverall(b) - approximateOverall(a));
}

// =============================================================================
// Signature
// =============================================================================

export interface JokerSigning {
  readonly player: Player;
  /** Blessé dont ce contrat est la contrepartie. */
  readonly replacesId: PlayerId;
}

/**
 * Contrat de joker médical.
 *
 * Il s'achève à la fin de la saison en cours : un joker est un dépannage, pas
 * un recrutement. Le laisser signer trois ans ferait du joker le moyen le plus
 * économique de constituer un effectif.
 */
export function signJoker(
  injured: Player,
  candidate: Player,
  clubId: Player['clubId'],
  currentSeason: number,
  annualSalary: number,
): JokerSigning {
  return {
    player: {
      ...candidate,
      clubId,
      freeAgent: false,
      contract: {
        startSeason: currentSeason,
        endSeason: currentSeason,
        annualSalary,
      },
    },
    replacesId: injured.id,
  };
}
