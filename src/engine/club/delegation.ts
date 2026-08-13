/**
 * Déléguer à son staff : V0.62.
 *
 * Le troisième pilier du GDD, « déléguer à son staff ce qu'on ne veut pas
 * gérer », n'avait jamais été implémenté. Le staff se recrutait depuis la V0.44,
 * pesait sur la progression des joueurs, parlait pendant les live moments, et
 * ne prenait jamais une décision à la place du manager.
 *
 * ## Ce que déléguer veut dire, et ce que ça coûte
 *
 * Déléguer n'est pas un raccourci gratuit : **l'adjoint décide comme un adjoint,
 * pas comme vous**. La qualité de sa décision suit sa compétence, et un staff
 * médiocre à qui l'on confie la composition alignera une équipe médiocre. C'est
 * la contrepartie qui rend le choix intéressant plutôt qu'automatique.
 *
 * Une délégation ne se subit jamais : rien n'est délégué par défaut, et chaque
 * domaine se reprend d'un clic. Le joueur qui veut tout piloter ne verra jamais
 * la différence.
 *
 * ## Pourquoi c'est dans la sauvegarde et pas dans les réglages
 *
 * Confier la composition à son adjoint est un choix de carrière, pas une
 * préférence d'affichage : il appartient au poste qu'on occupe, il suit la
 * partie, et il se perd quand on change de club.
 */

import type { Player } from '../types.js';
import type { TrainingFocus } from './development.js';
import type { StaffMember, StaffRole } from './staff.js';

export type DelegationArea =
  | 'REMPLACEMENTS'
  | 'ENTRAINEMENT'
  | 'OFFRES_MINEURES'
  | 'COMPOSITION';

export interface DelegationState {
  readonly delegated: readonly DelegationArea[];
}

export const NO_DELEGATION: DelegationState = { delegated: [] };

export const DELEGATION_LABEL: Readonly<Record<DelegationArea, string>> = {
  REMPLACEMENTS: 'Les remplacements en match',
  ENTRAINEMENT: 'Les focus d\'entraînement',
  OFFRES_MINEURES: 'Les offres mineures reçues',
  COMPOSITION: 'La composition de départ',
};

export const DELEGATION_DESCRIPTION: Readonly<Record<DelegationArea, string>> = {
  REMPLACEMENTS: 'Votre adjoint fait entrer le banc quand il le juge utile, sans vous demander.',
  ENTRAINEMENT: 'Il choisit sur quoi chaque joueur travaille, selon son poste et ses lacunes.',
  OFFRES_MINEURES: 'Il décline les offres sur vos remplaçants et accepte celles qui vous arrangent.',
  COMPOSITION: 'Il propose le quinze de départ. Vous gardez la main pour le changer.',
};

/** Qui décide, quand vous ne décidez pas. */
export const DELEGATION_OWNER: Readonly<Record<DelegationArea, StaffRole>> = {
  REMPLACEMENTS: 'ENTRAINEUR_CHEF',
  ENTRAINEMENT: 'ENTRAINEUR_SKILLS',
  OFFRES_MINEURES: 'PRESIDENT',
  COMPOSITION: 'ENTRAINEUR_CHEF',
};

export function isDelegated(state: DelegationState, area: DelegationArea): boolean {
  return state.delegated.includes(area);
}

export function toggleDelegation(
  state: DelegationState,
  area: DelegationArea,
): DelegationState {
  return {
    delegated: isDelegated(state, area)
      ? state.delegated.filter(a => a !== area)
      : [...state.delegated, area],
  };
}

/**
 * Ce que vaut la décision déléguée.
 *
 * De 0 à 100, la compétence de celui qui décide à votre place. Sans membre du
 * staff pour ce domaine, on retombe sur une valeur médiocre plutôt que sur
 * zéro : un club a toujours quelqu'un pour aligner une équipe, même mal.
 */
export const NO_STAFF_QUALITY = 45;

export function delegateQuality(
  staff: readonly StaffMember[],
  area: DelegationArea,
): number {
  const owner = staff.find(m => m.role === DELEGATION_OWNER[area]);
  return owner ? owner.quality : NO_STAFF_QUALITY;
}

/**
 * Ce que la délégation change au résultat.
 *
 * Un adjoint compétent fait presque aussi bien que le manager ; un adjoint
 * moyen fait perdre quelque chose. Le facteur s'applique là où la décision se
 * mesure, et il ne dépasse jamais un : déléguer ne peut pas rendre meilleur
 * que décider soi-même, sans quoi le jeu se jouerait tout seul et il n'y aurait
 * plus rien à faire.
 */
export function delegationPenalty(quality: number): number {
  const borne = Math.max(0, Math.min(100, quality));
  // 100 de compétence : aucune perte. 45, la valeur sans staff : 7 % de perte.
  return 1 - (100 - borne) / 800;
}

export interface DelegationSummary {
  readonly area: DelegationArea;
  readonly delegated: boolean;
  readonly quality: number;
  /** Phrase prête à afficher sous la case à cocher. */
  readonly verdict: string;
}

/**
 * Ce qu'on peut dire au manager de chaque délégation.
 *
 * On annonce la compétence de celui à qui l'on confie le domaine **avant** de
 * cocher, pas après : déléguer à un incompétent doit être un choix, pas une
 * découverte en fin de saison.
 */
export function summarise(
  state: DelegationState,
  staff: readonly StaffMember[],
): readonly DelegationSummary[] {
  const areas: readonly DelegationArea[] = [
    'COMPOSITION', 'REMPLACEMENTS', 'ENTRAINEMENT', 'OFFRES_MINEURES',
  ];

  return areas.map(area => {
    const quality = delegateQuality(staff, area);
    const owner = staff.find(m => m.role === DELEGATION_OWNER[area]);
    const nom = owner ? `${owner.firstName} ${owner.lastName}` : 'Personne à ce poste';
    const jugement = quality >= 75 ? 'de confiance'
      : quality >= 60 ? 'correct'
        : quality >= 45 ? 'limité'
          : 'dépassé';
    return {
      area,
      delegated: isDelegated(state, area),
      quality,
      verdict: `${nom} · ${jugement} (${Math.round(quality)}/100)`,
    };
  });
}

// =============================================================================
// Ce que l'adjoint décide, quand on le laisse décider
// =============================================================================

/**
 * Le focus d'entraînement qu'un adjoint choisit pour un joueur.
 *
 * Il raisonne comme un entraîneur des skills, pas comme un optimiseur : un
 * organisme fragile récupère, un jeune travaille son poste, un joueur qui
 * décline entretient son physique, et les autres progressent là où ils sont le
 * plus faibles.
 *
 * La compétence de l'adjoint n'entre pas ici : elle joue sur le rendement de la
 * séance, pas sur le bon sens du choix. Un adjoint limité ne fait pas travailler
 * le mental à un pilier de vingt ans, il le fait travailler moins bien.
 */
export function focusForPlayer(player: Player, currentSeason: number): TrainingFocus {
  const age = currentSeason - Number(player.birthDate.slice(0, 4));

  if (player.physical.robustesse <= 45) return 'RECUPERATION';
  if (age >= 31) return 'PHYSIQUE';
  if (age <= 22) return 'POSTE';

  const technique = (
    player.technical.passe + player.technical.plaquage
    + player.technical.visionDeJeu + player.technical.conservation
  ) / 4;
  const physique = (
    player.physical.vitesse + player.physical.puissance + player.physical.endurance
  ) / 3;
  const mental = (
    player.mental.decision + player.mental.sangFroid + player.mental.discipline
  ) / 3;

  const plusFaible = Math.min(technique, physique, mental);
  if (plusFaible === technique) return 'TECHNIQUE';
  if (plusFaible === physique) return 'PHYSIQUE';
  return 'MENTAL';
}

/**
 * Ce que l'adjoint fait d'une offre reçue sur l'un de vos joueurs.
 *
 * Il ne touche qu'aux joueurs dont le départ ne vous coûte rien : un
 * remplaçant, un joueur hors projet, un contrat qui s'achève. **Une offre sur un
 * cadre remonte toujours au manager**, quoi qu'il arrive : déléguer les petites
 * décisions ne doit jamais faire partir un titulaire dans votre dos.
 */
export interface MinorOfferInput {
  readonly isKeyPlayer: boolean;
  /** Part des matchs de la saison que le joueur a disputés, de 0 à 1. */
  readonly playRatio: number;
  /** Montant proposé, rapporté à la valeur estimée du joueur. */
  readonly offerRatio: number;
}

export type MinorOfferDecision = 'ACCEPTER' | 'REFUSER' | 'AU_MANAGER';

export function decideMinorOffer(input: MinorOfferInput): MinorOfferDecision {
  if (input.isKeyPlayer || input.playRatio >= 0.5) return 'AU_MANAGER';
  // En dessous de la valeur estimée, on refuse : un adjoint ne brade pas.
  if (input.offerRatio < 0.9) return 'REFUSER';
  return 'ACCEPTER';
}
