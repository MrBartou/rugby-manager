/**
 * Types spécifiques à la simulation de match.
 *
 * Granularité : par phase (~75 phases par match en moyenne).
 * Voir 06-moteur-match.md.
 */

import type { ClubId, MatchId, PlayerId, Position, StatValue } from '../types.js';

// =============================================================================
// Composition / feuille de match
// =============================================================================

/** Feuille de match : 15 titulaires + 8 remplaçants (Top 14 standard). */
export interface MatchSquad {
  readonly clubId: ClubId;
  readonly starters: readonly RosterEntry[];          // 15
  readonly substitutes: readonly RosterEntry[];        // 8
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
  readonly targetingStrategy?: string;                 // ex : "exploiter centre adverse faible"
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
  | 'KICK'
  | 'PENALTY'
  | 'CONVERSION'
  | 'DROP_GOAL'
  | 'TRY';

/** Possession à l'instant de la phase. */
export type Possession = 'HOME' | 'AWAY' | 'CONTESTED';

/** Issue d'une phase. */
export interface PhaseOutcome {
  readonly possessionAfter: Possession;
  readonly metersGained: number;                       // signé : positif = avancée du porteur
  readonly nextPhase: PhaseType;
  readonly tryScored?: 'HOME' | 'AWAY';
  readonly penaltyAwarded?: 'HOME' | 'AWAY';
  readonly cardIssued?: { color: 'YELLOW' | 'RED'; playerId: PlayerId };
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
  readonly weather: 'SEC' | 'PLUIE' | 'VENT' | 'EXTREME';
  readonly fieldCondition: 'BON' | 'GRAS' | 'DUR';
  readonly homeAdvantageBonus: number;                 // 0-1
  readonly homeFans: 'PEU' | 'MOYEN' | 'BEAUCOUP';
}

export interface MatchResult {
  readonly matchId: MatchId;
  readonly homeScore: number;
  readonly awayScore: number;
  readonly phases: readonly PhaseRecord[];
  readonly individualStats: ReadonlyMap<PlayerId, IndividualMatchStats>;
  readonly narrativeSummary: string;
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
}
