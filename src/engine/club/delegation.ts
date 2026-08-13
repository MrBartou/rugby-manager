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

import type { Player, PlayerId, Position } from '../types.js';
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

/**
 * Le remplacement que l'adjoint décide, s'il en décide un.
 *
 * Un entraîneur ne vide pas son banc d'un coup : il sort le joueur le plus
 * cuit, à partir du moment où l'usure commence à peser, et il garde des
 * cartouches pour la fin. La compétence joue sur le **seuil** : un adjoint
 * dépassé laisse ses titulaires s'épuiser plus longtemps avant de réagir.
 *
 * Rend `undefined` quand il n'y a rien à faire, ce qui est le cas le plus
 * fréquent : une délégation qui changerait quelque chose à chaque phase serait
 * insupportable à regarder.
 */
export interface SubstitutionAdviceInput {
  readonly minute: number;
  readonly onField: readonly {
    readonly playerId: PlayerId;
    readonly position: Position;
    readonly fatigue: number;
  }[];
  readonly bench: readonly {
    readonly playerId: PlayerId;
    readonly fatigue: number;
    readonly covers: readonly Position[];
    /** Niveau approximatif du remplaçant, pour ne pas affaiblir le quinze. */
    readonly overall: number;
  }[];
  readonly substitutionsUsed: number;
  readonly substitutionsAllowed: number;
  /** Compétence de celui qui décide, de 0 à 100. */
  readonly quality: number;
}

export interface SubstitutionAdvice {
  readonly off: PlayerId;
  readonly on: PlayerId;
}

/** Minute avant laquelle personne ne sort, sauf blessure : le match se joue. */
export const EARLIEST_SUBSTITUTION_MINUTE = 45;

export function adviseSubstitution(
  input: SubstitutionAdviceInput,
): SubstitutionAdvice | undefined {
  if (input.minute < EARLIEST_SUBSTITUTION_MINUTE) return undefined;
  if (input.substitutionsUsed >= input.substitutionsAllowed) return undefined;

  // Un adjoint de confiance réagit à 62 de fatigue, un adjoint dépassé attend 80.
  const borne = Math.max(0, Math.min(100, input.quality));
  const seuil = 80 - (borne / 100) * 18;

  const candidat = [...input.onField]
    .filter(p => p.fatigue >= seuil)
    .sort((a, b) => b.fatigue - a.fatigue)[0];
  if (!candidat) return undefined;

  const remplacant = [...input.bench]
    .filter(b => b.covers.includes(candidat.position))
    .sort((a, b) => b.overall - a.overall)[0];
  if (!remplacant) return undefined;

  return { off: candidat.playerId, on: remplacant.playerId };
}

/**
 * La composition que l'adjoint rend, avec ses propres limites.
 *
 * Le quinze proposé par défaut a toujours été le meilleur possible : déléguer
 * la composition n'aurait donc rien changé, et la case à cocher aurait été un
 * décor. Un adjoint n'est pas vous : plus sa compétence est basse, plus il se
 * trompe de joueur.
 *
 * L'erreur est un échange entre un titulaire et un remplaçant du même groupe,
 * pas un joueur hors de son poste : un entraîneur professionnel se trompe sur
 * la hiérarchie, pas sur le poste. Et le manager garde la main pour corriger,
 * ce qui rend la délégation confortable sans être gratuite.
 */
export interface LineupSwap {
  readonly starterIndex: number;
  readonly substituteIndex: number;
}

export function lineupMistakes(
  quality: number,
  starterCount: number,
  substituteCount: number,
  rng: { nextInt: (min: number, max: number) => number },
): readonly LineupSwap[] {
  if (starterCount === 0 || substituteCount === 0) return [];

  const borne = Math.max(0, Math.min(100, quality));
  // 90 et plus : aucune erreur. 45, la valeur sans staff : deux échanges.
  const erreurs = borne >= 90 ? 0 : borne >= 70 ? 1 : borne >= 50 ? 2 : 3;

  const swaps: LineupSwap[] = [];
  const dejaPris = new Set<number>();
  for (let i = 0; i < erreurs; i++) {
    const starterIndex = rng.nextInt(0, starterCount - 1);
    if (dejaPris.has(starterIndex)) continue;
    dejaPris.add(starterIndex);
    swaps.push({ starterIndex, substituteIndex: rng.nextInt(0, substituteCount - 1) });
  }
  return swaps;
}
