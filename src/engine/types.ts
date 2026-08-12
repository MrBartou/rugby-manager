/**
 * Domain types — moteur pur.
 *
 * Aucune dépendance vers data/, ui/, store/, intents/, sqlite ou tauri.
 * Voir 09-architecture-logicielle.md, section A.
 */

// =============================================================================
// IDs (branded types pour éviter les confusions à la compile)
// =============================================================================

export type PlayerId = string & { readonly __brand: 'PlayerId' };
export type ClubId = string & { readonly __brand: 'ClubId' };
export type MatchId = string & { readonly __brand: 'MatchId' };

// =============================================================================
// Joueur
// =============================================================================

/** Postes rugby (1-15 + remplaçants). */
export type Position =
  | 'PILIER_GAUCHE' | 'TALONNEUR' | 'PILIER_DROIT'
  | 'DEUXIEME_LIGNE_GAUCHE' | 'DEUXIEME_LIGNE_DROITE'
  | 'TROISIEME_LIGNE_AILE_GAUCHE' | 'TROISIEME_LIGNE_AILE_DROITE' | 'NUMERO_8'
  | 'DEMI_DE_MELEE' | 'OUVREUR'
  | 'CENTRE_INTERIEUR' | 'CENTRE_EXTERIEUR'
  | 'AILIER_GAUCHE' | 'AILIER_DROIT'
  | 'ARRIERE';

/**
 * Les quinze postes, dans l'ordre des numéros de maillot.
 *
 * Source unique dès qu'il faut *parcourir* les postes plutôt qu'en typer un —
 * chaque module qui redéclarait sa propre liste risquait d'en oublier un au
 * prochain ajout, sans que le compilateur s'en aperçoive.
 */
export const ALL_POSITIONS: readonly Position[] = [
  'PILIER_GAUCHE', 'TALONNEUR', 'PILIER_DROIT',
  'DEUXIEME_LIGNE_GAUCHE', 'DEUXIEME_LIGNE_DROITE',
  'TROISIEME_LIGNE_AILE_GAUCHE', 'TROISIEME_LIGNE_AILE_DROITE', 'NUMERO_8',
  'DEMI_DE_MELEE', 'OUVREUR',
  'AILIER_GAUCHE', 'CENTRE_INTERIEUR', 'CENTRE_EXTERIEUR', 'AILIER_DROIT',
  'ARRIERE',
];

/** Catégorie large pour la composition. */
export type PositionCategory = 'AVANT' | 'TROISQUART' | 'DEMI';

/**
 * Échelle 0-100 — backend granulaire, affichée comme barres + lettres S/A/B/C/D.
 * Voir 03-modele-joueur.md section A.
 */
export type StatValue = number; // [0, 100]

/** Attributs techniques (10-15 par joueur). */
export interface TechnicalAttributes {
  passe: StatValue;
  plaquage: StatValue;
  jeuAuPiedPlace: StatValue;       // pénalités, transformations, drops
  jeuAuPiedDynamique: StatValue;   // chandelles, occupation, trans-balle
  visionDeJeu: StatValue;
  conservation: StatValue;          // garder le ballon dans le contact
  prisedeballeHaute: StatValue;
  deblayage: StatValue;
}

/** Attributs physiques. */
export interface PhysicalAttributes {
  vitesse: StatValue;
  puissance: StatValue;
  endurance: StatValue;
  detente: StatValue;               // saut en touche
  robustesse: StatValue;             // résistance blessures
}

/** Attributs mentaux. */
export interface MentalAttributes {
  decision: StatValue;
  leadership: StatValue;
  sangFroid: StatValue;
  agressivite: StatValue;
  professionnalisme: StatValue;
  discipline: StatValue;
}

/** Sub-stats spécifiques au poste. Pas tous les joueurs ont toutes les clés. */
export interface PositionSpecificStats {
  // Avants
  pousseeMelee?: StatValue;          // piliers, 2e ligne
  qualiteLancer?: StatValue;          // talonneur
  sautEnTouche?: StatValue;           // 2e ligne principalement
  liftEnTouche?: StatValue;           // 1e/3e ligne (lifter)
  grattage?: StatValue;               // 3e ligne
  // Demis
  passeRapide?: StatValue;            // 9
  // Trois-quarts
  finition?: StatValue;               // ailiers, arrière
  jeuAerien?: StatValue;              // ailiers, arrière
}

/** Identifiants des traits — la liste exhaustive est dans engine/human/traits.ts (à créer). */
export type TraitId = string & { readonly __brand: 'TraitId' };

/** Modificateur de mood (calcul continu, voir engine/human/mood.ts à créer). */
export interface MoodModifier {
  source:
    | 'FORME_PHYSIQUE'
    | 'RESULTATS_RECENTS'
    | 'STATUT_EQUIPE'
    | 'RELATIONS'
    | 'CONTRAT'
    | 'FATIGUE'
    | 'RECONNAISSANCE'
    | 'VIE_PRIVEE';
  delta: number;                      // contribution au mood (signé)
  reason: string;                      // texte UI ("Vient de gagner un match clé")
  expiresAt?: number;                  // tick simulationClock (undefined = persistant)
}

/** Type de blessure (5-6 types — cf. décisions.md). */
export type InjuryType = 'MUSCULAIRE' | 'LIGAMENTAIRE' | 'COMMOTION' | 'FRACTURE' | 'COUP' | 'CHRONIQUE';

export interface Injury {
  type: InjuryType;
  startedAt: number;                   // tick simulationClock
  estimatedReturnAt: number;
  hasSequela: boolean;
}

/** État dynamique du joueur (forme/fatigue/mood/blessures). */
export interface PlayerDynamicState {
  forme: StatValue;                    // 0-100 (rolling 5-10 derniers matchs)
  fatigue: StatValue;                  // 0-100 (charge accumulée)
  mood: StatValue;                     // 0-100 (calculé via modifiers)
  moodModifiers: readonly MoodModifier[];
  injury?: Injury;
  /** V0.8 — round (currentRound) jusqu'auquel le joueur est suspendu (carton rouge). */
  suspendedUntilRound?: number;
  /**
   * V0.55 — journée à laquelle il a rejoint son club actuel.
   *
   * Absent pour l'effectif d'origine et pour toute sauvegarde antérieure : on
   * considère alors qu'il est là depuis toujours, donc parfaitement installé.
   */
  joinedAtRound?: number;
}

/** Caractéristiques cachées (révélées progressivement par scouting — M3). */
export interface HiddenAttributes {
  potentiel: StatValue;                // plafond de progression
  ambition: StatValue;
  determinisme: StatValue;
  loyaute: StatValue;
  adaptabilite: StatValue;
}

/** Contrat. */
export interface Contract {
  startSeason: number;
  endSeason: number;
  annualSalary: number;                // en euros
  signingBonus?: number;
  performanceBonus?: number;
  releaseClause?: number;
}

/** Le joueur (entité complète). */
export interface Player {
  readonly id: PlayerId;
  readonly clubId: ClubId;
  readonly firstName: string;
  readonly lastName: string;
  readonly birthDate: string;          // YYYY-MM-DD
  readonly position: Position;
  readonly secondaryPositions: readonly Position[];
  readonly isJiff: boolean;            // pilier 4

  readonly technical: TechnicalAttributes;
  readonly physical: PhysicalAttributes;
  readonly mental: MentalAttributes;
  readonly positionSpecific: PositionSpecificStats;

  readonly traits: readonly TraitId[];
  readonly hidden: HiddenAttributes;

  readonly dynamic: PlayerDynamicState;
  readonly contract: Contract;

  /** V0.6 — joueur retiré du circuit (carrière terminée). Filtré des rosters. */
  readonly retired?: boolean;
  readonly retirementSeason?: number;
  /** V0.6 — joueur libre (contrat expiré non renouvelé). Filtré du roster du club d'origine. */
  readonly freeAgent?: boolean;
}

// =============================================================================
// Relations entre joueurs (M6 — graphe)
// =============================================================================

export type RelationType = 'MENTOR' | 'RIVAL' | 'AMI' | 'NEUTRE' | 'CONFLIT';

/*
 * Le graphe des relations, lui, vit dans `human/relationships.ts` : c'est là
 * qu'il est construit, lu et sauvegardé. La version déclarée ici n'a jamais été
 * instanciée.
 */

// =============================================================================
// Club et staff
// =============================================================================

/** Tier du club, détermine les objectifs adaptés (cf. 02-gdd.md F). */
export type ClubTier = 'PETIT_BUDGET' | 'BUDGET_MOYEN' | 'GROS_BUDGET';

/** Identité tactique de référence du club (pilier 4). */
export type TacticalIdentity =
  | 'JEU_AVANTS'
  | 'GRAND_ECART'
  | 'MIXTE'
  | 'DEFENSE_DE_FER';

export interface Club {
  readonly id: ClubId;
  readonly name: string;
  readonly shortName: string;
  readonly city: string;
  readonly tier: ClubTier;
  readonly tacticalIdentity: TacticalIdentity;
  readonly stadiumCapacity: number;
  readonly annualBudget: number;       // euros
  readonly salaryCapUsage: number;     // euros
  readonly jiffCount: number;          // dérivé de l'effectif
  readonly reputation: StatValue;
}

/**
 * V0.60 : le staff vit dans `club/staff.ts`, et là seulement.
 *
 * `StaffRole` et `StaffMember` étaient déclarés ici **aussi**, dans une version
 * concurrente et jamais utilisée : rôles identiques, champs différents. Deux
 * définitions du même mot dans le même moteur, dont l'une ne servait qu'à un
 * squelette de V0.1 (`GameState`) que rien n'a jamais construit.
 */



/**
 * V0.60 : le squelette de V0.1 est retiré.
 *
 * `GameState`, `SeasonState`, `ClubStanding` et l'horloge de simulation
 * décrivaient une architecture à réducteur d'événements qui n'a jamais été
 * branchée. Trois de ces noms existaient déjà ailleurs, portés par les types
 * réellement utilisés (`game/season-session.ts`, `season/standings.ts`), et
 * lire le mauvais était une erreur qui compilait.
 */

