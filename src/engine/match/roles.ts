/**
 * Rôles de joueurs — V0.34.
 *
 * Jusqu'ici, deux ouvreurs de même niveau étaient rigoureusement le même joueur
 * pour le moteur. Le plan de match (V0.32) décide de la manière de jouer de
 * l'équipe ; les rôles décident de la manière de jouer de **chaque homme**, et
 * c'est ce qui donne une identité à un XV.
 *
 * ## Une transformation, pas un cas particulier
 *
 * Un rôle n'ajoute aucune branche dans les sous-systèmes : il produit une copie
 * du joueur aux attributs redistribués, et le moteur continue de lire les mêmes
 * champs qu'avant. C'est ce qui rend la mécanique sûre — la mêlée, la touche et
 * le jeu courant n'ont pas à connaître l'existence des rôles — et extensible :
 * ajouter un rôle, c'est ajouter une ligne de tableau.
 *
 * ## Somme nulle
 *
 * Chaque rôle donne autant qu'il retire. Un rôle qui améliorerait un joueur
 * serait un rôle qu'on choisit toujours, donc pas un choix. Ce que le manager
 * décide, c'est *où* placer les qualités d'un joueur — pas combien il en a.
 */

import type { Player, Position } from '../types.js';

// =============================================================================
// Catalogue
// =============================================================================

export type RoleId =
  // Première ligne
  | 'PILIER_ANCRE' | 'PILIER_BALADEUR'
  | 'TALONNEUR_LANCEUR' | 'TALONNEUR_TROISIEME_FLANKER'
  // Deuxième ligne
  | 'DEUXIEME_SAUTEUR' | 'DEUXIEME_COGNEUR'
  // Troisième ligne
  | 'TROISIEME_GRATTEUR' | 'TROISIEME_PORTEUR' | 'TROISIEME_PLAQUEUR'
  // Charnière
  | 'MELEE_JOUEUR' | 'MELEE_BOTTEUR'
  | 'OUVREUR_METRONOME' | 'OUVREUR_ANIMATEUR'
  // Trois-quarts
  | 'CENTRE_PERCUTANT' | 'CENTRE_DISTRIBUTEUR'
  | 'AILIER_FINISSEUR' | 'AILIER_CONTRE_ATTAQUANT'
  | 'ARRIERE_LIBERO' | 'ARRIERE_RELANCEUR';

/** Ajustements d'attributs, en points sur l'échelle 0-100. */
interface RoleShift {
  readonly technical?: Partial<Record<keyof Player['technical'], number>>;
  readonly physical?: Partial<Record<keyof Player['physical'], number>>;
  readonly mental?: Partial<Record<keyof Player['mental'], number>>;
  readonly positionSpecific?: Partial<Record<keyof Player['positionSpecific'], number>>;
}

export interface RoleDefinition {
  readonly id: RoleId;
  readonly label: string;
  readonly description: string;
  /** Postes auxquels ce rôle s'applique. */
  readonly positions: readonly Position[];
  readonly shift: RoleShift;
}

/** Amplitude d'un rôle marqué. Assez pour se voir, pas pour dénaturer un joueur. */
const STRONG = 8;
const MILD = 5;

export const ROLES: readonly RoleDefinition[] = [
  // ---- Piliers -------------------------------------------------------------
  {
    id: 'PILIER_ANCRE',
    label: 'Pilier d\'ancrage',
    description: 'Tout pour la mêlée. Peu de ballons portés, mais une poussée qui tient.',
    positions: ['PILIER_GAUCHE', 'PILIER_DROIT'],
    shift: {
      positionSpecific: { pousseeMelee: STRONG },
      physical: { puissance: MILD, vitesse: -STRONG, endurance: -MILD },
    },
  },
  {
    id: 'PILIER_BALADEUR',
    label: 'Pilier baladeur',
    description: 'Un pilier moderne : il porte et il déblaie, au prix de la conquête.',
    positions: ['PILIER_GAUCHE', 'PILIER_DROIT'],
    shift: {
      positionSpecific: { pousseeMelee: -10 },
      technical: { deblayage: MILD, conservation: 3 },
      physical: { vitesse: MILD, puissance: -3 },
    },
  },

  // ---- Talonneurs ----------------------------------------------------------
  {
    id: 'TALONNEUR_LANCEUR',
    label: 'Talonneur lanceur',
    description: 'La touche avant tout : lancers précis, conquête sécurisée.',
    positions: ['TALONNEUR'],
    shift: {
      positionSpecific: { qualiteLancer: STRONG, pousseeMelee: MILD },
      physical: { vitesse: -MILD, endurance: -MILD },
      technical: { deblayage: -3 },
    },
  },
  {
    id: 'TALONNEUR_TROISIEME_FLANKER',
    label: 'Talonneur troisième flanker',
    description: 'Il joue comme un gratteur. La touche en pâtit.',
    positions: ['TALONNEUR'],
    shift: {
      positionSpecific: { qualiteLancer: -10, pousseeMelee: -STRONG },
      technical: { deblayage: STRONG, plaquage: MILD },
      physical: { vitesse: MILD },
    },
  },

  // ---- Deuxièmes lignes ----------------------------------------------------
  {
    id: 'DEUXIEME_SAUTEUR',
    label: 'Sauteur de touche',
    description: 'Cible principale en alignement, au détriment du travail de l\'ombre.',
    positions: ['DEUXIEME_LIGNE_GAUCHE', 'DEUXIEME_LIGNE_DROITE'],
    shift: {
      positionSpecific: { sautEnTouche: STRONG },
      physical: { detente: MILD, puissance: -MILD },
      technical: { deblayage: -STRONG },
    },
  },
  {
    id: 'DEUXIEME_COGNEUR',
    label: 'Deuxième ligne de combat',
    description: 'Mêlée, mauls et déblayages. On sautera ailleurs.',
    positions: ['DEUXIEME_LIGNE_GAUCHE', 'DEUXIEME_LIGNE_DROITE'],
    shift: {
      positionSpecific: { sautEnTouche: -12, pousseeMelee: MILD },
      physical: { puissance: MILD, detente: -STRONG },
      technical: { deblayage: MILD, plaquage: MILD },
    },
  },

  // ---- Troisièmes lignes ---------------------------------------------------
  {
    id: 'TROISIEME_GRATTEUR',
    label: 'Gratteur',
    description: 'Il vit sur les ballons au sol. Peu d\'avancée balle en main.',
    positions: ['TROISIEME_LIGNE_AILE_GAUCHE', 'TROISIEME_LIGNE_AILE_DROITE', 'NUMERO_8'],
    shift: {
      positionSpecific: { grattage: STRONG },
      technical: { deblayage: MILD, conservation: -MILD },
      physical: { puissance: -STRONG },
    },
  },
  {
    id: 'TROISIEME_PORTEUR',
    label: 'Porteur de ballon',
    description: 'Il avance dans le contact et fait vivre le ballon.',
    positions: ['TROISIEME_LIGNE_AILE_GAUCHE', 'TROISIEME_LIGNE_AILE_DROITE', 'NUMERO_8'],
    shift: {
      positionSpecific: { grattage: -STRONG },
      physical: { puissance: STRONG },
      technical: { conservation: MILD, plaquage: -MILD },
    },
  },
  {
    id: 'TROISIEME_PLAQUEUR',
    label: 'Plaqueur',
    description: 'Un abattage défensif énorme, sans prétention offensive.',
    positions: ['TROISIEME_LIGNE_AILE_GAUCHE', 'TROISIEME_LIGNE_AILE_DROITE', 'NUMERO_8'],
    shift: {
      technical: { plaquage: STRONG, conservation: -MILD },
      physical: { endurance: MILD, vitesse: -MILD },
      mental: { agressivite: MILD, discipline: -STRONG },
    },
  },

  // ---- Demis de mêlée ------------------------------------------------------
  {
    id: 'MELEE_JOUEUR',
    label: 'Demi joueur',
    description: 'Tempo rapide, il attaque les espaces autour du ruck.',
    positions: ['DEMI_DE_MELEE'],
    shift: {
      positionSpecific: { passeRapide: STRONG },
      physical: { vitesse: MILD },
      technical: { jeuAuPiedDynamique: -STRONG, plaquage: -MILD },
    },
  },
  {
    id: 'MELEE_BOTTEUR',
    label: 'Demi gestionnaire',
    description: 'Il occupe au pied et sécurise. Moins de vitesse de transmission.',
    positions: ['DEMI_DE_MELEE'],
    shift: {
      positionSpecific: { passeRapide: -STRONG },
      technical: { jeuAuPiedDynamique: STRONG, visionDeJeu: MILD },
      physical: { vitesse: -MILD },
    },
  },

  // ---- Ouvreurs ------------------------------------------------------------
  {
    id: 'OUVREUR_METRONOME',
    label: 'Métronome',
    description: 'Il gère le pied et les points. Peu d\'initiative à la main.',
    positions: ['OUVREUR'],
    shift: {
      technical: { jeuAuPiedPlace: STRONG, jeuAuPiedDynamique: MILD, passe: -MILD },
      mental: { sangFroid: MILD, decision: -STRONG },
      physical: { vitesse: -MILD },
    },
  },
  {
    id: 'OUVREUR_ANIMATEUR',
    label: 'Animateur',
    description: 'Il joue à la main et lance ses trois-quarts. Le pied recule.',
    positions: ['OUVREUR'],
    shift: {
      technical: { jeuAuPiedPlace: -15, jeuAuPiedDynamique: -STRONG, passe: MILD, visionDeJeu: STRONG },
      mental: { decision: MILD },
      physical: { vitesse: MILD },
    },
  },

  // ---- Centres -------------------------------------------------------------
  {
    id: 'CENTRE_PERCUTANT',
    label: 'Centre percutant',
    description: 'Il passe la ligne d\'avantage dans le contact.',
    positions: ['CENTRE_INTERIEUR', 'CENTRE_EXTERIEUR'],
    shift: {
      physical: { puissance: STRONG },
      technical: { conservation: MILD, passe: -STRONG, visionDeJeu: -MILD },
    },
  },
  {
    id: 'CENTRE_DISTRIBUTEUR',
    label: 'Centre distributeur',
    description: 'Il fait jouer autour de lui plutôt que dans lui.',
    positions: ['CENTRE_INTERIEUR', 'CENTRE_EXTERIEUR'],
    shift: {
      technical: { passe: STRONG, visionDeJeu: MILD, plaquage: -MILD },
      physical: { puissance: -13 },
      mental: { decision: MILD },
    },
  },

  // ---- Ailiers -------------------------------------------------------------
  {
    id: 'AILIER_FINISSEUR',
    label: 'Finisseur',
    description: 'Il attend le ballon dans les vingt-deux et le met derrière.',
    positions: ['AILIER_GAUCHE', 'AILIER_DROIT'],
    shift: {
      positionSpecific: { finition: STRONG },
      physical: { vitesse: MILD },
      technical: { prisedeballeHaute: -STRONG, plaquage: -MILD },
    },
  },
  {
    id: 'AILIER_CONTRE_ATTAQUANT',
    label: 'Contre-attaquant',
    description: 'Il se met au travail sous les ballons hauts et relance de loin.',
    positions: ['AILIER_GAUCHE', 'AILIER_DROIT'],
    shift: {
      positionSpecific: { finition: -STRONG, jeuAerien: STRONG },
      technical: { prisedeballeHaute: MILD },
      physical: { vitesse: -MILD },
    },
  },

  // ---- Arrières ------------------------------------------------------------
  {
    id: 'ARRIERE_LIBERO',
    label: 'Dernier rempart',
    description: 'Sûr sous les chandelles, il ne prend aucun risque.',
    positions: ['ARRIERE'],
    shift: {
      positionSpecific: { jeuAerien: STRONG },
      technical: { prisedeballeHaute: MILD, jeuAuPiedDynamique: MILD, conservation: -MILD },
      physical: { vitesse: -13 },
    },
  },
  {
    id: 'ARRIERE_RELANCEUR',
    label: 'Relanceur',
    description: 'Il contre-attaque de partout, quitte à laisser des ballons hauts.',
    positions: ['ARRIERE'],
    shift: {
      positionSpecific: { jeuAerien: -STRONG },
      physical: { vitesse: STRONG },
      technical: { conservation: MILD, prisedeballeHaute: -MILD },
    },
  },
];

const BY_ID = new Map<RoleId, RoleDefinition>(ROLES.map(r => [r.id, r]));

/** Rôles proposés à un poste donné. Vide si le poste n'en propose aucun. */
export function rolesForPosition(position: Position): readonly RoleDefinition[] {
  return ROLES.filter(r => r.positions.includes(position));
}

export function roleById(id: RoleId): RoleDefinition | undefined {
  return BY_ID.get(id);
}

// =============================================================================
// Application
// =============================================================================

function clamp(v: number): number {
  return Math.max(1, Math.min(99, Math.round(v)));
}

/**
 * Applique un rôle à un joueur, le temps d'un match.
 *
 * Renvoie une copie : le joueur de la base n'est jamais modifié, sans quoi un
 * rôle choisi une fois s'imprimerait définitivement dans sa fiche.
 *
 * Les attributs spécifiques absents sont ignorés plutôt que créés — donner une
 * « qualité de lancer » à un ailier n'aurait aucun sens, et le moteur retombe
 * de toute façon sur un attribut générique quand le spécifique manque.
 */
export function applyRole(player: Player, roleId: RoleId | undefined): Player {
  if (!roleId) return player;
  const role = BY_ID.get(roleId);
  if (!role) return player;
  // Un rôle hors de son poste n'est pas une erreur fatale — une compo peut
  // avoir été bricolée — mais il ne s'applique pas.
  if (!role.positions.includes(player.position)) return player;

  const { shift } = role;

  const technical = { ...player.technical };
  for (const [k, d] of Object.entries(shift.technical ?? {})) {
    const key = k as keyof Player['technical'];
    technical[key] = clamp(technical[key] + d);
  }

  const physical = { ...player.physical };
  for (const [k, d] of Object.entries(shift.physical ?? {})) {
    const key = k as keyof Player['physical'];
    physical[key] = clamp(physical[key] + d);
  }

  const mental = { ...player.mental };
  for (const [k, d] of Object.entries(shift.mental ?? {})) {
    const key = k as keyof Player['mental'];
    mental[key] = clamp(mental[key] + d);
  }

  const positionSpecific = { ...player.positionSpecific };
  for (const [k, d] of Object.entries(shift.positionSpecific ?? {})) {
    const key = k as keyof Player['positionSpecific'];
    const current = positionSpecific[key];
    if (current === undefined) continue;
    positionSpecific[key] = clamp(current + d);
  }

  return { ...player, technical, physical, mental, positionSpecific };
}

/**
 * Rôle retenu par défaut à un poste : le premier du catalogue.
 *
 * Un défaut explicite vaut mieux qu'aucun rôle — sans lui, une équipe composée
 * automatiquement (l'IA, ou le manager qui valide sans rien toucher) jouerait
 * sans identité pendant que l'autre en aurait une.
 */
export function defaultRoleFor(position: Position): RoleId | undefined {
  return rolesForPosition(position)[0]?.id;
}

export interface RoleFit {
  readonly role: RoleDefinition;
  /**
   * Écart entre ce que le rôle amplifie et ce qu'il sacrifie, en points
   * d'attribut. Positif : le joueur est déjà fort là où le rôle appuie.
   */
  readonly score: number;
}

/**
 * Affinité d'un joueur avec chacun des rôles de son poste, du plus au moins
 * naturel.
 *
 * On compare la moyenne de ce que le rôle **amplifie** à la moyenne de ce qu'il
 * **sacrifie**. Un joueur convient à un rôle quand ses points forts sont ceux
 * que le rôle met en avant, *et* que ce qu'on lui retire n'était pas sa
 * qualité première — les deux comptent autant.
 *
 * Les moyennes, plutôt que des sommes, rendent les rôles comparables entre eux :
 * sans cela, un rôle touchant six attributs écraserait toujours un rôle qui en
 * touche trois.
 */
export function roleFitness(player: Player): readonly RoleFit[] {
  return rolesForPosition(player.position)
    .map(role => {
      const gains: number[] = [];
      const losses: number[] = [];

      const record = (value: number | undefined, delta: number): void => {
        if (value === undefined) return;
        (delta > 0 ? gains : losses).push(value);
      };

      for (const [k, d] of Object.entries(role.shift.technical ?? {})) {
        record(player.technical[k as keyof Player['technical']], d);
      }
      for (const [k, d] of Object.entries(role.shift.physical ?? {})) {
        record(player.physical[k as keyof Player['physical']], d);
      }
      for (const [k, d] of Object.entries(role.shift.mental ?? {})) {
        record(player.mental[k as keyof Player['mental']], d);
      }
      for (const [k, d] of Object.entries(role.shift.positionSpecific ?? {})) {
        record(player.positionSpecific[k as keyof Player['positionSpecific']], d);
      }

      const mean = (xs: readonly number[]): number =>
        xs.length === 0 ? 0 : xs.reduce((s, v) => s + v, 0) / xs.length;

      return { role, score: mean(gains) - mean(losses) };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Rôle qui met le mieux en valeur un joueur donné.
 *
 * Sert aux compositions automatiques : un gratteur né est aligné en gratteur,
 * pas en porteur.
 */
export function bestRoleFor(player: Player): RoleId | undefined {
  return roleFitness(player)[0]?.role.id;
}

/**
 * Appréciation lisible d'une affinité.
 *
 * Seuils calés sur la distribution réelle du championnat (scores de −11 à +18,
 * médiane 1,5) et non choisis à vue : à 14, « rôle naturel » n'aurait concerné
 * que 2 % des joueurs et l'étiquette n'aurait jamais servi.
 */
export function fitLabel(score: number): { label: string; tone: 'natural' | 'good' | 'ok' | 'poor' } {
  if (score >= 9) return { label: 'Rôle naturel', tone: 'natural' };
  if (score >= 2) return { label: 'À l\'aise', tone: 'good' };
  if (score >= -5) return { label: 'Convenable', tone: 'ok' };
  return { label: 'Hors de son registre', tone: 'poor' };
}
