/**
 * L'acclimatation d'une recrue — V0.55.
 *
 * `hidden.adaptabilite` est généré sur chaque joueur depuis la V0.4 et **lu
 * nulle part**. Conséquence : un joueur acheté en janvier joue à cent pour cent
 * de son niveau dès son premier match, dans un club qu'il ne connaît pas, avec
 * quatorze partenaires qu'il n'a jamais vus.
 *
 * Le mercato d'hiver n'était donc jamais un pari : on payait, et on encaissait
 * immédiatement. C'est le contraire de ce que tout le monde observe — une
 * recrue met des semaines à trouver ses marques, et certaines ne les trouvent
 * jamais.
 *
 * ## Ce que ce module fait
 *
 * Il ne touche pas au joueur stocké : il en produit une **vue diminuée** pour
 * la feuille de match, tant qu'il n'a pas fini de s'installer. C'est le même
 * procédé que `applyRole` dans le constructeur de feuille — on transforme pour
 * la rencontre, jamais l'effectif.
 *
 * Et ce qu'il ne fait pas : il ne touche ni au physique ni au potentiel. Un
 * joueur qui débarque court aussi vite qu'avant. Ce qui lui manque, ce sont les
 * automatismes et les repères — donc la technique et la décision.
 */

import type { Player } from '../types.js';

// =============================================================================
// Combien de temps pour s'installer
// =============================================================================

/** Durée maximale d'acclimatation, en journées de championnat. */
export const MAX_ADAPTATION_ROUNDS = 10;

/**
 * Journées nécessaires à une recrue pour trouver ses marques.
 *
 * L'adaptabilité fait l'essentiel, et le décalage de style ajoute. Un joueur
 * très adaptable arrivant dans un club qui lui ressemble est opérationnel en
 * deux journées ; un joueur rigide dans un club à contre-emploi met une demi-
 * saison — ce qui est aussi le délai qu'on observe dans la réalité.
 */
export function adaptationRounds(input: {
  readonly player: Player;
  /** Écart de style entre le joueur et son nouveau club, 0 (parfait) à 1. */
  readonly styleGap?: number;
}): number {
  const adaptability = input.player.hidden.adaptabilite;
  const base = 2 + ((100 - adaptability) / 100) * 6;
  const gap = (input.styleGap ?? 0) * 3;
  return Math.min(MAX_ADAPTATION_ROUNDS, Math.round(base + gap));
}

/**
 * Où en est-il, de 0 (tout juste arrivé) à 1 (installé).
 *
 * Absent de `joinedAtRound`, on considère qu'il est là depuis toujours : c'est
 * le cas de tout l'effectif d'origine, et d'une sauvegarde antérieure.
 */
export function adaptationProgress(input: {
  readonly player: Player;
  readonly currentRound: number;
  readonly styleGap?: number;
}): number {
  const joined = input.player.dynamic.joinedAtRound;
  if (joined === undefined) return 1;

  const needed = adaptationRounds(input);
  if (needed <= 0) return 1;
  const elapsed = input.currentRound - joined;
  if (elapsed >= needed) return 1;
  return Math.max(0, elapsed / needed);
}

// =============================================================================
// Ce que ça change sur le terrain
// =============================================================================

/**
 * Perte maximale, en points d'attribut, pour une recrue du premier jour.
 *
 * Volontairement modeste : une recrue qui débarque n'est pas un autre joueur,
 * elle est le même joueur mal réglé. Huit points sur cent, c'est perceptible
 * sans transformer un international en remplaçant.
 */
const MAX_PENALTY = 8;

/**
 * Vue du joueur telle qu'il se présente réellement ce jour-là.
 *
 * Ne touche que la technique et la décision — les automatismes et les repères.
 * Ni la vitesse, ni la puissance, ni l'endurance : un joueur qui change de club
 * ne perd pas ses jambes.
 */
export function applyAdaptation(input: {
  readonly player: Player;
  readonly currentRound: number;
  readonly styleGap?: number;
}): Player {
  const progress = adaptationProgress(input);
  if (progress >= 1) return input.player;

  const penalty = Math.round(MAX_PENALTY * (1 - progress));
  if (penalty === 0) return input.player;

  const drop = (v: number): number => Math.max(1, v - penalty);
  const p = input.player;
  return {
    ...p,
    technical: {
      ...p.technical,
      passe: drop(p.technical.passe),
      visionDeJeu: drop(p.technical.visionDeJeu),
      conservation: drop(p.technical.conservation),
      deblayage: drop(p.technical.deblayage),
    },
    mental: {
      ...p.mental,
      decision: drop(p.mental.decision),
    },
  };
}

/**
 * Ce que le staff en dit sur la fiche.
 *
 * Qualifie sans chiffrer, comme partout : le manager doit savoir qu'une recrue
 * n'est pas encore elle-même, pas lire un pourcentage.
 */
export function adaptationHint(input: {
  readonly player: Player;
  readonly currentRound: number;
  readonly styleGap?: number;
}): string | undefined {
  const progress = adaptationProgress(input);
  if (progress >= 1) return undefined;
  if (progress < 0.35) return 'Vient d\'arriver — il cherche encore ses repères.';
  if (progress < 0.75) return 'S\'installe peu à peu dans le collectif.';
  return 'Presque adapté au club.';
}
