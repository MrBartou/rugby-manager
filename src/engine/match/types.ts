/**
 * Types spécifiques à la simulation de match.
 *
 * Granularité : par phase (~75 phases par match en moyenne).
 * Voir 06-moteur-match.md.
 */

import type { Club, ClubId, MatchId, Player, PlayerId, Position, StatValue } from '../types.js';
import type { SubstitutionRecord } from './bench.js';
import type { PhaseContribution } from './carry.js';
import type { CrowdLevel } from './crowd.js';

export type { SubstitutionRecord, PhaseContribution };

// =============================================================================
// Composition / feuille de match
// =============================================================================

/** Feuille de match : 15 titulaires + 8 remplaçants (Top 14 standard). */
export interface MatchSquad {
  readonly clubId: ClubId;
  readonly starters: readonly RosterEntry[];          // 15
  readonly substitutes: readonly RosterEntry[];        // 8
  /** Buteur désigné. Optionnel — fallback : OUVREUR titulaire ou meilleur jeuAuPiedPlace. */
  readonly placeKickerId?: PlayerId;
}

export interface RosterEntry {
  readonly playerId: PlayerId;
  readonly position: Position;
  readonly captainArmband: boolean;
}

// =============================================================================
// Décisions du manager (avant et pendant le match)
// =============================================================================

/** Plan de jeu pré-match (cf. 07-tactique-preparation.md, niveau 2). */
export interface PreMatchTacticalPlan {
  readonly occupation: 'HAUTE' | 'MEDIANE' | 'BASSE';
  readonly defensiveLine: 'MONTANTE' | 'RIDEAU' | 'STAND_OFF';
  readonly setPiecesFocus: readonly ('MELEE' | 'TOUCHE' | 'MAUL' | 'NONE')[];
  // V0.60 : `targetingStrategy` retiré. C'était une chaîne libre, jamais
  // renseignée et que le moteur n'aurait de toute façon pas su interpréter.
  // Cibler un adversaire précis relève du dossier d'avant-match, qui existe et
  // qui, lui, produit de vrais effets.
}

export type LiveMomentChoice = string;

/** Décision live prise pendant un live moment. */
export interface LiveMomentDecision {
  readonly atTick: number;
  readonly momentId: string;
  readonly choice: LiveMomentChoice;
}

/** Toutes les décisions du manager pour un match (passées en entrée du moteur). */
export interface ManagerDecisionsForMatch {
  readonly squad: MatchSquad;
  readonly tacticalPlan: PreMatchTacticalPlan;
  readonly liveMoments: readonly LiveMomentDecision[];
}

// =============================================================================
// Phase de match — l'unité atomique de simulation
// =============================================================================

export type PhaseType =
  | 'KICKOFF'
  | 'SCRUM'
  | 'LINEOUT'
  | 'RUCK'
  | 'OPEN_PLAY'
  | 'GOAL_LINE'
  | 'KICK'
  | 'PENALTY'
  | 'CONVERSION'
  | 'DROP_GOAL'
  | 'TRY';

/** Possession à l'instant de la phase. */
export type Possession = 'HOME' | 'AWAY' | 'CONTESTED';

/** Type d'action qui produit des points. */
export type ScoringType = 'TRY' | 'CONVERSION' | 'PENALTY' | 'DROP_GOAL';

/** Issue d'une phase. */
export interface PhaseOutcome {
  readonly possessionAfter: Possession;
  readonly metersGained: number;                       // signé : positif = avancée du porteur
  readonly nextPhase: PhaseType;
  readonly tryScored?: 'HOME' | 'AWAY';
  readonly penaltyAwarded?: 'HOME' | 'AWAY';
  readonly cardIssued?: { color: 'YELLOW' | 'RED'; playerId: PlayerId };
  /** Points marqués pendant cette phase (transformation, pénalité réussie, drop). */
  readonly pointsScored?: { readonly team: 'HOME' | 'AWAY'; readonly value: number; readonly type: ScoringType };
  /** Joueur principal de la phase (marqueur d'essai, buteur, sanctionné, etc.). */
  readonly keyPlayerId?: PlayerId;
  /**
   * V0.13 — apports individuels de la phase (courses, mètres, plaquages, grattages…).
   * Alimente les statistiques de match joueur par joueur. Voir carry.ts.
   */
  readonly contributions?: readonly PhaseContribution[];
  readonly summary: string;                            // narration courte ("mêlée dominée")
}

/** Snapshot de l'état du match au début d'une phase. */
export interface MatchStateSnapshot {
  readonly minute: number;                              // 0-80 (+ overtime)
  readonly homeScore: number;
  readonly awayScore: number;
  readonly possession: Possession;
  readonly fieldPosition: number;                      // -50 à +50 (0 = milieu, signé selon possession)
  readonly phaseInPossession: number;                  // compteur multiphases
  readonly homeFatigue: StatValue;
  readonly awayFatigue: StatValue;
  readonly homeMomentum: number;                       // -100 à +100
}

// =============================================================================
// Entrée et sortie du simulateur
// =============================================================================

export interface MatchInput {
  readonly matchId: MatchId;
  readonly home: ManagerDecisionsForMatch;
  readonly away: ManagerDecisionsForMatch;
  /** Index des joueurs référencés par les feuilles de match — le moteur reste pur (pas de DB). */
  readonly playersById: ReadonlyMap<PlayerId, Player>;
  readonly weather: 'SEC' | 'PLUIE' | 'VENT' | 'EXTREME';
  readonly fieldCondition: 'BON' | 'GRAS' | 'DUR';
  readonly homeAdvantageBonus: number;                 // 0-1
  /**
   * V0.58 — le public, enfin lu par le moteur.
   *
   * Déclaré depuis la V0.1 et ignoré jusqu'ici. `MOYEN` est le point neutre :
   * c'est la valeur de la fixture de calibration, et rien ne change à ce
   * niveau-là. Voir `crowd.ts`.
   */
  readonly homeFans: CrowdLevel;
  /** Optionnel : enrichit la narration finale (sinon HOME / AWAY). */
  readonly homeClub?: Club;
  readonly awayClub?: Club;
  /** Modificateurs hebdomadaires (entraînement, focus) appliqués à HOME. */
  readonly homeWeeklyModifiers?: HomeWeeklyModifiers;
  /** V0.9 — modificateurs hebdomadaires appliqués à AWAY (si le joueur joue à l'extérieur). */
  readonly awayWeeklyModifiers?: HomeWeeklyModifiers;
  /** V0.9 — côté contrôlé par le joueur (pour live moments + décisions). Default 'HOME'. */
  readonly playerSide?: 'HOME' | 'AWAY';
  /**
   * V0.51 — graphe de relations, quand il est connu.
   *
   * La saison ne suit les relations que pour le club de l'utilisateur : celles
   * d'un club IA sont absentes, et sa cohésion vaut alors zéro — neutre, ni
   * bonus ni malus. Le moral, lui, est porté par les joueurs eux-mêmes et vaut
   * donc pour les deux camps.
   */
  readonly homeRelations?: import('../human/relationships.js').RelationsState;
  readonly awayRelations?: import('../human/relationships.js').RelationsState;
  /**
   * V0.52 — l'homme au sifflet.
   *
   * Absent pour un match libre ou un test : l'arbitrage est alors parfaitement
   * neutre, et la calibration historique reste valide.
   */
  readonly referee?: import('./referee.js').Referee;
  /** V0.52 — consigne de discipline au sol, par camp. */
  readonly homeDisciplinePolicy?: import('./referee.js').DisciplinePolicy;
  readonly awayDisciplinePolicy?: import('./referee.js').DisciplinePolicy;
  /**
   * V0.65 : ce que chaque camp a joué en touche jusqu'ici cette saison.
   *
   * Transmis au match plutôt que recalculé dedans : le compteur vit sur la
   * saison, et le moteur reste sans mémoire d'un match à l'autre.
   */
  readonly homeCallUsage?: import('./playbook.js').CallUsage;
  readonly awayCallUsage?: import('./playbook.js').CallUsage;
}


/** Modificateurs dérivés du choix de préparation hebdomadaire. */
export interface HomeWeeklyModifiers {
  /** -10..+10 : se cumule au tacticalBonus HOME pendant tout le match. */
  readonly tacticalBonus: number;
  /** -10..+10 : fatigue de départ HOME (négatif = mieux récupéré). */
  readonly initialFatigueDelta: number;
  /** Bonus spécifique mêlée/ruck (focus PACK). */
  readonly packBonus?: number;
  /** Bonus spécifique jeu courant (focus BACKS). */
  readonly backsBonus?: number;
  /** V0.8 — philosophie de touche choisie pré-match. */
  readonly lineoutPhilosophy?: LineoutPhilosophy;
  /**
   * V0.65 : le carnet de combinaisons de touche, et ce que l'adversaire en sait.
   *
   * Le carnet voyage avec la préparation de la semaine, pas avec le plan de
   * match : on le dessine à l'entraînement et on le garde d'un match à l'autre,
   * ce qui est exactement ce qui permet de se faire lire.
   */
  readonly playbook?: import('./playbook.js').Playbook;
  /**
   * Qualité d'analyse vidéo de **ce** camp, 0 à 1.
   *
   * C'est elle qui décide s'il lit les habitudes d'en face, et non l'inverse :
   * un camp lit, l'autre est lu. Zéro par défaut, donc aucune lecture, donc une
   * calibration inchangée.
   */
  readonly analysis?: number;
}

/** V0.8 — choix de philosophie de touche. */
export type LineoutPhilosophy = 'MAUL_LOURD' | 'SAUT_RAPIDE' | 'SAUT_LONG';

export interface MatchResult {
  readonly matchId: MatchId;
  readonly homeScore: number;
  readonly awayScore: number;
  readonly phases: readonly PhaseRecord[];
  readonly individualStats: ReadonlyMap<PlayerId, IndividualMatchStats>;
  readonly narrativeSummary: string;
  /** V0.13 — remplacements effectués pendant le match, dans l'ordre chronologique. */
  readonly homeSubstitutions: readonly SubstitutionRecord[];
  readonly awaySubstitutions: readonly SubstitutionRecord[];
  /** V0.13 — true si le match s'est terminé en mêlées simulées (plus de première ligne). */
  readonly uncontestedScrums: boolean;
  /**
   * V0.52 — cartons réellement distribués pendant la rencontre.
   *
   * Les suites disciplinaires en découlent. Jusqu'ici elles étaient tirées
   * après coup, indépendamment de ce qui s'était passé sur le terrain : un
   * joueur pouvait écoper d'un rouge dans un match où il n'avait pas concédé la
   * moindre pénalité.
   */
  readonly cardsIssued: readonly {
    readonly playerId: PlayerId;
    readonly color: 'YELLOW' | 'RED';
    readonly minute: number;
  }[];
  /**
   * V0.65 : les combinaisons de touche appelées, camp par camp.
   *
   * Le moteur ne tient pas le compteur de saison, il dit seulement ce qu'il
   * vient de jouer. La saison additionne et sauvegarde : deux responsabilités
   * séparées, et une seule source de vérité pour le cumul.
   */
  readonly homeLineoutCalls?: import('./playbook.js').CallUsage;
  readonly awayLineoutCalls?: import('./playbook.js').CallUsage;
}

export interface PhaseRecord {
  readonly index: number;
  readonly state: MatchStateSnapshot;
  readonly type: PhaseType;
  readonly outcome: PhaseOutcome;
}

export interface IndividualMatchStats {
  readonly minutesPlayed: number;
  readonly tries: number;
  readonly tackles: number;
  readonly tacklesMissed: number;
  readonly metersWithBall: number;
  readonly carries: number;
  readonly turnoversWon: number;
  readonly handlingErrors: number;
  readonly penaltiesConceded: number;
  readonly cards: { yellow: number; red: number };
  readonly kicksFromHand: number;
  readonly placeKicks: { attempted: number; made: number };
  /** V0.13 — défenseurs battus dans le contact. */
  readonly defendersBeaten: number;
  /** V0.13 — franchissements du rideau défensif. */
  readonly lineBreaks: number;
}
