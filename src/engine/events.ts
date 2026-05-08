/**
 * GameEvent — l'état du jeu dérive d'une séquence d'événements typés.
 *
 * Voir 09-architecture-logicielle.md, section A.3 (event sourcing).
 *
 * Règle : tous les changements d'état du jeu passent par un GameEvent.
 * Le reducer applyEvent(state, event) → state' est une fonction pure.
 *
 * Les saves sont sérialisées comme une liste d'events (+ metadata).
 * Un même seed + une même séquence d'events → même état exact.
 */

import type {
  ClubId,
  MatchId,
  PlayerId,
  Position,
  RelationType,
  SeasonId,
  StaffId,
  TraitId,
  SimulationClock,
  InjuryType,
  StatValue,
} from './types.js';

// =============================================================================
// Événements saison
// =============================================================================

export interface SeasonStarted {
  readonly type: 'SeasonStarted';
  readonly tick: SimulationClock;
  readonly seasonId: SeasonId;
  readonly year: number;
  readonly playerClubId: ClubId;
}

export interface MatchScheduled {
  readonly type: 'MatchScheduled';
  readonly tick: SimulationClock;
  readonly matchId: MatchId;
  readonly homeClub: ClubId;
  readonly awayClub: ClubId;
  readonly round: number;
}

// =============================================================================
// Événements match (déclenchés par le moteur match)
// =============================================================================

export interface MatchStarted {
  readonly type: 'MatchStarted';
  readonly tick: SimulationClock;
  readonly matchId: MatchId;
}

export interface MatchPhasePlayed {
  readonly type: 'MatchPhasePlayed';
  readonly tick: SimulationClock;
  readonly matchId: MatchId;
  readonly phaseIndex: number;
  readonly phaseType: 'SCRUM' | 'LINEOUT' | 'OPEN_PLAY' | 'RUCK' | 'KICK' | 'PENALTY' | 'TRY' | 'CONVERSION';
  readonly summary: string;
}

export interface MatchEnded {
  readonly type: 'MatchEnded';
  readonly tick: SimulationClock;
  readonly matchId: MatchId;
  readonly homeScore: number;
  readonly awayScore: number;
}

// =============================================================================
// Événements joueur — humain (pilier 2)
// =============================================================================

export interface TraitRevealed {
  readonly type: 'TraitRevealed';
  readonly tick: SimulationClock;
  readonly playerId: PlayerId;
  readonly trait: TraitId;
}

export interface TraitChanged {
  readonly type: 'TraitChanged';
  readonly tick: SimulationClock;
  readonly playerId: PlayerId;
  readonly trait: TraitId;
  readonly action: 'ADDED' | 'REMOVED';
}

export interface MoodChanged {
  readonly type: 'MoodChanged';
  readonly tick: SimulationClock;
  readonly playerId: PlayerId;
  readonly newMood: StatValue;
  readonly cause: string;
}

export interface RelationshipChanged {
  readonly type: 'RelationshipChanged';
  readonly tick: SimulationClock;
  readonly from: PlayerId;
  readonly to: PlayerId;
  readonly delta: number;
  readonly newType?: RelationType;
  readonly reason: string;
}

// =============================================================================
// Événements joueur — physique
// =============================================================================

export interface PlayerInjured {
  readonly type: 'PlayerInjured';
  readonly tick: SimulationClock;
  readonly playerId: PlayerId;
  readonly injuryType: InjuryType;
  readonly weeksOut: number;
  readonly hasSequelaRisk: boolean;
}

export interface PlayerRecovered {
  readonly type: 'PlayerRecovered';
  readonly tick: SimulationClock;
  readonly playerId: PlayerId;
  readonly leftSequela: boolean;
}

export interface PlayerPositionChanged {
  readonly type: 'PlayerPositionChanged';
  readonly tick: SimulationClock;
  readonly playerId: PlayerId;
  readonly newPosition: Position;
}

// =============================================================================
// Événements managériaux (intents validés)
// =============================================================================

export interface ManagerDecisionTaken {
  readonly type: 'ManagerDecisionTaken';
  readonly tick: SimulationClock;
  readonly decisionId: string;
  readonly choice: string;
  readonly context: Record<string, unknown>;  // payload spécifique à la décision
}

export interface StaffAdvised {
  readonly type: 'StaffAdvised';
  readonly tick: SimulationClock;
  readonly staffId: StaffId;
  readonly advice: string;
  readonly bias: 'PRUDENT' | 'AGRESSIF' | 'NEUTRE' | 'BUSINESS' | 'HUMAIN';
}

// =============================================================================
// Union type — utilisée par le reducer
// =============================================================================

export type GameEvent =
  | SeasonStarted
  | MatchScheduled
  | MatchStarted
  | MatchPhasePlayed
  | MatchEnded
  | TraitRevealed
  | TraitChanged
  | MoodChanged
  | RelationshipChanged
  | PlayerInjured
  | PlayerRecovered
  | PlayerPositionChanged
  | ManagerDecisionTaken
  | StaffAdvised;

/** Type guard utility pour le reducer. */
export type EventByType<T extends GameEvent['type']> = Extract<GameEvent, { type: T }>;
