/**
 * SeasonSession — orchestre une saison Top 14 complète.
 *
 * Référence : 02-gdd.md (boucle saisonnière) + 13-gestion-projet.md V0.3 (saison 26 journées).
 *
 * V0.3 : pas de boucle hebdo détaillée, on enchaîne les journées. L'utilisateur joue
 *   son match (interactif), les autres matchs de la journée sont auto-simulés.
 *
 * V0.4+ : boucle hebdo (5 jours actifs entre matchs), entraînement, mood, blessures.
 */

import { simulateMatch } from '../match/simulate.js';
import type { IndividualMatchStats, MatchInput, MatchResult } from '../match/types.js';
import type { Club, ClubId, Player, PlayerId } from '../types.js';
import { applyMatchToPlayerStates } from '../match/player-state.js';
import { progressInjuryRecovery, rollPostMatchInjuries, type RolledInjury } from '../match/injuries.js';
import { applyMatchCards, clearExpiredSuspensions, type RolledCard } from '../match/cards.js';
import {
  isInternationalBreak,
  isWindowClosing,
  windowOf,
  type CallUpSchedule,
} from '../season/internationals.js';
import {
  applyCaps,
  AUTUMN_OPPONENTS,
  internationalFatigue,
  NATIONS,
  reportWindow,
  isEligible,
  seedInitialCaps,
  selectNationalSquad,
  selectionScore,
  UNKNOWN_PLAY_RATIO,
  type Caps,
  type InternationalResult,
  type NationalSquad,
  type WindowReport,
} from '../season/national-team.js';
import {
  buildFranceSheet,
  buildInternationalMatchInput,
  buildNationSquad,
  FRANCE_NATIONAL_CLUB,
} from '../season/national-opponent.js';
import { applyBadFitMoodPenalty, evaluateIdentityFit } from '../club/identity-fit.js';
import {
  applyMovement,
  computeAnnualPayroll,
  computeRoundPayroll,
  initFinancesForAllClubs,
  type ClubFinances,
  type FinancialMovement,
} from '../club/finances.js';
import {
  buildContractDecision,
  resolveContractDecision as resolveContractDecisionPure,
  type ContractDecision,
  type ContractDecisionOptionId,
  type ContractDecisionResolution,
} from '../club/contract-decisions.js';
import { detectExpiringContracts } from '../club/contracts.js';
import {
  generateIncomingOffers,
  resolveIncomingOffer as resolveIncomingOfferPure,
  type IncomingOffer,
  type IncomingOfferResolution,
} from '../club/transfer-market.js';
import {
  bidForInternationalTarget,
  generateForeignInterest,
  generateInternationalTargets,
  type InternationalBid,
  type InternationalTarget,
} from '../club/international-market.js';
import {
  canAffordTransfer,
  estimateMarketValue,
  perceivedRank,
  resolveTransferOffer,
  type AffordabilityCheck,
  type TransferResolution,
} from '../club/transfer-offers.js';
import { expectedMarketSalary } from '../club/contracts.js';
import {
  defaultAcademyState,
  type AcademyFocus,
  type AcademyInvestment,
  type AcademyState,
} from '../club/academy.js';
import {
  canBeJoker,
  eligibleJokers,
  jokerCandidates,
  jokerEligibility,
  signJoker,
} from '../club/medical-joker.js';
import {
  generateInitialRelations,
  applyMatchToRelations,
  type RelationsState,
} from '../human/relationships.js';
import { applyRivalryTensions, type RivalryTension } from '../human/squad-rivalry.js';
import {
  detectHumanEvents,
  detectPressEvent,
} from '../human/event-detector.js';
import type { HumanEvent, HumanEventOption, HumanEventType } from '../human/events.js';
import {
  generateFinal,
  generatePlayoffMatches,
  generateRoundRobinCalendar,
  generateSemifinals,
  isPlayoffRound,
  matchesForRound,
  nextMatchForClub,
  playoffRoundsAfter,
  type PlayoffRounds,
  type PlayoffMatch,
  type ScheduledMatch,
  type SeasonCalendar,
} from '../season/calendar.js';
import {
  campaignSummaryLabel,
  competitionForRank,
  generatePoolCampaign,
  nextKnockoutFixture,
  summarisePool,
  type CompetitionId,
  type EuropeanCampaign,
  type EuropeanFixture,
  type EuropeanResult,
  type PoolOutcome,
} from '../season/european-cup.js';
import {
  asOpponent,
  clubsOfCompetition,
  drawPoolOpponents,
  EMPTY_EUROPEAN_WORLD,
  type EuropeanWorld,
} from '../season/european-world.js';
import {
  relegationStatusForRank,
  resolveRelegation,
  type RelegationStatus,
  type SeasonRelegationResult,
} from '../season/relegation.js';
import { createRng } from '../rng.js';
import {
  DEFAULT_TRAINING_FOCUS,
  type CoachingQuality,
  type TrainingFocus,
} from '../club/development.js';
import { coachingQualityFromStaff, generateStaffForClub, type StaffMember } from '../club/staff.js';
import {
  DEFAULT_PLAN,
  INITIAL_FACILITIES,
  matchdayRevenue,
} from '../club/club-management.js';
import { loanWageReliefPerRound } from '../club/loans.js';
import { rateMatch } from '../match/player-rating.js';
import { canRegister, type SigningCheck } from '../club/regulations.js';
import { attendanceBonus, rivalryBetween } from '../season/rivalries.js';
import {
  EMPTY_SCOUTING,
  advanceScouting,
  assignClubScout,
  assignScout,
  scoutingSlots,
  estimateValue,
  unassignClubScout,
  unassignScout,
  type ScoutingState,
  type ValueEstimate,
} from '../club/scouting.js';
import {
  transferWindowStatus,
  type TransferWindowStatus,
} from '../season/transfer-window.js';
import {
  applyMatchToStandings,
  emptyStandings,
  rankedStandings,
  type ClubStanding,
  type Standings,
} from '../season/standings.js';

// =============================================================================
// État
// =============================================================================

export interface PlayedMatch {
  readonly round: number;
  readonly homeClubId: ClubId;
  readonly awayClubId: ClubId;
  readonly homeScore: number;
  readonly awayScore: number;
  /** Si true, c'est l'utilisateur qui a joué ce match. */
  readonly playerPlayed: boolean;
  /** Étiquette pour les matchs de phases finales. */
  readonly playoffLabel?: string;
}

/**
 * Ce qu'on retient d'un joueur sur une saison.
 *
 * Élargi en V0.53 : les essais, les matchs et les minutes suffisaient à piloter
 * le développement, pas à départager les joueurs d'un championnat. Un troisième
 * ligne qui gratte trente ballons ne marque pas d'essai.
 */
/**
 * Ce qu'un joueur a produit **en sélection** sur la saison (V0.63).
 *
 * Volontairement plus court que la ligne de championnat : une carrière
 * internationale se raconte en capes, en essais et en minutes, pas en
 * franchissements. Et surtout, ces totaux ne se mélangent jamais à ceux du
 * Top 14 : un essai en bleu n'entre pas au classement des marqueurs.
 */
export interface InternationalSeasonStat {
  readonly matches: number;
  readonly minutes: number;
  readonly tries: number;
  readonly tackles: number;
  readonly meters: number;
}

export interface SeasonPlayerStat {
  readonly tries: number;
  readonly matches: number;
  /** V0.14 — minutes cumulées : c'est le moteur du développement. */
  readonly minutes: number;
  readonly tackles: number;
  readonly meters: number;
  readonly turnovers: number;
  readonly defendersBeaten: number;
  readonly lineBreaks: number;
  /**
   * V0.61 — somme des notes de match, et nombre de matchs notés.
   *
   * On garde la somme et le compte plutôt que la moyenne : une moyenne
   * stockée ne se met pas à jour sans se dénaturer, et la note de saison est
   * une dérivée comme les autres. Facultatifs pour qu'une sauvegarde
   * antérieure se charge sans mentir sur ce qu'elle contient.
   */
  readonly ratingSum?: number;
  readonly ratedMatches?: number;
}

/** Note moyenne d'un joueur sur la saison, ou `undefined` s'il n'a pas été noté. */
export function averageRating(stat: SeasonPlayerStat | undefined): number | undefined {
  if (!stat?.ratedMatches) return undefined;
  return Math.round(((stat.ratingSum ?? 0) / stat.ratedMatches) * 10) / 10;
}

export interface SeasonState {
  readonly playerClubId: ClubId;
  readonly currentSeason: number;                // V0.6 — année de la saison en cours (ex: 2025 = 2025-26)
  readonly currentRound: number;                 // 1-indexed ; > 29 = saison terminée
  readonly calendar: SeasonCalendar;
  readonly standings: Standings;
  readonly history: readonly PlayedMatch[];
  /** Match du joueur pour la journée courante, undefined si saison terminée ou éliminé. */
  readonly playerNextMatch: ScheduledMatch | PlayoffMatch | undefined;
  readonly status: 'in-progress' | 'eliminated' | 'finished';
  /** Phase actuelle. */
  readonly phase: 'regular' | 'playoffs' | 'semifinals' | 'final' | 'over';
  /** Vainqueur du Brennus (défini après la finale). */
  readonly champion?: ClubId;
  /** Graphe des relations dans le club joueur (V0.4). */
  readonly relations: RelationsState;
  /** Mood modifiers par joueur du club joueur (V0.4). */
  readonly moodDeltasByPlayer: ReadonlyMap<PlayerId, number>;
  /** Bonus tactique pour le prochain match (issu d'events humains). */
  readonly nextMatchTacticalBonus: number;
  /** Events humains en attente de décision. */
  readonly pendingEvents: readonly HumanEvent[];
  /** Historique des events traités (pour le journal). */
  readonly resolvedEvents: readonly { readonly event: HumanEvent; readonly chosenOptionId: string; readonly resolvedAtRound: number }[];
  /** V0.6 — finances par club. */
  readonly financesByClub: ReadonlyMap<ClubId, ClubFinances>;
  /** V0.6 — décisions de renouvellement de contrat en attente (joueurs du club joueur en fin de contrat). */
  readonly pendingContractDecisions: readonly ContractDecision[];
  /** V0.6 — décisions de contrat résolues (pour journal). */
  readonly resolvedContractDecisions: readonly ContractDecisionResolution[];
  /** V0.6 — offres entrantes IA en attente de décision (sur les joueurs du club joueur). */
  readonly pendingIncomingOffers: readonly IncomingOffer[];
  /** V0.13 — campagne européenne du club joueur (undefined si non qualifié). */
  readonly europeanCampaign: EuropeanCampaign | undefined;
  /** V0.13 — match européen à disputer cette journée, le cas échéant. */
  readonly europeanFixture: EuropeanFixture | undefined;
  /** V0.13 — situation du club joueur vis-à-vis de la descente. */
  readonly relegationStatus: RelegationStatus;
  /** V0.30 — état du marché : ouvert, fermé, prochaine fenêtre. */
  readonly transferWindow: TransferWindowStatus;
  /**
   * V0.31 — journée jusqu'à laquelle chaque joueur approché reste hors
   * d'atteinte. Exposé pour la sauvegarde : sans lui, recharger une partie
   * effaçait tous les délais et permettait de relancer indéfiniment une offre
   * refusée.
   */
  readonly bidCooldowns: ReadonlyMap<PlayerId, number>;
  /** V0.37 — blessés dont le droit au joker médical est déjà consommé. */
  readonly jokersUsedFor: ReadonlySet<PlayerId>;
  /** V0.39 — centre de formation du club utilisateur. */
  readonly academy: AcademyState;
  /**
   * V0.31 — joueurs des autres clubs modifiés par la session (blessures,
   * suspensions, guérisons). À répercuter dans le stock global, faute de quoi
   * les compositions adverses ignoreraient ces indisponibilités.
   */
  readonly aiPlayerUpdates: ReadonlyMap<PlayerId, Player>;
  /** V0.7 — roster live du club joueur (reflet des transferts, contrats, fatigue/forme). */
  readonly playerClubRoster: readonly Player[];
  /** V0.7 — blessures fraîches du dernier match (notif UI). Reset à chaque commit. */
  readonly latestInjuries: readonly RolledInjury[];
  /** V0.8 — cartons du dernier match. Reset à chaque commit. */
  readonly latestCards: readonly RolledCard[];
  /**
   * V0.56 — brouilles qui viennent d'éclater au grand jour.
   *
   * Pas toutes les tensions de la journée : seulement celles qui ont franchi le
   * seuil du conflit ouvert, c'est-à-dire celles qui méritent qu'on prévienne
   * le manager.
   */
  readonly latestRivalries: readonly RivalryTension[];
  /**
   * V0.56 — journées des phases finales de ce championnat.
   *
   * Exposées parce qu'elles ne sont plus une constante : une Pro D2 à seize
   * clubs joue sa finale trois journées plus tard qu'un Top 14, et l'interface
   * n'a aucun moyen de le deviner.
   */
  readonly playoffRounds: PlayoffRounds;
  /** V0.8 — sélections internationales de la journée courante. */
  readonly callUpSchedule: CallUpSchedule;
  /**
   * V0.58 — le groupe France de la fenêtre en cours, s'il y en a une.
   *
   * Absent hors trêve : il n'y a pas de sélection permanente, et l'afficher
   * en continu ferait de la liste un tableau de plus.
   */
  readonly nationalSquad: NationalSquad | undefined;
  /** V0.58 — capes accumulées par joueur, toutes saisons confondues. */
  readonly caps: Caps;
  /** V0.59 — capes gagnées pendant la saison en cours, pour le registre de carrière. */
  readonly capsThisSeason: ReadonlyMap<PlayerId, number>;
  /**
   * V0.63 : ce qu'ont produit les internationaux en sélection cette saison.
   *
   * Depuis que les tests sont joués par le moteur, une sélection n'est plus une
   * ligne d'absence : elle a des essais, des plaquages et des mètres.
   */
  readonly internationalStats: ReadonlyMap<PlayerId, InternationalSeasonStat>;
  /** V0.59 — candidats à la sélection, classés au mérite. */
  readonly nationalShortlist: readonly { readonly player: Player; readonly score: number }[];
  /** V0.58 — bilan de la dernière fenêtre internationale soldée. */
  readonly latestWindowReport: WindowReport | undefined;
  /** V0.8 — true si le round courant est une trêve internationale. */
  readonly isInternationalBreak: boolean;
  /** V0.9 — stats cumulées des joueurs sur la saison en cours. */
  readonly seasonPlayerStats: ReadonlyMap<PlayerId, SeasonPlayerStat>;
  /**
   * V0.58 — matchs du club dirigé déjà comptabilisés.
   *
   * Exposé pour la sauvegarde : c'est le dénominateur du temps de jeu, et il
   * doit être restauré avec le numérateur sous peine de rendre tout l'effectif
   * remplaçant au rechargement.
   */
  readonly statsMatchCount: number;
  /** V0.14 — focus d'entraînement choisi par le manager, par joueur. */
  readonly trainingByPlayer: ReadonlyMap<PlayerId, TrainingFocus>;
  /** V0.14 — qualité d'encadrement du club joueur, dérivée de son staff. */
  readonly coaching: CoachingQuality;
  /** V0.44 — encadrement en place, désormais recrutable. */
  readonly staff: readonly StaffMember[];
  /** V0.15 — connaissance des joueurs (fourchettes d'estimation). */
  readonly scouting: ScoutingState;
  /** V0.15 — nombre de missions d'observation simultanées autorisées. */
  readonly scoutingSlots: number;
}

// =============================================================================
// Transferts sortants (V0.28)
// =============================================================================

export interface BidTerms {
  readonly fee: number;
  readonly annualSalary: number;
  readonly years: number;
}

/**
 * Ce que le manager sait *avant* de proposer.
 *
 * Ni le prix demandé par le vendeur, ni la valeur exacte du joueur : seulement
 * la fourchette de son propre service recrutement. Exposer le chiffre réel
 * viderait le scouting de son sens — on annonçait « vous négociez à l'aveugle »
 * en pré-remplissant le curseur pile sur la bonne valeur.
 */
export interface BidPreview {
  readonly valueRange: ValueEstimate;
  /**
   * Point de départ honnête pour le curseur d'indemnité. Sans rapport de
   * scouting, il est extrapolé du salaire — une information publique.
   */
  readonly suggestedFee: number;
  readonly expectedSalary: number;
  readonly currentSalary: number;
  readonly contractYearsLeft: number;
  readonly sellingClubName: string;
  /** Trésorerie disponible de l'acheteur. */
  readonly balance: number;
  /** Marge salariale annuelle restante avant de crever le budget. */
  readonly payrollHeadroom: number;
  /** Journées restantes avant de pouvoir re-proposer (0 = voie libre). */
  readonly cooldownRounds: number;
  /** Renseigné si aucune offre n'est possible du tout. */
  readonly blocked?: string;
}

export type BidOutcome =
  | { readonly kind: 'SIGNED'; readonly player: Player; readonly fee: number; readonly resolution: TransferResolution }
  | { readonly kind: 'REFUSED'; readonly resolution: TransferResolution; readonly cooldownRounds: number }
  | { readonly kind: 'BLOCKED'; readonly reason: string };

export interface BidRecord {
  readonly playerId: PlayerId;
  readonly playerName: string;
  readonly round: number;
  readonly fee: number;
  readonly annualSalary: number;
  readonly accepted: boolean;
  readonly refusedBy?: 'CLUB' | 'JOUEUR';
  readonly reason: string;
}

/**
 * Après un refus, la porte reste fermée un moment.
 *
 * Sans ce délai, le manager rejoue le dé jusqu'à ce que l'aléa passe : la
 * négociation n'aurait plus aucun sens. Un joueur qui a dit non est plus long à
 * faire changer d'avis qu'un club qui trouve juste l'offre trop basse.
 */
const BID_COOLDOWN_CLUB = 2;
const BID_COOLDOWN_PLAYER = 4;

export interface SeasonSession {
  getState(): SeasonState;
  /**
   * Simule tous les matchs de la journée courante SAUF celui du joueur, et avance.
   * Le match du joueur doit être joué via `playPlayerMatch` puis `commitPlayerMatch`.
   * @returns la liste des matchs auto-joués cette journée (hors match du joueur).
   */
  simulateOtherMatchesOfRound(seedSalt: string): readonly PlayedMatch[];
  /** Enregistre le résultat du match du joueur et incrémente la journée. */
  commitPlayerMatch(homeScore: number, awayScore: number, result: MatchResult, starterIds?: readonly PlayerId[]): void;
  /** Avance d'un round sans match du joueur (phases finales auxquelles il n'est pas qualifié). */
  skipRound(seedSalt: string): readonly PlayedMatch[];
  /** Renvoie le top N du classement. */
  getRanking(): readonly ClubStanding[];
  /** Applique l'option choisie d'un event humain en attente. */
  resolveHumanEvent(eventId: string, optionId: string): void;
  /** Force la détection d'events (utilisé après chargement d'une partie sans events). */
  triggerEventDetection(playerClubRoster: readonly Player[], currentSeason: number): void;
  /** V0.6 — résout une décision de renouvellement. Renvoie l'éventuelle mise à jour du joueur (override). */
  resolveContractDecision(decisionId: string, optionId: ContractDecisionOptionId): ContractDecisionResolution | undefined;
  /** V0.6 — résout une offre entrante (accepter/refuser). Met à jour finances + clubId joueur. */
  resolveIncomingOffer(offerId: string, accept: boolean): IncomingOfferResolution | undefined;
  /** V0.6 — signe un free agent. Retourne le joueur mis à jour si accepté. */
  signFreeAgent(player: Player, offer: { years: number; annualSalary: number }): Player | undefined;
  /**
   * V0.63 : les joueurs étrangers à vendre cette fenêtre de mercato.
   *
   * Meilleurs à prix égal que le marché français, et non-JIFF : chaque recrue
   * rapproche la feuille de match du quota.
   */
  getInternationalTargets(): readonly InternationalTarget[];
  /**
   * V0.63 : offre pour un joueur étranger.
   *
   * Le règlement et la trésorerie sont vérifiés ici, comme pour toute autre
   * arrivée : l'interdiction de recruter ne s'arrête pas à la frontière.
   */
  signInternational(
    target: InternationalTarget,
    bid: InternationalBid,
  ): { readonly ok: true; readonly player: Player } | { readonly ok: false; readonly reason: string };
  /**
   * V0.13 — enregistre le résultat d'un match européen.
   *
   * N'avance pas la journée : le match de coupe se joue *en plus* du match de
   * championnat de la même semaine. C'est précisément ce cumul qui impose la
   * rotation — la fatigue et les blessures s'appliquent aux joueurs alignés.
   */
  commitEuropeanMatch(
    clubScore: number,
    opponentScore: number,
    starterIds?: readonly PlayerId[],
    subIds?: readonly PlayerId[],
  ): void;
  /** V0.13 — bilan de la phase de poule européenne. */
  getPoolOutcome(): PoolOutcome | undefined;
  /** V0.13 — libellé du parcours européen, pour le bilan de fin de saison. */
  getEuropeanSummary(): string | undefined;
  /** V0.13 — applique descentes et montées en fin de saison. */
  resolveSeasonRelegation(strengthByClub: (clubId: ClubId) => number): SeasonRelegationResult;
  /** V0.14 — assigne un focus d'entraînement à un joueur. */
  setTrainingFocus(playerId: PlayerId, focus: TrainingFocus): void;
  /** V0.14 — applique un focus à tout l'effectif d'un coup. */
  setTrainingFocusForAll(focus: TrainingFocus): void;
  /** V0.14 — staff du club joueur (compétences et salaires). */
  getStaff(): readonly StaffMember[];
  /** V0.14 — remplace un membre du staff par un candidat recruté. */
  hireStaff(member: StaffMember): void;
  /**
   * V0.28 — chiffrage d'une offre pour un joueur sous contrat ailleurs.
   *
   * Sert à pré-remplir la négociation : le manager voit ce qu'on attend de lui
   * avant de proposer, mais **pas** le prix exact demandé par le club vendeur —
   * c'est tout l'enjeu de la négociation.
   */
  previewBid(player: Player): BidPreview;
  /** V0.28 — soumet une offre pour un joueur sous contrat. */
  submitBid(player: Player, terms: BidTerms): BidOutcome;
  /** V0.28 — historique des offres soumises cette saison. */
  getBidHistory(): readonly BidRecord[];
  /** V0.39 — règle l'investissement et l'orientation du centre de formation. */
  setAcademyPlan(plan: { readonly investment?: AcademyInvestment; readonly focus?: AcademyFocus }): void;
  /**
   * V0.37 — blessés du club ouvrant droit à un joker médical, et agents libres
   * signables pour chacun. Vide hors des conditions de la règle.
   */
  getJokerOptions(): readonly {
    readonly injured: Player;
    readonly returnsAtRound: number;
    readonly candidates: readonly Player[];
  }[];
  /**
   * V0.37 — signe un joker médical. Seule dérogation à la fenêtre de mercato :
   * elle est donc vérifiée par le moteur, pas par l'interface.
   */
  signMedicalJoker(injuredId: PlayerId, candidate: Player, annualSalary: number):
    { readonly ok: true; readonly player: Player } | { readonly ok: false; readonly reason: string };
  /**
   * V0.30 — répercute sur les finances des mouvements décidés hors session
   * (mercato des clubs IA en cours de saison).
   *
   * Sans cela, les indemnités du mercato d'hiver disparaissaient : les clubs
   * échangeaient des joueurs sans que l'argent ne bouge, et le classement
   * financier devenait faux dès la J13.
   */
  applyExternalTransfers(balanceByClub: ReadonlyMap<ClubId, number>): void;
  /** V0.15 — met un joueur sous observation (dans la limite des créneaux). */
  assignScout(playerId: PlayerId): void;
  /** V0.15 — retire un joueur des missions d'observation. */
  unassignScout(playerId: PlayerId): void;
  /** V0.43 — met un club entier sous observation (coûte deux créneaux). */
  assignClubScout(clubId: ClubId): void;
  unassignClubScout(clubId: ClubId): void;
  /** V0.44 — remplace le titulaire d'un poste de l'encadrement. */
  setStaff(next: readonly StaffMember[]): void;
  /**
   * V0.44 — resynchronise l'effectif du club utilisateur.
   *
   * La semaine d'entraînement modifie forme, fatigue et blessures **hors**
   * session : sans cette remontée, le match se jouerait sur l'effectif d'avant
   * l'entraînement et la charge n'aurait aucun effet.
   */
  syncPlayerRoster(roster: readonly Player[]): void;
  /** V0.14 — entrées de développement à passer au rollover de fin de saison. */
  getDevelopmentInputs(): {
    readonly minutesByPlayer: ReadonlyMap<PlayerId, number>;
    readonly focusByPlayer: ReadonlyMap<PlayerId, TrainingFocus>;
    readonly coachingByClub: ReadonlyMap<string, CoachingQuality>;
  };
}

// =============================================================================
// Helpers
// =============================================================================

function autoSimulateMatch(
  buildInput: (homeClubId: ClubId, awayClubId: ClubId) => MatchInput,
  match: ScheduledMatch,
  seed: string,
): { readonly result: MatchResult; readonly input: MatchInput } {
  const input = buildInput(match.homeClubId, match.awayClubId);
  return { result: simulateMatch(input, seed), input };
}

// =============================================================================
// Implémentation
// =============================================================================

export interface SeasonSessionOptions {
  readonly clubIds: readonly ClubId[];
  readonly playerClubId: ClubId;
  readonly seed: string;
  /**
   * Constructeur de MatchInput pour les sims auto. Permet à l'orchestrateur de
   * savoir comment composer une équipe (depuis seed-loader).
   */
  readonly buildMatchInput: (homeClubId: ClubId, awayClubId: ClubId) => MatchInput;
  /** Roster complet du club joueur (V0.4 — pour relations + events). */
  readonly playerClubRoster: readonly Player[];
  readonly currentSeason: number;
  /** V0.6 — tous les clubs (pour calcul finances/recettes). Optionnel pour rétro-compat tests. */
  readonly allClubs?: readonly Club[];
  /** V0.6 — accès au roster d'un club arbitraire (pour calcul payroll de chaque club). */
  readonly rosterByClub?: (clubId: ClubId) => readonly Player[];
  /**
   * V0.13 — rang du club joueur la saison précédente (1-14). Détermine la
   * qualification européenne. Absent = première saison, pas de coupe d'Europe.
   */
  readonly previousSeasonRank?: number;
  /**
   * V0.63 : le monde européen persistant.
   *
   * La session le **lit** sans jamais le modifier : les clubs européens vivent
   * d'une saison à l'autre, c'est-à-dire plus longtemps qu'une session. Leur
   * évolution appartient à l'intersaison (`runEuropeanSeason`).
   */
  readonly europeanWorld?: EuropeanWorld;
  /**
   * V0.63 : saison du début de carrière.
   *
   * Donne leur âge aux joueurs des sélections étrangères : sans elle, les
   * All Blacks auraient vingt-deux ans à chaque nouvelle saison.
   */
  readonly careerStartSeason?: number;
  /**
   * V0.45 — politique commerciale et installations du club utilisateur.
   *
   * Fourni sous forme de fonction : le manager peut changer de tarif en cours
   * de saison, et une valeur figée à la construction rendrait ce réglage sans
   * effet jusqu'à l'intersaison suivante.
   */
  readonly clubDirection?: () => {
    readonly facilities: import('../club/club-management.js').ClubFacilities;
    readonly plan: import('../club/club-management.js').ClubPlan;
  };
  /**
   * V0.49 — joueurs placés sur la liste des transferts.
   *
   * Fourni sous forme de fonction, comme la politique commerciale : une
   * demande de départ est acceptée en cours de saison, et une liste figée à la
   * construction ne ferait jamais venir personne.
   */
  readonly wantAwayIds?: () => readonly PlayerId[];
  /**
   * V0.50 — hiérarchie annoncée de l'effectif.
   *
   * Fournie sous forme de fonction, comme la politique commerciale : le manager
   * change de hiérarchie en cours de saison, et une carte figée à la
   * construction ne refléterait jamais ses annonces.
   */
  readonly squadStatuses?: () => ReadonlyMap<PlayerId, import('../club/squad-status.js').SquadStatus>;
  /**
   * V0.58 — vivier de la sélection nationale : **tout** le rugby français.
   *
   * `allClubs` ne porte que la division qu'on joue, ce qui est juste pour le
   * championnat et faux pour le XV de France : un manager de Pro D2 voyait le
   * sélectionneur composer son groupe uniquement parmi les clubs de deuxième
   * division. Fourni sous forme de fonction, comme les autres vues vivantes :
   * les effectifs bougent en cours de saison.
   */
  readonly nationalPool?: () => readonly Player[];
  /**
   * V0.60 — le règlement, tel qu'il s'applique au club dirigé.
   *
   * L'interdiction de recruter ne barrait que la signature d'un agent libre,
   * parce qu'elle n'était testée que dans l'écran qui la propose. Une offre
   * payante ou un joker médical passait sans rien croiser. Le moteur la lit
   * donc lui-même, à toutes les portes d'entrée d'un joueur.
   */
  readonly recruitment?: () => {
    readonly division: 'TOP14' | 'PRO_D2';
    readonly transferBan: boolean;
  };
  /**
   * V0.60 — les joueurs sans club, vus par l'interface.
   *
   * Le joker médical les cherchait dans les effectifs des clubs, d'où ils sont
   * par définition absents : la liste des candidats était toujours vide et la
   * fonctionnalité, morte depuis sa livraison.
   */
  readonly freeAgentPool?: () => readonly Player[];
  /**
   * V0.60 — les prêts en cours du club dirigé.
   *
   * Le club d'accueil prend en charge une part du salaire. Sans cette vue, le
   * moteur facturait au prêteur la totalité de la masse salariale et la part
   * négociée ne servait qu'à l'affichage.
   */
  readonly activeLoans?: () => readonly import('../club/loans.js').ActiveLoan[];
  /**
   * V0.59 — retouches du sélectionneur, quand c'est le manager qui l'est.
   *
   * Le moteur propose un groupe classé au mérite ; le manager en retire et en
   * ajoute. Fourni sous forme de fonction, comme les autres vues vivantes : il
   * change d'avis entre deux journées.
   */
  readonly nationalPicks?: () => {
    readonly added: readonly PlayerId[];
    readonly removed: readonly PlayerId[];
  };
  /**
   * Si défini, restaure la session depuis un snapshot (load partie en cours).
   */
  readonly restoreFrom?: {
    readonly currentRound: number;
    readonly history: readonly PlayedMatch[];
    readonly standings: readonly ClubStanding[];
    readonly champion?: ClubId;
    readonly financesByClub?: ReadonlyMap<ClubId, ClubFinances>;
    /** V0.14 — focus d'entraînement sauvegardés. */
    readonly trainingByPlayer?: ReadonlyMap<PlayerId, TrainingFocus>;
    /** V0.15 — connaissance des joueurs sauvegardée. */
    readonly scouting?: ScoutingState;
    /** V0.44 — encadrement recruté, qui prime sur la génération par défaut. */
    readonly staff?: readonly StaffMember[];
    /** V0.31 — délais après refus d'offre. */
    readonly bidCooldowns?: ReadonlyMap<PlayerId, number>;
    /** V0.37 — blessés pour lesquels un joker a déjà été signé. */
    readonly jokersUsedFor?: readonly PlayerId[];
    /** V0.39 — état du centre de formation. */
    readonly academy?: AcademyState;
    /**
     * V0.58 — statistiques individuelles de la saison en cours.
     *
     * Elles repartaient de zéro à chaque chargement, ce qui vidait le
     * classement des marqueurs, privait le développement des jeunes de ses
     * minutes et faisait juger les honneurs sur une demi-saison.
     */
    readonly playerStats?: ReadonlyMap<PlayerId, SeasonPlayerStat>;
    /** V0.58 — matchs déjà comptabilisés, dénominateur du temps de jeu. */
    readonly statsMatchCount?: number;
    /** V0.60 — décisions humaines en attente au moment de la sauvegarde. */
    readonly pendingEvents?: readonly HumanEvent[];
    /** V0.58 — capes internationales accumulées au fil des saisons. */
    readonly caps?: ReadonlyMap<PlayerId, import('../season/national-team.js').CapRecord>;
  };
}

export function createSeasonSession(opts: SeasonSessionOptions): SeasonSession {
  const calendar = generateRoundRobinCalendar(opts.clubIds, hashSeed(opts.seed));

  /**
   * V0.56 — les phases finales suivent la longueur du championnat joué.
   *
   * Elles étaient figées à 27, 28 et 29, c'est-à-dire aux trois journées qui
   * suivent un Top 14. En Pro D2, passée à seize clubs et trente journées, ces
   * numéros tombent au milieu de la saison régulière : le moteur n'aurait
   * jamais déclenché de barrages, et une saison de deuxième division se serait
   * arrêtée sans champion.
   */
  const PLAYOFFS = playoffRoundsAfter(calendar.totalRounds);
  let standings = emptyStandings(opts.clubIds);
  const history: PlayedMatch[] = [];
  let currentRound = 1;

  // Restauration depuis un snapshot (load ou new-season avec carryover finances)
  if (opts.restoreFrom) {
    currentRound = opts.restoreFrom.currentRound;
    for (const h of opts.restoreFrom.history) history.push(h);
    // V0.60 : le classement restauré se **superpose** au classement vide, il ne
    // le remplace pas.
    //
    // L'intersaison ne transmet que les clubs frappés d'un retrait de points,
    // ce qui est une entrée légitime : « voici les ajustements ». En remplaçant
    // la table entière par cette liste partielle, la session perdait tous les
    // autres clubs. `applyMatchToStandings` sort sans rien faire quand un des
    // deux clubs manque : tous les matchs de la saison suivante étaient donc
    // ignorés en silence, et la J27 plantait sur un « top 6 incomplet » faute
    // de six clubs classés.
    const restoredStandings = new Map<ClubId, ClubStanding>(standings);
    for (const s of opts.restoreFrom.standings) {
      // Un club qui ne fait plus partie de la division n'a rien à y faire :
      // une sanction suit un club relégué, elle ne le ramène pas.
      if (!restoredStandings.has(s.clubId)) continue;
      restoredStandings.set(s.clubId, s);
    }
    standings = restoredStandings;
  }

  // Phases finales : matchs générés à la fin de la saison régulière puis après chaque tour
  let playoffMatches: readonly PlayoffMatch[] = [];
  let semifinalMatches: readonly PlayoffMatch[] = [];
  let finalMatch: PlayoffMatch | undefined;
  let champion: ClubId | undefined = opts.restoreFrom?.champion;

  // V0.4 : relations + events humains
  let relations: RelationsState = generateInitialRelations(opts.playerClubRoster, opts.currentSeason, opts.seed);
  let moodDeltasByPlayer: Map<PlayerId, number> = new Map();
  let nextMatchTacticalBonus = 0;
  /**
   * V0.60 : les décisions en attente survivent au rechargement.
   *
   * Elles étaient perdues. Un conflit de vestiaire ouvert le vendredi
   * disparaissait si l'on rechargeait le samedi, avec la décision qu'il
   * appelait : la question se refermait toute seule, sans qu'on y réponde et
   * sans que rien n'en découle.
   */
  let pendingEvents: HumanEvent[] = [...(opts.restoreFrom?.pendingEvents ?? [])];
  const resolvedEvents: { event: HumanEvent; chosenOptionId: string; resolvedAtRound: number }[] = [];

  // V0.6 : décisions de renouvellement de contrat (uniquement pour le club joueur)
  let pendingContractDecisions: ContractDecision[] = [];
  const resolvedContractDecisions: ContractDecisionResolution[] = [];
  // Détection initiale des contrats expirants (au démarrage de la session)
  const expiring = detectExpiringContracts(opts.playerClubRoster, opts.currentSeason);
  for (const p of expiring) {
    pendingContractDecisions.push(buildContractDecision(p, opts.currentSeason));
  }
  // Roster mutable du club joueur : reflète les transferts intervenus
  let playerClubRoster: readonly Player[] = opts.playerClubRoster;
  // Offres entrantes IA en attente
  let pendingIncomingOffers: IncomingOffer[] = [];
  // V0.7 : blessures fraîches du dernier match (reset à chaque match du joueur)
  let latestInjuries: readonly RolledInjury[] = [];
  // V0.8 : cartons du dernier match
  let latestCards: readonly RolledCard[] = [];
  // V0.56 : brouilles ouvertes lors du dernier match
  let latestRivalries: readonly RivalryTension[] = [];

  // V0.9 : stats cumulées de la saison en cours
  // V0.58 : restaurées avec la partie — sans quoi une reprise en cours de
  // saison repartait d'une feuille blanche.
  let seasonPlayerStats: Map<PlayerId, SeasonPlayerStat> = new Map(
    opts.restoreFrom?.playerStats ?? [],
  );

  /**
   * Rencontres du club dirigé dont on a effectivement relevé les compositions.
   *
   * Sert de dénominateur au temps de jeu, et il doit impérativement venir de la
   * **même source que le numérateur** — `seasonPlayerStats`. Compter les matchs
   * de `history` paraissait plus direct, et c'était faux : l'historique est
   * restauré au chargement d'une partie, les statistiques individuelles ne le
   * sont pas. Un effectif rechargé à la vingtième journée se retrouvait avec
   * zéro à sept matchs au compteur pour un dénominateur de vingt — tout le monde
   * remplaçant, personne en concurrence, et le système entier sans effet. C'est
   * ce que le test de bout en bout ne pouvait pas voir : il part d'une session
   * neuve, où les deux compteurs coïncident par construction.
   */
  let statsMatchCount = opts.restoreFrom?.statsMatchCount ?? 0;


  const EMPTY_STAT: SeasonPlayerStat = {
    tries: 0, matches: 0, minutes: 0,
    tackles: 0, meters: 0, turnovers: 0, defendersBeaten: 0, lineBreaks: 0,
  };

  /**
   * V0.53 — l'agrégat s'est élargi.
   *
   * Il ne portait que les essais, les matchs et les minutes : de quoi piloter
   * le développement, pas de quoi désigner un meilleur joueur du championnat.
   * Un troisième ligne qui gratte trente ballons et plaque deux cents fois ne
   * marque pas un essai de la saison.
   */
  function addStat(
    into: Map<PlayerId, SeasonPlayerStat>,
    id: PlayerId,
    stat: IndividualMatchStats | undefined,
    countMatch: boolean,
    fallbackMinutes = 0,
    rating?: number,
  ): void {
    const cur = into.get(id) ?? EMPTY_STAT;
    into.set(id, {
      tries: cur.tries + (stat?.tries ?? 0),
      matches: cur.matches + (countMatch ? 1 : 0),
      minutes: cur.minutes + (stat?.minutesPlayed ?? fallbackMinutes),
      tackles: cur.tackles + (stat?.tackles ?? 0),
      meters: cur.meters + (stat?.metersWithBall ?? 0),
      turnovers: cur.turnovers + (stat?.turnoversWon ?? 0),
      defendersBeaten: cur.defendersBeaten + (stat?.defendersBeaten ?? 0),
      lineBreaks: cur.lineBreaks + (stat?.lineBreaks ?? 0),
      ...(rating !== undefined ? {
        ratingSum: (cur.ratingSum ?? 0) + rating,
        ratedMatches: (cur.ratedMatches ?? 0) + 1,
      } : {
        ...(cur.ratingSum !== undefined ? { ratingSum: cur.ratingSum } : {}),
        ...(cur.ratedMatches !== undefined ? { ratedMatches: cur.ratedMatches } : {}),
      }),
    });
  }

  /**
   * V0.61 — les notes d'une rencontre, prêtes à être cumulées.
   *
   * La note de saison est une moyenne de notes de match : elle se calcule donc
   * au moment où le match est encore entier, pas après coup sur des cumuls qui
   * auraient perdu le découpage par rencontre.
   */
  function ratingsOf(result: MatchResult, input: MatchInput): ReadonlyMap<PlayerId, number> {
    const camp = (side: MatchInput['home']): readonly Player[] =>
      [...side.squad.starters, ...side.squad.substitutes]
        .map(e => input.playersById.get(e.playerId))
        .filter((p): p is Player => p !== undefined);
    const diff = result.homeScore - result.awayScore;
    const { byPlayer } = rateMatch([
      { players: camp(input.home), pointsDifference: diff },
      { players: camp(input.away), pointsDifference: -diff },
    ], result.individualStats);
    return new Map([...byPlayer].map(([id, note]) => [id, note.rating]));
  }

  /**
   * V0.53 — cumule les statistiques des deux camps d'un match auto-simulé.
   *
   * Le club dirigé est déjà servi par `accumulatePlayerStats` au moment du
   * commit : on l'ignore ici pour ne pas compter deux fois.
   */
  function accumulateLeagueStats(result: MatchResult, input: MatchInput): void {
    const next = new Map(seasonPlayerStats);
    const notes = ratingsOf(result, input);
    for (const side of [input.home, input.away]) {
      if (side.squad.clubId === opts.playerClubId) continue;
      const starters = new Set(side.squad.starters.map(e => e.playerId));
      for (const id of starters) {
        addStat(next, id, result.individualStats.get(id), true, 80, notes.get(id));
      }
      for (const [id, stat] of result.individualStats.entries()) {
        if (starters.has(id)) continue;
        if (!side.squad.substitutes.some(e => e.playerId === id)) continue;
        if (stat.minutesPlayed <= 0 && stat.tries <= 0) continue;
        addStat(next, id, stat, stat.minutesPlayed > 0, 0, notes.get(id));
      }
    }
    seasonPlayerStats = next;
  }

  function accumulatePlayerStats(
    result: MatchResult,
    starterIds: readonly PlayerId[],
    notes: ReadonlyMap<PlayerId, number> = new Map(),
  ): void {
    const next = new Map(seasonPlayerStats);
    const starterSet = new Set(starterIds);
    // V0.56 — le dénominateur du temps de jeu se compte ici, avec le numérateur.
    statsMatchCount++;

    for (const id of starterIds) {
      addStat(next, id, result.individualStats.get(id), true, 80, notes.get(id));
    }

    // V0.14 : les remplaçants entrés en jeu comptent eux aussi — c'est le banc
    // actif qui rend leurs minutes réelles, et donc leur progression possible.
    for (const [id, stat] of result.individualStats.entries()) {
      if (starterSet.has(id)) continue;
      if (stat.minutesPlayed <= 0 && stat.tries <= 0) continue;
      addStat(next, id, stat, stat.minutesPlayed > 0, 0, notes.get(id));
    }

    seasonPlayerStats = next;
  }

  // ---------------------------------------------------------------------------
  // V0.56 — les rivalités de vestiaire
  // ---------------------------------------------------------------------------

  /**
   * Fait vivre la concurrence au poste dans le graphe de relations.
   *
   * Appelée après chaque match du club dirigé : c'est le moment où le temps de
   * jeu vient de bouger, et donc le seul où la comparaison a du sens.
   */
  function advanceRivalries(): void {
    if (statsMatchCount === 0) return;

    const playRatio = new Map<PlayerId, number>();
    for (const p of playerClubRoster) {
      const stat = seasonPlayerStats.get(p.id);
      playRatio.set(p.id, Math.min(1, (stat?.matches ?? 0) / statsMatchCount));
    }

    const outcome = applyRivalryTensions(relations, {
      roster: playerClubRoster,
      playRatio,
      ...(opts.squadStatuses ? { statuses: opts.squadStatuses() } : {}),
    });
    relations = outcome.relations;
    latestRivalries = outcome.flares;
  }

  // ---------------------------------------------------------------------------
  // V0.58 — Le XV de France
  // ---------------------------------------------------------------------------

  /**
   * Capes accumulées, saison après saison.
   *
   * C'est la mémoire de la sélection : sans elle, une première sélection ne
   * serait jamais une première, et un joueur de trente ans arriverait au
   * Tournoi avec le même statut qu'un jeune découvert la veille.
   */
  let caps: Caps = opts.restoreFrom?.caps
    ? new Map(opts.restoreFrom.caps)
    // Première saison d'une carrière : on donne au monde un passé international,
    // faute de quoi le premier communiqué annoncerait une première sélection
    // pour chacun des trente-trois retenus.
    : seedInitialCaps(opts.nationalPool?.() ?? opts.playerClubRoster, opts.currentSeason);
  /** Groupe retenu pour la fenêtre en cours, recalculé à chaque ouverture. */
  let nationalSquad: NationalSquad | undefined;
  let squadWindowKey: string | undefined;
  /** Bilan de la dernière fenêtre soldée — l'interface le publie puis l'oublie. */
  let latestWindowReport: WindowReport | undefined;
  /**
   * Capes gagnées **pendant cette saison**, par joueur.
   *
   * Distinct du cumul de carrière, et pour une bonne raison : le cumul contient
   * le passé estimé au démarrage de la partie. En le prenant pour un gain de
   * l'année, le registre de carrière attribuait cinquante-quatre sélections à
   * une seule saison, dans un monde qui en joue sept. La session étant recréée
   * à chaque intersaison, ce compteur est naturellement annuel.
   */
  let capsGainedThisSeason: Map<PlayerId, number> = new Map();
  /**
   * V0.63 : ce qu'un international a **produit** en sélection cette saison.
   *
   * Distinct des statistiques de championnat, et volontairement : un essai
   * marqué en bleu n'a rien à faire au classement des marqueurs du Top 14. Mais
   * il a tout à faire sur la fiche du joueur, qui jusqu'ici ne disait que
   * « sélectionné ».
   */
  const internationalStats = new Map<PlayerId, InternationalSeasonStat>();

  /** Tous les joueurs de la division qu'on joue, dans leur état du jour. */
  function leaguePlayers(): readonly Player[] {
    if (!opts.rosterByClub || !opts.allClubs) return playerClubRoster;
    const out: Player[] = [];
    for (const c of opts.allClubs) {
      if (c.id === opts.playerClubId) out.push(...playerClubRoster);
      else out.push(...liveRosterOf(c.id));
    }
    return out;
  }

  /**
   * Le groupe du moment.
   *
   * Recalculé à l'ouverture de chaque fenêtre et mémorisé pour sa durée : le
   * sélectionneur annonce une liste, il n'en change pas d'une journée à
   * l'autre. Hors trêve, il n'y a pas de groupe — et c'est bien ainsi que le
   * manager doit le vivre.
   */
  function currentNationalSquad(): NationalSquad | undefined {
    const window = windowOf(currentRound);
    if (!window) return undefined;
    const key = `${opts.currentSeason}_${window}`;
    if (squadWindowKey === key && nationalSquad) return nationalSquad;

    // Le temps de jeu n'est connu que pour la division qu'on joue : ailleurs,
    // aucun match n'est simulé en détail. On renseigne donc explicitement les
    // joueurs de notre championnat — zéro compris — et on laisse les autres
    // absents de la carte, où ils seront traités comme une inconnue plutôt que
    // comme des remplaçants.
    const playRatio = new Map<PlayerId, number>();
    const played = Math.max(1, statsMatchCount);
    for (const p of leaguePlayers()) {
      playRatio.set(p.id, Math.min(1, (seasonPlayerStats.get(p.id)?.matches ?? 0) / played));
    }

    nationalSquad = selectNationalSquad({
      players: opts.nationalPool?.() ?? leaguePlayers(),
      caps,
      playRatio,
      currentSeason: opts.currentSeason,
    });
    squadWindowKey = key;
    return applyPicks(nationalSquad);
  }

  /**
   * Applique les retouches du manager au groupe proposé.
   *
   * Jamais mémorisé : le manager change d'avis, et un groupe figé au premier
   * calcul lui ferait croire que ses ajouts n'ont pas été pris.
   */
  function applyPicks(base: NationalSquad): NationalSquad {
    const picks = opts.nationalPicks?.();
    if (!picks || (picks.added.length === 0 && picks.removed.length === 0)) return base;

    const removed = new Set(picks.removed.map(id => id as string));
    const players = [
      ...base.players.filter(id => !removed.has(id as string)),
      ...picks.added.filter(id => !base.players.includes(id)),
    ];
    return { ...base, players };
  }

  /**
   * Les candidats, classés comme le sélectionneur les voit.
   *
   * Sert à l'écran du poste national : sans ce classement, le manager
   * retoucherait un groupe sans savoir qui vient juste derrière.
   */
  function nationalShortlist(): readonly { player: Player; score: number }[] {
    const playRatio = new Map<PlayerId, number>();
    const played = Math.max(1, statsMatchCount);
    for (const p of leaguePlayers()) {
      playRatio.set(p.id, Math.min(1, (seasonPlayerStats.get(p.id)?.matches ?? 0) / played));
    }
    return (opts.nationalPool?.() ?? leaguePlayers())
      .filter(p => isEligible(p, opts.currentSeason))
      .map(player => ({
        player,
        score: selectionScore({
          player,
          caps,
          playRatio: playRatio.get(player.id) ?? UNKNOWN_PLAY_RATIO,
          currentSeason: opts.currentSeason,
        }),
      }))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Solde la fenêtre : on joue les matchs, on compte les capes, on renvoie les
   * joueurs fatigués.
   *
   * Appelé à la fin de la dernière journée de trêve. Les internationaux
   * reviennent avec de la fatigue en plus — c'est la contrepartie, et sans elle
   * une sélection serait une bonne nouvelle sans revers.
   */
  function closeInternationalWindow(): void {
    const window = windowOf(currentRound);
    const squad = currentNationalSquad();
    if (!window || !squad || !isWindowClosing(currentRound)) return;

    const results = playInternationalWindow(window, squad);
    latestWindowReport = reportWindow(window, results);
  }

  /**
   * V0.63 : la fenêtre internationale, jouée par le moteur de match.
   *
   * Chaque test est une vraie rencontre : un XV de France composé dans le
   * groupe convoqué, une sélection adverse persistante, quatre-vingts minutes
   * simulées. Ce qui en revient au club, la fatigue, les blessures et les
   * performances, n'est plus forfaitaire mais mesuré sur ce qui s'est passé.
   */
  function playInternationalWindow(
    window: 'AUTOMNE' | 'TOURNOI',
    squad: NationalSquad,
  ): readonly InternationalResult[] {
    const opponents = window === 'AUTOMNE' ? AUTUMN_OPPONENTS : NATIONS;
    const byId = new Map(nationalPlayers().map(p => [p.id as string, p] as const));
    // Le groupe, dans l'ordre du sélectionneur : `selectNationalSquad` le rend
    // déjà classé, poste par poste, au mérite.
    const ranked = squad.players
      .map(id => byId.get(id as string))
      .filter((p): p is Player => p !== undefined);
    if (ranked.length < 15) return [];

    const results: InternationalResult[] = [];
    /** Minutes jouées en sélection pendant la fenêtre, par joueur. */
    const minutes = new Map<PlayerId, number>();

    for (let i = 0; i < opponents.length; i++) {
      const nation = opponents[i]!;
      const sheet = buildFranceSheet({
        ranked,
        clubId: FRANCE_NATIONAL_CLUB,
        matchIndex: i,
      });
      const atHome = i % 2 === 0;
      const input = buildInternationalMatchInput({
        nation,
        france: sheet,
        francePlayers: ranked,
        nationSquad: buildNationSquad({
          nation,
          currentSeason: opts.currentSeason,
          careerStartSeason: opts.careerStartSeason ?? opts.currentSeason,
        }),
        atHome,
        matchId: `intl_${opts.currentSeason}_${window}_${nation.id}`,
      });
      const result = simulateMatch(input, `${opts.seed}_intl_${opts.currentSeason}_${window}_${i}`);

      const franceScore = atHome ? result.homeScore : result.awayScore;
      const opponentScore = atHome ? result.awayScore : result.homeScore;
      results.push({ opponent: nation.name, franceScore, opponentScore, home: atHome });

      // Une cape par feuille de match, pas par convocation : c'est la règle, et
      // c'est ce qui redonne son prix au maillot.
      for (const id of sheet.matchdayIds) {
        const stat = result.individualStats.get(id);
        if (stat && stat.minutesPlayed <= 0) continue;
        caps = applyCaps(caps, { ...squad, players: [id] }, 1);
        capsGainedThisSeason.set(id, (capsGainedThisSeason.get(id) ?? 0) + 1);
        minutes.set(id, (minutes.get(id) ?? 0) + (stat?.minutesPlayed ?? 0));
        accumulateInternationalStat(id, stat);
      }

      applyInternationalWear(sheet, result);
    }

    // La fatigue suit les minutes réellement disputées. Un joueur qui a fait
    // cinq matchs pleins ne revient pas dans le même état que le vingt-deuxième
    // homme entré dix minutes en fin de tournoi.
    const perMatch = internationalFatigue(1);
    playerClubRoster = playerClubRoster.map(p => {
      const played = minutes.get(p.id);
      if (played === undefined || played <= 0) return p;
      const extra = Math.round((played / 80) * perMatch);
      return { ...p, dynamic: { ...p.dynamic, fatigue: Math.min(100, p.dynamic.fatigue + extra) } };
    });

    return results;
  }

  /**
   * Les blessures en bleu.
   *
   * Elles arrivent au club par une porte qu'il ne contrôle pas : c'est
   * précisément ce qui les rend dures, et ce qui donne enfin un revers à la
   * fierté d'avoir cinq internationaux.
   */
  function applyInternationalWear(
    sheet: { readonly starterIds: readonly PlayerId[] },
    result: MatchResult,
  ): void {
    const mine = new Set(playerClubRoster.map(p => p.id as string));
    const fielded = sheet.starterIds.filter(id => mine.has(id as string));
    if (fielded.length === 0) return;
    const inj = rollPostMatchInjuries({
      players: playerClubRoster,
      starterIds: fielded,
      currentRound,
      seed: `${opts.seed}_intl_${result.matchId as string}`,
    });
    playerClubRoster = inj.players;
    latestInjuries = [...latestInjuries, ...inj.newInjuries];
  }

  /** Le vivier de la sélection, joueurs du club dirigé compris. */
  function nationalPlayers(): readonly Player[] {
    return opts.nationalPool?.() ?? leaguePlayers();
  }

  function accumulateInternationalStat(
    id: PlayerId,
    stat: IndividualMatchStats | undefined,
  ): void {
    const current = internationalStats.get(id) ?? {
      matches: 0, minutes: 0, tries: 0, tackles: 0, meters: 0,
    };
    internationalStats.set(id, {
      matches: current.matches + 1,
      minutes: current.minutes + (stat?.minutesPlayed ?? 0),
      tries: current.tries + (stat?.tries ?? 0),
      tackles: current.tackles + (stat?.tackles ?? 0),
      meters: current.meters + Math.round(stat?.metersWithBall ?? 0),
    });
  }

  /**
   * Compatibilité : l'interface lit encore un calendrier d'appels.
   *
   * Il n'est plus construit d'avance à partir des trois meilleurs JIFF de
   * chaque club — quarante-deux joueurs pour une équipe de quinze — mais dérivé
   * du groupe réellement sélectionné.
   */
  function callUpScheduleNow(): CallUpSchedule {
    const squad = currentNationalSquad();
    const byRound = new Map<number, ReadonlySet<PlayerId>>();
    if (squad) byRound.set(currentRound, new Set(squad.players));
    return { byRound };
  }

  // V0.6 : finances par club
  let financesByClub: Map<ClubId, ClubFinances> = (() => {
    if (opts.restoreFrom?.financesByClub) {
      return new Map(opts.restoreFrom.financesByClub);
    }
    if (opts.allClubs) {
      return initFinancesForAllClubs(opts.allClubs, opts.currentSeason);
    }
    return new Map();
  })();
  const clubsById = new Map<ClubId, Club>();
  if (opts.allClubs) for (const c of opts.allClubs) clubsById.set(c.id, c);

  // ---------------------------------------------------------------------------
  // V0.14 — Entraînement et staff
  // ---------------------------------------------------------------------------

  let trainingByPlayer: Map<PlayerId, TrainingFocus> = new Map(
    opts.restoreFrom?.trainingByPlayer ?? [],
  );

  let staff: StaffMember[] = (() => {
    // V0.44 — l'encadrement est désormais **restauré** en priorité : il se
    // recrute, donc il ne peut plus être regénéré depuis la seule réputation du
    // club, sinon toute embauche disparaîtrait au rechargement.
    const restored = opts.restoreFrom?.staff;
    if (restored && restored.length > 0) return [...restored];
    const club = opts.allClubs?.find(c => c.id === opts.playerClubId);
    return club ? [...generateStaffForClub(club)] : [];
  })();

  function coachingForPlayerClub(): CoachingQuality {
    return coachingQualityFromStaff(staff);
  }

  // ---------------------------------------------------------------------------
  // V0.15 — Scouting
  // ---------------------------------------------------------------------------

  function scoutQuality(): number {
    return staff.find(m => m.role === 'SCOUT_PRINCIPAL')?.quality ?? 45;
  }

  /**
   * On connaît son propre effectif dès le premier jour : les joueurs s'entraînent
   * sous nos yeux. Sans cette amorce, le manager démarrait la saison en ignorant
   * tout de ses propres joueurs, ce qui n'a aucun sens.
   */
  let scouting: ScoutingState = (() => {
    const restored = opts.restoreFrom?.scouting;
    if (restored && restored.knowledge.size > 0) return restored;
    return advanceScouting(EMPTY_SCOUTING, {
      ownSquadIds: opts.playerClubRoster.filter(p => !p.retired).map(p => p.id),
      matchesPlayedByPlayer: new Map(),
      facedOpponentIds: [],
      scoutQuality: scoutQuality(),
    });
  })();

  /**
   * Fait progresser la connaissance après une journée.
   * Appelé à chaque avancée de round, quel que soit le chemin emprunté.
   */
  function advanceScoutingForRound(facedOpponentIds: readonly PlayerId[]): void {
    const matchesByPlayer = new Map<PlayerId, number>();
    for (const [id, stat] of seasonPlayerStats) matchesByPlayer.set(id, stat.matches);

    // V0.43 — effectifs des clubs sous observation, résolus à la volée : les
    // stocker dans l'état du scouting les figerait au moment de l'affectation
    // et un transfert rendrait la liste fausse.
    const scoutedClubRosters = new Map<ClubId, readonly PlayerId[]>();
    for (const clubId of scouting.clubAssignments ?? []) {
      scoutedClubRosters.set(
        clubId,
        liveRosterOf(clubId).filter(p => !p.retired).map(p => p.id),
      );
    }

    scouting = advanceScouting(scouting, {
      ownSquadIds: playerClubRoster.filter(p => !p.retired).map(p => p.id),
      matchesPlayedByPlayer: matchesByPlayer,
      facedOpponentIds,
      scoutQuality: scoutQuality(),
      scoutedClubRosters,
    });
  }

  // ---------------------------------------------------------------------------
  // V0.28 — Transferts sortants
  // ---------------------------------------------------------------------------

  /** Journée jusqu'à laquelle un joueur approché ne peut plus l'être. */
  const bidCooldowns = new Map<PlayerId, number>(opts.restoreFrom?.bidCooldowns ?? []);
  const bidHistory: BidRecord[] = [];
  /** V0.37 — le droit au joker s'épuise à l'usage, un seul par blessé. */
  const jokersUsedFor = new Set<PlayerId>(opts.restoreFrom?.jokersUsedFor ?? []);

  /** V0.39 — centre de formation : niveau acquis, investissement et orientation. */
  let academy: AcademyState = opts.restoreFrom?.academy
    ?? defaultAcademyState(clubsById.get(opts.playerClubId) ?? {
      tier: 'BUDGET_MOYEN', annualBudget: 20_000_000,
    } as Club);

  /**
   * V0.60 : une arrivée se contrôle au moteur, pas à l'écran qui la propose.
   *
   * Les prêts n'y figurent pas : ils ne vont que dans un sens, du club vers
   * l'extérieur, et une interdiction de recruter n'a rien à y redire.
   */
  function registrationCheck(annualSalary: number): SigningCheck | undefined {
    const rules = opts.recruitment?.();
    if (!rules) return undefined;
    return canRegister({
      roster: playerClubRoster.filter(p => !p.retired),
      division: rules.division,
      annualSalary,
      transferBan: rules.transferBan,
    });
  }

  function affordabilityFor(terms: BidTerms): AffordabilityCheck {
    const club = clubsById.get(opts.playerClubId);
    return canAffordTransfer({
      fee: terms.fee,
      annualSalary: terms.annualSalary,
      balance: financesByClub.get(opts.playerClubId)?.balance ?? 0,
      currentPayroll: computeAnnualPayroll(playerClubRoster),
      annualBudget: club?.annualBudget ?? 0,
    });
  }

  function buildBidPreview(player: Player): BidPreview {
    const finances = financesByClub.get(opts.playerClubId);
    const club = clubsById.get(opts.playerClubId);
    const balance = finances?.balance ?? 0;
    const payrollHeadroom = Math.max(0, (club?.annualBudget ?? 0) - computeAnnualPayroll(playerClubRoster));

    const familiarity = scouting.knowledge.get(player.id)?.familiarity ?? 0;
    const valueRange = estimateValue(
      estimateMarketValue(player, opts.currentSeason),
      familiarity,
      player.id as string,
    );
    // Faute de rapport, on part du salaire — visible de tous — plutôt que d'une
    // valeur que le club n'est pas censé connaître.
    const suggestedFee = valueRange.certainty === 'INCONNU'
      ? Math.round((player.contract.annualSalary * 4) / 10_000) * 10_000
      : Math.round(((valueRange.min + valueRange.max) / 2) / 10_000) * 10_000;

    const base = {
      valueRange,
      suggestedFee,
      expectedSalary: expectedMarketSalary(player, opts.currentSeason),
      currentSalary: player.contract.annualSalary,
      contractYearsLeft: Math.max(0, player.contract.endSeason - opts.currentSeason),
      sellingClubName: clubsById.get(player.clubId)?.name ?? 'Club inconnu',
      balance,
      payrollHeadroom,
      cooldownRounds: Math.max(0, (bidCooldowns.get(player.id) ?? 0) - currentRound),
    };

    const blocked = ((): string | undefined => {
      if (player.clubId === opts.playerClubId) return 'Ce joueur fait déjà partie de votre effectif.';
      if (player.retired) return 'Ce joueur a pris sa retraite.';
      if (player.freeAgent) return 'Joueur libre : passez par une proposition de contrat.';
      // V0.30 — la contrainte calendaire vaut pour tout le monde. Laisser le
      // manager acheter en continu pendant que l'IA attend sa fenêtre lui
      // donnerait un avantage que rien ne justifie.
      const window = transferWindowStatus(currentRound, calendar.totalRounds);
      if (!window.open) return window.summary;
      // Sans accès aux effectifs adverses, impossible de juger la profondeur du
      // vendeur — mieux vaut fermer la porte que décider à l'aveugle.
      if (!opts.rosterByClub || !clubsById.has(player.clubId)) {
        return 'Club vendeur inconnu de cette partie.';
      }
      return undefined;
    })();

    return blocked ? { ...base, blocked } : base;
  }

  // ---------------------------------------------------------------------------
  // V0.13 — Coupe d'Europe
  // ---------------------------------------------------------------------------

  /**
   * V0.63 : le continent, tel qu'il existe en dehors de nous.
   *
   * Vide quand la sauvegarde est antérieure à la V0.63 : les adversaires sont
   * alors générés à la volée comme avant, plutôt que de refuser de charger.
   */
  const europeanWorld: EuropeanWorld = opts.europeanWorld ?? EMPTY_EUROPEAN_WORLD;

  const europeanCompetition: CompetitionId | undefined = (() => {
    const rank = opts.previousSeasonRank;
    if (rank === undefined) return undefined;
    return competitionForRank(rank);
  })();

  let europeanCampaign: EuropeanCampaign | undefined = (() => {
    if (!europeanCompetition) return undefined;
    const drawn = drawPoolOpponents({
      world: europeanWorld,
      competition: europeanCompetition,
      season: opts.currentSeason,
      seed: opts.seed,
      count: 4,
    }).map(asOpponent);
    return generatePoolCampaign(
      europeanCompetition,
      `${opts.seed}_${opts.currentSeason}`,
      drawn.length > 0 ? drawn : undefined,
    );
  })();

  /** Adversaires possibles en phase finale : le reste de la compétition. */
  function knockoutPool(): readonly ReturnType<typeof asOpponent>[] {
    if (!europeanCompetition) return [];
    return clubsOfCompetition(europeanWorld, europeanCompetition).map(asOpponent);
  }

  /** Match européen prévu pour la journée courante, s'il en reste un à jouer. */
  function computeEuropeanFixture(): EuropeanFixture | undefined {
    if (!europeanCampaign) return undefined;

    // Phase de poule : le match est attaché à une journée de championnat précise.
    const poolFixture = europeanCampaign.fixtures.find(f => f.round === currentRound);
    if (poolFixture) {
      const alreadyPlayed = europeanCampaign.results.some(
        r => r.stage === 'POOL' && r.round === poolFixture.round,
      );
      if (!alreadyPlayed) return poolFixture;
    }

    // Phases finales : elles se jouent après la fin du championnat régulier.
    const knockout = nextKnockoutFixture(
      europeanCampaign,
      `${opts.seed}_${opts.currentSeason}`,
      knockoutPool(),
    );
    if (knockout && knockout.round === currentRound) return knockout;
    return undefined;
  }

  /**
   * Applique le coût physique d'un match européen aux joueurs alignés.
   * C'est le cœur de l'arbitrage : jouer ses cadres en coupe les use pour le
   * championnat de la semaine suivante.
   */
  function applyEuropeanMatchWear(
    starterIds: readonly PlayerId[],
    subIds: readonly PlayerId[],
    result: 'WIN' | 'DRAW' | 'LOSS',
  ): void {
    playerClubRoster = applyMatchToPlayerStates({
      players: playerClubRoster,
      starterIds,
      subIds,
      result,
    });
    const inj = rollPostMatchInjuries({
      players: playerClubRoster,
      starterIds,
      currentRound,
      seed: `${opts.seed}_eu`,
    });
    playerClubRoster = inj.players;
    latestInjuries = [...latestInjuries, ...inj.newInjuries];
  }

  // ---------------------------------------------------------------------------
  // V0.13 — Relégation
  // ---------------------------------------------------------------------------

  /**
   * V0.13 — force moyenne de l'effectif disponible du club joueur, sur l'échelle
   * 0-100 des attributs. Sert à résoudre un match européen que le joueur n'a pas
   * disputé lui-même.
   */
  function playerClubStrength(): number {
    const available = playerClubRoster.filter(p => !p.retired && !p.freeAgent && !p.dynamic.injury);
    if (available.length === 0) return 55;
    const ranked = [...available].sort((a, b) => rawRating(b) - rawRating(a)).slice(0, 15);
    let total = 0;
    for (const p of ranked) total += rawRating(p);
    return total / ranked.length;
  }

  function rawRating(p: Player): number {
    return (
      p.technical.passe + p.technical.plaquage + p.technical.conservation +
      p.physical.vitesse + p.physical.puissance + p.physical.endurance
    ) / 6;
  }

  /**
   * Résout un match européen que le joueur n'a pas joué.
   *
   * Un club ne peut pas déclarer forfait : si la journée avance sans que le match
   * de coupe ait été disputé, il est simulé de façon abstraite (score dérivé de
   * l'écart de niveau) et l'effectif encaisse malgré tout la charge de la semaine.
   */
  function autoResolveEuropeanFixture(fixture: EuropeanFixture): void {
    if (!europeanCampaign) return;
    const rng = createRng(`eu_auto_${opts.seed}_${opts.currentSeason}_${fixture.round}_${fixture.stage}`);
    const homeEdge = fixture.atHome ? 4 : 0;
    const delta = (playerClubStrength() + homeEdge) - fixture.opponent.strength;

    const clubScore = Math.max(0, Math.round(22 + delta * 0.45 + rng.nextGaussian(0, 8)));
    const opponentScore = Math.max(0, Math.round(22 - delta * 0.35 + rng.nextGaussian(0, 8)));

    europeanCampaign = {
      ...europeanCampaign,
      results: [...europeanCampaign.results, {
        round: fixture.round,
        stage: fixture.stage,
        opponentName: fixture.opponent.name,
        clubScore,
        opponentScore,
        atHome: fixture.atHome,
      }],
    };

    // Même sans décision du manager, la semaine double se paie : le staff aligne
    // une équipe et ces joueurs accumulent de la fatigue.
    const fielded = [...playerClubRoster]
      .filter(p => !p.retired && !p.freeAgent && !p.dynamic.injury)
      .sort((a, b) => rawRating(b) - rawRating(a))
      .slice(0, 15)
      .map(p => p.id);
    if (fielded.length > 0) {
      const outcome: 'WIN' | 'DRAW' | 'LOSS' =
        clubScore > opponentScore ? 'WIN' : clubScore < opponentScore ? 'LOSS' : 'DRAW';
      applyEuropeanMatchWear(fielded, [], outcome);
    }
  }

  /**
   * Appelé juste avant d'incrémenter la journée : garantit qu'aucun match européen
   * n'est perdu en route.
   */
  function settlePendingEuropeanFixture(): void {
    const fixture = computeEuropeanFixture();
    if (fixture && fixture.round === currentRound) autoResolveEuropeanFixture(fixture);
  }

  /**
   * Effets de bord communs à toutes les avancées de journée.
   * `facedOpponentIds` alimente la connaissance des adversaires affrontés.
   */
  function endOfRoundSideEffects(facedOpponentIds: readonly PlayerId[] = []): void {
    settlePendingEuropeanFixture();
    advanceScoutingForRound(facedOpponentIds);
    recoverAiPlayers();
    // V0.58 — la fenêtre internationale se solde à sa dernière journée.
    closeInternationalWindow();
  }

  // ---------------------------------------------------------------------------
  // V0.31 — Usure des effectifs adverses
  // ---------------------------------------------------------------------------

  /**
   * Joueurs des autres clubs modifiés par une blessure ou une suspension.
   *
   * Jusqu'ici, seul l'effectif de l'utilisateur subissait des blessures et des
   * cartons : il perdait des joueurs, ses adversaires jamais. La compétition
   * s'en trouvait faussée, et le levier « blessure longue durée » du mercato
   * d'hiver ne pouvait tout simplement pas se déclencher.
   *
   * La session ne possède pas ces effectifs — elle les lit via `rosterByClub`.
   * Elle tient donc un calque des joueurs qu'elle a modifiés, que l'appelant
   * répercute dans son stock. C'est le même mécanisme que pour le roster du
   * club utilisateur, appliqué au reste du championnat.
   */
  let aiPlayerUpdates: ReadonlyMap<PlayerId, Player> = new Map();

  /** Effectif d'un club adverse, calque appliqué. */
  function liveRosterOf(clubId: ClubId): readonly Player[] {
    const base = opts.rosterByClub?.(clubId) ?? [];
    return base.map(p => aiPlayerUpdates.get(p.id) ?? p);
  }

  function mergeAiUpdates(players: readonly Player[]): void {
    const next = new Map(aiPlayerUpdates);
    for (const p of players) next.set(p.id, p);
    aiPlayerUpdates = next;
  }

  /**
   * Applique blessures et cartons aux titulaires d'un match auto-simulé.
   *
   * On s'appuie sur la composition réellement alignée par `buildMatchInput` :
   * appliquer l'usure à tout l'effectif punirait des joueurs restés en tribune.
   */
  function applyAutoMatchWear(
    input: MatchInput,
    matchSeed: string,
    cardsIssued: readonly { readonly playerId: PlayerId; readonly color: 'YELLOW' | 'RED' }[] = [],
  ): void {
    if (!opts.rosterByClub) return;

    for (const side of [input.home, input.away]) {
      const clubId = side.squad.clubId;
      if (clubId === opts.playerClubId) continue;

      const starterIds = side.squad.starters.map(s => s.playerId);
      const roster = liveRosterOf(clubId);
      if (roster.length === 0) continue;

      const injured = rollPostMatchInjuries({
        players: roster,
        starterIds,
        currentRound,
        seed: `${matchSeed}_${clubId}`,
      });
      const carded = applyMatchCards({
        players: injured.players,
        cards: cardsIssued,
        currentRound,
      });
      mergeAiUpdates(carded.players);
    }
  }

  /**
   * Guérisons et fins de suspension côté adversaires, à chaque journée.
   *
   * On balaie les effectifs réels plutôt que le seul calque : celui-ci repart
   * vide après un chargement de partie, alors que les blessures, elles, ont été
   * sauvegardées avec les joueurs. S'en tenir au calque condamnait tout blessé
   * d'un club adverse à ne jamais revenir.
   */
  function recoverAiPlayers(): void {
    if (!opts.rosterByClub) return;

    for (const clubId of opts.clubIds) {
      if (clubId === opts.playerClubId) continue;

      const roster = liveRosterOf(clubId);
      const concerned = roster.filter(
        p => p.dynamic.injury !== undefined || p.dynamic.suspendedUntilRound !== undefined,
      );
      if (concerned.length === 0) continue;

      mergeAiUpdates(
        clearExpiredSuspensions(progressInjuryRecovery(concerned, currentRound), currentRound),
      );
    }
  }

  /** Recette d'un match européen à domicile : au-dessus d'une affiche de championnat. */
  function computeEuropeanGate(fixture: EuropeanFixture): number {
    const base = fixture.competition === 'CHAMPIONS_CUP' ? 620_000 : 280_000;
    const knockoutBonus = fixture.stage === 'POOL' ? 0 : 240_000;
    return base + knockoutBonus;
  }

  function computeRelegationStatus(): RelegationStatus {
    const ranked = rankedStandings(standings);
    const index = ranked.findIndex(r => r.clubId === opts.playerClubId);
    if (index < 0) return 'SAFE';
    return relegationStatusForRank(index + 1, ranked.length);
  }

  function applyClubMovement(clubId: ClubId, m: FinancialMovement): void {
    const cur = financesByClub.get(clubId);
    if (!cur) return;
    const next = new Map(financesByClub);
    next.set(clubId, applyMovement(cur, m));
    financesByClub = next;
  }

  function maybeGenerateIncomingOffers(): void {
    if (!opts.allClubs) return;
    // Plafond : on ne génère pas si déjà 3+ offres en attente
    if (pendingIncomingOffers.length >= 3) return;
    // Pas d'offres en phases finales (round > totalRounds)
    if (currentRound > calendar.totalRounds) return;
    const newOffers = generateIncomingOffers({
      playerClubId: opts.playerClubId,
      playerClubRoster,
      otherClubs: opts.allClubs.filter(c => c.id !== opts.playerClubId),
      round: currentRound,
      currentSeason: opts.currentSeason,
      seed: opts.seed,
      ...(opts.wantAwayIds !== undefined ? { wantAwayIds: opts.wantAwayIds() } : {}),
    });
    // V0.63 : les clubs européens viennent aussi chercher les meilleurs. Leurs
    // offres passent par la même porte que les françaises : c'est la même
    // décision, avec une conséquence de plus : le joueur perd la sélection.
    const fromAbroad = generateForeignInterest({
      playerClubId: opts.playerClubId,
      roster: playerClubRoster,
      world: europeanWorld,
      round: currentRound,
      currentSeason: opts.currentSeason,
      seed: opts.seed,
    });
    pendingIncomingOffers = [...pendingIncomingOffers, ...newOffers, ...fromAbroad];
  }

  /** L'acheteur est-il un club étranger ? */
  function isForeignClub(clubId: ClubId): boolean {
    return europeanWorld.clubs.some(c => c.id === clubId);
  }

  function recordRoundFinances(round: number, dayMatches: readonly { homeClubId: ClubId; awayClubId: ClubId }[]): void {
    if (financesByClub.size === 0 || !opts.rosterByClub) return;
    // Payroll : prélevé sur tous les clubs chaque journée de saison régulière
    if (round <= calendar.totalRounds) {
      for (const clubId of financesByClub.keys()) {
        const roster = opts.rosterByClub(clubId);
        const payroll = computeRoundPayroll(roster, calendar.totalRounds);
        // Les prêts allègent la feuille de paie de celui qui prête, et de lui
        // seul : ce sont ses joueurs qui sont partis.
        const relief = clubId === opts.playerClubId
          ? loanWageReliefPerRound(
            opts.activeLoans?.() ?? [],
            (playerId) => playerClubRoster.find(p => p.id === playerId)?.contract.annualSalary,
            calendar.totalRounds,
          )
          : 0;
        applyClubMovement(clubId, {
          kind: 'PAYROLL',
          amount: -Math.max(0, payroll - relief),
          round,
          note: `Salaires J${round}`,
        });
      }
    }
    // Recettes match : pour chaque club qui reçoit
    for (const m of dayMatches) {
      const club = clubsById.get(m.homeClubId);
      if (!club) continue;
      const standing = standings.get(m.homeClubId);
      const played = standing?.played ?? 0;
      const winsRatio = played > 0 ? (standing?.wins ?? 0) / played : 0.5;
      // V0.48 — un derby remplit l'enceinte quel que soit le classement.
      const rivalry = rivalryBetween(m.homeClubId, m.awayClubId);
      // V0.60 — une seule billetterie pour tout le monde.
      //
      // Le club dirigé passait par `matchdayRevenue` (V0.45), les clubs IA par
      // un `computeMatchRevenue` de V0.6 au billet à trente euros en dur. Deux
      // économies parallèles, dont une seule tenait compte du stade agrandi, de
      // la politique tarifaire et des derbys : les recettes du championnat
      // n'étaient pas comparables entre elles.
      //
      // Un club IA n'a pas de direction à piloter : on lui prête la politique
      // par défaut et ses installations d'origine. Sa campagne de communication
      // est réputée incluse dans son budget annuel, faute d'un poste de dépense
      // qui la facturerait.
      const direction = m.homeClubId === opts.playerClubId && opts.clubDirection
        ? opts.clubDirection()
        : { facilities: INITIAL_FACILITIES, plan: DEFAULT_PLAN };
      const revenue = matchdayRevenue({
        club,
        facilities: direction.facilities,
        plan: direction.plan,
        winsRatio,
        ...(rivalry ? { rivalryBonus: attendanceBonus(rivalry.intensity) } : {}),
      }).revenue;
      applyClubMovement(m.homeClubId, {
        kind: 'MATCH_REVENUE',
        amount: revenue,
        round,
        note: `Billetterie J${round}`,
      });
    }
  }
  // Types triggeré dans les 3 derniers rounds pour éviter le spam
  const recentlyTriggeredTypes: { type: HumanEventType; round: number }[] = [];
  // V0.9 : joueurs récemment ciblés par un event (pour varier la rotation)
  const recentlyTargetedPlayers: { id: PlayerId; round: number }[] = [];

  function refreshBlockedTypes(): Set<HumanEventType> {
    const blocked = new Set<HumanEventType>();
    for (const t of recentlyTriggeredTypes) {
      if (currentRound - t.round <= 3) blocked.add(t.type);
    }
    return blocked;
  }

  function refreshRecentTargets(): Set<PlayerId> {
    const recent = new Set<PlayerId>();
    for (const t of recentlyTargetedPlayers) {
      if (currentRound - t.round <= 6) recent.add(t.id);
    }
    return recent;
  }

  function detectAndAddEvents(): void {
    const blocked = refreshBlockedTypes();
    // Liste des matchs joués par le club joueur, plus récents en dernier
    const myHistory = history.filter(h =>
      h.homeClubId === opts.playerClubId || h.awayClubId === opts.playerClubId
    );
    const consecutiveDefeats = countTrailingDefeats(myHistory, opts.playerClubId);
    const fatigueByPlayer = new Map<PlayerId, number>();
    // V0.7+ : on a la fatigue réelle dans dynamic.fatigue
    for (const p of playerClubRoster) {
      fatigueByPlayer.set(p.id, p.dynamic.fatigue);
    }

    const newEvents = detectHumanEvents({
      currentRound,
      clubPlayers: playerClubRoster,
      relations,
      recentHistory: myHistory.slice(-5),
      typesAlreadyTriggeredRecently: blocked,
      fatigueByPlayer,
      recentlyTargetedPlayerIds: refreshRecentTargets(),
    }, opts.currentSeason);

    const press = detectPressEvent(currentRound, consecutiveDefeats, blocked);

    const final = press ? [press, ...newEvents].slice(0, 2) : newEvents;
    for (const e of final) {
      // Évite les doublons (même id déjà en attente ou résolu)
      if (pendingEvents.some(p => p.id === e.id)) continue;
      if (resolvedEvents.some(r => r.event.id === e.id)) continue;
      pendingEvents.push(e);
      recentlyTriggeredTypes.push({ type: e.type, round: currentRound });
      // V0.9 : trace les joueurs ciblés
      for (const pid of e.involvedPlayerIds) {
        recentlyTargetedPlayers.push({ id: pid, round: currentRound });
      }
    }
  }

  /**
   * Un championnat trop court n'a pas de phase finale.
   *
   * Le format en exige six qualifiés. Tant que les barrages étaient figés à la
   * vingt-septième journée, la question ne se posait pas : un championnat de
   * quatre clubs s'arrêtait à la sixième et n'y arrivait jamais. Maintenant
   * qu'ils suivent la saison régulière, ils arrivent le lendemain — et un
   * mini-championnat de test s'écroulait sur un « top 6 incomplet ».
   */
  const hasPlayoffs = opts.clubIds.length >= 6;

  function computePhase(): SeasonState['phase'] {
    if (currentRound <= calendar.totalRounds) return 'regular';
    if (!hasPlayoffs) return 'over';
    if (currentRound === PLAYOFFS.PLAYOFFS) return 'playoffs';
    if (currentRound === PLAYOFFS.SEMIFINALS) return 'semifinals';
    if (currentRound === PLAYOFFS.FINAL) return 'final';
    return 'over';
  }

  /**
   * Les tableaux de phase finale, régénérés en cascade.
   *
   * V0.60 : ils ne l'étaient qu'à la journée qui les concerne. Recharger une
   * sauvegarde en demi-finales trouvait donc des barrages vides, ne pouvait pas
   * en déduire de qualifiés, ne composait aucune demie et déclarait la saison
   * terminée sans champion : une carrière perdue au premier rechargement du
   * mois de juin.
   *
   * Rien n'a besoin d'être sauvegardé pour cela. Les barrages se déduisent du
   * classement, qui l'est, et leurs vainqueurs de l'historique, qui l'est
   * aussi. Les phases finales ne rapportent aucun point de championnat, donc le
   * classement dont on les tire ne bouge plus : le tableau reconstruit est
   * exactement celui qu'on avait quitté.
   */
  function ensurePlayoffMatches(): void {
    if (!hasPlayoffs) return;
    if (currentRound >= PLAYOFFS.PLAYOFFS && playoffMatches.length === 0) {
      const top6 = rankedStandings(standings).slice(0, 6).map(s => s.clubId);
      playoffMatches = generatePlayoffMatches(top6, calendar.totalRounds);
    }
    if (currentRound >= PLAYOFFS.SEMIFINALS && semifinalMatches.length === 0) {
      const top2 = rankedStandings(standings).slice(0, 2).map(s => s.clubId);
      const winner1 = winnerOf(playoffMatches[0]);
      const winner2 = winnerOf(playoffMatches[1]);
      if (winner1 && winner2) {
        semifinalMatches = generateSemifinals(top2, winner1, winner2, calendar.totalRounds);
      }
    }
    if (currentRound >= PLAYOFFS.FINAL && finalMatch === undefined) {
      const w1 = winnerOf(semifinalMatches[0]);
      const w2 = winnerOf(semifinalMatches[1]);
      if (w1 && w2) finalMatch = generateFinal(w1, w2, calendar.totalRounds);
    }
    // Une finale déjà disputée avant le rechargement a un vainqueur : c'est le
    // champion, et il ne se redéduit d'aucun classement.
    if (champion === undefined && finalMatch) {
      champion = winnerOf(finalMatch);
    }
  }

  /**
   * Le mieux classé des deux à l'issue de la saison régulière.
   *
   * C'est la règle des phases finales : à égalité au coup de sifflet final, le
   * classement départage. Elle est appliquée ici de la même façon partout, au
   * lieu de trois tranchages différents, dont un qui laissait tout simplement
   * la finale sans vainqueur.
   */
  function betterRanked(a: ClubId, b: ClubId): ClubId {
    const ranked = rankedStandings(standings).map(s => s.clubId);
    const ia = ranked.indexOf(a);
    const ib = ranked.indexOf(b);
    if (ia < 0) return b;
    if (ib < 0) return a;
    return ia <= ib ? a : b;
  }

  /** Le qualifié d'un match à élimination directe, nul compris. */
  function knockoutWinner(
    homeClubId: ClubId,
    awayClubId: ClubId,
    homeScore: number,
    awayScore: number,
  ): ClubId {
    if (homeScore > awayScore) return homeClubId;
    if (awayScore > homeScore) return awayClubId;
    return betterRanked(homeClubId, awayClubId);
  }

  function winnerOf(match: PlayoffMatch | undefined): ClubId | undefined {
    if (!match) return undefined;
    const played = history.find(h =>
      h.round === match.round && h.homeClubId === match.homeClubId && h.awayClubId === match.awayClubId,
    );
    if (!played) return undefined;
    return knockoutWinner(match.homeClubId, match.awayClubId, played.homeScore, played.awayScore);
  }

  function currentRoundMatches(): readonly (ScheduledMatch | PlayoffMatch)[] {
    if (currentRound <= calendar.totalRounds) {
      return matchesForRound(calendar, currentRound);
    }
    ensurePlayoffMatches();
    if (currentRound === PLAYOFFS.PLAYOFFS) return playoffMatches;
    if (currentRound === PLAYOFFS.SEMIFINALS) return semifinalMatches;
    if (currentRound === PLAYOFFS.FINAL && finalMatch) return [finalMatch];
    return [];
  }

  function computeNextMatch(): ScheduledMatch | PlayoffMatch | undefined {
    if (currentRound <= calendar.totalRounds) {
      return nextMatchForClub(calendar, opts.playerClubId, currentRound);
    }
    const matches = currentRoundMatches();
    return matches.find(m => m.homeClubId === opts.playerClubId || m.awayClubId === opts.playerClubId);
  }

  function status(): 'in-progress' | 'eliminated' | 'finished' {
    if (!hasPlayoffs && currentRound > calendar.totalRounds) return 'finished';
    if (currentRound > PLAYOFFS.FINAL) return 'finished';
    // Si on est en phases finales mais le joueur n'a pas de match, il est éliminé
    if (currentRound > calendar.totalRounds) {
      const next = computeNextMatch();
      if (!next) return 'eliminated';
    }
    return 'in-progress';
  }

  function getState(): SeasonState {
    const next = computeNextMatch();
    const baseState: SeasonState = {
      playerClubId: opts.playerClubId,
      currentSeason: opts.currentSeason,
      currentRound,
      calendar,
      standings,
      history,
      playerNextMatch: next,
      status: status(),
      phase: computePhase(),
      ...(champion !== undefined ? { champion } : {}),
      relations,
      moodDeltasByPlayer,
      nextMatchTacticalBonus,
      pendingEvents,
      resolvedEvents,
      financesByClub,
      pendingContractDecisions,
      resolvedContractDecisions,
      pendingIncomingOffers,
      transferWindow: transferWindowStatus(currentRound, calendar.totalRounds),
      bidCooldowns,
      jokersUsedFor,
      academy,
      aiPlayerUpdates,
      playerClubRoster,
      latestInjuries,
      latestCards,
      latestRivalries,
      playoffRounds: PLAYOFFS,
      callUpSchedule: callUpScheduleNow(),
      nationalSquad: currentNationalSquad(),
      caps,
      capsThisSeason: capsGainedThisSeason,
      internationalStats,
      nationalShortlist: windowOf(currentRound) ? nationalShortlist() : [],
      latestWindowReport,
      isInternationalBreak: isInternationalBreak(currentRound),
      seasonPlayerStats,
      statsMatchCount,
      trainingByPlayer,
      coaching: coachingForPlayerClub(),
      staff,
      scouting,
      scoutingSlots: scoutingSlots(scoutQuality()),
      europeanCampaign,
      europeanFixture: computeEuropeanFixture(),
      relegationStatus: computeRelegationStatus(),
    };
    return baseState;
  }

  function applyEventEffects(event: HumanEvent, optionId: string): void {
    const opt: HumanEventOption | undefined = event.options.find(o => o.id === optionId);
    if (!opt) return;
    for (const eff of opt.effects) {
      if (eff.moodDelta) {
        const cur = moodDeltasByPlayer.get(eff.moodDelta.playerId) ?? 0;
        const next = Math.max(-50, Math.min(50, cur + eff.moodDelta.delta));
        const m = new Map(moodDeltasByPlayer);
        m.set(eff.moodDelta.playerId, next);
        moodDeltasByPlayer = m;
      }
      if (eff.relationDelta) {
        relations = applyRelationDelta(relations, eff.relationDelta.p1, eff.relationDelta.p2, eff.relationDelta.delta);
      }
      if (eff.tacticalBonusNextMatch !== undefined) {
        nextMatchTacticalBonus += eff.tacticalBonusNextMatch;
      }
    }
    resolvedEvents.push({ event, chosenOptionId: optionId, resolvedAtRound: currentRound });
    pendingEvents = pendingEvents.filter(p => p.id !== event.id);
  }

  return {
    getState,

    simulateOtherMatchesOfRound(seedSalt: string): readonly PlayedMatch[] {
      if (currentRound > PLAYOFFS.FINAL) return [];
      ensurePlayoffMatches();
      const dayMatches = currentRoundMatches();
      const playerMatch = computeNextMatch();
      const others = dayMatches.filter(m => m !== playerMatch);
      const newlyPlayed: PlayedMatch[] = [];

      for (const m of others) {
        const matchSeed = `${opts.seed}_r${currentRound}_${m.homeClubId}_${m.awayClubId}_${seedSalt}`;
        const { result, input } = autoSimulateMatch(opts.buildMatchInput, m, matchSeed);
        applyAutoMatchWear(input, matchSeed, result.cardsIssued);
        // V0.53 — les statistiques du championnat, pas seulement celles du club
        // dirigé : sans elles, aucun trophée individuel ne peut se calculer.
        accumulateLeagueStats(result, input);
        const isPlayoff = isPlayoffRound(m.round, calendar.totalRounds);
        const played: PlayedMatch = {
          round: m.round,
          homeClubId: m.homeClubId,
          awayClubId: m.awayClubId,
          homeScore: result.homeScore,
          awayScore: result.awayScore,
          playerPlayed: false,
          ...(isPlayoff && 'label' in m ? { playoffLabel: (m as PlayoffMatch).label } : {}),
        };
        newlyPlayed.push(played);
        history.push(played);
        // Standings: en saison régulière uniquement (les playoffs ne donnent pas de points classement)
        if (!isPlayoff) {
          standings = applyMatchToStandings(standings, m, result);
        }
      }
      return newlyPlayed;
    },

    commitPlayerMatch(homeScore: number, awayScore: number, result: MatchResult, starterIds?: readonly PlayerId[]): void {
      const playerMatch = computeNextMatch();
      if (!playerMatch) {
        // Pas de match du joueur : on avance quand même la phase finale
        endOfRoundSideEffects();
        currentRound += 1;
        return;
      }
      const isPlayoff = isPlayoffRound(playerMatch.round, calendar.totalRounds);
      const played: PlayedMatch = {
        round: playerMatch.round,
        homeClubId: playerMatch.homeClubId,
        awayClubId: playerMatch.awayClubId,
        homeScore,
        awayScore,
        playerPlayed: true,
        ...(isPlayoff && 'label' in playerMatch ? { playoffLabel: (playerMatch as PlayoffMatch).label } : {}),
      };
      history.push(played);
      if (!isPlayoff) {
        standings = applyMatchToStandings(standings, playerMatch, result);
      }
      // Si on vient de jouer la finale → désigner le champion
      if (playerMatch.round === PLAYOFFS.FINAL) {
        champion = knockoutWinner(
          playerMatch.homeClubId, playerMatch.awayClubId, homeScore, awayScore,
        );
      }

      // V0.9 : cumul des stats joueurs (essais)
      if (starterIds && starterIds.length > 0) {
        // V0.61 : la note de chaque joueur du club dirigé. Seul son effectif
        // est cumulé ici, l'adversaire l'ayant déjà été par le championnat.
        const chezNous = playerMatch.homeClubId === opts.playerClubId;
        const ecart = chezNous ? homeScore - awayScore : awayScore - homeScore;
        const { byPlayer } = rateMatch(
          [{ players: playerClubRoster, pointsDifference: ecart }],
          result.individualStats,
        );
        accumulatePlayerStats(
          result,
          starterIds,
          new Map([...byPlayer].map(([id, note]) => [id, note.rating])),
        );
      }

      // V0.4 : évolution des relations entre titulaires
      if (starterIds && starterIds.length > 0) {
        const playerIsHome = playerMatch.homeClubId === opts.playerClubId;
        const myScore = playerIsHome ? homeScore : awayScore;
        const oppScore = playerIsHome ? awayScore : homeScore;
        relations = applyMatchToRelations(relations, {
          starterIds,
          resultDelta: myScore - oppScore,
        });
        // V0.56 : et la concurrence au poste tend celles des autres.
        advanceRivalries();
        // V0.7 : fatigue + forme post-match pour les joueurs du club joueur
        const matchResult: 'WIN' | 'DRAW' | 'LOSS' =
          myScore > oppScore ? 'WIN' : myScore < oppScore ? 'LOSS' : 'DRAW';
        // V0.13 : le banc est actif — on connaît enfin les remplaçants réellement
        // entrés en jeu, et ils accumulent leur propre fatigue (V0.7 les ignorait).
        const playerSubstitutions = playerIsHome ? result.homeSubstitutions : result.awaySubstitutions;
        const enteredSubIds = playerSubstitutions.map(sub => sub.onPlayerId);
        playerClubRoster = applyMatchToPlayerStates({
          players: playerClubRoster,
          starterIds,
          subIds: enteredSubIds,
          result: matchResult,
        });
        // V0.7 : roll de blessures
        const inj = rollPostMatchInjuries({
          players: playerClubRoster,
          starterIds,
          currentRound,
          seed: opts.seed,
        });
        playerClubRoster = inj.players;
        latestInjuries = inj.newInjuries;
        // V0.52 : les cartons ont été sifflés pendant la rencontre ; on n'en
        // applique ici que les suites disciplinaires.
        const cardsRoll = applyMatchCards({
          players: playerClubRoster,
          cards: result.cardsIssued,
          currentRound,
        });
        playerClubRoster = cardsRoll.players;
        latestCards = cardsRoll.cards;
      } else {
        // Match auto-simulé (pas de starterIds fournis) : fatigue moyenne sur tout le roster
        playerClubRoster = playerClubRoster.map<Player>(p => {
          if (p.retired || p.freeAgent || p.dynamic.injury) return p;
          return {
            ...p,
            dynamic: {
              ...p.dynamic,
              fatigue: Math.min(100, p.dynamic.fatigue + 8),
            },
          };
        });
      }
      // Reset bonus tactique post-match
      nextMatchTacticalBonus = 0;

      // V0.6 : finances de la journée (avant l'incrément de round)
      const roundMatches = history.filter(h => h.round === currentRound);
      recordRoundFinances(currentRound, roundMatches);

      // V0.6 : offres entrantes IA sur les joueurs du club joueur
      maybeGenerateIncomingOffers();

      // V0.15 : affronter une équipe apprend quelque chose sur ses joueurs.
      // Les adversaires sont ceux qui apparaissent dans les stats du match sans
      // appartenir à l'effectif du club utilisateur.
      const ownIds = new Set(playerClubRoster.map(p => p.id));
      const facedOpponentIds = [...result.individualStats.keys()].filter(id => !ownIds.has(id));

      endOfRoundSideEffects(facedOpponentIds);
      currentRound += 1;
      // V0.7 : recovery des blessures dont le délai est atteint
      playerClubRoster = progressInjuryRecovery(playerClubRoster, currentRound);
      // V0.8 : levée des suspensions échues
      playerClubRoster = clearExpiredSuspensions(playerClubRoster, currentRound);
      // Détecter de nouveaux events humains
      detectAndAddEvents();
    },

    /** Avance d'un round sans match du joueur (utilisé en phases finales si pas qualifié). */
    skipRound(seedSalt: string): readonly PlayedMatch[] {
      const newlyPlayed: PlayedMatch[] = [];
      if (currentRound > PLAYOFFS.FINAL) return newlyPlayed;
      ensurePlayoffMatches();
      const dayMatches = currentRoundMatches();

      for (const m of dayMatches) {
        const matchSeed = `${opts.seed}_skip_r${currentRound}_${m.homeClubId}_${m.awayClubId}_${seedSalt}`;
        const { result, input } = autoSimulateMatch(opts.buildMatchInput, m, matchSeed);
        applyAutoMatchWear(input, matchSeed, result.cardsIssued);
        // V0.53 — les statistiques du championnat, pas seulement celles du club
        // dirigé : sans elles, aucun trophée individuel ne peut se calculer.
        accumulateLeagueStats(result, input);
        const isPlayoff = isPlayoffRound(m.round, calendar.totalRounds);
        const played: PlayedMatch = {
          round: m.round,
          homeClubId: m.homeClubId,
          awayClubId: m.awayClubId,
          homeScore: result.homeScore,
          awayScore: result.awayScore,
          playerPlayed: false,
          ...(isPlayoff && 'label' in m ? { playoffLabel: (m as PlayoffMatch).label } : {}),
        };
        history.push(played);
        newlyPlayed.push(played);
        if (!isPlayoff) {
          standings = applyMatchToStandings(standings, m, result);
        }
        if (m.round === PLAYOFFS.FINAL) {
          // Une finale auto-simulée nulle ne laissait aucun champion, et toute
          // la fin de saison en dépend.
          champion = knockoutWinner(m.homeClubId, m.awayClubId, result.homeScore, result.awayScore);
        }
      }
      // V0.6 : finances de la journée
      const roundMatches = history.filter(h => h.round === currentRound);
      recordRoundFinances(currentRound, roundMatches);
      // V0.7 : fatigue moyenne sur tout le roster (skipRound = pas de joueur du joueur sur le terrain)
      playerClubRoster = playerClubRoster.map<Player>(p => {
        if (p.retired || p.freeAgent || p.dynamic.injury) return p;
        return {
          ...p,
          dynamic: { ...p.dynamic, fatigue: Math.max(0, p.dynamic.fatigue - 8) },
        };
      });
      maybeGenerateIncomingOffers();
      endOfRoundSideEffects();
      currentRound += 1;
      // V0.7 : recovery des blessures
      playerClubRoster = progressInjuryRecovery(playerClubRoster, currentRound);
      // V0.8 : levée des suspensions échues
      playerClubRoster = clearExpiredSuspensions(playerClubRoster, currentRound);
      return newlyPlayed;
    },

    getRanking() {
      return rankedStandings(standings);
    },

    resolveHumanEvent(eventId: string, optionId: string): void {
      const event = pendingEvents.find(e => e.id === eventId);
      if (!event) return;
      applyEventEffects(event, optionId);
    },

    triggerEventDetection(): void {
      detectAndAddEvents();
    },

    resolveContractDecision(decisionId: string, optionId: ContractDecisionOptionId): ContractDecisionResolution | undefined {
      const decision = pendingContractDecisions.find(d => d.id === decisionId);
      if (!decision) return undefined;
      const player = playerClubRoster.find(p => p.id === decision.playerId);
      if (!player) return undefined;
      const resolution = resolveContractDecisionPure(
        decision, optionId, player, opts.currentSeason, opts.seed,
        // V0.50 — le rôle annoncé pèse sur ce que le joueur réclame.
        opts.squadStatuses?.().get(player.id),
      );
      pendingContractDecisions = pendingContractDecisions.filter(d => d.id !== decisionId);
      resolvedContractDecisions.push(resolution);
      // Reflète l'éventuelle mise à jour dans le roster mutable
      if (resolution.playerUpdate) {
        playerClubRoster = playerClubRoster.map(p =>
          p.id === resolution.playerUpdate!.id ? resolution.playerUpdate! : p,
        );
      }
      return resolution;
    },

    resolveIncomingOffer(offerId: string, accept: boolean): IncomingOfferResolution | undefined {
      const offer = pendingIncomingOffers.find(o => o.id === offerId);
      if (!offer) return undefined;
      const player = playerClubRoster.find(p => p.id === offer.playerId);
      if (!player) return undefined;
      const base = resolveIncomingOfferPure(offer, player, accept, opts.currentSeason);
      // V0.63 : un départ hors de France se note sur le joueur, et c'est ce qui
      // lui coûte le maillot bleu, et ce qui fait de cette vente un arbitrage.
      const resolution: IncomingOfferResolution = base.kind === 'ACCEPTED' && isForeignClub(offer.fromClubId)
        ? { ...base, updatedPlayer: { ...base.updatedPlayer, abroad: true } }
        : base;
      pendingIncomingOffers = pendingIncomingOffers.filter(o => o.id !== offerId);
      if (resolution.kind === 'ACCEPTED') {
        // Cash : club joueur encaisse, club acheteur paye
        applyClubMovement(opts.playerClubId, {
          kind: 'TRANSFER_IN',
          amount: resolution.transferAmount,
          round: currentRound,
          note: `Vente ${player.lastName}`,
        });
        applyClubMovement(offer.fromClubId, {
          kind: 'TRANSFER_OUT',
          amount: -resolution.transferAmount,
          round: currentRound,
          note: `Achat ${player.lastName}`,
        });
        // Le joueur quitte le roster du club joueur
        playerClubRoster = playerClubRoster.filter(p => p.id !== offer.playerId);
      }
      return resolution;
    },

    getInternationalTargets(): readonly InternationalTarget[] {
      if (europeanWorld.clubs.length === 0) return [];
      // Deux vitrines par saison, calées sur les fenêtres de mercato : le
      // marché d'hiver est plus maigre, comme le vrai.
      return generateInternationalTargets({
        world: europeanWorld,
        currentSeason: opts.currentSeason,
        seed: opts.seed,
        window: currentRound <= 1 ? 'ETE' : 'HIVER',
      });
    },

    signInternational(target: InternationalTarget, bid: InternationalBid) {
      const registration = registrationCheck(bid.annualSalary);
      if (registration && !registration.allowed) {
        return { ok: false as const, reason: registration.reason ?? 'Signature refusée par la commission.' };
      }
      const affordability = affordabilityFor({
        fee: bid.transferFee,
        annualSalary: bid.annualSalary,
        years: bid.years,
      });
      if (!affordability.canAfford) {
        return { ok: false as const, reason: affordability.reason ?? 'Opération hors de portée.' };
      }

      const club = clubsById.get(opts.playerClubId);
      if (!club) return { ok: false as const, reason: 'Club dirigé inconnu de cette partie.' };

      const response = bidForInternationalTarget({
        target,
        bid,
        buyingClub: club,
        currentSeason: opts.currentSeason,
        round: currentRound,
        seed: opts.seed,
      });
      if (response.kind === 'REFUSE') return { ok: false as const, reason: response.reason };

      applyClubMovement(opts.playerClubId, {
        kind: 'TRANSFER_OUT',
        amount: -bid.transferFee,
        round: currentRound,
        note: `Transfert ${target.player.lastName}`,
      });

      const signed = response.updatedPlayer;
      if (evaluateIdentityFit(club, signed).fit === 'BAD') {
        playerClubRoster = applyBadFitMoodPenalty(playerClubRoster, 4);
      }
      playerClubRoster = [...playerClubRoster, signed];
      trainingByPlayer = new Map(trainingByPlayer).set(signed.id, DEFAULT_TRAINING_FOCUS);
      return { ok: true as const, player: signed };
    },

    commitEuropeanMatch(
      clubScore: number,
      opponentScore: number,
      starterIds?: readonly PlayerId[],
      subIds?: readonly PlayerId[],
    ): void {
      if (!europeanCampaign) return;
      const fixture = computeEuropeanFixture();
      if (!fixture) return;

      const entry: EuropeanResult = {
        round: fixture.round,
        stage: fixture.stage,
        opponentName: fixture.opponent.name,
        clubScore,
        opponentScore,
        atHome: fixture.atHome,
      };
      europeanCampaign = {
        ...europeanCampaign,
        results: [...europeanCampaign.results, entry],
      };

      // Le match de coupe use l'effectif aligné : c'est le prix de la rotation.
      if (starterIds && starterIds.length > 0) {
        const outcome: 'WIN' | 'DRAW' | 'LOSS' =
          clubScore > opponentScore ? 'WIN' : clubScore < opponentScore ? 'LOSS' : 'DRAW';
        applyEuropeanMatchWear(starterIds, subIds ?? [], outcome);
      }

      // Recette de billetterie sur les matchs à domicile.
      if (fixture.atHome && financesByClub.has(opts.playerClubId)) {
        applyClubMovement(opts.playerClubId, {
          kind: 'MATCH_REVENUE',
          amount: computeEuropeanGate(fixture),
          round: fixture.round,
          note: `Recette ${fixture.opponent.name}`,
        });
      }
    },

    getPoolOutcome(): PoolOutcome | undefined {
      return europeanCampaign ? summarisePool(europeanCampaign) : undefined;
    },

    getEuropeanSummary(): string | undefined {
      return europeanCampaign ? campaignSummaryLabel(europeanCampaign) : undefined;
    },

    resolveSeasonRelegation(strengthByClub: (clubId: ClubId) => number): SeasonRelegationResult {
      return resolveRelegation(
        {
          rankedStandings: rankedStandings(standings),
          season: opts.currentSeason,
          strengthByClub,
        },
        createRng(`relegation_${opts.seed}_${opts.currentSeason}`),
      );
    },

    setTrainingFocus(playerId: PlayerId, focus: TrainingFocus): void {
      const next = new Map(trainingByPlayer);
      next.set(playerId, focus);
      trainingByPlayer = next;
    },

    setTrainingFocusForAll(focus: TrainingFocus): void {
      const next = new Map(trainingByPlayer);
      for (const p of playerClubRoster) {
        if (p.retired || p.freeAgent) continue;
        next.set(p.id, focus);
      }
      trainingByPlayer = next;
    },

    getStaff(): readonly StaffMember[] {
      return staff;
    },

    hireStaff(member: StaffMember): void {
      staff = [...staff.filter(m => m.role !== member.role), { ...member, clubId: opts.playerClubId as string }];
    },

    previewBid(player: Player): BidPreview {
      return buildBidPreview(player);
    },

    submitBid(player: Player, terms: BidTerms): BidOutcome {
      // Le règlement d'abord : une interdiction de recruter se constate sans
      // rien savoir du joueur convoité ni de son club.
      const registration = registrationCheck(terms.annualSalary);
      if (registration && !registration.allowed) {
        return { kind: 'BLOCKED', reason: registration.reason ?? 'Signature refusée par la commission.' };
      }

      const preview = buildBidPreview(player);
      if (preview.blocked) return { kind: 'BLOCKED', reason: preview.blocked };
      if (preview.cooldownRounds > 0) {
        return {
          kind: 'BLOCKED',
          reason: `${player.lastName} vient d'être approché : il faut attendre ${preview.cooldownRounds} journée(s).`,
        };
      }

      const affordability = affordabilityFor(terms);
      if (!affordability.canAfford) {
        return { kind: 'BLOCKED', reason: affordability.reason ?? 'Opération hors de portée.' };
      }

      const sellingClub = clubsById.get(player.clubId)!;
      const sellingRoster = opts.rosterByClub!(player.clubId);
      const ranked = rankedStandings(standings);
      const byReputation = [...(opts.allClubs ?? [])].sort((a, b) => b.reputation - a.reputation);

      // Même lecture que pour l'IA : un joueur juge un club sur son classement
      // *et* sa stature. Utiliser le seul classement du moment rendrait un grand
      // club en difficulté brusquement repoussant, ce qui ne correspond à rien.
      const rankOf = (clubId: ClubId): number => {
        const index = ranked.findIndex(s => s.clubId === clubId);
        const currentRank = index >= 0 ? index + 1 : opts.clubIds.length;
        const repIndex = byReputation.findIndex(c => c.id === clubId);
        if (repIndex < 0) return currentRank;
        return perceivedRank(currentRank, repIndex + 1);
      };

      const resolution = resolveTransferOffer(
        {
          offer: {
            playerId: player.id,
            fromClubId: player.clubId,
            toClubId: opts.playerClubId,
            fee: terms.fee,
            annualSalary: terms.annualSalary,
            years: terms.years,
          },
          player,
          sellingClub,
          sellingRoster,
          currentSeason: opts.currentSeason,
          sellingBalance: financesByClub.get(player.clubId)?.balance ?? 0,
          buyerRank: rankOf(opts.playerClubId),
          currentRank: rankOf(player.clubId),
          buyerRoster: playerClubRoster,
          totalClubs: opts.clubIds.length,
        },
        // La graine intègre les termes : améliorer son offre rebat les dés,
        // reproposer la même chose donnerait le même refus.
        createRng(`bid_${opts.seed}_${player.id}_${currentRound}_${terms.fee}_${terms.annualSalary}`),
      );

      const response = resolution.playerResponse ?? resolution.clubResponse;

      if (!resolution.accepted) {
        // Un vendeur qui a chiffré sa demande laisse la négociation ouverte :
        // fermer la porte après avoir annoncé un prix qu'on peut payer serait
        // absurde. Le délai punit le lowball et le refus du joueur.
        const negotiating = resolution.refusedBy === 'CLUB'
          && resolution.clubResponse.counterFee !== undefined;
        const cooldown = negotiating ? 0
          : resolution.refusedBy === 'JOUEUR' ? BID_COOLDOWN_PLAYER
            : BID_COOLDOWN_CLUB;
        if (cooldown > 0) bidCooldowns.set(player.id, currentRound + cooldown);
        bidHistory.push({
          playerId: player.id,
          playerName: `${player.firstName} ${player.lastName}`,
          round: currentRound,
          fee: terms.fee,
          annualSalary: terms.annualSalary,
          accepted: false,
          ...(resolution.refusedBy ? { refusedBy: resolution.refusedBy } : {}),
          reason: response.reason,
        });
        return { kind: 'REFUSED', resolution, cooldownRounds: cooldown };
      }

      const signed = resolution.player!;

      applyClubMovement(opts.playerClubId, {
        kind: 'TRANSFER_OUT',
        amount: -terms.fee,
        round: currentRound,
        note: `Transfert ${player.lastName}`,
      });
      // L'indemnité alimente la trésorerie du vendeur : c'est ce qui permettra
      // à l'IA de se renforcer à son tour une fois le marché IA en place.
      if (financesByClub.has(player.clubId)) {
        applyClubMovement(player.clubId, {
          kind: 'TRANSFER_IN',
          amount: terms.fee,
          round: currentRound,
          note: `Vente ${player.lastName}`,
        });
      }

      // Une recrue à contre-culture crispe le vestiaire, comme pour un agent libre.
      const buyerClub = clubsById.get(opts.playerClubId);
      if (buyerClub && evaluateIdentityFit(buyerClub, signed).fit === 'BAD') {
        playerClubRoster = applyBadFitMoodPenalty(playerClubRoster, 4);
      }

      playerClubRoster = [...playerClubRoster, signed];
      trainingByPlayer = new Map(trainingByPlayer).set(signed.id, DEFAULT_TRAINING_FOCUS);

      bidHistory.push({
        playerId: player.id,
        playerName: `${player.firstName} ${player.lastName}`,
        round: currentRound,
        fee: terms.fee,
        annualSalary: terms.annualSalary,
        accepted: true,
        reason: response.reason,
      });

      return { kind: 'SIGNED', player: signed, fee: terms.fee, resolution };
    },

    getBidHistory(): readonly BidRecord[] {
      return bidHistory;
    },

    setAcademyPlan(plan) {
      academy = {
        ...academy,
        ...(plan.investment ? { investment: plan.investment } : {}),
        ...(plan.focus ? { focus: plan.focus } : {}),
      };
    },

    getJokerOptions() {
      // Les effectifs de clubs ne contiennent aucun joueur libre : c'est ce qui
      // les définit. Le vivier vient donc de la base complète.
      const freeAgents = (opts.freeAgentPool?.() ?? [])
        .filter(p => p.freeAgent && !p.retired);

      return jokerCandidates(playerClubRoster, currentRound, jokersUsedFor).map(injured => ({
        injured,
        returnsAtRound: injured.dynamic.injury?.estimatedReturnAt ?? currentRound,
        candidates: eligibleJokers(injured, freeAgents),
      }));
    },

    signMedicalJoker(injuredId: PlayerId, candidate: Player, annualSalary: number) {
      const injured = playerClubRoster.find(p => p.id === injuredId);
      if (!injured) return { ok: false as const, reason: 'Joueur introuvable dans l\'effectif.' };

      const eligibility = jokerEligibility(injured, currentRound, jokersUsedFor);
      if (!eligibility.eligible) {
        return { ok: false as const, reason: eligibility.reason ?? 'Joker impossible.' };
      }

      const check = canBeJoker(injured, candidate);
      if (!check.allowed) return { ok: false as const, reason: check.reason ?? 'Joker impossible.' };

      const registration = registrationCheck(annualSalary);
      if (registration && !registration.allowed) {
        return { ok: false as const, reason: registration.reason ?? 'Signature refusée par la commission.' };
      }

      const affordability = affordabilityFor({ fee: 0, annualSalary, years: 1 });
      if (!affordability.canAfford) {
        return { ok: false as const, reason: affordability.reason ?? 'Opération hors de portée.' };
      }

      const signing = signJoker(injured, candidate, opts.playerClubId, opts.currentSeason, annualSalary);
      jokersUsedFor.add(injuredId);
      playerClubRoster = [...playerClubRoster, signing.player];
      trainingByPlayer = new Map(trainingByPlayer).set(signing.player.id, DEFAULT_TRAINING_FOCUS);

      return { ok: true as const, player: signing.player };
    },

    applyExternalTransfers(balanceByClub: ReadonlyMap<ClubId, number>): void {
      for (const [clubId, balance] of balanceByClub) {
        const finances = financesByClub.get(clubId);
        if (!finances || balance === finances.balance) continue;
        applyClubMovement(clubId, {
          kind: balance > finances.balance ? 'TRANSFER_IN' : 'TRANSFER_OUT',
          amount: balance - finances.balance,
          round: currentRound,
          note: 'Mercato d\'hiver',
        });
      }
    },

    assignScout(playerId: PlayerId): void {
      scouting = assignScout(scouting, playerId, scoutQuality());
    },

    setStaff(next: readonly StaffMember[]): void {
      staff = [...next];
    },

    syncPlayerRoster(roster: readonly Player[]): void {
      playerClubRoster = [...roster];
    },

    assignClubScout(clubId: ClubId): void {
      scouting = assignClubScout(scouting, clubId, scoutQuality());
    },

    unassignClubScout(clubId: ClubId): void {
      scouting = unassignClubScout(scouting, clubId);
    },

    unassignScout(playerId: PlayerId): void {
      scouting = unassignScout(scouting, playerId);
    },

    getDevelopmentInputs() {
      const minutesByPlayer = new Map<PlayerId, number>();
      for (const [id, stat] of seasonPlayerStats) minutesByPlayer.set(id, stat.minutes);

      const focusByPlayer = new Map<PlayerId, TrainingFocus>(trainingByPlayer);
      for (const p of playerClubRoster) {
        if (!focusByPlayer.has(p.id)) focusByPlayer.set(p.id, DEFAULT_TRAINING_FOCUS);
      }

      // Les clubs IA ont leur propre staff généré : sans ça, seuls les joueurs du
      // club utilisateur bénéficieraient d'un encadrement différencié.
      const coachingByClub = new Map<string, CoachingQuality>();
      coachingByClub.set(opts.playerClubId as string, coachingForPlayerClub());
      for (const club of opts.allClubs ?? []) {
        if (club.id === opts.playerClubId) continue;
        coachingByClub.set(club.id as string, coachingQualityFromStaff(generateStaffForClub(club)));
      }

      return { minutesByPlayer, focusByPlayer, coachingByClub };
    },

    signFreeAgent(player: Player, offer: { years: number; annualSalary: number }): Player | undefined {
      // V0.6 : aucune validation de cap salarial (warning UI uniquement)
      const updated: Player = {
        ...player,
        clubId: opts.playerClubId,
        freeAgent: false,
        contract: {
          startSeason: opts.currentSeason,
          endSeason: opts.currentSeason + offer.years,
          annualSalary: offer.annualSalary,
        },
      };
      // Bonus de signature : forfait 10% du salaire annuel
      const signingBonus = Math.round(offer.annualSalary * 0.1);
      applyClubMovement(opts.playerClubId, {
        kind: 'TRANSFER_OUT',
        amount: -signingBonus,
        round: currentRound,
        note: `Signature ${player.lastName}`,
      });
      // V0.8 : pénalité cohésion si signing à contre-culture
      const playerClub = clubsById.get(opts.playerClubId);
      if (playerClub) {
        const fit = evaluateIdentityFit(playerClub, updated);
        if (fit.fit === 'BAD') {
          playerClubRoster = applyBadFitMoodPenalty(playerClubRoster, 4);
        }
      }
      playerClubRoster = [...playerClubRoster, updated];
      return updated;
    },
  };
}

// =============================================================================
// Helpers
// =============================================================================

function applyRelationDelta(state: RelationsState, p1: PlayerId, p2: PlayerId, delta: number): RelationsState {
  const sa = p1 as string;
  const sb = p2 as string;
  const key = sa < sb ? `${sa}|${sb}` : `${sb}|${sa}`;
  const cur = state.byPair.get(key);
  const next = new Map(state.byPair);
  const newScore = Math.max(-100, Math.min(100, (cur?.score ?? 0) + delta));
  if (Math.abs(newScore) < 5) {
    next.delete(key);
  } else {
    next.set(key, {
      fromId: (sa < sb ? p1 : p2),
      toId: (sa < sb ? p2 : p1),
      score: newScore,
      type: newScore >= 50 ? 'AMI' : newScore >= -20 ? 'NEUTRE' : newScore >= -50 ? 'RIVAL' : 'CONFLIT',
    });
  }
  return { byPair: next };
}

function countTrailingDefeats(history: readonly PlayedMatch[], playerClubId: ClubId): number {
  let count = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i]!;
    const isHome = h.homeClubId === playerClubId;
    const myScore = isHome ? h.homeScore : h.awayScore;
    const oppScore = isHome ? h.awayScore : h.homeScore;
    if (myScore < oppScore) count++;
    else break;
  }
  return count;
}

// =============================================================================
// Helper : hash string seed → number (pour calendar generator)
// =============================================================================

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
