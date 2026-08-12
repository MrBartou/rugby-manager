import { useMemo, useRef, useState } from 'react';
import {
  autoLineup,
  clearPlayerOverrides,
  listAllPlayersWithOverrides,
  listClubs,
  listRoster,
  makeMatchInput,
  setPlayerOverrides,
} from '../data/seed-browser.js';
import type { ManualLineup } from '../data/seed-browser.js';
import { buildEuropeanMatchInput } from '../data/european-opponent.js';
import { COMPETITION_LABEL } from '../engine/season/european-cup.js';
import type { MatchInput, RosterEntry } from '../engine/match/types.js';
import type { Club, ClubId, Player, PlayerId } from '../engine/types.js';
import type { PreloadedDecision } from '../engine/match/session.js';
import { applyWeekPlan, type WeekPlan } from '../engine/match/week-plan.js';
import { TRAINING_FOCUS_LABEL, approximateOverall, type DevelopmentReport } from '../engine/club/development.js';
import {
  createSeasonSession,
  type BidOutcome,
  type BidPreview,
  type BidTerms,
  type SeasonSession,
  type SeasonState,
} from '../engine/game/season-session.js';
import { rolloverSeason } from '../engine/season/rollover.js';
import { runAiMarket, type AiTransfer } from '../engine/club/ai-market.js';
import {
  applyBoardVerdict,
  clubStature,
  idleReputationDecay,
  jobOffersFor,
  midSeasonSackings,
  sackedCoaches,
  type JobOffer,
  type ManagerStatus,
} from '../engine/season/manager-career.js';
import {
  EMPTY_MANAGER_CAREER,
  appendManagerSeason,
  markDeparture,
  type ManagerCareer,
  type SeasonVerdict,
} from '../engine/season/manager-record.js';
import {
  defaultContract,
  objectiveWithSalary,
  signContract,
  type Demands,
  type ManagerContract,
} from '../engine/season/contract-negotiation.js';
import {
  EMPTY_MAILBOX,
  answerMail,
  mailDivisionChange,
  mailExpectationReview,
  mailHonours,
  mailSanction,
  appendMail,
  effectOf,
  mailBoardReview,
  mailPressInterview,
  mailTransferBudget,
  mailTransferRequest,
  mailAcademyIntake,
  mailInjury,
  mailSquadRift,
  mailJobOffers,
  mailMilestone,
  mailObjectiveSet,
  mailSeasonVerdict,
  mailTransfer,
  markAllRead,
  markRead,
  pendingAnswers,
  unreadCount,
  type Mailbox,
  type MailDraft,
} from '../engine/season/mailbox.js';
import {
  buildProD2Clubs,
  clubsOfDivision,
  divisionOf,
  exchangeClubs,
  initialDivisions,
  resolvePromotions,
  shadowRng,
  shadowSeason,
  DIVISION_LABEL,
  type Division,
  type DivisionState,
} from '../engine/season/divisions.js';
import { generateClubSquad } from '../engine/club/youth-generation.js';
import { resolveTrainingWeek } from '../engine/club/training-week.js';
import { buildAgenda } from '../engine/season/manager-agenda.js';
import {
  EMPTY_HEAD_TO_HEAD,
  recordResult,
  rivalryBetween,
  rivalryContext,
  type HeadToHead,
} from '../engine/season/rivalries.js';
import {
  computeExpectations,
  confidenceDelta as expectationConfidenceDelta,
  judgeExpectations,
  type BoardExpectation,
  type ClubSituation,
} from '../engine/season/board-expectations.js';
import { generateWeather } from '../engine/match/weather.js';
import { refereeFor, type DisciplinePolicy } from '../engine/match/referee.js';
import { computeHonours, honoursOf, type SeasonHonours } from '../engine/season/honours.js';
import { adaptationHint, applyAdaptation } from '../engine/club/adaptation.js';
import {
  isLoanable,
  loanCost,
  loanMinutes,
  loanOffersFor,
  loanReport,
  loanTradeoff,
  type ActiveLoan,
  type LoanOffer,
} from '../engine/club/loans.js';
import {
  reactionSummary,
  roomReaction,
  type RoomEvent,
} from '../engine/human/dressing-room.js';
import {
  EMPTY_RIVALS,
  contestedBy,
  reputationTable,
  fillVacancy,
  managerOf,
  reviewRivalSeason,
  sackRival,
  seedRivals,
  type RivalState,
} from '../engine/season/rival-managers.js';
import {
  coherence,
  judgeStatus,
  statusOf,
  type SquadStatus,
} from '../engine/club/squad-status.js';
import {
  MOOD_LONG,
  MOOD_MEDIUM,
  MOOD_SHORT,
  computeMood,
  pruneMoodEvents,
  pushMoodEvent,
} from '../engine/human/mood.js';
import { TOPIC_LABEL } from '../engine/human/player-talk.js';
import { computeRelationsForMood } from '../engine/human/relationships.js';
import type { MoodModifier } from '../engine/types.js';
import {
  betrayalFallout,
  judgePromise,
  promiseOutcome,
  resolvePlayerTalk,
  resolveTransferRequest,
  type PlayerPromise,
  type PlayerTalkOutcome,
  type TalkTopic,
  type TransferRequest,
} from '../engine/human/player-talk.js';
import {
  evaluateHire,
  generateStaffMarket,
  hireInto,
  severanceFor,
  type StaffCandidate,
} from '../engine/club/staff-market.js';
import { buildOpponentReport, type OpponentReport } from '../engine/club/opponent-report.js';
import { CLUB_MISSION_COST, usedSlots } from '../engine/club/scouting.js';
import {
  DEFAULT_PLAN,
  INITIAL_FACILITIES,
  advanceProjects,
  canLaunch,
  commercialCost,
  matchdayRevenue,
  medicalBonus,
  merchandisingRevenue,
  projectCost,
  projectDuration,
  sponsorRevenue,
  PROJECT_LABEL,
  type ClubFacilities,
  type ClubPlan,
  type OngoingProject,
  type ProjectKind,
} from '../engine/club/club-management.js';
import {
  canRegister,
  capReport,
  jiffReport,
  reviewSeason,
  sanctionSummary,
} from '../engine/club/regulations.js';
import {
  EMPTY_NEWS,
  appendNews,
  newsFromInjury,
  newsFromMarket,
  newsFromResult,
  newsFromSeasonEnd,
  newsFromSelection,
  newsFromInternationalWindow,
  type NewsFeed,
} from '../engine/season/news.js';
import { isWindowOpeningRound } from '../engine/season/transfer-window.js';
import { applyMovement as applyFinancesMovement, closeSeason as closeSeasonFinances, initFinancesForAllClubs } from '../engine/club/finances.js';
import { defaultAcademyLevel, generateFreeAgentPool, generateYouthIntake } from '../engine/club/youth-generation.js';
import { EMPTY_PROSPECTS, trackProspects, type ProspectRecord } from '../engine/club/academy.js';
import {
  academyCost,
  advanceAcademy,
  defaultAcademyState,
  targetLevel,
  type AcademyState,
} from '../engine/club/academy.js';
import { appendSeason, EMPTY_HISTORY, type CareerHistory, type SeasonRecord } from '../engine/season/records.js';
import {
  EMPTY_BOOK,
  fromLegacyTotals,
  recordSeason,
  retirementTribute,
  type CareerBook,
  type SeasonEntry,
} from '../engine/season/player-career.js';
import { INITIAL_REPUTATION, updateReputation, type ManagerReputation } from '../engine/season/manager-reputation.js';
import {
  checkObjectiveMet,
  computeObjective,
  INITIAL_BOARD_CONFIDENCE,
  updateBoardConfidence,
  type BoardConfidence,
  type SeasonObjective,
} from '../engine/season/board-objective.js';
import { simulateMatch } from '../engine/match/simulate.js';
import { createRng } from '../engine/rng.js';
import {
  buildSeasonSaveFromState,
  generateSeasonSaveId,
  seasonSaveRepository,
} from '../data/season-save-repository.js';
import { useToast } from './components/Toasts.js';
import { positionLabel } from './components/DataBits.js';
import { crowdFromFillRate, type CrowdLevel } from '../engine/match/crowd.js';
import { HighlightsScreen } from './screens/HighlightsScreen.js';
import { TrainingScreen } from './screens/TrainingScreen.js';
import { SetupScreen } from './screens/SetupScreen.js';
import { TitleScreen } from './screens/TitleScreen.js';
import { MatchScreen } from './screens/MatchScreen.js';
import { SeasonSetupScreen } from './screens/SeasonSetupScreen.js';
import { DashboardScreen } from './screens/DashboardScreen.js';
import { StandingsScreen } from './screens/StandingsScreen.js';
import { PreMatchScreen } from './screens/PreMatchScreen.js';
import { SquadScreen } from './screens/SquadScreen.js';
import { PlayerScreen } from './screens/PlayerScreen.js';
import { HumanEventModal } from './components/HumanEventModal.js';
import { ContractDecisionModal } from './components/ContractDecisionModal.js';
import { AppShell, type NavKey } from './components/AppShell.js';
import {
  Onboarding,
  isOnboardingOff,
  readSeen,
} from './components/Onboarding.js';
import { nextLesson, type LessonId, type OnboardingScreen } from '../engine/season/onboarding.js';
import { FinancesScreen } from './screens/FinancesScreen.js';
import { TransferMarketScreen } from './screens/TransferMarketScreen.js';
import { NewsScreen } from './screens/NewsScreen.js';
import { CareerScreen } from './screens/CareerScreen.js';
import { ClubDirectionScreen } from './screens/ClubDirectionScreen.js';
import { NegotiationModal } from './components/NegotiationModal.js';
import { SabbaticalScreen } from './screens/SabbaticalScreen.js';
import { NationalScreen } from './screens/NationalScreen.js';
import type { WindowReport } from '../engine/season/national-team.js';
import {
  federationApproaches,
  federationLetter,
  reviewNationalSeason,
} from '../engine/season/national-job.js';
import { JobOfferModal } from './components/JobOfferModal.js';
import type { ContractDecisionOptionId, ContractDecisionResolution } from '../engine/club/contract-decisions.js';

export interface MatchSetup {
  readonly matchInput: MatchInput;
  readonly homeClub: Club;
  readonly awayClub: Club;
  readonly seed: string;
  readonly preloadedDecisions?: readonly PreloadedDecision[];
  /** Si défini, retourner au dashboard de saison après le match. */
  readonly returnToSeason?: boolean;
  /**
   * V0.13 — match de coupe d'Europe. Le résultat est enregistré via
   * `commitEuropeanMatch` et n'avance pas la journée de championnat.
   */
  readonly european?: {
    readonly playerIsHome: boolean;
    readonly label: string;
  };
}

interface PreMatchContext {
  readonly homeClubId: string;
  readonly awayClubId: string;
  readonly playerIsHome: boolean;
  readonly playerClubId: string;
  readonly seed: string;
  readonly initialLineup: ManualLineup;
  /** V0.51 — le temps annoncé, identique en préparation et au coup d'envoi. */
  readonly conditions: {
    readonly weather: MatchInput['weather'];
    readonly fieldCondition: MatchInput['fieldCondition'];
  };
  /** V0.52 — l'arbitre désigné, annoncé au dossier et présent au coup d'envoi. */
  readonly referee: import('../engine/match/referee.js').Referee;
}

type Screen =
  | { kind: 'title' }
  | { kind: 'season-setup' }
  | { kind: 'dashboard' }
  | { kind: 'standings' }
  | { kind: 'match-setup' }
  | { kind: 'pre-match'; ctx: PreMatchContext }
  | { kind: 'match'; setup: MatchSetup }
  | { kind: 'squad' }
  | { kind: 'training' }
  | { kind: 'player'; player: Player }
  | { kind: 'finances' }
  | { kind: 'transfers' }
  | { kind: 'news' }
  | { kind: 'career' }
  /**
   * V0.57 — les temps forts d'une rencontre qu'on n'a pas jouée.
   *
   * Porte le résultat et la feuille avec lui : rien n'est stocké ailleurs, un
   * condensé se regarde une fois et se referme.
   */
  | {
      kind: 'highlights';
      result: import('../engine/match/types.js').MatchResult;
      input: import('../engine/match/types.js').MatchInput;
      homeClubId: string;
      awayClubId: string;
    }
  | { kind: 'direction' };

/**
 * Écran courant, tel que l'introduction le comprend.
 *
 * Les écrans qui ne portent aucune leçon (titre, match en cours, mise en place)
 * tombent sur `autre` : rien ne doit s'afficher par-dessus un match.
 */
const ONBOARDING_SCREEN: Readonly<Record<Screen['kind'], OnboardingScreen>> = {
  title: 'autre', 'season-setup': 'autre', 'match-setup': 'autre',
  'pre-match': 'autre', match: 'autre', highlights: 'autre',
  dashboard: 'dashboard', standings: 'standings', squad: 'squad',
  training: 'training', player: 'player', finances: 'finances',
  transfers: 'transfers', news: 'news', career: 'career', direction: 'direction',
};

/**
 * Durée d'absence à partir de laquelle un joueur ne compte plus comme couverture
 * à son poste. En dessous, le club l'attend plutôt que de recruter.
 */
const LONG_TERM_INJURY_ROUNDS = 4;

/** Libellé lisible d'un tour de coupe d'Europe. */
function europeanStageLabel(stage: string): string {
  const map: Record<string, string> = {
    POOL: 'phase de poule',
    ROUND_OF_16: 'huitième de finale',
    QUARTERFINAL: 'quart de finale',
    SEMIFINAL: 'demi-finale',
    FINAL: 'finale',
  };
  return map[stage] ?? stage;
}

export function App() {
  const { notify } = useToast();
  /**
   * V0.44 — deux pools distincts, et la distinction est structurante.
   *
   * `allClubs` sert aux **recherches par identifiant** : une offre d'emploi, un
   * transfert ou une entrée du fil peuvent concerner un club de l'autre étage.
   * `clubs` est le **championnat qu'on joue** — quatorze clubs, et c'est lui
   * que reçoivent le calendrier, le mercato IA, les limogeages et le centre de
   * formation. Les confondre ferait tourner le mercato sur vingt-huit clubs et
   * construirait un calendrier impossible.
   */
  const [divisionEpoch, setDivisionEpoch] = useState(0);
  const [staffEpoch, setStaffEpoch] = useState(0);
  const allClubs = useMemo(() => [...listClubs(), ...buildProD2Clubs()], []);
  const divisionsRef = useRef<DivisionState>(
    initialDivisions(listClubs(), buildProD2Clubs()),
  );
  const playerDivisionRef = useRef<Division>('TOP14');

  const clubs = useMemo(
    () => {
      const byId = new Map(allClubs.map(c => [c.id as string, c]));
      return clubsOfDivision(divisionsRef.current, playerDivisionRef.current)
        .map(id => byId.get(id as string))
        .filter((c): c is Club => c !== undefined);
    },
    // La division du manager change à l'intersaison, suivie d'un refreshSeason :
    // c'est ce compteur qui fait recalculer le pool au rendu suivant.
    [allClubs, divisionEpoch],
  );
  const [screen, setScreen] = useState<Screen>({ kind: 'title' });

  /**
   * V0.49 — leçons déjà lues, et refus global.
   *
   * En état React et pas seulement en `localStorage` : sans cela, fermer une
   * bulle ne provoquerait aucun rendu, et la suivante n'apparaîtrait qu'au
   * prochain clic ailleurs.
   */
  const [seenLessons, setSeenLessons] = useState<readonly LessonId[]>(() => readSeen());
  const [onboardingOff, setOnboardingOff] = useState<boolean>(() => isOnboardingOff());

  // Session de saison persistée à travers les navigations dashboard ↔ match
  const seasonRef = useRef<SeasonSession | null>(null);
  const seasonSeedRef = useRef<string>('');
  // Trigger re-render quand l'état de saison change après un match
  const [, setSeasonVersion] = useState(0);
  /**
   * V0.56 — **le seul endroit** où l'effectif s'écrit.
   *
   * ## Pourquoi ce point de passage existe
   *
   * L'effectif vivait à deux endroits : les `playerOverrides` de l'interface, et
   * le roster que la session de saison tient de son côté. `refreshSeason`
   * recopie le second par-dessus le premier — donc toute écriture qui oubliait
   * de synchroniser la session était **silencieusement effacée** à la première
   * occasion.
   *
   * Ce défaut a frappé trois fois en trois versions, toujours de la même façon
   * et toujours invisible aux tests moteur, qui ne voient jamais l'interface :
   *
   *  - V0.53, les réactions du vestiaire n'apparaissaient nulle part ;
   *  - V0.54, deux morals cohabitaient sans se parler ;
   *  - V0.55, la date d'arrivée d'une recrue était posée puis perdue aussitôt.
   *
   * Quinze écritures existaient, six seulement synchronisaient. Elles passent
   * désormais toutes par ici, et la synchronisation n'est plus quelque chose
   * qu'on peut oublier.
   *
   * Seul `refreshSeason` écrit encore directement, et c'est normal : c'est lui
   * qui **lit** la session pour la recopier, le synchroniser reviendrait à lui
   * renvoyer ce qu'il vient d'en tirer.
   */
  const commitRoster = (players: readonly Player[]): void => {
    setPlayerOverrides(players);
    const session = seasonRef.current;
    if (!session) return;
    const clubId = session.getState().playerClubId;
    session.syncPlayerRoster(players.filter(p => p.clubId === clubId));
  };

  const refreshSeason = (): void => {
    // V0.7 : sync les overrides depuis le roster live (fatigue/forme/transferts/contrats)
    const session = seasonRef.current;
    if (session) {
      const state = session.getState();
      const liveRoster = state.playerClubRoster;
      // V0.31 — les blessures et suspensions des autres clubs remontent par le
      // même canal. Sans cette répercussion, un adversaire blessé continuerait
      // d'être aligné : `pickStartingFifteen` lit le stock global, pas la session.
      if (liveRoster.length > 0 || state.aiPlayerUpdates.size > 0) {
        const existing = listAllPlayersWithOverrides();
        const byId = new Map(existing.map(p => [p.id, p] as const));
        for (const p of liveRoster) byId.set(p.id, p);
        for (const p of state.aiPlayerUpdates.values()) byId.set(p.id, p);
        // V0.54 — le moral stocké se recalcule ici, à chaque rafraîchissement :
        // sept sources plus événements actifs. C'est ce qui garantit que le
        // moteur de match lit exactement ce que l'écran affiche.
        setPlayerOverrides(refreshMoods([...byId.values()]));
      }
    }
    setSeasonVersion(v => v + 1);
  };

  const [seasonSaveStatus, setSeasonSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [rolloverSummary, setRolloverSummary] = useState<{ retiredCount: number; freeAgentCount: number; youthCount: number; newSeason: number } | null>(null);
  /** V0.29 — mouvements du dernier mercato IA, affichés dans l'onglet Transferts. */
  const aiMarketRef = useRef<readonly AiTransfer[]>([]);
  /** V0.30 — saison pour laquelle le mercato d'hiver a déjà été joué. */
  const winterMarketRef = useRef<number | null>(null);
  /** V0.38 — journal du championnat, conservé d'une saison à l'autre. */
  const newsRef = useRef<NewsFeed>(EMPTY_NEWS);
  /** V0.39 — centre de formation : niveau acquis, investissement, orientation. */
  const academyRef = useRef<AcademyState>({ level: 3, investment: 'MODERE', focus: 'EQUILIBRE' });

  /** Consigne des entrées dans le fil. Les doublons sont écartés par le moteur. */
  const publish = (entries: readonly Parameters<typeof appendNews>[1][number][]): void => {
    if (entries.length === 0) return;
    newsRef.current = appendNews(newsRef.current, entries);
  };

  /** V0.42 — parcours du manager et sa correspondance. */
  const managerCareerRef = useRef<ManagerCareer>(EMPTY_MANAGER_CAREER);
  const mailboxRef = useRef<Mailbox>(EMPTY_MAILBOX);
  /** V0.43 — contrat négocié avec le président du club actuel. */
  const contractRef = useRef<ManagerContract>(defaultContract(2025));
  /** V0.43 — espoirs sortis du centre, suivis nommément. */
  const prospectsRef = useRef<readonly ProspectRecord[]>(EMPTY_PROSPECTS);
  /**
   * V0.43 — bancs libérés et encore sans titulaire.
   *
   * Ils survivent d'une journée à l'autre pendant une année sabbatique : un
   * poste ouvert en novembre doit rester consultable en février, sinon
   * l'attente n'a rien à quoi se raccrocher.
   */
  const vacanciesRef = useRef<readonly ClubId[]>([]);
  /**
   * V0.53 — les entraîneurs des autres clubs.
   *
   * Jusqu'ici les clubs IA limogeaient des fantômes : une vacance n'était qu'un
   * identifiant de club, et la réputation du manager ne se comparait à rien.
   */
  const rivalsRef = useRef<RivalState>(EMPTY_RIVALS);
  /**
   * V0.53 — les honneurs individuels, saison après saison.
   *
   * Une année se terminait sur un classement et rien d'autre : ni meilleur
   * joueur, ni XV de la saison, ni meilleur espoir.
   */
  const honoursRef = useRef<readonly SeasonHonours[]>([]);
  /**
   * V0.55 — joueurs partis jouer ailleurs pour la saison.
   *
   * Sans cette troisième voie, un jeune prenait des minutes à l'équipe première
   * ou stagnait — la progression se payant en minutes depuis la V0.14.
   */
  const loansRef = useRef<readonly ActiveLoan[]>([]);
  const [loanEpoch, setLoanEpoch] = useState(0);
  /**
   * V0.55 — joueurs ménagés cette semaine.
   *
   * La charge d'entraînement était collective : impossible de préserver un
   * cadre de trente-quatre ans tout en poussant les jeunes.
   */
  const [restedPlayers, setRestedPlayers] = useState<ReadonlySet<PlayerId>>(new Set());
  const [rivalEpoch, setRivalEpoch] = useState(0);
  /**
   * V0.45 — direction du club : installations, chantier en cours et politique
   * commerciale. C'est ce qui donne enfin une destination à la trésorerie.
   */
  const facilitiesRef = useRef<ClubFacilities>(INITIAL_FACILITIES);
  const ongoingProjectRef = useRef<OngoingProject | undefined>(undefined);
  const clubPlanRef = useRef<ClubPlan>(DEFAULT_PLAN);
  const [directionEpoch, setDirectionEpoch] = useState(0);

  /**
   * V0.48 — mémoire des confrontations avec chaque rival.
   *
   * Sans elle, un derby serait un match comme un autre entre deux équipes
   * médiocres : c'est la série en cours qui lui donne son poids.
   */
  const headToHeadRef = useRef<ReadonlyMap<string, HeadToHead>>(new Map());

  /** V0.48 — feuille de route du président, au-delà du classement. */
  const expectationsRef = useRef<readonly BoardExpectation[]>([]);

  /**
   * Photo du club telle que le président la voit : c'est sur elle qu'il fixe
   * ses exigences, et sur elle qu'il les jugera un an plus tard.
   */
  const clubSituation = (roster: readonly Player[], balance: number, season: number): ClubSituation => {
    const stats = seasonRef.current?.getState().seasonPlayerStats;
    let youthMinutes = 0;
    let totalMinutes = 0;
    for (const p of roster) {
      const minutes = stats?.get(p.id)?.minutes ?? 0;
      totalMinutes += minutes;
      if (season - Number(p.birthDate.slice(0, 4)) < 23) youthMinutes += minutes;
    }
    return {
      capUsage: capReport(roster, playerDivisionRef.current).usage,
      jiffHeadroom: jiffReport(roster).foreignHeadroom,
      youthMinutesRatio: totalMinutes > 0 ? youthMinutes / totalMinutes : 0,
      seasonBalance: balance,
    };
  };

  /**
   * V0.48 — engagements pris devant des joueurs.
   *
   * Ce sont les seules choses d'une conversation qui survivent à la
   * conversation : une promesse de temps de jeu court sur six journées et se
   * paie à l'échéance.
   */
  const promisesRef = useRef<readonly PlayerPromise[]>([]);
  /** Matchs disputés par joueur au moment de la promesse, pour faire les comptes. */
  const promiseBaselineRef = useRef<ReadonlyMap<string, number>>(new Map());
  const [lastTalkOutcome, setLastTalkOutcome] = useState<
    { playerId: PlayerId; outcome: PlayerTalkOutcome } | null
  >(null);

  /**
   * V0.49 — demandes de départ ouvertes.
   *
   * Une promesse trahie pouvait n'être qu'une jauge de moral qui baisse. Ici
   * elle laisse une trace que le manager doit traiter : accepter et voir les
   * clubs venir, ou retenir et vivre avec.
   */
  const transferRequestsRef = useRef<readonly TransferRequest[]>([]);

  /**
   * V0.50 — capitaine en titre du club.
   *
   * Le brassard était réattribué à l'ouvreur avant chaque rencontre : le choix
   * du manager ne survivait pas au coup de sifflet final. Il est désormais
   * porté par le club, et sauvegardé.
   */
  const captainRef = useRef<PlayerId | undefined>(undefined);

  /**
   * V0.50 — hiérarchie annoncée de l'effectif.
   *
   * Le statut d'un joueur n'était qu'une déduction de son temps de jeu : le
   * manager ne pouvait rien annoncer, donc rien tenir ni rien trahir.
   */
  const squadStatusRef = useRef<ReadonlyMap<PlayerId, SquadStatus>>(new Map());
  const [statusEpoch, setStatusEpoch] = useState(0);
  /** Compteur d'époque : les refs ne déclenchent aucun rendu à elles seules. */
  const [requestEpoch, setRequestEpoch] = useState(0);

  /** V0.45 — suites de la commission : elles courent sur la saison suivante. */
  const sanctionedLastSeasonRef = useRef(false);
  const pointsPenaltyRef = useRef(0);
  const transferBanRef = useRef(false);
  /**
   * V0.47 — les suites de la commission pour **tous** les clubs.
   *
   * Sans elles, seul le club de l'utilisateur passait devant la commission : les
   * clubs IA respectaient le plafond mais ne payaient jamais rien, et la règle
   * restait à deux vitesses.
   */
  const repeatOffendersRef = useRef<ReadonlySet<string>>(new Set());
  const pointsPenaltyByClubRef = useRef<ReadonlyMap<ClubId, number>>(new Map());
  /** Offre en cours de négociation ; la modale de signature s'ouvre dessus. */
  const [negotiating, setNegotiating] = useState<JobOffer | null>(null);
  /**
   * Le compteur de non-lus s'affiche dans la navigation, donc la boîte doit
   * provoquer un rendu quand elle change — ce qu'une ref ne fait pas. On garde
   * la ref pour l'écriture synchrone depuis les handlers, et ce compteur pour
   * en signaler les évolutions à React.
   */
  const [unreadMails, setUnreadMails] = useState(0);

  /** Dépose du courrier. Les `undefined` sont tolérés : tous les rédacteurs ne
   *  produisent pas systématiquement un message. */
  const sendMail = (drafts: readonly (MailDraft | undefined)[]): void => {
    const kept = drafts.filter((d): d is MailDraft => d !== undefined);
    if (kept.length === 0) return;
    mailboxRef.current = appendMail(mailboxRef.current, kept);
    setUnreadMails(unreadCount(mailboxRef.current));
  };

  /**
   * V0.43 — applique la réponse donnée à un message.
   *
   * Le moteur dit ce que la décision coûte ; c'est ici qu'on la paie. Passer par
   * `answerMail` avant d'appliquer quoi que ce soit est essentiel : il refuse
   * une seconde réponse, ce qui empêche de rejouer la décision et d'en cumuler
   * les effets à chaque ouverture de la boîte.
   */
  const resolveMailAnswer = (mailId: string, actionId: string): void => {
    const before = mailboxRef.current;
    const after = answerMail(before, mailId, actionId);
    if (after === before) return;
    mailboxRef.current = after;

    const effect = effectOf(actionId);
    if (effect.reputationDelta !== 0) {
      reputationRef.current = {
        ...reputationRef.current,
        score: Math.max(0, Math.min(100, reputationRef.current.score + effect.reputationDelta)),
      };
    }
    if (effect.confidenceDelta !== 0) {
      confidenceRef.current = {
        ...confidenceRef.current,
        score: Math.max(0, Math.min(100, confidenceRef.current.score + effect.confidenceDelta)),
      };
    }
    const session = seasonRef.current;
    if (effect.cashDelta !== 0 && session) {
      // `applyExternalTransfers` attend des soldes absolus, pas des mouvements.
      const state = session.getState();
      const current = state.financesByClub.get(state.playerClubId)?.balance ?? 0;
      session.applyExternalTransfers(
        new Map([[state.playerClubId, current + effect.cashDelta]]),
      );
    }

    // V0.49 — une demande de départ ne se règle pas en réputation ni en
    // trésorerie : elle se paie sur le moral d'un homme et de son vestiaire.
    const [base, argument] = actionId.split(':');
    if ((base === 'DEPART_ACCEPTER' || base === 'DEPART_RETENIR') && argument !== undefined) {
      resolveDepartureRequest(argument as PlayerId, base === 'DEPART_ACCEPTER' ? 'ACCEPTER' : 'RETENIR');
    }

    setUnreadMails(unreadCount(mailboxRef.current));
    refreshSeason();
  };

  /** V0.49 — applique la réponse donnée à une demande de départ. */
  const resolveDepartureRequest = (
    playerId: PlayerId,
    decision: 'ACCEPTER' | 'RETENIR',
  ): void => {
    const request = transferRequestsRef.current.find(r => r.playerId === playerId);
    if (!request) return;

    const resolution = resolveTransferRequest(decision);
    applyMoodDelta(
      playerId, resolution.playerMoodDelta,
      decision === 'ACCEPTER' ? 'Mis sur la liste des transferts' : 'Retenu contre son gré',
      'STATUT_EQUIPE', MOOD_LONG,
    );
    applySquadMoodDelta(resolution.dressingRoomDelta, playerId);

    transferRequestsRef.current = resolution.listed
      ? transferRequestsRef.current.map(r =>
        r.playerId === playerId ? { ...r, status: 'SUR_LA_LISTE' as const } : r)
      // Retenu : l'affaire est close, il ne reste que le moral.
      : transferRequestsRef.current.filter(r => r.playerId !== playerId);
    setRequestEpoch(e => e + 1);
    notify(`${request.playerName} — ${resolution.narrative}`, decision === 'ACCEPTER' ? 'info' : 'warn');
  };

  /**
   * Bilan de fenêtre adressé au manager.
   *
   * Le fil d'actualité consigne les cent mouvements du championnat ; la
   * direction sportive, elle, ne parle que des nôtres.
   */
  const mailOwnMarket = (
    transfers: readonly AiTransfer[],
    season: number,
    round: number,
    clubId: ClubId,
    windowLabel: string,
  ): void => {
    const mine = transfers.filter(t => t.kind === 'TRANSFERT' || t.kind === 'RECRUE_LIBRE');
    sendMail([mailTransfer({
      season,
      round,
      clubId,
      arrivals: mine.filter(t => t.toClubId === clubId).map(t => t.playerName),
      departures: mine.filter(t => t.fromClubId === clubId).map(t => t.playerName),
      windowLabel,
    })]);
  };
  const [lastContractResolution, setLastContractResolution] = useState<ContractDecisionResolution | null>(null);
  const [snoozedContractIds, setSnoozedContractIds] = useState<ReadonlySet<string>>(new Set());
  const careerHistoryRef = useRef<CareerHistory>(EMPTY_HISTORY);
  /**
   * V0.59 — le registre de carrière des joueurs.
   *
   * Remplace `careerHistory.playerCareerStats` : le détail saison par saison au
   * lieu d'un cumul d'essais et de matchs.
   */
  const careerBookRef = useRef<CareerBook>(EMPTY_BOOK);
  /** V0.14 — rapports de progression de la dernière intersaison (affichés au dashboard). */
  const developmentReportsRef = useRef<readonly DevelopmentReport[]>([]);
  const reputationRef = useRef<ManagerReputation>(INITIAL_REPUTATION);
  const objectiveRef = useRef<SeasonObjective | null>(null);
  const confidenceRef = useRef<BoardConfidence>(INITIAL_BOARD_CONFIDENCE);
  const [firedNotice, setFiredNotice] = useState<string | null>(null);
  /** V0.41 — statut du manager : en poste quelque part, ou libre. */
  const careerRef = useRef<ManagerStatus>({ kind: 'EN_POSTE', clubId: 'toulouse' as ClubId });
  /** V0.41 — propositions reçues à l'intersaison, en attente de réponse. */
  const [pendingOffers, setPendingOffers] = useState<readonly JobOffer[]>([]);
  /** V0.59 — la proposition de la fédération, quand elle arrive. */
  const [nationalOffer, setNationalOffer] = useState<{ season: number; letter: string } | null>(null);
  /** V0.59 — retouches du manager sur le groupe proposé. */
  const nationalPicksRef = useRef<{ added: PlayerId[]; removed: PlayerId[] }>({ added: [], removed: [] });
  const [nationalEpoch, setNationalEpoch] = useState(0);
  /** V0.59 — bilans des fenêtres internationales de la saison en cours. */
  const windowReportsRef = useRef<WindowReport[]>([]);

  // ---------------------------------------------------------------------------
  // Handlers — saison
  // ---------------------------------------------------------------------------

  /**
   * V0.44 — effectifs des clubs de Pro D2.
   *
   * Ces clubs n'existent dans aucun CSV : les écrire à la main serait des
   * centaines de lignes de données mortes. On les fabrique une fois, de façon
   * déterministe, et la couche d'overrides les persiste comme n'importe quel
   * autre joueur. Sans effectif, un club de seconde division ne peut ni aligner
   * un XV ni être affronté : la descente mènerait droit à un écran cassé.
   */
  const buildProD2Squads = (seed: string, season: number, existing: readonly Player[]): readonly Player[] => {
    const taken = new Set(existing.map(p => p.id as string));
    const out: Player[] = [];
    for (const club of buildProD2Clubs()) {
      // Le niveau visé suit la réputation du club : Brive n'est pas Aurillac,
      // et un championnat plat n'aurait aucune hiérarchie à remonter.
      const squad = generateClubSquad({
        clubId: club.id,
        currentSeason: season,
        targetLevel: 46 + Math.round((club.reputation - 34) * 0.45),
        seed,
        existingPlayerIds: taken,
      });
      for (const p of squad) taken.add(p.id as string);
      out.push(...squad);
    }
    return out;
  };

  const startSeason = (playerClubId: string, seed: string): void => {
    clearPlayerOverrides();
    divisionsRef.current = initialDivisions(listClubs(), buildProD2Clubs());
    playerDivisionRef.current = divisionOf(divisionsRef.current, playerClubId as ClubId);
    setDivisionEpoch(e => e + 1);
    // V0.37 — un vivier d'agents libres dès le coup d'envoi. Sans lui, les
    // contrats n'expirant qu'à l'intersaison, le marché restait vide toute la
    // première saison et le joker médical n'avait jamais personne à signer.
    const base = listAllPlayersWithOverrides();
    commitRoster([
      ...base,
      ...buildProD2Squads(seed, 2025, base),
      ...generateFreeAgentPool({
        currentSeason: 2025,
        seed,
        existingPlayerIds: new Set(base.map(p => p.id as string)),
      }),
    ]);
    careerHistoryRef.current = EMPTY_HISTORY;
    reputationRef.current = INITIAL_REPUTATION;
    confidenceRef.current = INITIAL_BOARD_CONFIDENCE;
    setFiredNotice(null);
    const playerClub = allClubs.find(c => c.id === playerClubId);
    objectiveRef.current = playerClub
      ? computeObjective(playerClub, INITIAL_REPUTATION.score, playerDivisionRef.current)
      : null;
    // V0.42 — nouvelle carrière : parcours vierge, et la lettre de mission du
    // président ouvre la boîte.
    managerCareerRef.current = EMPTY_MANAGER_CAREER;
    mailboxRef.current = EMPTY_MAILBOX;
    contractRef.current = defaultContract(2025);
    prospectsRef.current = EMPTY_PROSPECTS;
    vacanciesRef.current = [];
    sanctionedLastSeasonRef.current = false;
    transferBanRef.current = false;
    repeatOffendersRef.current = new Set();
    pointsPenaltyByClubRef.current = new Map();
    pointsPenaltyRef.current = 0;
    expectationsRef.current = [];
    headToHeadRef.current = new Map();
    promisesRef.current = [];
    transferRequestsRef.current = [];
    captainRef.current = undefined;
    // V0.53 — chaque banc du championnat reçoit un nom.
    rivalsRef.current = seedRivals(allClubs, playerClubId as ClubId, c => clubStature(c));
    honoursRef.current = [];
    careerBookRef.current = EMPTY_BOOK;
    loansRef.current = [];
    setRivalEpoch(e => e + 1);
    squadStatusRef.current = new Map();
    setStatusEpoch(e => e + 1);
    // Le menu titre peut avoir réarmé les explications juste avant.
    setSeenLessons(readSeen());
    setOnboardingOff(isOnboardingOff());
    promiseBaselineRef.current = new Map();
    setLastTalkOutcome(null);
    facilitiesRef.current = INITIAL_FACILITIES;
    ongoingProjectRef.current = undefined;
    clubPlanRef.current = DEFAULT_PLAN;
    setDirectionEpoch(e => e + 1);
    setNegotiating(null);
    setUnreadMails(0);
    if (playerClub && objectiveRef.current) {
      sendMail([mailObjectiveSet({
        season: 2025,
        clubId: playerClub.id,
        clubName: playerClub.name,
        objectiveKind: objectiveRef.current.kind,
        objectiveLabel: objectiveRef.current.label,
        boardConfidence: INITIAL_BOARD_CONFIDENCE.score,
        seasonsAtClub: 0,
      })]);
    }
    // Le championnat qu'on va jouer, calculé ici et pas lu depuis `clubs` : le
    // memo reflète encore le rendu précédent, donc le Top 14, et la session
    // aurait été bâtie sur les mauvais quatorze clubs — un club de Pro D2 s'y
    // retrouvait sans le moindre match au calendrier.
    const byIdStart = new Map(allClubs.map(c => [c.id as string, c]));
    const startLeague = clubsOfDivision(divisionsRef.current, playerDivisionRef.current)
      .map(id => byIdStart.get(id as string))
      .filter((c): c is Club => c !== undefined);

    seasonSeedRef.current = seed;
    seasonRef.current = createSeasonSession({
      clubIds: startLeague.map(c => c.id),
      playerClubId: playerClubId as ClubId,
      seed,
      buildMatchInput: (homeId, awayId) => makeMatchInput({
        homeClubId: homeId,
        awayClubId: awayId,
        ...weatherForSim(homeId),
        matchId: `s_${seed}_${homeId}_${awayId}`,
      }),
      playerClubRoster: listRoster(playerClubId),
      currentSeason: 2025,
      allClubs: startLeague,
      rosterByClub: (cid) => listRoster(cid),
      // V0.58 — le XV de France se recrute dans les deux divisions.
      nationalPool: () => listAllPlayersWithOverrides(),
      nationalPicks: () => nationalPicksRef.current,
      clubDirection: () => ({ facilities: facilitiesRef.current, plan: clubPlanRef.current }),
      wantAwayIds: () => transferRequestsRef.current
        .filter(r => r.status === 'SUR_LA_LISTE')
        .map(r => r.playerId),
      squadStatuses: () => squadStatusRef.current,
      // V0.13 — première saison : la qualification européenne est estimée d'après
      // la réputation du club, faute de classement de la saison précédente.
      // V0.44 — sauf en Pro D2, qui n'a pas de coupe d'Europe.
      ...(playerDivisionRef.current === 'TOP14'
        ? { previousSeasonRank: initialRankFromReputation(playerClubId) } : {}),
    });
    aiMarketRef.current = [];
    winterMarketRef.current = null;
    newsRef.current = EMPTY_NEWS;
    const startClub = allClubs.find(c => c.id === playerClubId);
    if (startClub) academyRef.current = defaultAcademyState(startClub);
    careerRef.current = { kind: 'EN_POSTE', clubId: playerClubId as ClubId };
    setPendingOffers([]);
    setSeasonSaveStatus('idle');
    setRolloverSummary(null);
    setScreen({ kind: 'dashboard' });
  };

  /**
   * V0.59 — une sauvegarde antérieure à la V0.56 porte une Pro D2 à quatorze
   * clubs.
   *
   * Sans ce rattrapage, elle y reste pour toujours : la promotion échange un
   * club contre un club, personne n'ajoute jamais les deux manquants, et la
   * partie garde un championnat de vingt-six journées là où il en faut trente.
   */
  const completeDivisions = (state: DivisionState): DivisionState => {
    const connus = new Set(state.proD2.map(id => id as string));
    const manquants = buildProD2Clubs()
      .filter(c => !connus.has(c.id as string) && !state.top14.includes(c.id))
      .map(c => c.id);
    if (manquants.length === 0) return state;
    return { ...state, proD2: [...state.proD2, ...manquants] };
  };

  const loadSeason = async (saveId: string): Promise<void> => {
    const save = await seasonSaveRepository.load(saveId);
    if (!save) return;
    setPlayerOverrides(save.playerOverrides);

    // V0.44 — la division doit être restaurée **avant** de construire la
    // session : c'est elle qui dit quels quatorze clubs composent le
    // championnat qu'on reprend. La rétablir après aurait donné à la session le
    // pool de l'étage précédent.
    divisionsRef.current = completeDivisions(
      save.divisions ?? initialDivisions(listClubs(), buildProD2Clubs()),
    );
    playerDivisionRef.current = divisionOf(divisionsRef.current, save.playerClubId);
    setDivisionEpoch(e => e + 1);

    // Une partie commencée avant les deux étages n'a aucun joueur de Pro D2 : la
    // première relégation tomberait sur des clubs sans effectif, incapables
    // d'aligner un XV.
    if (!buildProD2Clubs().some(c => listRoster(c.id as string).length > 0)) {
      const known = listAllPlayersWithOverrides();
      commitRoster([
        ...known,
        ...buildProD2Squads(save.seed, save.currentSeason, known),
      ]);
    }

    const byIdOnLoad = new Map(allClubs.map(c => [c.id as string, c]));
    const restoredLeague = clubsOfDivision(divisionsRef.current, playerDivisionRef.current)
      .map(id => byIdOnLoad.get(id as string))
      .filter((c): c is Club => c !== undefined);

    careerHistoryRef.current = save.careerHistory;
    reputationRef.current = save.managerReputation;
    objectiveRef.current = save.objective;
    confidenceRef.current = save.boardConfidence;
    setFiredNotice(null);
    seasonSeedRef.current = save.seed;
    seasonRef.current = createSeasonSession({
      clubIds: save.clubIds,
      playerClubId: save.playerClubId,
      seed: save.seed,
      buildMatchInput: (homeId, awayId) => makeMatchInput({
        homeClubId: homeId,
        awayClubId: awayId,
        ...weatherForSim(homeId),
        matchId: `s_${save.seed}_${homeId}_${awayId}`,
      }),
      playerClubRoster: listRoster(save.playerClubId),
      currentSeason: save.currentSeason,
      allClubs: restoredLeague,
      rosterByClub: (cid) => listRoster(cid),
      // V0.58 — le XV de France se recrute dans les deux divisions.
      nationalPool: () => listAllPlayersWithOverrides(),
      nationalPicks: () => nationalPicksRef.current,
      clubDirection: () => ({ facilities: facilitiesRef.current, plan: clubPlanRef.current }),
      wantAwayIds: () => transferRequestsRef.current
        .filter(r => r.status === 'SUR_LA_LISTE')
        .map(r => r.playerId),
      squadStatuses: () => squadStatusRef.current,
      // Pas de coupe d'Europe en Pro D2.
      ...(playerDivisionRef.current === 'TOP14'
        ? { previousSeasonRank: lastSeasonRank() ?? initialRankFromReputation(save.playerClubId) }
        : {}),
      restoreFrom: {
        currentRound: save.currentRound,
        history: save.history,
        standings: save.standings,
        ...(save.champion !== undefined ? { champion: save.champion } : {}),
        financesByClub: new Map(save.financesByClub.map(e => [e.clubId, e.finances])),
        // V0.31 — état de club longtemps resté en mémoire vive. Absent des
        // sauvegardes antérieures : la session repart alors de ses valeurs par
        // défaut, ce qui reste correct.
        ...(save.trainingByPlayer
          ? { trainingByPlayer: new Map(save.trainingByPlayer.map(e => [e.playerId, e.focus])) }
          : {}),
        ...(save.scouting
          ? {
            scouting: {
              knowledge: new Map(save.scouting.knowledge.map(e => [e.playerId, e.knowledge])),
              assignments: save.scouting.assignments,
              clubAssignments: save.scouting.clubAssignments ?? [],
            },
          }
          : {}),
        ...(save.staff && save.staff.length > 0 ? { staff: save.staff } : {}),
        ...(save.bidCooldowns
          ? { bidCooldowns: new Map(save.bidCooldowns.map(e => [e.playerId, e.untilRound])) }
          : {}),
        ...(save.jokersUsedFor ? { jokersUsedFor: save.jokersUsedFor } : {}),
        // V0.58 — les statistiques de la saison en cours reprennent où elles
        // s'étaient arrêtées. Le compteur de matchs les accompagne : c'est le
        // dénominateur du temps de jeu, et le restaurer sans lui rendrait tout
        // l'effectif remplaçant.
        ...(save.playerStats
          ? { playerStats: new Map(save.playerStats.map(e => [e.playerId, e.stat])) }
          : {}),
        ...(save.statsMatchCount !== undefined ? { statsMatchCount: save.statsMatchCount } : {}),
        ...(save.caps ? { caps: new Map(save.caps.map(e => [e.playerId, e.record])) } : {}),
      },
    });
    aiMarketRef.current = save.aiMarket ?? [];
    winterMarketRef.current = save.winterMarketSeason ?? null;
    newsRef.current = save.news ? { items: save.news } : EMPTY_NEWS;
    const loadedClub = allClubs.find(c => c.id === save.playerClubId);
    academyRef.current = save.academy ?? (loadedClub ? defaultAcademyState(loadedClub) : academyRef.current);
    careerRef.current = save.career ?? { kind: 'EN_POSTE', clubId: save.playerClubId };
    managerCareerRef.current = save.managerSeasons
      ? { seasons: save.managerSeasons }
      : EMPTY_MANAGER_CAREER;
    mailboxRef.current = save.mailbox ? { mails: save.mailbox } : EMPTY_MAILBOX;
    contractRef.current = save.managerContract ?? defaultContract(save.currentSeason);
    prospectsRef.current = save.prospects ?? EMPTY_PROSPECTS;
    // V0.44 — une sauvegarde antérieure aux deux étages repart d'un Top 14
    // complet : ses quatorze clubs sont exactement ceux du CSV.
    vacanciesRef.current = [];
    sanctionedLastSeasonRef.current = save.regulation?.sanctionedLastSeason ?? false;
    transferBanRef.current = save.regulation?.transferBan ?? false;
    repeatOffendersRef.current = new Set(
      (save.regulation?.repeatOffenders ?? []).map(id => id as string),
    );
    pointsPenaltyByClubRef.current = new Map();
    pointsPenaltyRef.current = 0;
    expectationsRef.current = save.expectations ?? [];
    headToHeadRef.current = new Map(
      (save.headToHead ?? []).map(e => [e.clubId as string, e.record]),
    );
    transferRequestsRef.current = save.transferRequests ?? [];
    captainRef.current = save.captainPlayerId;
    squadStatusRef.current = new Map(
      (save.squadStatuses ?? []).map(e => [e.playerId, e.status] as const),
    );
    // V0.53 — une sauvegarde antérieure n'a pas de corps d'entraîneurs : on le
    // reconstitue, plutôt que de laisser le championnat anonyme.
    honoursRef.current = save.honours ?? [];
    // V0.59 — le registre, ou sa reconstitution depuis l'ancien cumul.
    careerBookRef.current = save.careerBook
      ? new Map(save.careerBook.map(e => [e.playerId, e.career]))
      : fromLegacyTotals(
        (save.careerHistory as { playerCareerStats?: readonly {
          playerId: PlayerId; playerName: string; clubId: ClubId; tries: number; matches: number;
        }[] }).playerCareerStats ?? [],
        save.currentSeason - 1,
      );
    loansRef.current = save.loans ?? [];
    setLoanEpoch(e => e + 1);
    rivalsRef.current = save.rivals
      ? {
        managers: save.rivals.managers,
        byClub: new Map(save.rivals.byClub.map(e => [e.clubId, e.managerId] as const)),
      }
      : seedRivals(allClubs, save.playerClubId, c => clubStature(c));
    setRivalEpoch(e => e + 1);
    setStatusEpoch(e => e + 1);
    setRequestEpoch(e => e + 1);
    setSeenLessons(readSeen());
    setOnboardingOff(isOnboardingOff());
    promisesRef.current = (save.promises ?? []).map(e => e.promise);
    promiseBaselineRef.current = new Map(
      (save.promises ?? []).map(e => [e.promise.playerId as string, e.baseline]),
    );
    setLastTalkOutcome(null);
    facilitiesRef.current = save.direction?.facilities ?? INITIAL_FACILITIES;
    ongoingProjectRef.current = save.direction?.ongoing;
    clubPlanRef.current = save.direction?.plan ?? DEFAULT_PLAN;
    setDirectionEpoch(e => e + 1);
    setNegotiating(null);
    setUnreadMails(unreadCount(mailboxRef.current));
    setPendingOffers([]);
    setSeasonSaveStatus('idle');
    setRolloverSummary(null);
    setScreen({ kind: 'dashboard' });
  };

  const saveSeasonNow = async (kind: 'manual' | 'auto' = 'manual'): Promise<void> => {
    const session = seasonRef.current;
    if (!session) return;
    const state = session.getState();
    const playerClub = allClubs.find(c => c.id === state.playerClubId);
    const seasonLabel = `${state.currentSeason}-${(state.currentSeason + 1).toString().slice(-2)}`;
    const phaseLabel = state.phase === 'regular' ? `J${state.currentRound}` : state.phase === 'over' ? 'Saison finie' : state.phase;
    // Auto-save : un slot fixe par club (écrasement). Manuel : nouvel ID.
    const saveId = kind === 'auto'
      ? `autosave_${state.playerClubId}`
      : generateSeasonSaveId();
    const prefix = kind === 'auto' ? '⟲ Auto · ' : '';
    const displayName = `${prefix}${playerClub?.shortName ?? state.playerClubId} • ${seasonLabel} • ${phaseLabel}`;
    try {
      await seasonSaveRepository.save(buildSeasonSaveFromState(
        saveId,
        state,
        seasonSeedRef.current,
        clubs.map(c => c.id),
        displayName,
        listAllPlayersWithOverrides(),
        careerHistoryRef.current,
        reputationRef.current,
        objectiveRef.current ?? undefined,
        confidenceRef.current,
        {
          aiMarket: aiMarketRef.current,
          ...(winterMarketRef.current !== null ? { winterMarketSeason: winterMarketRef.current } : {}),
          news: newsRef.current.items,
          academy: academyRef.current,
          career: careerRef.current,
          managerSeasons: managerCareerRef.current.seasons,
          mailbox: mailboxRef.current.mails,
          managerContract: contractRef.current,
          prospects: prospectsRef.current,
          divisions: divisionsRef.current,
          careerBook: [...careerBookRef.current].map(([playerId, career]) => ({ playerId, career })),
          regulation: {
            sanctionedLastSeason: sanctionedLastSeasonRef.current,
            transferBan: transferBanRef.current,
            repeatOffenders: [...repeatOffendersRef.current].map(id => id as ClubId),
          },
          expectations: expectationsRef.current,
          headToHead: [...headToHeadRef.current].map(([clubId, record]) => ({
            clubId: clubId as ClubId, record,
          })),
          promises: promisesRef.current.map(p => ({
            promise: p,
            baseline: promiseBaselineRef.current.get(p.playerId as string) ?? 0,
          })),
          transferRequests: transferRequestsRef.current,
          ...(captainRef.current !== undefined ? { captainPlayerId: captainRef.current } : {}),
          squadStatuses: [...squadStatusRef.current].map(([playerId, status]) => ({ playerId, status })),
          rivals: {
            managers: rivalsRef.current.managers,
            byClub: [...rivalsRef.current.byClub].map(([clubId, managerId]) => ({ clubId, managerId })),
          },
          honours: honoursRef.current,
          loans: loansRef.current,
          direction: {
            facilities: facilitiesRef.current,
            plan: clubPlanRef.current,
            ...(ongoingProjectRef.current ? { ongoing: ongoingProjectRef.current } : {}),
          },
        },
      ));
      setSeasonSaveStatus('saved');
      // L'auto-save est silencieuse : la signaler à chaque journée serait du bruit.
      if (kind === 'manual') notify('Partie sauvegardée', 'success');
      setTimeout(() => setSeasonSaveStatus('idle'), 2500);
    } catch {
      setSeasonSaveStatus('error');
      notify('Échec de la sauvegarde', 'warn');
    }
  };

  // ---------------------------------------------------------------------------
  // V0.6 — Rollover : passage à la saison suivante
  // ---------------------------------------------------------------------------

  const onStartNextSeason = (): void => {
    const session = seasonRef.current;
    if (!session) return;
    const state = session.getState();
    if (state.phase !== 'over') return;

    // V0.9 — Archive la saison qui se termine dans l'historique de carrière
    if (state.champion) {
      const ranking = [...state.standings.values()].sort((a, b) => {
        if (b.leaguePoints !== a.leaguePoints) return b.leaguePoints - a.leaguePoints;
        return (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst);
      });
      const playerRank = ranking.findIndex(r => r.clubId === state.playerClubId) + 1;
      // Détecter le runner-up : finale = dernière entrée history avec round = FINAL
      const finalMatches = state.history.filter(h => h.round === state.playoffRounds.FINAL);
      const finalMatch = finalMatches.length > 0 ? finalMatches[finalMatches.length - 1] : undefined;
      const runnerUp = finalMatch
        ? (finalMatch.homeScore > finalMatch.awayScore ? finalMatch.awayClubId : finalMatch.homeClubId)
        : undefined;
      // Top scorer de la saison côté club joueur
      const playerRoster = state.playerClubRoster;
      let topScorerEntry: { playerId: import('../engine/types.js').PlayerId; tries: number } | undefined;
      for (const [pid, stat] of state.seasonPlayerStats.entries()) {
        if (!topScorerEntry || stat.tries > topScorerEntry.tries) {
          topScorerEntry = { playerId: pid, tries: stat.tries };
        }
      }
      const topScorerPlayer = topScorerEntry ? playerRoster.find(p => p.id === topScorerEntry!.playerId) : undefined;
      const seasonRecord: SeasonRecord = {
        seasonStart: state.currentSeason,
        champion: state.champion,
        ...(runnerUp ? { runnerUp } : {}),
        playerClubFinalRank: playerRank > 0 ? playerRank : 0,
        playerClubReachedFinal: state.history.some(h => h.round === state.playoffRounds.FINAL && (h.homeClubId === state.playerClubId || h.awayClubId === state.playerClubId)),
        playerClubChampion: state.champion === state.playerClubId,
        ...(topScorerPlayer && topScorerEntry && topScorerEntry.tries > 0 ? {
          topScorerOfSeason: {
            playerId: topScorerPlayer.id,
            playerName: `${topScorerPlayer.firstName} ${topScorerPlayer.lastName}`,
            clubId: topScorerPlayer.clubId,
            tries: topScorerEntry.tries,
          },
        } : {}),
      };
      careerHistoryRef.current = appendSeason(careerHistoryRef.current, seasonRecord);
      // V0.9 Phase 3 — vérifier l'objectif du board
      const objective = objectiveRef.current;
      const objectiveCheck = objective
        ? checkObjectiveMet({
            objective,
            playerClubFinalRank: seasonRecord.playerClubFinalRank,
            playerClubChampion: seasonRecord.playerClubChampion,
          })
        : { met: false, summary: '' };
      const objectiveMet = objectiveCheck.met;
      // V0.42 — la réputation d'avant, pour mesurer ce que la saison a rapporté.
      const reputationBefore = reputationRef.current.score;
      // V0.9 Phase 2 — update réputation manager
      reputationRef.current = updateReputation(reputationRef.current, {
        playerClubId: state.playerClubId,
        champion: state.champion,
        playerClubReachedFinal: seasonRecord.playerClubReachedFinal,
        playerClubFinalRank: seasonRecord.playerClubFinalRank,
        objectiveMet,
        ...(objectiveRef.current ? { objectiveTargetRank: objectiveRef.current.targetRank } : {}),
      });
      // V0.9 Phase 3 — update confiance board + check licenciement
      confidenceRef.current = updateBoardConfidence(
        confidenceRef.current,
        objectiveMet,
        seasonRecord.playerClubChampion,
      );
      // V0.41 — un limogeage rend libre au lieu de terminer la carrière.
      const careerBefore = careerRef.current;
      const clubNameNow = allClubs.find(c => c.id === state.playerClubId)?.name ?? 'Le club';
      const verdict = applyBoardVerdict(
        careerRef.current,
        confidenceRef.current.fired,
        state.currentSeason,
        clubNameNow,
        confidenceRef.current.consecutiveFailures,
        contractRef.current.patience,
      );
      careerRef.current = verdict.status;
      if (verdict.notice) setFiredNotice(verdict.notice);

      // V0.42 — la saison entre au parcours, et le président écrit son verdict.
      //
      // On archive même sans objectif connu (sauvegarde antérieure à V0.9) :
      // une ligne incomplète vaut mieux qu'un trou dans la carrière.
      const wasInCharge = careerBefore.kind === 'EN_POSTE';
      const fired = verdict.status.kind === 'LIBRE';
      const seasonVerdict: SeasonVerdict = fired
        ? 'LIMOGE'
        : objectiveMet ? 'RECONDUIT' : 'AVERTI';
      // Une saison passée sans club n'entre pas au parcours : on ne l'a pas
      // dirigée, et l'y consigner créditerait le manager d'un résultat qui ne
      // lui appartient pas.
      if (wasInCharge) managerCareerRef.current = appendManagerSeason(managerCareerRef.current, {
        season: state.currentSeason,
        clubId: state.playerClubId,
        clubName: clubNameNow,
        objectiveKind: objective?.kind ?? 'TOP_10',
        objectiveTargetRank: objective?.targetRank ?? 10,
        objectiveLabel: objective?.label ?? 'Non défini',
        finalRank: seasonRecord.playerClubFinalRank,
        objectiveMet,
        reachedFinal: seasonRecord.playerClubReachedFinal,
        wonTitle: seasonRecord.playerClubChampion,
        reputationAfter: reputationRef.current.score,
        reputationDelta: reputationRef.current.score - reputationBefore,
        boardConfidence: confidenceRef.current.score,
        verdict: seasonVerdict,
      });
      if (wasInCharge) sendMail([
        mailSeasonVerdict({
          season: state.currentSeason,
          clubId: state.playerClubId,
          clubName: clubNameNow,
          finalRank: seasonRecord.playerClubFinalRank,
          objectiveLabel: objective?.label ?? 'Non défini',
          objectiveMet,
          wonTitle: seasonRecord.playerClubChampion,
          verdict: seasonVerdict,
          boardConfidence: confidenceRef.current.score,
        }),
        mailMilestone({
          season: state.currentSeason,
          seasonsManaged: reputationRef.current.seasonsManaged,
          titles: reputationRef.current.titlesWon,
          reputation: reputationRef.current.score,
        }),
      ]);
    }

    // 1. Rollover : retraites + reset dynamic + vieillissement + free agents
    const allPlayers = listAllPlayersWithOverrides();
    // V0.14 — le rollover fait progresser les joueurs selon leur temps de jeu,
    // leur entraînement et la qualité du staff, au lieu d'une simple courbe d'âge.
    // V0.55 — les prêts s'achèvent avec la saison : chacun rentre, et on dit
    // franchement ce que son année a donné.
    for (const loan of loansRef.current) {
      const minutes = loanMinutes(loan, state.currentRound);
      publish([{
        season: state.currentSeason,
        round: 0,
        kind: 'TRANSFERT' as const,
        headline: `${loan.playerName} revient de prêt`,
        detail: loanReport(loan, minutes),
        clubId: state.playerClubId,
        involvesPlayer: true,
      }]);
    }

    const developmentInputs = session.getDevelopmentInputs();
    // V0.55 — les minutes disputées ailleurs comptent autant que celles
    // disputées ici : c'est tout l'intérêt d'un prêt.
    const withLoanMinutes = loansRef.current.length > 0
      ? {
        ...developmentInputs,
        minutesByPlayer: (() => {
          const map = new Map(developmentInputs.minutesByPlayer);
          for (const loan of loansRef.current) {
            const gained = loanMinutes(loan, state.currentRound);
            map.set(loan.playerId, (map.get(loan.playerId) ?? 0) + gained);
          }
          return map;
        })(),
      }
      : developmentInputs;

    const rollover = rolloverSeason({
      players: allPlayers,
      currentSeason: state.currentSeason,
      seed: seasonSeedRef.current,
      development: withLoanMinutes,
    });
    loansRef.current = [];
    setLoanEpoch(e => e + 1);
    developmentReportsRef.current = rollover.developmentReports;

    // 1bis. V0.7 — promo de jeunes par club
    const existingIds = new Set<string>(rollover.players.map(p => p.id as string));
    const youthByClub: Player[] = [];
    // V0.39 — le centre du club utilisateur suit son investissement ; les clubs
    // IA gardent le niveau dicté par leur taille.
    const playerAcademy = academyRef.current;
    for (const club of clubs) {
      const isMine = club.id === state.playerClubId;
      const intake = generateYouthIntake({
        club,
        currentSeason: rollover.newSeason,
        academyLevel: isMine ? Math.round(playerAcademy.level) : defaultAcademyLevel(club),
        ...(isMine ? { focus: playerAcademy.focus } : {}),
        seed: `${seasonSeedRef.current}_youth_${rollover.newSeason}`,
        existingPlayerIds: existingIds,
      });
      for (const p of intake) existingIds.add(p.id as string);
      youthByClub.push(...intake);
      // V0.42 — la promotion sortante du club était livrée sans un mot : on
      // découvrait les jeunes dans la liste d'effectif, sans savoir qu'ils
      // venaient d'arriver ni lequel valait le coup.
      if (isMine && intake.length > 0) {
        // V0.43 — on retient le niveau de sortie : c'est la seule référence qui
        // permette de mesurer plus tard ce que le jeune est devenu.
        prospectsRef.current = trackProspects(
          prospectsRef.current,
          intake.map(p => ({ playerId: p.id, overall: approximateOverall(p) })),
          rollover.newSeason,
          Math.round(playerAcademy.level),
        );
        const best = [...intake]
          .sort((a, b) => approximateOverall(b) - approximateOverall(a))[0]!;
        sendMail([mailAcademyIntake({
          season: rollover.newSeason,
          clubId: club.id,
          count: intake.length,
          bestName: `${best.firstName} ${best.lastName}`,
          bestLevel: Math.round(approximateOverall(best)),
          academyLevel: Math.round(playerAcademy.level),
        })]);
      }
    }
    const playersAfterIntake = [...rollover.players, ...youthByClub];

    // 2. Clôture des finances de la saison écoulée + nouvel encaissement sponsor pour chaque club
    const closedFinances = new Map<ClubId, import('../engine/club/finances.js').ClubFinances>();
    for (const [clubId, prev] of state.financesByClub.entries()) {
      const club = allClubs.find(c => c.id === clubId);
      if (!club) continue;
      let next = closeSeasonFinances(prev, rollover.newSeason);
      // V0.45 — le club de l'utilisateur encaisse selon sa politique
      // commerciale : sponsors majorés par la campagne, recettes de boutique,
      // et coût de cette même campagne. Les clubs IA gardent l'enveloppe sèche.
      if (clubId === state.playerClubId) {
        const standing = state.standings.get(clubId);
        const winsRatio = standing && standing.played > 0 ? standing.wins / standing.played : 0.5;
        next = applyFinancesMovement(next, {
          kind: 'SPONSOR',
          amount: sponsorRevenue(club, clubPlanRef.current),
          note: 'Sponsors + TV (saison)',
        });
        next = applyFinancesMovement(next, {
          kind: 'SPONSOR',
          amount: merchandisingRevenue({
            club, facilities: facilitiesRef.current, plan: clubPlanRef.current, winsRatio,
          }),
          note: 'Boutique et merchandising',
        });
        const campaign = commercialCost(clubPlanRef.current);
        if (campaign > 0) {
          next = applyFinancesMovement(next, {
            kind: 'TRANSFER_OUT',
            amount: -campaign,
            note: 'Campagne marketing',
          });
        }
      } else {
        next = applyFinancesMovement(next, {
          kind: 'SPONSOR',
          amount: club.annualBudget,
          note: 'Sponsors + TV (saison)',
        });
      }
      closedFinances.set(clubId, next);
    }

    // V0.48 — le président fait le point sur ce qu'il avait demandé en plus du
    // classement, puis fixe la feuille de route de l'exercice qui s'ouvre.
    const playerRosterEnd = playersAfterIntake.filter(
      p => p.clubId === state.playerClubId && !p.retired && !p.freeAgent,
    );
    const financesEnd = state.financesByClub.get(state.playerClubId);
    const situationEnd = clubSituation(
      playerRosterEnd,
      (financesEnd?.seasonRevenue ?? 0) - (financesEnd?.seasonExpenses ?? 0),
      state.currentSeason,
    );

    if (expectationsRef.current.length > 0 && careerRef.current.kind === 'EN_POSTE') {
      const results = judgeExpectations(expectationsRef.current, situationEnd);
      const delta = expectationConfidenceDelta(results);
      confidenceRef.current = {
        ...confidenceRef.current,
        score: Math.max(0, Math.min(100, confidenceRef.current.score + delta)),
      };
      sendMail([mailExpectationReview({
        season: state.currentSeason,
        clubId: state.playerClubId,
        clubName: allClubs.find(c => c.id === state.playerClubId)?.name ?? 'Le club',
        results: results.map(r => ({
          wording: r.expectation.wording,
          summary: r.summary,
          met: r.met,
        })),
        confidenceDelta: delta,
      })]);
    }

    // 2bis. V0.47 — la commission passe les comptes en revue, pour **tous** les
    // clubs.
    //
    // Deux points d'ordre, et ils comptent :
    //  - le contrôle porte sur l'effectif d'avant-mercato, donc sur la saison
    //    réellement jouée. Le faire après le marché ne verrait plus aucune
    //    infraction, puisque les clubs y dégraissent (V0.46) ;
    //  - il précède le mercato, pour qu'une interdiction de recruter s'applique
    //    à la fenêtre qui s'ouvre et non à celle de l'année suivante.
    const divisionPlayed = playerDivisionRef.current;
    const rosterAtSeasonEnd = (clubId: ClubId): readonly Player[] =>
      playersAfterIntake.filter(p => p.clubId === clubId && !p.retired && !p.freeAgent);

    const bannedClubs = new Set<ClubId>();
    const penalties = new Map<ClubId, number>();
    const nextRepeat = new Set<string>();

    for (const club of clubs) {
      const roster = rosterAtSeasonEnd(club.id);
      if (roster.length === 0) continue;

      const verdicts = reviewSeason({
        cap: capReport(roster, divisionPlayed),
        jiff: jiffReport(roster),
        repeatOffender: club.id === state.playerClubId
          ? sanctionedLastSeasonRef.current
          : repeatOffendersRef.current.has(club.id as string),
      });
      if (verdicts.length === 0) continue;

      nextRepeat.add(club.id as string);
      const points = verdicts.reduce((n, x) => n + x.pointsDeducted, 0);
      if (points > 0) penalties.set(club.id, points);
      if (verdicts.some(x => x.transferBan)) bannedClubs.add(club.id);

      const fine = verdicts.reduce((n, x) => n + x.fine, 0);
      if (fine > 0) {
        const f = closedFinances.get(club.id);
        if (f) {
          closedFinances.set(club.id, applyFinancesMovement(f, {
            kind: 'TRANSFER_OUT',
            amount: -fine,
            note: 'Amende de la commission',
          }));
        }
      }

      // Le championnat apprend chaque sanction : un club qui démarre la saison
      // suivante avec six points de retard doit avoir une raison lisible.
      for (const verdict of verdicts) {
        publish([{
          season: state.currentSeason,
          round: 0,
          kind: 'SAISON' as const,
          headline: `${club.name} sanctionné : ${sanctionSummary(verdict)}`,
          detail: verdict.reason,
          clubId: club.id,
          involvesPlayer: club.id === state.playerClubId,
        }]);
      }

      if (club.id === state.playerClubId) {
        sendMail([mailSanction({
          season: state.currentSeason,
          clubId: club.id,
          clubName: club.name,
          sanctions: verdicts.map(x => ({ summary: sanctionSummary(x), reason: x.reason })),
        })]);
      }
    }

    repeatOffendersRef.current = nextRepeat;
    sanctionedLastSeasonRef.current = nextRepeat.has(state.playerClubId as string);
    pointsPenaltyRef.current = penalties.get(state.playerClubId) ?? 0;
    transferBanRef.current = bannedClubs.has(state.playerClubId);
    pointsPenaltyByClubRef.current = penalties;

    // 2ter. V0.29 — mercato des clubs IA.
    //
    // Après les recettes de sponsors, sinon les clubs négocieraient sur la
    // trésorerie de l'an dernier. Et après la promotion des jeunes, pour qu'un
    // club qui vient de faire monter un espoir n'aille pas acheter un doublon
    // au même poste.
    const aiMarket = runAiMarket({
      players: playersAfterIntake,
      clubs,
      playerClubId: state.playerClubId,
      balanceByClub: new Map([...closedFinances].map(([id, f]) => [id, f.balance])),
      currentSeason: rollover.newSeason,
      rankedClubIds: session.getRanking().map(s => s.clubId),
      seed: seasonSeedRef.current,
      division: playerDivisionRef.current,
      transferBannedClubs: bannedClubs,
    });
    commitRoster(aiMarket.players);
    aiMarketRef.current = aiMarket.transfers;
    publish(newsFromMarket(
      aiMarket.transfers, rollover.newSeason, 0, state.playerClubId, 'Mercato estival',
    ));
    mailOwnMarket(
      aiMarket.transfers, rollover.newSeason, 0, state.playerClubId, 'Mercato estival',
    );

    // Les indemnités circulent réellement : ce qu'un club encaisse aujourd'hui,
    // il pourra le dépenser la saison prochaine.
    for (const [clubId, balance] of aiMarket.balanceByClub) {
      const finances = closedFinances.get(clubId);
      if (!finances || balance === finances.balance) continue;
      closedFinances.set(clubId, applyFinancesMovement(finances, {
        kind: balance > finances.balance ? 'TRANSFER_IN' : 'TRANSFER_OUT',
        amount: balance - finances.balance,
        note: 'Mercato',
      }));
    }

    // 2ter. V0.44 — montées et descentes.
    //
    // L'échange doit précéder la reconstruction de la session : c'est lui qui
    // décide de quels quatorze clubs se compose le championnat de la saison
    // suivante, et donc du calendrier.
    const leagueRanking = session.getRanking().map(r => r.clubId);
    const playedDivision = playerDivisionRef.current;
    const otherDivision: Division = playedDivision === 'TOP14' ? 'PRO_D2' : 'TOP14';

    // Force d'un effectif, pour le barrage et pour le championnat qu'on ne joue
    // pas. Un club sans joueur retomberait à zéro et descendrait chaque année.
    const playersByClub = new Map<string, number>();
    for (const p of playersAfterIntake) {
      if (p.retired || p.freeAgent) continue;
      const key = p.clubId as string;
      const prev = playersByClub.get(key);
      playersByClub.set(key, (prev ?? 0) + approximateOverall(p));
    }
    const countByClub = new Map<string, number>();
    for (const p of playersAfterIntake) {
      if (p.retired || p.freeAgent) continue;
      countByClub.set(p.clubId as string, (countByClub.get(p.clubId as string) ?? 0) + 1);
    }
    const strengthOf = (clubId: ClubId): number => {
      const total = playersByClub.get(clubId as string);
      const n = countByClub.get(clubId as string);
      return total !== undefined && n ? total / n : 50;
    };

    const shadowRanking = shadowSeason(
      clubsOfDivision(divisionsRef.current, otherDivision),
      strengthOf,
      shadowRng(seasonSeedRef.current, state.currentSeason, otherDivision),
    ).map(r => r.clubId);

    const promotions = resolvePromotions({
      top14Ranking: playedDivision === 'TOP14' ? leagueRanking : shadowRanking,
      proD2Ranking: playedDivision === 'PRO_D2' ? leagueRanking : shadowRanking,
      strengthOf,
    }, createRng(`promo_${seasonSeedRef.current}_${state.currentSeason}`));

    const divisionsBefore = divisionsRef.current;
    divisionsRef.current = exchangeClubs(
      divisionsRef.current, promotions.relegated, promotions.promoted,
    );
    const divisionBefore = playerDivisionRef.current;
    playerDivisionRef.current = divisionOf(divisionsRef.current, state.playerClubId);
    setDivisionEpoch(e => e + 1);

    // Le championnat de la saison qui s'ouvre — pas celui qu'on vient de finir.
    const byIdAll = new Map(allClubs.map(c => [c.id as string, c]));
    const nextLeagueClubs = clubsOfDivision(divisionsRef.current, playerDivisionRef.current)
      .map(id => byIdAll.get(id as string))
      .filter((c): c is Club => c !== undefined);

    publishPromotionNews(promotions, state.currentSeason, divisionsBefore);
    if (divisionBefore !== playerDivisionRef.current) {
      sendMail([mailDivisionChange({
        season: state.currentSeason,
        clubId: state.playerClubId,
        clubName: allClubs.find(c => c.id === state.playerClubId)?.name ?? 'Le club',
        promoted: playerDivisionRef.current === 'TOP14',
      })]);
    }

    // Un promu n'a pas de finances : il arrive d'une division que la session
    // précédente ne suivait pas.
    for (const c of nextLeagueClubs) {
      if (closedFinances.has(c.id)) continue;
      for (const [cid, f] of initFinancesForAllClubs([c], rollover.newSeason)) {
        closedFinances.set(cid, f);
      }
    }

    // V0.45 — les chantiers avancent d'une saison et se livrent à l'échéance.
    const projects = advanceProjects(
      facilitiesRef.current, ongoingProjectRef.current, rollover.newSeason,
    );
    facilitiesRef.current = projects.facilities;
    ongoingProjectRef.current = projects.ongoing;
    setDirectionEpoch(e => e + 1);
    if (projects.delivered) {
      const label = PROJECT_LABEL[projects.delivered.kind];
      publish([{
        season: rollover.newSeason,
        round: 0,
        kind: 'SAISON' as const,
        headline: `${label} livré — niveau ${projects.delivered.targetLevel}`,
        clubId: state.playerClubId,
        involvesPlayer: true,
      }]);
      notify(`${label} livré.`, 'success');
    }

    // 3. Recrée une SeasonSession neuve pour la nouvelle saison
    const newSeed = `${seasonSeedRef.current}_s${rollover.newSeason}`;
    seasonSeedRef.current = newSeed;
    seasonRef.current = createSeasonSession({
      clubIds: nextLeagueClubs.map(c => c.id),
      playerClubId: state.playerClubId,
      seed: newSeed,
      buildMatchInput: (homeId, awayId) => makeMatchInput({
        homeClubId: homeId,
        awayClubId: awayId,
        ...weatherForSim(homeId),
        matchId: `s_${newSeed}_${homeId}_${awayId}`,
      }),
      playerClubRoster: listRoster(state.playerClubId),
      currentSeason: rollover.newSeason,
      allClubs: nextLeagueClubs,
      rosterByClub: (cid) => listRoster(cid),
      // V0.58 — le XV de France se recrute dans les deux divisions.
      nationalPool: () => listAllPlayersWithOverrides(),
      nationalPicks: () => nationalPicksRef.current,
      clubDirection: () => ({ facilities: facilitiesRef.current, plan: clubPlanRef.current }),
      wantAwayIds: () => transferRequestsRef.current
        .filter(r => r.status === 'SUR_LA_LISTE')
        .map(r => r.playerId),
      squadStatuses: () => squadStatusRef.current,
      // V0.13 — la qualification européenne dépend du classement qu'on vient de finir.
      // V0.44 — mais elle n'existe pas en Pro D2 : ne rien transmettre est ce
      // qui coupe la coupe d'Europe, plutôt qu'un rang bidon.
      ...(playerDivisionRef.current === 'TOP14' && lastSeasonRank() !== undefined
        ? { previousSeasonRank: lastSeasonRank()! } : {}),
      restoreFrom: {
        currentRound: 1,
        history: [],
        // Le retrait de points s'applique à la saison **suivante** : retirer des
        // points d'un classement déjà clos ne changerait rien, et la sanction
        // doit peser sur une course en train de se jouer.
        // V0.47 — le retrait frappe chaque club sanctionné, pas seulement
        // celui de l'utilisateur : sinon la sanction serait un handicap
        // réservé au joueur.
        standings: [...pointsPenaltyByClubRef.current]
          .filter(([clubId]) => nextLeagueClubs.some(c => c.id === clubId))
          .map(([clubId, points]) => ({
            clubId,
            played: 0, wins: 0, draws: 0, losses: 0,
            pointsFor: 0, pointsAgainst: 0, tryBonus: 0, losingBonus: 0,
            leaguePoints: -points,
          })),
        financesByClub: closedFinances,
      },
    });

    // V0.9 Phase 3 — recalcule l'objectif pour la nouvelle saison
    const playerClubAfter = allClubs.find(c => c.id === state.playerClubId);
    if (playerClubAfter) {
      objectiveRef.current = computeObjective(
        playerClubAfter, reputationRef.current.score, playerDivisionRef.current,
      );
      // V0.48 — la feuille de route accompagne la mission.
      expectationsRef.current = careerRef.current.kind === 'EN_POSTE'
        ? computeExpectations(playerClubAfter, situationEnd)
        : [];

      // V0.49 — les demandes de départ ne traversent pas l'intersaison : celui
      // qui n'est pas parti pendant la fenêtre repart d'une page blanche, et
      // sans cela un joueur invendu resterait « sur la liste » à vie.
      transferRequestsRef.current = [];
      setRequestEpoch(e => e + 1);

      // V0.42 — la mission de l'exercice qui s'ouvre est notifiée par écrit. Un
      // manager limogé n'en reçoit pas : il n'a plus de président.
      if (careerRef.current.kind === 'EN_POSTE') {
        sendMail([mailObjectiveSet({
          season: state.currentSeason + 1,
          clubId: playerClubAfter.id,
          clubName: playerClubAfter.name,
          objectiveKind: objectiveRef.current.kind,
          objectiveLabel: objectiveRef.current.label,
          boardConfidence: confidenceRef.current.score,
          seasonsAtClub: managerCareerRef.current.seasons
            .filter(s => s.clubId === playerClubAfter.id).length,
        })]);
      }
    }
    // V0.41 — la valse des entraîneurs, puis les portes qui s'ouvrent au manager.
    const finalRanks = new Map<ClubId, number>(
      session.getRanking().map((r, i) => [r.clubId, i + 1]),
    );
    const sackings = sackedCoaches(
      clubs, finalRanks, state.playerClubId,
      createRng(`coaches_${seasonSeedRef.current}_${state.currentSeason}`),
    );
    // V0.53 — le palmarès individuel, avant tout le reste : c'est le rituel qui
    // clôt la saison, et il se calcule sur les statistiques du championnat
    // entier, pas sur celles du seul club dirigé.
    const honours = computeHonours({
      players: listAllPlayersWithOverrides(),
      stats: state.seasonPlayerStats,
      currentSeason: state.currentSeason,
      roundsPlayed: state.currentRound,
      clubNameOf: p => allClubs.find(c => c.id === p.clubId)?.name ?? '—',
    });
    honoursRef.current = [...honoursRef.current, honours];

    // V0.59 — on consigne la saison dans le registre de carrière. C'est ici, et
    // pas plus tôt, parce qu'il faut les honneurs : une ligne de saison porte
    // aussi les titres individuels.
    (() => {
      const enLoan = new Set(loansRef.current.map(l => l.playerId as string));
      const entries: SeasonEntry[] = [];
      for (const player of listAllPlayersWithOverrides()) {
        const stat = state.seasonPlayerStats.get(player.id);
        const titres = honoursOf([honours], player.id).map(h => h.label);
        // Les capes du registre sont celles gagnées **cette saison-là**. Les
        // déduire du cumul serait faux : il contient le passé estimé au
        // démarrage de la partie.
        const capsSaison = state.capsThisSeason.get(player.id) ?? 0;
        entries.push({
          playerId: player.id,
          playerName: `${player.firstName} ${player.lastName}`,
          clubId: player.clubId,
          matches: stat?.matches ?? 0,
          minutes: stat?.minutes ?? 0,
          tries: stat?.tries ?? 0,
          caps: capsSaison,
          honours: titres,
          ...(enLoan.has(player.id as string) ? { onLoan: true } : {}),
        });
      }
      careerBookRef.current = recordSeason(careerBookRef.current, state.currentSeason, entries);
    })();

    const nôtres = [
      honours.bestPlayer, honours.bestYoungPlayer, honours.topTryScorer,
      ...honours.teamOfTheSeason,
    ]
      .filter((l): l is NonNullable<typeof l> => l !== undefined)
      .filter(l => listRoster(state.playerClubId).some(p => p.id === l.playerId))
      .map(l => l.playerName);

    sendMail([mailHonours({
      season: state.currentSeason,
      clubId: state.playerClubId,
      ...(honours.bestPlayer
        ? { bestPlayer: { name: honours.bestPlayer.playerName, clubName: honours.bestPlayer.clubName } }
        : {}),
      ...(honours.bestYoungPlayer
        ? { bestYoung: { name: honours.bestYoungPlayer.playerName, clubName: honours.bestYoungPlayer.clubName } }
        : {}),
      ...(honours.topTryScorer
        ? {
          topScorer: {
            name: honours.topTryScorer.playerName,
            clubName: honours.topTryScorer.clubName,
            tries: Number((honours.topTryScorer.line.match(/(\d+)/) ?? ['0'])[0]),
          },
        }
        : {}),
      ownLaureates: [...new Set(nôtres)],
    })]);

    if (honours.bestPlayer) {
      publish([{
        season: state.currentSeason,
        round: 0,
        kind: 'SAISON' as const,
        headline: `${honours.bestPlayer.playerName} élu meilleur joueur du championnat`,
        detail: `${honours.bestPlayer.clubName} — ${honours.bestPlayer.line}.`,
        involvesPlayer: false,
      }]);
    }

    // V0.53 — la valse porte enfin des noms. On juge d'abord la saison de
    // chacun, puis on limoge, puis on repourvoit : dans cet ordre, sans quoi un
    // limogé serait jugé sur un banc qu'il vient de quitter.
    for (const [clubId, rank] of finalRanks) {
      const club = clubs.find(c => c.id === clubId);
      if (!club || clubId === state.playerClubId) continue;
      rivalsRef.current = reviewRivalSeason(
        rivalsRef.current, clubId, rank,
        // L'attente : un club se juge sur le rang que sa stature laisse espérer.
        Math.max(1, Math.round(15 - clubStature(club) / 7)),
      );
    }

    publish(sackings.map(sk => {
      const partant = managerOf(rivalsRef.current, sk.clubId);
      rivalsRef.current = sackRival(rivalsRef.current, sk.clubId).state;
      return {
        season: state.currentSeason,
        round: 0,
        kind: 'SAISON' as const,
        headline: partant
          ? `${sk.clubName} se sépare de ${partant.name}`
          : `${sk.clubName} se sépare de son entraîneur`,
        detail: sk.reason,
        clubId: sk.clubId,
        involvesPlayer: false,
      };
    }));

    // V0.59 — le bilan du sélectionneur. On juge sur le Tournoi : une tournée
    // d'automne manquée contre les Néo-Zélandais ne coûte sa place à personne.
    if (careerRef.current.kind === 'SELECTIONNEUR') {
      const poste = careerRef.current;
      const tournoi = windowReportsRef.current.find(r => r.window === 'TOURNOI');
      const bilan = reviewNationalSeason({
        tournament: tournoi,
        consecutiveFailures: poste.failures,
      });
      reputationRef.current = {
        ...reputationRef.current,
        score: Math.max(0, Math.min(100, reputationRef.current.score + bilan.reputationDelta)),
      };
      sendMail([{
        season: state.currentSeason,
        round: 0,
        sender: 'FEDERATION',
        subject: bilan.dismissed
          ? 'Il est mis fin à votre mission'
          : `Bilan de la saison internationale — ${bilan.verdict.toLowerCase()}`,
        body: bilan.dismissed
          ? `${bilan.summary}\n\nLe comité a décidé de confier le groupe à quelqu'un d'autre. Nous vous remercions pour ces saisons.`
          : bilan.summary,
        importance: bilan.dismissed ? 'HAUTE' : 'NORMALE',
      }]);
      careerRef.current = bilan.dismissed
        ? { kind: 'LIBRE', since: state.currentSeason + 1, reason: 'LIMOGE' }
        : { ...poste, failures: bilan.verdict === 'INSUFFISANT' ? poste.failures + 1 : 0 };
      windowReportsRef.current = [];
      nationalPicksRef.current = { added: [], removed: [] };
    }

    // Un manager sans club ne reste pas indéfiniment désirable.
    if (careerRef.current.kind === 'LIBRE') {
      reputationRef.current = idleReputationDecay(reputationRef.current);
    }

    // Les bancs déjà libérés pendant une année sabbatique restent ouverts : un
    // poste vacant en février ne se repourvoit pas tout seul en juin.
    const knownVacancies = new Set(vacanciesRef.current.map(id => id as string));
    vacanciesRef.current = [
      ...vacanciesRef.current,
      ...sackings.map(sk => sk.clubId).filter(id => !knownVacancies.has(id as string)),
    ];

    const offers = contestVacancies(jobOffersFor({
      clubs,
      vacancies: vacanciesRef.current,
      reputation: reputationRef.current,
      status: careerRef.current,
    }), state.currentSeason);
    // V0.53 — les bancs que le manager ne peut pas prendre trouvent preneur
    // tout de suite. Sans cela, un manager qui ne reçoit jamais d'offre voyait
    // les vacances s'empiler d'année en année.
    refillVacantBenches(state.currentSeason, offers.map(o => o.clubId));
    setPendingOffers(offers);

    // V0.59 — la fédération, elle, n'écrit pas tous les ans. Le poste ne se
    // cumule pas : la lettre le dit franchement, sans quoi ce serait un piège
    // et non une proposition.
    if (federationApproaches({
      reputation: reputationRef.current,
      vacant: (state.currentSeason - 2024) % 4 === 0,
      alreadyInPost: careerRef.current.kind === 'SELECTIONNEUR',
    })) {
      const clubActuel = careerRef.current.kind === 'EN_POSTE'
        ? allClubs.find(c => c.id === (careerRef.current as { clubId: ClubId }).clubId)?.name
        : undefined;
      setNationalOffer({
        season: state.currentSeason,
        letter: federationLetter(reputationRef.current, clubActuel),
      });
      sendMail([{
        season: state.currentSeason,
        round: 0,
        sender: 'FEDERATION',
        subject: 'Le banc du XV de France vous est proposé',
        body: federationLetter(reputationRef.current, clubActuel),
        importance: 'HAUTE',
      }]);
    }
    // La modale ne dure que le temps d'un clic ; le mail, lui, reste consultable
    // après coup — y compris quand on a décliné et qu'on regrette.
    sendMail([mailJobOffers({
      season: state.currentSeason,
      clubNames: offers.map(o => o.clubName),
      unemployed: careerRef.current.kind === 'LIBRE',
    })]);

    publish(newsFromSeasonEnd({
      season: state.currentSeason,
      championName: state.champion ? (allClubs.find(c => c.id === state.champion)?.name) : undefined,
      playerClubName: allClubs.find(c => c.id === state.playerClubId)?.name ?? 'Le club',
      playerRank: session.getRanking().findIndex(r => r.clubId === state.playerClubId) + 1,
      playerClubId: state.playerClubId,
    }));

    // V0.59 — un joueur du club qui raccroche mérite qu'on le salue. Jusqu'ici
    // il disparaissait de l'effectif sans une ligne, ce qui rendait vaines les
    // huit saisons qu'on avait passées à le construire.
    for (const partiId of rollover.retired) {
      const parti = listAllPlayersWithOverrides().find(p => p.id === partiId);
      if (!parti || parti.clubId !== state.playerClubId) continue;
      sendMail([{
        season: state.currentSeason,
        round: 0,
        sender: 'DIRECTION_SPORTIVE',
        subject: `${parti.firstName} ${parti.lastName} met un terme à sa carrière`,
        body: retirementTribute(careerBookRef.current.get(parti.id), parti.lastName),
        importance: careerBookRef.current.has(parti.id) ? 'HAUTE' : 'NORMALE',
        clubId: state.playerClubId,
      }]);
    }

    setRolloverSummary({
      retiredCount: rollover.retired.length,
      freeAgentCount: rollover.freeAgents.length,
      youthCount: youthByClub.length,
      newSeason: rollover.newSeason,
    });
    winterMarketRef.current = null;

    // V0.39 — le centre converge vers le niveau visé, et sa facture tombe.
    const myClub = allClubs.find(c => c.id === state.playerClubId);
    if (myClub) {
      const before = academyRef.current;
      academyRef.current = advanceAcademy(before, myClub);
      const cost = academyCost(before.investment, myClub);
      const finances = closedFinances.get(state.playerClubId);
      if (finances) {
        closedFinances.set(state.playerClubId, applyFinancesMovement(finances, {
          kind: 'PAYROLL',
          amount: -cost,
          note: 'Centre de formation',
        }));
      }
      seasonRef.current?.setAcademyPlan(before);
    }

    setSeasonSaveStatus('idle');
    refreshSeason();
  };

  /**
   * V0.30 — mercato d'hiver, joué une seule fois par saison à l'ouverture de la
   * fenêtre.
   *
   * Le garde-fou par saison compte : cette fonction est appelée après chaque
   * avancée de journée, et rejouer le marché à chaque passage sur la J13
   * viderait les effectifs.
   */
  /**
   * V0.38 — consigne ce qui mérite d'être retenu de la journée écoulée : les
   * blessures longues et les scores hors norme. Appelé après chaque avancée,
   * le journal écartant lui-même les doublons.
   */
  /**
   * V0.58 — ce que la sélection nationale change pour le club.
   *
   * Une sélection n'était qu'une absence : on la traite désormais comme ce
   * qu'elle est — une reconnaissance pour le joueur, une nouvelle pour le
   * championnat, et une facture de fatigue au retour.
   */
  const announcedWindowRef = useRef<string | null>(null);
  const publishInternational = (
    state: ReturnType<NonNullable<typeof seasonRef.current>['getState']>,
  ): void => {
    const squad = state.nationalSquad;
    if (squad) {
      // Une annonce par fenêtre et par saison : la liste tombe une fois.
      const key = `${state.currentSeason}_${state.currentRound <= 10 ? 'AUTOMNE' : 'TOURNOI'}`;
      if (announcedWindowRef.current !== key) {
        announcedWindowRef.current = key;
        const selected = new Set(squad.players.map(id => id as string));
        const mine = state.playerClubRoster.filter(p => selected.has(p.id as string));
        if (mine.length > 0) {
          const label = state.currentRound <= 10 ? 'la tournée d\'automne' : 'le Tournoi des 6 Nations';
          const item = newsFromSelection({
            season: state.currentSeason,
            round: state.currentRound,
            clubId: state.playerClubId,
            windowLabel: label,
            selectedNames: mine.map(p => `${p.firstName} ${p.lastName}`),
            newCapNames: mine
              .filter(p => squad.newCaps.includes(p.id))
              .map(p => `${p.firstName} ${p.lastName}`),
          });
          if (item) publish([item]);

          // Être sélectionné se ressent dans le vestiaire, et une première
          // sélection plus longtemps qu'une routine.
          commitRoster(listAllPlayersWithOverrides().map(p => {
            if (!selected.has(p.id as string)) return p;
            const premiere = squad.newCaps.includes(p.id);
            return {
              ...p,
              dynamic: {
                ...p.dynamic,
                moodModifiers: pushMoodEvent(p.dynamic.moodModifiers, {
                  source: 'RECONNAISSANCE',
                  delta: premiere ? 12 : 7,
                  reason: premiere ? 'Première sélection en équipe de France' : 'Sélectionné en équipe de France',
                  expiresAt: state.currentRound + (premiere ? MOOD_LONG : MOOD_MEDIUM),
                }),
              },
            };
          }));

          const nouveaux = mine.filter(p => squad.newCaps.includes(p.id));
          notify(
            nouveaux.length > 0
              ? `${nouveaux.map(p => p.lastName).join(', ')} — première sélection en équipe de France`
              : `${mine.length} joueur${mine.length > 1 ? 's' : ''} du club en sélection`,
            'success',
          );
        }
      }
    }

    const report = state.latestWindowReport;
    if (report && publishedWindowRef.current !== `${state.currentSeason}_${report.window}`) {
      publishedWindowRef.current = `${state.currentSeason}_${report.window}`;
      windowReportsRef.current = [...windowReportsRef.current, report];
      publish([newsFromInternationalWindow({
        season: state.currentSeason,
        round: state.currentRound,
        headline: report.headline,
        scores: report.results.map(r =>
          `France ${r.franceScore}-${r.opponentScore} ${r.opponent}`),
      })]);
    }
  };
  const publishedWindowRef = useRef<string | null>(null);

  /**
   * V0.58 — le public du jour, pour la feuille de match.
   *
   * On ne le calcule que pour les rencontres à domicile du club dirigé : c'est
   * le seul stade dont on connaît la politique tarifaire, le marketing et les
   * travaux. Ailleurs, `MOYEN` — le point neutre.
   */
  const crowdForHomeMatch = (homeClubId: string, playerIsHome: boolean): CrowdLevel => {
    const session = seasonRef.current;
    const club = allClubs.find(c => (c.id as string) === homeClubId);
    if (!playerIsHome || !session || !club) return 'MOYEN';
    const st = session.getState().standings.get(club.id);
    const winsRatio = st && st.played > 0 ? st.wins / st.played : 0.5;
    const revenue = matchdayRevenue({
      club, facilities: facilitiesRef.current, plan: clubPlanRef.current, winsRatio,
    });
    return crowdFromFillRate(revenue.fillRate);
  };

  const publishRoundNews = (): void => {
    const session = seasonRef.current;
    if (!session) return;
    const state = session.getState();

    for (const injury of state.latestInjuries) {
      const player = state.playerClubRoster.find(p => p.id === injury.playerId);
      const returnsAt = player?.dynamic.injury?.estimatedReturnAt;
      if (!player || returnsAt === undefined) continue;
      if (returnsAt - state.currentRound < LONG_TERM_INJURY_ROUNDS) continue;
      publish([newsFromInjury({
        playerName: `${player.firstName} ${player.lastName}`,
        injuryType: player.dynamic.injury!.type,
        returnsAtRound: returnsAt,
        season: state.currentSeason,
        round: state.currentRound,
        clubId: state.playerClubId,
      })]);
      // Le championnat apprend l'absence ; le manager reçoit le diagnostic.
      sendMail([mailInjury({
        season: state.currentSeason,
        round: state.currentRound,
        clubId: state.playerClubId,
        playerName: `${player.firstName} ${player.lastName}`,
        injuryType: player.dynamic.injury!.type,
        returnsAtRound: returnsAt,
      })]);
    }

    // V0.56 — une brouille de vestiaire vient d'éclater. On ne le signale qu'au
    // moment de la bascule : la tension monte sur des mois, l'alerte est un
    // événement.
    for (const rift of state.latestRivalries) {
      const frustrated = state.playerClubRoster.find(p => p.id === rift.frustrated);
      const ahead = state.playerClubRoster.find(p => p.id === rift.ahead);
      if (!frustrated || !ahead) continue;
      sendMail([mailSquadRift({
        season: state.currentSeason,
        round: state.currentRound,
        clubId: state.playerClubId,
        frustratedName: `${frustrated.firstName} ${frustrated.lastName}`,
        aheadName: `${ahead.firstName} ${ahead.lastName}`,
        position: positionLabel(frustrated.position),
      })]);
      notify(
        `${frustrated.lastName} ne supporte plus d'être derrière ${ahead.lastName}.`,
        'warn',
      );
    }

    // V0.58 — la liste du XV de France, quand elle vient de tomber, et le
    // bilan de la fenêtre quand elle se referme. Deux moments seulement : une
    // sélection annoncée chaque journée cesserait d'être un événement.
    publishInternational(state);

    // V0.48 — la mémoire du derby se met à jour au coup de sifflet final.
    const lastPlayed = state.history.filter(h => h.playerPlayed).slice(-1)[0];
    if (lastPlayed) {
      const atHome = lastPlayed.homeClubId === state.playerClubId;
      const opponent = atHome ? lastPlayed.awayClubId : lastPlayed.homeClubId;
      if (rivalryBetween(state.playerClubId, opponent)) {
        const mine = atHome ? lastPlayed.homeScore : lastPlayed.awayScore;
        const theirs = atHome ? lastPlayed.awayScore : lastPlayed.homeScore;
        const outcome = mine > theirs ? 'V' : mine < theirs ? 'D' : 'N';
        const key = opponent as string;
        headToHeadRef.current = new Map(headToHeadRef.current).set(
          key,
          recordResult(headToHeadRef.current.get(key) ?? EMPTY_HEAD_TO_HEAD, outcome),
        );
      }
    }

    const last = state.history.filter(h => h.playerPlayed).slice(-1)[0];
    if (last) {
      const atHome = last.homeClubId === state.playerClubId;
      const entry = newsFromResult({
        season: state.currentSeason,
        round: last.round,
        opponentName: allClubs.find(c => c.id === (atHome ? last.awayClubId : last.homeClubId))?.name ?? '—',
        myScore: atHome ? last.homeScore : last.awayScore,
        theirScore: atHome ? last.awayScore : last.homeScore,
        atHome,
        clubId: state.playerClubId,
      });
      if (entry) publish([entry]);
    }

    maybeSolicitManager(state);
    // V0.48 — une promesse se règle au fil des journées, jamais à l'intersaison :
    // attendre l'été rendrait l'engagement abstrait.
    settlePromises();
  };

  /**
   * V0.48 — engage la conversation avec un joueur.
   *
   * Le moral bouge tout de suite ; une promesse, elle, s'inscrit et se règle
   * six journées plus tard. C'est cette dette différée qui fait qu'on hésite.
   */
  const talkToPlayer = (player: Player, topic: TalkTopic): void => {
    const session = seasonRef.current;
    if (!session) return;
    const state = session.getState();

    const outcome = resolvePlayerTalk({
      player,
      topic,
      context: {
        playRatio: playRatioByPlayerForPlayerClub().get(player.id as string) ?? 0.5,
        forme: player.dynamic.forme,
        mood: player.dynamic.mood,
        currentRound: state.currentRound,
      },
      rng: createRng(`talk_${seasonSeedRef.current}_${player.id as string}_${state.currentRound}_${topic}`),
    });

    applyMoodDelta(
      player.id, outcome.moodDelta,
      `Conversation : ${TOPIC_LABEL[topic].toLowerCase()}`,
      'VIE_PRIVEE', MOOD_SHORT,
    );

    if (outcome.promise) {
      // Une seule promesse en cours par joueur : en empiler plusieurs rendrait
      // la dette illisible et permettrait de racheter une trahison par une
      // nouvelle promesse.
      const played = state.seasonPlayerStats.get(player.id)?.matches ?? 0;
      promisesRef.current = [
        ...promisesRef.current.filter(p => p.playerId !== player.id),
        outcome.promise,
      ];
      promiseBaselineRef.current = new Map(promiseBaselineRef.current)
        .set(player.id as string, played);
    }

    setLastTalkOutcome({ playerId: player.id, outcome });
    refreshSeason();
  };

  /**
   * V0.50 — annonce un rôle à un joueur.
   *
   * L'annonce est gratuite ; c'est la tenir qui coûte. Le moral se recalcule
   * dès le rendu suivant, sur l'écart entre ce qu'on vient de dire et ce que le
   * joueur vit réellement.
   */
  const setSquadStatus = (playerId: PlayerId, status: SquadStatus): void => {
    const avant = squadStatusRef.current.get(playerId);
    squadStatusRef.current = new Map(squadStatusRef.current).set(playerId, status);
    setStatusEpoch(e => e + 1);

    // V0.53 — écarter quelqu'un du projet se voit dans tout le vestiaire.
    if (status === 'HORS_PROJET' && avant !== 'HORS_PROJET' && seasonRef.current) {
      const player = listRoster(seasonRef.current.getState().playerClubId)
        .find(p => p.id === playerId);
      if (player) shakeRoom(player, 'MIS_A_L_ECART');
    }
  };

  /**
   * V0.53 — un banc convoité ne vous attend pas.
   *
   * Chaque poste vacant est d'abord proposé aux entraîneurs sans club. Si l'un
   * d'eux est nettement mieux coté que vous, il signe et l'offre vous passe
   * sous le nez — c'est ce qui donne enfin un sens à votre réputation : elle ne
   * sert plus seulement à ouvrir des portes, elle se **compare**.
   */
  const contestVacancies = (
    offers: readonly JobOffer[],
    season: number,
  ): readonly JobOffer[] => {
    const kept: typeof offers[number][] = [];
    for (const offer of offers) {
      const rival = contestedBy(
        rivalsRef.current, offer.stature, reputationRef.current.score,
      );
      if (!rival) { kept.push(offer); continue; }

      const club = allClubs.find(c => c.id === offer.clubId);
      if (club) {
        rivalsRef.current = fillVacancy(
          rivalsRef.current, club, offer.stature,
          createRng(`vacance_${seasonSeedRef.current}_${season}_${offer.clubId as string}`),
        ).state;
      }
      vacanciesRef.current = vacanciesRef.current.filter(id => id !== offer.clubId);
      publish([{
        season,
        round: 0,
        kind: 'SAISON' as const,
        headline: `${offer.clubName} nomme ${rival.name}`,
        detail: rival.reputationLine,
        clubId: offer.clubId,
        involvesPlayer: false,
      }]);
    }
    setRivalEpoch(e => e + 1);
    return kept;
  };

  /**
   * V0.51 — le temps qu'il fait pour une rencontre donnée.
   *
   * Déterministe sur (graine de carrière, saison, journée, stade) : recharger
   * une sauvegarde ne doit pas changer les conditions du match qu'on s'apprête
   * à jouer, sinon la préparation ne veut plus rien dire.
   */
  const weatherFor = (season: number, round: number, homeClubId: string) =>
    generateWeather({
      round,
      homeClubId,
      rng: createRng(`meteo_${seasonSeedRef.current}_${season}_${round}_${homeClubId}`),
    });

  /**
   * Conditions d'un match simulé du championnat.
   *
   * Le calendrier fait jouer toutes les rencontres d'une journée le même
   * week-end : il pleut donc sur les autres stades comme sur le nôtre, chacun
   * selon sa région. La saison et la journée se lisent sur la session, qui est
   * toujours en place au moment où ce rappel est invoqué.
   */
  /**
   * V0.52 — l'homme au sifflet, désigné comme la météo.
   *
   * Déterministe sur (graine, saison, journée, stade) : le dossier d'avant-match
   * annonce un arbitre, et c'est celui-là qu'on retrouve au coup d'envoi.
   */
  const refereeForMatch = (season: number, round: number, homeClubId: string) =>
    refereeFor(createRng(`arbitre_${seasonSeedRef.current}_${season}_${round}_${homeClubId}`));

  const weatherForSim = (homeClubId: string) => {
    const st = seasonRef.current?.getState();
    return weatherFor(st?.currentSeason ?? 2025, st?.currentRound ?? 1, homeClubId);
  };

  /** Applique une variation de moral durable à un joueur du club. */
  const applyMoodDelta = (
    playerId: PlayerId,
    delta: number,
    reason: string,
    source: MoodModifier['source'] = 'VIE_PRIVEE',
    duration: number = MOOD_MEDIUM,
  ): void => {
    if (delta === 0) return;
    const session = seasonRef.current;
    const round = session?.getState().currentRound ?? 0;

    const next = listAllPlayersWithOverrides().map(p => p.id === playerId
      ? {
        ...p,
        dynamic: {
          ...p.dynamic,
          moodModifiers: pushMoodEvent(p.dynamic.moodModifiers, {
            source, delta, reason, expiresAt: round + duration,
          }),
        },
      }
      : p);
    commitRoster(refreshMoods(next));
  };

  /**
   * V0.54 — recalcule le moral stocké de tout l'effectif dirigé.
   *
   * C'est ici que les deux morals du jeu n'en font plus qu'un : `dynamic.mood`
   * cesse d'être un compteur indépendant pour devenir **le résultat** de
   * `computeMood()` — sept sources plus événements encore actifs. Le moteur de
   * match lit donc exactement ce que l'écran d'effectif affiche.
   *
   * On ne touche qu'au club dirigé : le moral d'un joueur adverse n'a ni
   * historique d'événements ni relations connues, et le recalculer
   * l'écraserait à sa valeur de base.
   */
  const refreshMoods = (players: readonly Player[]): readonly Player[] => {
    const session = seasonRef.current;
    if (!session) return players;
    const state = session.getState();
    const clubId = state.playerClubId;
    const ratios = playRatioByPlayerForPlayerClub();
    const results = recentResultsForPlayer();

    return players.map(p => {
      if (p.clubId !== clubId || p.retired) return p;
      const playRatio = ratios.get(p.id as string) ?? 0.5;
      const { mood } = computeMood({
        player: p,
        recentResults: results,
        playRatio,
        currentSeason: state.currentSeason,
        currentRound: state.currentRound,
        relationsFactors: computeRelationsForMood(state.relations, p.id),
        isCaptain: p.id === captainRef.current,
        squadStatus: statusOf(squadStatusRef.current, p, playRatio, state.currentSeason),
      });
      // On purge en même temps : sans cela, une carrière de vingt saisons
      // traînerait des centaines de modificateurs périmés dans chaque
      // sauvegarde, tous inertes.
      const kept = pruneMoodEvents(p.dynamic.moodModifiers, state.currentRound);
      if (mood === p.dynamic.mood && kept.length === p.dynamic.moodModifiers.length) return p;
      return { ...p, dynamic: { ...p.dynamic, mood, moodModifiers: kept } };
    });
  };

  /**
   * V0.48 — fait les comptes des promesses arrivées à échéance.
   *
   * Appelé à chaque journée : une promesse tenue se solde dès que le temps de
   * jeu suit, une promesse trahie attend l'échéance pour tomber.
   */
  const settlePromises = (): void => {
    const session = seasonRef.current;
    if (!session) return;
    const state = session.getState();
    const remaining: PlayerPromise[] = [];

    for (const promise of promisesRef.current) {
      const baseline = promiseBaselineRef.current.get(promise.playerId as string) ?? 0;
      const played = (state.seasonPlayerStats.get(promise.playerId)?.matches ?? 0) - baseline;
      const verdict = judgePromise(promise, played, state.currentRound);

      if (verdict === 'EN_COURS') {
        remaining.push(promise);
        continue;
      }

      const settled = promiseOutcome(verdict);
      applyMoodDelta(
        promise.playerId, settled.moodDelta,
        verdict === 'TENUE' ? 'Promesse tenue' : 'Promesse trahie',
        'STATUT_EQUIPE', verdict === 'TENUE' ? MOOD_MEDIUM : MOOD_LONG,
      );
      notify(`${promise.playerName} — ${settled.narrative}`, verdict === 'TENUE' ? 'success' : 'warn');

      if (verdict === 'TRAHIE') settleBetrayal(promise, state.currentRound);
    }

    promisesRef.current = remaining;
  };

  /**
   * V0.49 — les suites d'une promesse trahie.
   *
   * Le vestiaire prend toujours quelque chose : une parole non tenue se sait,
   * et sans cela il suffirait de promettre à tout le monde en n'assumant qu'une
   * baisse de moral isolée. Le joueur, lui, ne demande à partir que si son
   * tempérament l'y pousse.
   */
  const settleBetrayal = (promise: PlayerPromise, round: number): void => {
    const session = seasonRef.current;
    if (!session) return;
    const state = session.getState();
    const player = listRoster(state.playerClubId).find(p => p.id === promise.playerId);
    if (!player) return;

    const fallout = betrayalFallout({
      player,
      rng: createRng(`betrayal_${seasonSeedRef.current}_${promise.playerId as string}_${round}`),
    });

    // V0.53 — le groupe réagit joueur par joueur, via le graphe de relations,
    // au lieu d'encaisser le même malus d'un bloc.
    shakeRoom(player, 'PROMESSE_TRAHIE');

    if (!fallout.transferRequest) return;

    transferRequestsRef.current = [
      ...transferRequestsRef.current.filter(r => r.playerId !== promise.playerId),
      {
        playerId: promise.playerId,
        playerName: promise.playerName,
        madeAtRound: round,
        season: state.currentSeason,
        status: 'EN_ATTENTE',
      },
    ];
    setRequestEpoch(e => e + 1);

    sendMail([mailTransferRequest({
      season: state.currentSeason,
      round,
      clubId: state.playerClubId,
      playerId: promise.playerId as string,
      playerName: promise.playerName,
    })]);
    notify(fallout.narrative, 'warn');
  };

  /**
   * V0.53 — le vestiaire réagit à ce qu'on vient de faire à l'un des siens.
   *
   * Individuellement, et pas d'un bloc : c'est le graphe de relations qui
   * décide qui le prend mal. Un delta uniforme aurait rendu ce graphe inutile
   * une fois de plus.
   */
  const shakeRoom = (subject: Player, event: RoomEvent): void => {
    const session = seasonRef.current;
    if (!session) return;
    const state = session.getState();
    const squad = listRoster(state.playerClubId);
    const reactions = roomReaction({
      subject, squad, event, relations: state.relations,
    });
    if (reactions.length === 0) return;

    const byId = new Map(reactions.map(r => [r.playerId as string, r] as const));
    const next = listAllPlayersWithOverrides().map(p => {
      const reaction = byId.get(p.id as string);
      return reaction === undefined ? p : {
        ...p,
        dynamic: {
          ...p.dynamic,
          moodModifiers: pushMoodEvent(p.dynamic.moodModifiers, {
            source: 'RELATIONS',
            delta: reaction.delta,
            reason: reaction.reason,
            expiresAt: state.currentRound + MOOD_MEDIUM,
          }),
        },
      };
    });
    commitRoster(refreshMoods(next));
    notify(reactionSummary(subject, reactions), 'warn');
  };

  /** Variation de moral appliquée à tout le vestiaire, sauf l'intéressé. */
  const applySquadMoodDelta = (delta: number, exceptId?: PlayerId): void => {
    if (delta === 0) return;
    const session = seasonRef.current;
    if (!session) return;
    const state = session.getState();
    const squad = new Set(
      listRoster(state.playerClubId)
        .filter(p => p.id !== exceptId)
        .map(p => p.id as string),
    );
    const next = listAllPlayersWithOverrides().map(p => squad.has(p.id as string)
      ? {
        ...p,
        dynamic: {
          ...p.dynamic,
          moodModifiers: pushMoodEvent(p.dynamic.moodModifiers, {
            source: 'RELATIONS',
            delta,
            reason: 'Décision mal passée dans le groupe',
            expiresAt: state.currentRound + MOOD_SHORT,
          }),
        },
      }
      : p);
    commitRoster(refreshMoods(next));
  };

  /**
   * V0.45 — lance un chantier.
   *
   * L'argent part tout de suite, l'effet arrive une ou deux saisons plus tard :
   * c'est cette asymétrie qui fait de la construction un pari plutôt qu'un achat.
   */
  const launchProject = (kind: ProjectKind): void => {
    const session = seasonRef.current;
    if (!session) return;
    const state = session.getState();
    const finances = state.financesByClub.get(state.playerClubId);
    if (!finances) return;

    const check = canLaunch({
      facilities: facilitiesRef.current,
      ongoing: ongoingProjectRef.current,
      kind,
      balance: finances.balance,
    });
    if (!check.allowed) {
      notify(check.reason ?? 'Chantier impossible.', 'warn');
      return;
    }

    const targetLevel = levelOfFacility(kind) + 1;
    ongoingProjectRef.current = {
      kind,
      targetLevel,
      readyAtSeason: state.currentSeason + projectDuration(kind),
      totalCost: projectCost(kind, targetLevel),
    };
    session.applyExternalTransfers(
      new Map([[state.playerClubId, finances.balance - check.cost]]),
    );
    setDirectionEpoch(e => e + 1);
    notify(`Chantier lancé : ${PROJECT_LABEL[kind]}.`, 'success');
    refreshSeason();
  };

  const levelOfFacility = (kind: ProjectKind): number => {
    const f = facilitiesRef.current;
    return kind === 'STADE' ? f.stade
      : kind === 'CENTRE_ENTRAINEMENT' ? f.entrainement
        : kind === 'CENTRE_MEDICAL' ? f.medical
          : f.boutique;
  };

  /**
   * V0.44 — le vivier de techniciens, renouvelé à chaque saison.
   *
   * Un marché figé ferait du recrutement de staff une décision unique prise en
   * début de carrière, jamais réexaminée.
   */
  const marketSeason = seasonRef.current?.getState().currentSeason ?? 2025;
  const staffMarket = useMemo(
    () => generateStaffMarket({ season: marketSeason, seed: seasonSeedRef.current }),
    [marketSeason, staffEpoch],
  );

  /**
   * Embauche un technicien.
   *
   * L'indemnité de rupture du sortant est prélevée en même temps que la
   * signature : sans elle, on renverrait tout l'encadrement chaque été pour
   * repartir du marché, et la continuité n'aurait aucune valeur.
   */
  const hireStaffMember = (candidate: StaffCandidate): void => {
    const session = seasonRef.current;
    if (!session) return;
    const state = session.getState();
    const club = allClubs.find(c => c.id === state.playerClubId);
    if (!club) return;

    const verdict = evaluateHire(candidate, club, reputationRef.current, candidate.askingSalary);
    if (!verdict.accepted) {
      notify(verdict.message, 'info');
      return;
    }

    const outgoing = state.staff.find(m => m.role === candidate.role);
    const cost = candidate.askingSalary + (outgoing ? severanceFor(outgoing) : 0);
    const finances = state.financesByClub.get(state.playerClubId);
    if (!finances || finances.balance < cost) {
      notify('Trésorerie insuffisante pour cette signature.', 'warn');
      return;
    }

    session.setStaff(hireInto(state.staff, candidate, state.playerClubId as string));
    session.applyExternalTransfers(
      new Map([[state.playerClubId, finances.balance - cost]]),
    );
    setStaffEpoch(e => e + 1);
    notify(verdict.message, 'success');
    refreshSeason();
  };

  /**
   * V0.44 — ce que le championnat retient des montées et des descentes.
   *
   * Le fil doit consigner le mouvement des **deux** étages : un club qu'on ne
   * croisera plus, un autre qu'on découvrira. Sans cela, l'effectif du
   * championnat changerait entre deux saisons sans que rien ne l'explique.
   */
  const publishPromotionNews = (
    outcome: ReturnType<typeof resolvePromotions>,
    season: number,
    before: DivisionState,
  ): void => {
    const nameOf = (id: ClubId): string =>
      allClubs.find(c => c.id === id)?.name ?? (id as string);

    const entries = [
      ...outcome.relegated.map(id => ({
        season, round: 0, kind: 'SAISON' as const,
        headline: `${nameOf(id)} est relégué en Pro D2`,
        clubId: id,
        involvesPlayer: false,
      })),
      ...outcome.promoted.map(id => ({
        season, round: 0, kind: 'SAISON' as const,
        headline: `${nameOf(id)} accède au Top 14`,
        clubId: id,
        involvesPlayer: false,
      })),
    ];

    if (outcome.barrage) {
      const b = outcome.barrage;
      entries.push({
        season, round: 0, kind: 'SAISON' as const,
        headline: b.top14Survives
          ? `${nameOf(b.top14ClubId)} sauve sa place en barrage (${b.top14Score}-${b.challengerScore})`
          : `${nameOf(b.challengerId)} monte au bout du barrage (${b.challengerScore}-${b.top14Score})`,
        clubId: b.top14ClubId,
        involvesPlayer: divisionOf(before, b.top14ClubId) === playerDivisionRef.current,
      });
    }

    publish(entries);
  };

  /**
   * V0.43 — les deux sollicitations qui appellent une réponse en cours de saison.
   *
   * Elles se déclenchent sur un état durable — une série de défaites, une
   * confiance entamée — et non sur un match isolé : recevoir une convocation du
   * bureau après une seule contre-performance transformerait un ressort
   * dramatique en bruit hebdomadaire. Le plafond d'une occurrence par saison
   * tient au même raisonnement, et l'identifiant de message s'en charge — deux
   * convocations la même saison porteraient le même sujet et seraient écartées
   * comme doublons.
   */
  const maybeSolicitManager = (state: SeasonState): void => {
    if (careerRef.current.kind !== 'EN_POSTE') return;

    const played = state.history.filter(h => h.playerPlayed).slice(-4);
    const losses = played.filter(h => {
      const home = h.homeClubId === state.playerClubId;
      return (home ? h.homeScore : h.awayScore) < (home ? h.awayScore : h.homeScore);
    }).length;

    if (played.length === 4 && losses === 4) {
      sendMail([mailPressInterview({
        season: state.currentSeason,
        round: state.currentRound,
        clubName: allClubs.find(c => c.id === state.playerClubId)?.name ?? 'le club',
        losses,
      })]);
    }

    // Le bureau ne convoque qu'à mi-parcours : plus tôt, il n'y a pas matière ;
    // plus tard, la saison est jouée et la discussion n'a plus d'objet.
    const objective = objectiveRef.current;
    if (objective && confidenceRef.current.score < 30 && state.currentRound >= 10 && state.currentRound <= 20) {
      const rank = session_rank(state);
      if (rank > objective.targetRank) {
        sendMail([mailBoardReview({
          season: state.currentSeason,
          round: state.currentRound,
          clubId: state.playerClubId,
          rank,
          objectiveLabel: objective.label,
          confidence: confidenceRef.current.score,
        })]);
      }
    }
  };

  /** Rang courant du club de l'utilisateur au classement. */
  const session_rank = (state: SeasonState): number => {
    const ranked = [...state.standings.values()].sort((a, b) => {
      if (b.leaguePoints !== a.leaguePoints) return b.leaguePoints - a.leaguePoints;
      return (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst);
    });
    return ranked.findIndex(r => r.clubId === state.playerClubId) + 1;
  };

  const maybeRunWinterMarket = (): void => {
    const session = seasonRef.current;
    if (!session) return;
    const state = session.getState();
    if (!isWindowOpeningRound(state.currentRound, 'HIVERNAL')) return;
    if (winterMarketRef.current === state.currentSeason) return;
    winterMarketRef.current = state.currentSeason;

    const players = listAllPlayersWithOverrides();

    // Un joueur absent jusqu'en avril ne couvre plus son poste : c'est même la
    // première raison pour laquelle un club se présente au mercato d'hiver.
    const unavailableIds = new Set(
      players
        .filter(p => {
          const injury = p.dynamic.injury;
          return injury !== undefined
            && injury.estimatedReturnAt - state.currentRound >= LONG_TERM_INJURY_ROUNDS;
        })
        .map(p => p.id),
    );

    const market = runAiMarket({
      players,
      clubs,
      playerClubId: state.playerClubId,
      balanceByClub: new Map([...state.financesByClub].map(([id, f]) => [id, f.balance])),
      currentSeason: state.currentSeason,
      rankedClubIds: session.getRanking().map(s => s.clubId),
      seed: seasonSeedRef.current,
      window: 'HIVERNAL',
      unavailableIds,
    });

    if (market.transfers.length === 0) return;

    commitRoster(market.players);
    aiMarketRef.current = market.transfers;
    session.applyExternalTransfers(market.balanceByClub);
    publish(newsFromMarket(
      market.transfers, state.currentSeason, state.currentRound, state.playerClubId, 'Mercato hivernal',
    ));
    mailOwnMarket(
      market.transfers, state.currentSeason, state.currentRound, state.playerClubId, 'Mercato hivernal',
    );
    notify(
      `Mercato d'hiver : ${market.transfers.length} mouvement${market.transfers.length > 1 ? 's' : ''} dans le championnat`,
      'info',
    );
    refreshSeason();
  };

  const onResolveContractDecision = (decisionId: string, optionId: ContractDecisionOptionId): void => {
    const session = seasonRef.current;
    if (!session) return;
    const resolution = session.resolveContractDecision(decisionId, optionId);
    if (!resolution) return;
    if (resolution.playerUpdate) {
      const updated = listAllPlayersWithOverrides().map(p =>
        p.id === resolution.playerUpdate!.id ? resolution.playerUpdate! : p,
      );
      commitRoster(updated);
    }
    setLastContractResolution(resolution);
    setSnoozedContractIds(prev => {
      const next = new Set(prev);
      next.delete(decisionId);
      return next;
    });
    refreshSeason();
  };

  const onAcknowledgeContractResolution = (): void => {
    setLastContractResolution(null);
  };

  const onSkipContractDecision = (decisionId: string): void => {
    setSnoozedContractIds(prev => {
      const next = new Set(prev);
      next.add(decisionId);
      return next;
    });
  };

  const onSignFreeAgent = (player: Player, offer: { years: number; annualSalary: number }): void => {
    const session = seasonRef.current;
    if (!session) return;

    // V0.45 — le règlement s'oppose ici. Dépasser le plafond reste possible et
    // se paiera devant la commission ; recruter sous interdiction, non.
    const check = canRegister({
      roster: listRoster(session.getState().playerClubId),
      division: playerDivisionRef.current,
      annualSalary: offer.annualSalary,
      transferBan: transferBanRef.current,
    });
    if (!check.allowed) {
      notify(check.reason ?? 'Signature refusée par la commission.', 'warn');
      return;
    }
    if (check.warning) notify(check.warning, 'warn');

    const signed = session.signFreeAgent(player, offer);
    if (signed) {
      // V0.55 — on note quand il arrive : une recrue met des semaines à trouver
      // ses marques, et sans cette date rien ne le saurait.
      const updated = markAsNewcomer(signed);
      const list = listAllPlayersWithOverrides();
      const exists = list.some(p => p.id === updated.id);
      const next = exists
        ? list.map(p => p.id === updated.id ? updated : p)
        : [...list, updated];
      commitRoster(next);
      refreshSeason();
    }
  };

  /**
   * V0.55 — horodate l'arrivée d'une recrue.
   *
   * `hidden.adaptabilite` existait depuis la V0.4 sans être lu nulle part : un
   * joueur acheté en janvier jouait à cent pour cent dès son premier match.
   */
  const markAsNewcomer = (player: Player): Player => {
    const round = seasonRef.current?.getState().currentRound ?? 0;
    return { ...player, dynamic: { ...player.dynamic, joinedAtRound: round } };
  };

  /**
   * V0.28 — chiffrage d'une cible sous contrat. Purement consultatif : aucun
   * effet de bord, l'écran peut le rappeler à volonté.
   */
  const onPreviewBid = (player: Player): BidPreview => {
    const session = seasonRef.current;
    if (!session) {
      return {
        valueRange: { min: 0, max: 0, certainty: 'INCONNU' },
        suggestedFee: 0,
        expectedSalary: 0, currentSalary: player.contract.annualSalary,
        contractYearsLeft: 0, sellingClubName: '—', balance: 0, payrollHeadroom: 0,
        cooldownRounds: 0, blocked: 'Aucune saison en cours.',
      };
    }
    return session.previewBid(player);
  };

  const onSubmitBid = (player: Player, terms: BidTerms): BidOutcome => {
    const session = seasonRef.current;
    if (!session) return { kind: 'BLOCKED', reason: 'Aucune saison en cours.' };

    const outcome = session.submitBid(player, terms);
    if (outcome.kind === 'SIGNED') {
      const arrivé = markAsNewcomer(outcome.player);
      const nextRoster = listAllPlayersWithOverrides()
        .map(p => (p.id === arrivé.id ? arrivé : p));
      commitRoster(nextRoster);
      notify(`${outcome.player.lastName} rejoint le club`, 'success');
    } else if (outcome.kind === 'REFUSED') {
      notify(
        outcome.resolution.refusedBy === 'CLUB' ? 'Le club vendeur refuse' : 'Le joueur refuse',
        'warn',
      );
    } else {
      notify(outcome.reason, 'warn');
    }
    refreshSeason();
    return outcome;
  };

  const onResolveIncomingOffer = (offerId: string, accept: boolean): void => {
    const session = seasonRef.current;
    if (!session) return;
    const resolution = session.resolveIncomingOffer(offerId, accept);
    if (resolution && resolution.kind === 'ACCEPTED') {
      // V0.53 — on secoue le vestiaire **avant** de sortir le joueur de
      // l'effectif : après, il n'y serait plus, et le graphe ne dirait rien.
      shakeRoom(resolution.updatedPlayer, 'VENDU');
      const list = listAllPlayersWithOverrides();
      const next = list.map(p => p.id === resolution.updatedPlayer.id ? resolution.updatedPlayer : p);
      const wasInList = list.some(p => p.id === resolution.updatedPlayer.id);
      commitRoster(wasInList ? next : [...list, resolution.updatedPlayer]);
    }
    refreshSeason();
  };

  /**
   * V0.13 — rang de la dernière saison achevée, qui détermine la qualification
   * européenne. Absent lors de la toute première saison d'une carrière.
   */
  const lastSeasonRank = (): number | undefined => {
    const seasons = careerHistoryRef.current.seasons;
    return seasons.length > 0 ? seasons[seasons.length - 1]!.playerClubFinalRank : undefined;
  };

  /**
   * Faute de saison précédente, on classe les clubs par réputation pour décider
   * qui débute en coupe d'Europe. Un gros club y entre dès sa première saison.
   */
  const initialRankFromReputation = (clubId: string): number => {
    const ordered = [...clubs].sort((a, b) => b.reputation - a.reputation);
    const index = ordered.findIndex(c => c.id === clubId);
    return index >= 0 ? index + 1 : ordered.length;
  };

  const playPlayerMatch = (): void => {
    const session = seasonRef.current;
    if (!session) return;
    const state = session.getState();
    if (!state.playerNextMatch) return;
    const playerIsHome = state.playerNextMatch.homeClubId === state.playerClubId;
    // V0.8 : exclure les joueurs appelés en sélection ce round
    const calledUp = unavailableThisRound(state);
    setScreen({
      kind: 'pre-match',
      ctx: {
        homeClubId: state.playerNextMatch.homeClubId,
        awayClubId: state.playerNextMatch.awayClubId,
        playerIsHome,
        playerClubId: state.playerClubId,
        seed: `${state.currentRound}_${state.playerNextMatch.homeClubId}_${state.playerNextMatch.awayClubId}`,
        initialLineup: autoLineup(state.playerClubId, calledUp),
        conditions: weatherFor(
          state.currentSeason, state.currentRound, state.playerNextMatch.homeClubId,
        ),
        referee: refereeForMatch(
          state.currentSeason, state.currentRound, state.playerNextMatch.homeClubId,
        ),
      },
    });
  };

  /**
   * V0.13 — lance le match de coupe d'Europe de la semaine.
   *
   * L'adversaire est généré à la volée (pas de roster en base). On propose la
   * composition automatique en excluant blessés et sélectionnés : c'est là que le
   * joueur choisit de faire tourner ou non.
   */
  const playEuropeanMatch = (): void => {
    const session = seasonRef.current;
    if (!session) return;
    const state = session.getState();
    const fixture = state.europeanFixture;
    if (!fixture) return;

    const playerClub = allClubs.find(c => c.id === state.playerClubId);
    if (!playerClub) return;

    const calledUp = unavailableThisRound(state);
    const lineup = autoLineup(state.playerClubId, calledUp);
    const roster = listRoster(state.playerClubId);
    const rosterById = new Map(roster.map(p => [p.id, p]));

    const starters: RosterEntry[] = [];
    for (const entry of lineup.starters) {
      const player = rosterById.get(entry.playerId as PlayerId);
      if (!player) continue;
      starters.push({
        playerId: player.id,
        position: entry.position,
        captainArmband: entry.playerId === (lineup.captainPlayerId ?? captainRef.current),
      });
    }
    // Le banc de ManualLineup ne porte que des identifiants : le poste vient du joueur.
    const substitutes: RosterEntry[] = [];
    for (const id of lineup.substitutes) {
      const player = rosterById.get(id as PlayerId);
      if (!player) continue;
      substitutes.push({ playerId: player.id, position: player.position, captainArmband: false });
    }

    const matchInput = buildEuropeanMatchInput({
      opponent: fixture.opponent,
      playerClub,
      playerSquad: { clubId: playerClub.id, starters, substitutes },
      playerPlayers: roster,
      atHome: fixture.atHome,
      matchId: `eu_${state.currentSeason}_${fixture.round}_${fixture.stage}`,
      seed: `${seasonSeedRef.current}_${state.currentSeason}`,
    });

    setScreen({
      kind: 'match',
      setup: {
        matchInput,
        homeClub: matchInput.homeClub,
        awayClub: matchInput.awayClub,
        seed: `eu_${state.currentSeason}_${fixture.round}`,
        returnToSeason: true,
        european: {
          playerIsHome: fixture.atHome,
          label: `${COMPETITION_LABEL[fixture.competition]} — ${europeanStageLabel(fixture.stage)}`,
        },
      },
    });
  };

  const launchPreparedMatch = (
    lineup: ManualLineup,
    plan: WeekPlan,
    tactics: import('../engine/match/types.js').PreMatchTacticalPlan,
    discipline: DisciplinePolicy,
  ): void => {
    if (screen.kind !== 'pre-match') return;
    const ctx = screen.ctx;
    // V0.50 — le brassard désigné ici vaut pour les rencontres suivantes.
    if (lineup.captainPlayerId !== undefined) {
      captainRef.current = lineup.captainPlayerId as PlayerId;
    }
    const baseModifiers = applyWeekPlan(plan);

    // V0.58 — l'effet du public passe désormais par la feuille de match, pas
    // par un bonus tactique replié ici. L'interface décrit l'affluence ; c'est
    // le moteur qui en tire l'avantage du terrain.
    const modifiers = baseModifiers;

    // V0.44 — la semaine laisse des traces au-delà du week-end. Jusqu'ici la
    // charge ne coûtait que quelques points de fatigue au coup d'envoi : « forte »
    // était gratuite, et le choix se faisait tout seul. Elle se paie désormais
    // en forme, en récupération et, parfois, en blessés.
    const session = seasonRef.current;
    if (session) {
      const state = session.getState();
      const week = resolveTrainingWeek({
        players: listRoster(state.playerClubId),
        load: plan.load,
        // V0.45 — les installations s'ajoutent au staff : de bons équipements
        // ne remplacent pas un bon médecin, ils le rendent plus efficace.
        medicalQuality: Math.min(100, state.coaching.physique + medicalBonus(facilitiesRef.current)),
        currentRound: state.currentRound,
        currentSeason: state.currentSeason,
        rested: restedPlayers,
        rng: createRng(`week_${seasonSeedRef.current}_${state.currentSeason}_${state.currentRound}`),
      });
      // Le repos vaut pour la semaine écoulée, pas pour toute la saison.
      setRestedPlayers(new Set());

      const byId = new Map(listAllPlayersWithOverrides().map(p => [p.id as string, p]));
      for (const p of week.players) byId.set(p.id as string, p);
      commitRoster([...byId.values()]);

      for (const injury of week.injuries) {
        notify(
          `${injury.playerName} se blesse à l'entraînement — ${injury.weeks} semaine${injury.weeks > 1 ? 's' : ''}`,
          'warn',
        );
        publish([newsFromInjury({
          playerName: injury.playerName,
          injuryType: injury.type,
          returnsAtRound: state.currentRound + injury.weeks,
          season: state.currentSeason,
          round: state.currentRound,
          clubId: state.playerClubId,
        })]);
      }
    }
    const isHomeForPlayer = ctx.playerIsHome;
    const input = makeMatchInput({
      homeClubId: ctx.homeClubId,
      awayClubId: ctx.awayClubId,
      matchId: `r_${ctx.seed}`,
      homeFans: crowdForHomeMatch(ctx.homeClubId, isHomeForPlayer),
      ...ctx.conditions,
      // Le joueur fournit sa compo : si HOME, on l'applique côté HOME, sinon côté AWAY
      ...(isHomeForPlayer ? { homeLineup: lineup } : { awayLineup: lineup }),
      // V0.32 — le plan du manager remplace celui déduit de l'identité du club
      // de son côté seulement : l'adversaire garde le sien.
      ...(isHomeForPlayer ? { homePlan: tactics } : { awayPlan: tactics }),
      // Les modifs hebdo s'appliquent au moteur côté HOME ; si le joueur joue à
      // l'extérieur, on les transmet quand même côté HOME (V0.4 distinguera).
    });
    // Patch HomeWeeklyModifiers selon que le joueur reçoit ou pas
    const enrichedInput: MatchInput = {
      ...input,
      playerSide: isHomeForPlayer ? 'HOME' : 'AWAY',
      ...(isHomeForPlayer
        ? { homeWeeklyModifiers: modifiers }
        : { awayWeeklyModifiers: modifiers }),
      // V0.51 — le graphe de relations n'est suivi que pour notre club : la
      // cohésion d'un adversaire vaut donc zéro, soit neutre. Le moral, lui,
      // est porté par les joueurs et pèse des deux côtés.
      ...(seasonRef.current
        ? (isHomeForPlayer
          ? { homeRelations: seasonRef.current.getState().relations }
          : { awayRelations: seasonRef.current.getState().relations })
        : {}),
      // V0.55 — les recrues se présentent telles qu'elles sont ce jour-là :
      // pas encore tout à fait elles-mêmes. On transforme pour la rencontre,
      // jamais l'effectif stocké.
      playersById: (() => {
        const round = seasonRef.current?.getState().currentRound ?? 0;
        const next = new Map(input.playersById);
        for (const [id, p] of input.playersById) {
          if (p.clubId !== ctx.playerClubId) continue;
          next.set(id, applyAdaptation({ player: p, currentRound: round }));
        }
        return next;
      })(),
      // V0.52 — l'arbitre du dossier, et la consigne qu'on lui oppose.
      referee: ctx.referee,
      ...(isHomeForPlayer
        ? { homeDisciplinePolicy: discipline }
        : { awayDisciplinePolicy: discipline }),
    };
    setScreen({
      kind: 'match',
      setup: {
        matchInput: enrichedInput,
        homeClub: input.homeClub,
        awayClub: input.awayClub,
        seed: ctx.seed,
        returnToSeason: true,
      },
    });
  };

  /**
   * Appelé depuis MatchScreen quand le joueur a fini son match et veut revenir
   * au dashboard. On simule d'abord les AUTRES matchs du round courant, PUIS on
   * commit (commit incrémente currentRound, donc l'ordre compte).
   */
  const onMatchFinished = (
    homeScore: number,
    awayScore: number,
    result: import('../engine/match/types.js').MatchResult,
    matchInput: import('../engine/match/types.js').MatchInput,
  ): void => {
    const session = seasonRef.current;
    if (!session) {
      setScreen({ kind: 'season-setup' });
      return;
    }
    // Détermine quel côté est le joueur (HOME ou AWAY) puis ses starters
    const playerClubId = session.getState().playerClubId;
    const playerIsHome = matchInput.home.squad.clubId === playerClubId;
    const starters = playerIsHome ? matchInput.home.squad.starters : matchInput.away.squad.starters;
    const starterIds = starters.map(s => s.playerId);

    // V0.13 — un match de coupe d'Europe ne fait pas avancer la journée de
    // championnat : il s'ajoute à la semaine et n'use que les joueurs alignés.
    const european = screen.kind === 'match' ? screen.setup.european : undefined;
    if (european) {
      const clubScore = playerIsHome ? homeScore : awayScore;
      const opponentScore = playerIsHome ? awayScore : homeScore;
      const subIds = (playerIsHome ? result.homeSubstitutions : result.awaySubstitutions)
        .map(sub => sub.onPlayerId);
      session.commitEuropeanMatch(clubScore, opponentScore, starterIds, subIds);
      refreshSeason();
      setScreen({ kind: 'dashboard' });
      void saveSeasonNow('auto');
      return;
    }

    // 1. Simule les autres matchs du round courant (avant que commit ne change le round)
    session.simulateOtherMatchesOfRound('player');
    // 2. Commit le match du joueur (incrémente currentRound + déclenche détection events + évolue relations)
    session.commitPlayerMatch(homeScore, awayScore, result, starterIds);
    maybeRunWinterMarket();
    publishRoundNews();
    refreshSeason();
    setScreen({ kind: 'dashboard' });
    // Auto-save après chaque journée jouée
    void saveSeasonNow('auto');
  };

  const onSimRoundOnly = (): void => {
    const session = seasonRef.current;
    if (!session) return;
    const state = session.getState();
    if (!state.playerNextMatch) {
      // Pas de match du joueur (éliminé en phases finales) → simuler la journée seule
      session.skipRound('auto');
      maybeRunWinterMarket();
      publishRoundNews();
      refreshSeason();
      return;
    }
    // Simule TOUS les matchs (y compris celui du joueur, en mode auto)
    const playerMatch = state.playerNextMatch;
    const input = makeMatchInput({
      homeClubId: playerMatch.homeClubId,
      awayClubId: playerMatch.awayClubId,
      matchId: `auto_${state.currentRound}`,
      homeFans: crowdForHomeMatch(
        playerMatch.homeClubId as string,
        playerMatch.homeClubId === state.playerClubId,
      ),
    });
    const result = simulateMatch(input, `auto_${state.currentRound}`);
    const playerIsHome = playerMatch.homeClubId === state.playerClubId;
    const starters = playerIsHome ? input.home.squad.starters : input.away.squad.starters;
    const starterIds = starters.map(s => s.playerId);
    // Ordre important : on simule les AUTRES matchs avant le commit (qui incrémente currentRound)
    session.simulateOtherMatchesOfRound('auto');
    session.commitPlayerMatch(result.homeScore, result.awayScore, result, starterIds);
    maybeRunWinterMarket();
    publishRoundNews();
    refreshSeason();
    void saveSeasonNow('auto');
    // V0.57 — on n'a pas joué le match : on le regarde en accéléré. C'était
    // jusqu'ici la seule façon d'avancer sans jamais rien voir du terrain.
    setScreen({
      kind: 'highlights',
      result,
      input,
      homeClubId: playerMatch.homeClubId as string,
      awayClubId: playerMatch.awayClubId as string,
    });
  };

  const onSkipRound = (): void => {
    const session = seasonRef.current;
    if (!session) return;
    session.skipRound('skip');
    maybeRunWinterMarket();
    publishRoundNews();
    refreshSeason();
    void saveSeasonNow('auto');
  };

  /**
   * V0.43 — une journée passée sans club.
   *
   * Le championnat se joue sans nous, et c'est le seul moment où des bancs se
   * libèrent en cours de saison : sans cela, l'année sabbatique n'aurait aucune
   * issue avant l'été et l'attente serait vide.
   */
  const advanceSabbatical = (): void => {
    const session = seasonRef.current;
    if (!session) return;
    session.skipRound('skip');
    publishRoundNews();

    const state = session.getState();
    const ranks = new Map<ClubId, number>(
      [...state.standings.values()]
        .sort((a, b) => (b.leaguePoints - a.leaguePoints)
          || ((b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst)))
        .map((r, i) => [r.clubId, i + 1]),
    );

    const sacked = midSeasonSackings(
      clubs, ranks, state.currentRound,
      createRng(`midsack_${seasonSeedRef.current}_${state.currentSeason}_${state.currentRound}`),
    );

    if (sacked.length > 0) {
      publish(sacked.map(sk => ({
        season: state.currentSeason,
        round: state.currentRound,
        kind: 'SAISON' as const,
        headline: `${sk.clubName} se sépare de son entraîneur`,
        detail: sk.reason,
        clubId: sk.clubId,
        involvesPlayer: false,
      })));

      const known = new Set(vacanciesRef.current.map(id => id as string));
      vacanciesRef.current = [
        ...vacanciesRef.current,
        ...sacked.map(sk => sk.clubId).filter(id => !known.has(id as string)),
      ];

      const offers = jobOffersFor({
        clubs,
        vacancies: vacanciesRef.current,
        reputation: reputationRef.current,
        status: careerRef.current,
      });
      if (offers.length > 0) {
        setPendingOffers(offers);

    // V0.59 — la fédération, elle, n'écrit pas tous les ans. Le poste ne se
    // cumule pas : la lettre le dit franchement, sans quoi ce serait un piège
    // et non une proposition.
    if (federationApproaches({
      reputation: reputationRef.current,
      vacant: (state.currentSeason - 2024) % 4 === 0,
      alreadyInPost: careerRef.current.kind === 'SELECTIONNEUR',
    })) {
      const clubActuel = careerRef.current.kind === 'EN_POSTE'
        ? allClubs.find(c => c.id === (careerRef.current as { clubId: ClubId }).clubId)?.name
        : undefined;
      setNationalOffer({
        season: state.currentSeason,
        letter: federationLetter(reputationRef.current, clubActuel),
      });
      sendMail([{
        season: state.currentSeason,
        round: 0,
        sender: 'FEDERATION',
        subject: 'Le banc du XV de France vous est proposé',
        body: federationLetter(reputationRef.current, clubActuel),
        importance: 'HAUTE',
      }]);
    }
        sendMail([mailJobOffers({
          season: state.currentSeason,
          clubNames: offers.map(o => o.clubName),
          unemployed: true,
        })]);
      }
    }

    refreshSeason();
    void saveSeasonNow('auto');
  };

  // ---------------------------------------------------------------------------
  // Handlers — match isolé (V0.2 conservé)
  // ---------------------------------------------------------------------------

  const startMatch = (homeId: string, awayId: string, seed: string): void => {
    const input = makeMatchInput({ homeClubId: homeId, awayClubId: awayId, matchId: `m_${seed}` });
    setScreen({
      kind: 'match',
      setup: {
        matchInput: input,
        homeClub: input.homeClub,
        awayClub: input.awayClub,
        seed,
      },
    });
  };

  const loadMatch = (homeId: string, awayId: string, seed: string, decisions: readonly PreloadedDecision[]): void => {
    const input = makeMatchInput({ homeClubId: homeId, awayClubId: awayId, matchId: `m_${seed}` });
    setScreen({
      kind: 'match',
      setup: {
        matchInput: input,
        homeClub: input.homeClub,
        awayClub: input.awayClub,
        seed,
        preloadedDecisions: decisions,
      },
    });
  };

  const backToHome = (): void => {
    if (seasonRef.current) {
      setScreen({ kind: 'dashboard' });
    } else {
      setScreen({ kind: 'season-setup' });
    }
  };

  const seasonState = seasonRef.current?.getState();

  const onResolveEvent = (eventId: string, optionId: string): void => {
    const session = seasonRef.current;
    if (!session) return;
    session.resolveHumanEvent(eventId, optionId);
    refreshSeason();
  };

  const onSkipCurrentEvent = (): void => {
    // V0.4 : "plus tard" reporte simplement le modal au prochain affichage du Dashboard
    // (en V0.5, on pourra implémenter un vrai pending). Pour V0.4, on choisit l'option par défaut.
    const session = seasonRef.current;
    if (!session) return;
    const ev = session.getState().pendingEvents[0];
    if (!ev) return;
    session.resolveHumanEvent(ev.id, ev.defaultOptionId);
    refreshSeason();
  };

  // ---------------------------------------------------------------------------
  // Données dérivées pour la vue vestiaire / fiche joueur
  // ---------------------------------------------------------------------------

  /** Résultats récents du club joueur (dernier 5 matchs, du POV du joueur). */
  /** Résultats récents d'un club, du plus ancien au plus récent. */
  const recentResultsFor = (clubId: ClubId): readonly (-1 | 0 | 1)[] => {
    if (!seasonState) return [];
    return seasonState.history
      .filter(h => h.homeClubId === clubId || h.awayClubId === clubId)
      .slice(-5)
      .map(h => {
        const isHome = h.homeClubId === clubId;
        const myScore = isHome ? h.homeScore : h.awayScore;
        const oppScore = isHome ? h.awayScore : h.homeScore;
        if (myScore > oppScore) return 1;
        if (myScore < oppScore) return -1;
        return 0;
      }) as readonly (-1 | 0 | 1)[];
  };

  const recentResultsForPlayer = (): readonly (-1 | 0 | 1)[] =>
    seasonState ? recentResultsFor(seasonState.playerClubId) : [];

  /**
   * V0.36 — dossier sur le prochain adversaire.
   *
   * Le manager préparait son plan, ses rôles et sa composition sans rien savoir
   * de qui il affrontait. Le dossier passe par le scouting : c'est ce qui donne
   * enfin à l'observation une utilité chaque semaine, et pas seulement pendant
   * une fenêtre de mercato.
   */
  const buildDossier = (opponentClubId: string): OpponentReport | undefined => {
    const session = seasonRef.current;
    if (!session) return undefined;
    const state = session.getState();
    const club = allClubs.find(c => c.id === opponentClubId);
    if (!club) return undefined;

    const leagueRosters = new Map<ClubId, readonly Player[]>();
    for (const c of clubs) leagueRosters.set(c.id, listRoster(c.id));

    const ranked = session.getRanking();
    const rankIndex = ranked.findIndex(r => r.clubId === club.id);

    return buildOpponentReport({
      club,
      roster: listRoster(club.id),
      leagueRosters,
      scouting: state.scouting,
      form: recentResultsFor(club.id),
      ...(rankIndex >= 0 ? { rank: rankIndex + 1 } : { rank: undefined }),
      currentRound: state.currentRound,
    });
  };

  /** Pour V0.4 phase 1 : ratio simplifié — supposé 1.0 pour titulaires auto-pickés. */
  const playRatioByPlayerForPlayerClub = (): ReadonlyMap<string, number> => {
    // V0.4 phase 1 : on n'a pas encore le tracking de qui a joué chaque match.
    // On retourne un ratio uniforme de 0.6 (rotation "moyenne") + bump pour les
    // joueurs qui sont dans l'auto-lineup actuel.
    const map = new Map<string, number>();
    if (!seasonState) return map;
    const lineup = autoLineup(seasonState.playerClubId);
    const starterIds = new Set(lineup.starters.map(s => s.playerId));
    const subIds = new Set(lineup.substitutes);
    const roster = listRoster(seasonState.playerClubId);
    for (const p of roster) {
      const id = p.id as string;
      if (starterIds.has(id)) map.set(id, 0.85);
      else if (subIds.has(id)) map.set(id, 0.45);
      else map.set(id, 0.1);
    }
    return map;
  };

  // V0.10 : navigation FM via sidebar (AppShell)
  const navKey: NavKey | null = (() => {
    switch (screen.kind) {
      case 'dashboard': return 'dashboard';
      case 'standings': return 'standings';
      case 'squad': case 'player': return 'squad';
      case 'training': return 'training';
      case 'finances': return 'finances';
      case 'transfers': return 'transfers';
      case 'news': return 'news';
      case 'career': return 'career';
      case 'direction': return 'direction';
      default: return null;
    }
  })();
  const inGame = navKey !== null && seasonState !== undefined;

  const navigateTo = (key: NavKey): void => {
    switch (key) {
      case 'dashboard': setScreen({ kind: 'dashboard' }); break;
      case 'standings': setScreen({ kind: 'standings' }); break;
      case 'squad': setScreen({ kind: 'squad' }); break;
      case 'training': setScreen({ kind: 'training' }); break;
      case 'finances': setScreen({ kind: 'finances' }); break;
      case 'transfers': setScreen({ kind: 'transfers' }); break;
      case 'news': setScreen({ kind: 'news' }); break;
      case 'career': setScreen({ kind: 'career' }); break;
      case 'direction': setScreen({ kind: 'direction' }); break;
    }
  };

  /**
   * V0.41 — le manager signe ailleurs.
   *
   * Changer de club en cours de carrière impose de reconstruire la session : le
   * roster, les finances et l'objectif suivent le nouveau club. La saison vient
   * de démarrer (journée 1, aucun match joué), l'opération est donc sans perte.
   */
  /**
   * V0.53 — les bancs que le manager n'a pas pris trouvent preneur.
   *
   * Un club ne commence pas une saison sans entraîneur, et laisser les vacances
   * ouvertes les ferait s'empiler d'année en année jusqu'à ce que la moitié du
   * championnat soit sans banc occupé.
   */
  /**
   * V0.55 — qui n'est pas sélectionnable cette journée.
   *
   * Les internationaux en trêve, et désormais les joueurs prêtés : un joueur
   * parti jouer ailleurs ne doit évidemment plus apparaître sur la feuille.
   */
  const unavailableThisRound = (
    state: ReturnType<NonNullable<typeof seasonRef.current>['getState']>,
  ): ReadonlySet<PlayerId> => {
    const out = new Set<PlayerId>(
      state.callUpSchedule.byRound.get(state.currentRound) ?? [],
    );
    for (const loan of loansRef.current) out.add(loan.playerId);
    return out;
  };

  /**
   * V0.55 — envoie un joueur jouer ailleurs pour la saison.
   *
   * Le prêt est un arbitrage, pas un rangement : on gagne un joueur formé dans
   * un an, on en perd un tout de suite. C'est pour cela qu'il retire vraiment
   * l'intéressé de la feuille de match.
   */
  const sendOnLoan = (player: Player, offer: LoanOffer): void => {
    const session = seasonRef.current;
    if (!session) return;
    const state = session.getState();

    loansRef.current = [
      ...loansRef.current.filter(l => l.playerId !== player.id),
      {
        playerId: player.id,
        playerName: `${player.firstName} ${player.lastName}`,
        clubId: offer.clubId,
        clubName: offer.clubName,
        season: state.currentSeason,
        playingTime: offer.playingTime,
        wageShare: offer.wageShare,
      },
    ];
    setLoanEpoch(e => e + 1);

    notify(
      `${player.lastName} est prêté à ${offer.clubName} pour la saison.`,
      'info',
    );
    publish([{
      season: state.currentSeason,
      round: state.currentRound,
      kind: 'TRANSFERT' as const,
      headline: `${player.firstName} ${player.lastName} prêté à ${offer.clubName}`,
      detail: offer.pitch,
      clubId: state.playerClubId,
      involvesPlayer: true,
    }]);
    refreshSeason();
  };

  const refillVacantBenches = (
    season: number,
    /**
     * Bancs laissés ouverts parce que le manager a une offre dessus : on ne
     * les pourvoit qu'une fois sa décision rendue.
     */
    reserved: readonly ClubId[] = [],
  ): void => {
    const mine = careerRef.current.kind === 'EN_POSTE' ? careerRef.current.clubId : undefined;
    const held = new Set(reserved.map(id => id as string));
    for (const clubId of vacanciesRef.current) {
      if (clubId === mine || held.has(clubId as string)) continue;
      const club = allClubs.find(c => c.id === clubId);
      if (!club) continue;
      const { state, hired } = fillVacancy(
        rivalsRef.current, club, clubStature(club),
        createRng(`banc_${seasonSeedRef.current}_${season}_${clubId as string}`),
      );
      if (!hired) continue;
      rivalsRef.current = state;
      publish([{
        season,
        round: 0,
        kind: 'SAISON' as const,
        headline: `${club.name} nomme ${hired.name}`,
        detail: hired.reputationLine,
        clubId: club.id,
        involvesPlayer: false,
      }]);
    }
    vacanciesRef.current = vacanciesRef.current.filter(
      id => id === mine || held.has(id as string),
    );
    setRivalEpoch(e => e + 1);
  };

  const acceptJobOffer = (offer: JobOffer, demands: Demands): void => {
    const session = seasonRef.current;
    if (!session) return;
    const state = session.getState();
    const newClub = allClubs.find(c => c.id === offer.clubId);
    if (!newClub) return;

    const seed = seasonSeedRef.current;
    seasonRef.current = createSeasonSession({
      clubIds: clubs.map(c => c.id),
      playerClubId: offer.clubId,
      seed,
      buildMatchInput: (homeId, awayId) => makeMatchInput({
        homeClubId: homeId,
        awayClubId: awayId,
        ...weatherForSim(homeId),
        matchId: `s_${seed}_${homeId}_${awayId}`,
      }),
      playerClubRoster: listRoster(offer.clubId as string),
      currentSeason: state.currentSeason,
      allClubs: clubs,
      rosterByClub: (cid) => listRoster(cid),
      // V0.58 — le XV de France se recrute dans les deux divisions.
      nationalPool: () => listAllPlayersWithOverrides(),
      nationalPicks: () => nationalPicksRef.current,
      clubDirection: () => ({ facilities: facilitiesRef.current, plan: clubPlanRef.current }),
      wantAwayIds: () => transferRequestsRef.current
        .filter(r => r.status === 'SUR_LA_LISTE')
        .map(r => r.playerId),
      squadStatuses: () => squadStatusRef.current,
      restoreFrom: {
        currentRound: 1,
        history: [],
        standings: [],
        financesByClub: state.financesByClub,
      },
    });

    // V0.42 — partir de son plein gré doit se lire dans le parcours. Le verdict
    // de la saison écoulée a été écrit avant que la décision ne soit prise.
    if (careerRef.current.kind === 'EN_POSTE') {
      managerCareerRef.current = markDeparture(managerCareerRef.current, careerRef.current.clubId);
    }
    careerRef.current = { kind: 'EN_POSTE', clubId: offer.clubId };
    vacanciesRef.current = vacanciesRef.current.filter(id => id !== offer.clubId);
    // Les bancs qu'on laisse derrière soi ne restent pas vides.
    refillVacantBenches(state.currentSeason);
    // V0.43 — se payer au-dessus du marché durcit la mission : c'est la
    // contrepartie du salaire, sans quoi le palier le plus élevé serait gratuit.
    contractRef.current = signContract(newClub, demands, state.currentSeason);
    objectiveRef.current = objectiveWithSalary(offer.objective, demands.salary);
    // Un nouveau board ne tient pas les échecs précédents contre son entraîneur.
    confidenceRef.current = INITIAL_BOARD_CONFIDENCE;
    academyRef.current = defaultAcademyState(newClub);
    aiMarketRef.current = [];
    winterMarketRef.current = null;

    publish([{
      season: state.currentSeason,
      round: 0,
      kind: 'SAISON',
      headline: `Vous prenez les rênes de ${offer.clubName}`,
      detail: `Objectif fixé : ${offer.objective.label}`,
      clubId: offer.clubId,
      involvesPlayer: true,
    }]);

    // Le nouveau président se présente : sans cette lettre, on prendrait un
    // poste sans jamais avoir lu ce qu'on y attend de nous.
    sendMail([mailObjectiveSet({
      season: state.currentSeason,
      clubId: offer.clubId,
      clubName: offer.clubName,
      objectiveKind: objectiveRef.current.kind,
      objectiveLabel: objectiveRef.current.label,
      boardConfidence: INITIAL_BOARD_CONFIDENCE.score,
      seasonsAtClub: managerCareerRef.current.seasons
        .filter(s => s.clubId === offer.clubId).length,
    })]);

    sendMail([mailTransferBudget({
      season: state.currentSeason,
      clubId: offer.clubId,
      amount: contractRef.current.transferBudget,
    })]);

    setPendingOffers([]);
    setNegotiating(null);
    setFiredNotice(null);
    setScreen({ kind: 'dashboard' });
    refreshSeason();
  };

  const exitSeason = (): void => {
    seasonRef.current = null;
    setScreen({ kind: 'title' });
  };

  const playerClubName = seasonState
    ? (allClubs.find(c => c.id === seasonState.playerClubId)?.name ?? seasonState.playerClubId)
    : '';
  // V0.44 — la division fait partie de l'identité de la saison : sans elle, un
  // classement de Pro D2 ressemble trait pour trait à un classement de Top 14.
  const seasonLabel = seasonState
    ? `${seasonState.currentSeason}-${(seasonState.currentSeason + 1).toString().slice(-2)}`
      + ` · ${DIVISION_LABEL[playerDivisionRef.current]}`
    : '';
  const phaseLabelTopbar = seasonState ? (() => {
    if (seasonState.phase === 'regular') return `J${seasonState.currentRound}/${seasonState.calendar.totalRounds}`;
    if (seasonState.phase === 'playoffs') return 'Barrages';
    if (seasonState.phase === 'semifinals') return 'Demi-finales';
    if (seasonState.phase === 'final') return 'Finale';
    return 'Saison terminée';
  })() : '';

  /**
   * V0.18 — indicateurs permanents du bandeau supérieur.
   * Ce que le manager doit avoir sous les yeux en continu : son rang, sa forme
   * récente, la santé de l'effectif et sa trésorerie.
   */
  const hudStats = (() => {
    if (!seasonState) return [];
    const ranked = [...seasonState.standings.values()].sort((a, b) => {
      if (b.leaguePoints !== a.leaguePoints) return b.leaguePoints - a.leaguePoints;
      return (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst);
    });
    const rank = ranked.findIndex(r => r.clubId === seasonState.playerClubId) + 1;
    const standing = seasonState.standings.get(seasonState.playerClubId);

    const roster = seasonState.playerClubRoster.filter(p => !p.retired && !p.freeAgent);
    const unavailable = roster.filter(
      p => p.dynamic.injury
        || (p.dynamic.suspendedUntilRound !== undefined && p.dynamic.suspendedUntilRound > seasonState.currentRound),
    ).length;

    const finances = seasonState.financesByClub.get(seasonState.playerClubId);
    const cash = finances ? finances.balance : undefined;

    const stats = [
      { label: 'Classement', value: rank > 0 ? `${rank}e` : '—', highlight: true },
      { label: 'Points', value: String(standing?.leaguePoints ?? 0) },
      { label: 'Indispo.', value: String(unavailable), warn: unavailable >= 4 },
    ];
    if (cash !== undefined) {
      stats.push({
        label: 'Trésorerie',
        value: `${(cash / 1_000_000).toFixed(1)} M€`,
        warn: cash < 0,
      });
    }
    return stats;
  })();

  // Wrappe le contenu in-game dans AppShell
  /**
   * V0.43 — pendant une année sabbatique, la session tourne toujours sur le
   * dernier club pour faire vivre le championnat, mais le bandeau ne doit pas
   * prétendre qu'on l'entraîne encore, ni afficher une mission qui n'est plus
   * la nôtre.
   */
  const renderInGame = (content: React.ReactNode): React.ReactNode => (
    <AppShell
      clubId={(seasonState?.playerClubId as string) ?? 'toulouse'}
      hudStats={hudStats}
      active={navKey ?? 'dashboard'}
      onNavigate={navigateTo}
      onExitSeason={exitSeason}
      onSave={saveSeasonNow}
      saveStatus={seasonSaveStatus}
      clubName={careerRef.current.kind === 'LIBRE' ? 'Sans club' : playerClubName}
      seasonLabel={seasonLabel}
      phaseLabel={phaseLabelTopbar}
      {...(objectiveRef.current && careerRef.current.kind === 'EN_POSTE'
        ? { objectiveLabel: objectiveRef.current.label.split(' ')[0] } : {})}
      {...(seasonState && seasonState.pendingIncomingOffers.length > 0
        ? { transfersBadge: seasonState.pendingIncomingOffers.length } : {})}
      {...(unreadMails > 0 ? { mailsBadge: unreadMails } : {})}
    >
      {content}
    </AppShell>
  );

  /**
   * V0.49 — l'agenda de la semaine, calculé une fois.
   *
   * Hissé hors du JSX parce que l'introduction en a besoin elle aussi : elle
   * ne doit pointer le panneau que les semaines où il a quelque chose à dire.
   */
  const weekAgenda = seasonState !== undefined && careerRef.current.kind === 'EN_POSTE'
    ? buildAgenda({
      currentRound: seasonState.currentRound,
      roster: listRoster(seasonState.playerClubId),
      currentSeason: seasonState.currentSeason,
      capUsage: capReport(listRoster(seasonState.playerClubId), playerDivisionRef.current).usage,
      capOver: capReport(listRoster(seasonState.playerClubId), playerDivisionRef.current).status === 'DEPASSEMENT',
      jiffHeadroom: jiffReport(listRoster(seasonState.playerClubId)).foreignHeadroom,
      jiffCompliant: jiffReport(listRoster(seasonState.playerClubId)).compliant,
      transferBan: transferBanRef.current,
      promises: promisesRef.current.map(p => {
        const baseline = promiseBaselineRef.current.get(p.playerId as string) ?? 0;
        const played = (seasonState.seasonPlayerStats.get(p.playerId)?.matches ?? 0) - baseline;
        const elapsed = seasonState.currentRound - p.madeAtRound;
        return {
          playerName: p.playerName,
          dueAtRound: p.dueAtRound,
          onTrack: elapsed > 0 && played / elapsed >= p.targetRatio,
        };
      }),
      expectations: judgeExpectations(
        expectationsRef.current,
        clubSituation(
          listRoster(seasonState.playerClubId),
          (seasonState.financesByClub.get(seasonState.playerClubId)?.seasonRevenue ?? 0)
            - (seasonState.financesByClub.get(seasonState.playerClubId)?.seasonExpenses ?? 0),
          seasonState.currentSeason,
        ),
      ).map(r => ({ wording: r.expectation.wording, met: r.met })),
      ...(ongoingProjectRef.current
        ? {
          project: {
            label: PROJECT_LABEL[ongoingProjectRef.current.kind],
            readyAtSeason: ongoingProjectRef.current.readyAtSeason,
          },
        }
        : {}),
      // V0.50 — la hiérarchie annoncée, confrontée au temps de jeu réel.
      squadHierarchy: (() => {
        void statusEpoch;
        const ratios = playRatioByPlayerForPlayerClub();
        const roster = listRoster(seasonState.playerClubId).filter(p => !p.retired);
        const statuses = roster.map(p => statusOf(
          squadStatusRef.current, p, ratios.get(p.id as string) ?? 0, seasonState.currentSeason,
        ));
        const report = coherence(statuses);
        const underused = roster
          .filter((p, i) => judgeStatus(
            statuses[i]!, ratios.get(p.id as string) ?? 0, p.traits as readonly string[],
          ).verdict === 'SOUS_UTILISE')
          .map(p => `${p.firstName} ${p.lastName}`);
        return { overcommitted: report.overcommitted, summary: report.summary, underused };
      })(),
      // `requestEpoch` n'est pas lu : il est là pour que la mutation
      // d'une ref déclenche le rendu qui recalcule cet agenda.
      transferRequests: requestEpoch >= 0
        ? transferRequestsRef.current.map(r => ({ playerName: r.playerName, status: r.status }))
        : [],
      unreadMails,
      pendingAnswers: pendingAnswers(mailboxRef.current).length,
      boardConfidence: confidenceRef.current.score,
      transferWindowOpen: seasonState.transferWindow.open,
    })
    : [];

  /**
   * V0.49 — l'introduction, désormais étalée sur la carrière.
   *
   * Elle ne se déclenche plus « au premier tableau de bord » pour tout dire
   * d'un coup : le moteur regarde où l'on est et ce qui se passe, et sort la
   * leçon qui correspond — ou rien, ce qui est le cas le plus fréquent.
   *
   * Les garde-fous de la V0.43 restent : une décision de carrière en cours
   * (offre d'embauche, négociation) passe devant, sinon la bulle vient se
   * poser par-dessus la modale qu'on est en train de lire.
   */
  const lesson = seasonState !== undefined
    && careerRef.current.kind === 'EN_POSTE'
    && pendingOffers.length === 0
    && negotiating === null
    && !onboardingOff
    ? nextLesson({
      screen: ONBOARDING_SCREEN[screen.kind],
      currentRound: seasonState.currentRound,
      seasonsPlayed: careerHistoryRef.current.seasons.length,
      capUsage: capReport(listRoster(seasonState.playerClubId), playerDivisionRef.current).usage,
      transferWindowOpen: seasonState.transferWindow.open,
      pendingAnswers: pendingAnswers(mailboxRef.current).length,
      agendaCount: weekAgenda.length,
      openPromises: promisesRef.current.length,
      transferRequests: requestEpoch >= 0 ? transferRequestsRef.current.length : 0,
      expectations: expectationsRef.current.length,
      seen: seenLessons,
    })
    : undefined;

  return (
    <div className="app">
      <Onboarding
        lesson={lesson}
        onSeen={() => {
          setSeenLessons(readSeen());
          setOnboardingOff(isOnboardingOff());
        }}
      />

      {seasonSaveStatus !== 'idle' && (
        <div className={`save-toast save-toast-${seasonSaveStatus}`} role="status" aria-live="polite">
          {seasonSaveStatus === 'saved' ? (
            <>
              <span className="save-toast-icon" aria-hidden>✓</span>
              <span>Saison sauvegardée</span>
            </>
          ) : (
            <>
              <span className="save-toast-icon" aria-hidden>!</span>
              <span>Erreur de sauvegarde</span>
            </>
          )}
        </div>
      )}

      {/* V0.41 — la valse des entraîneurs se joue par-dessus l'écran courant.
          Ces deux blocs vivaient dans la branche `season-setup`, héritage du
          temps où un limogeage renvoyait à l'écran de sélection de club : la
          carrière n'y repassant plus jamais, ni la modale ni l'avis de
          licenciement n'étaient affichés une seule fois. */}
      {/* V0.59 — la fédération. Une lettre, deux réponses, aucune ambiguïté sur
          ce que le poste coûte. */}
      {nationalOffer && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal national-offer">
            <div className="panel-tag">Fédération française de rugby</div>
            <h3>Le banc du XV de France</h3>
            <p style={{ whiteSpace: 'pre-line' }}>{nationalOffer.letter}</p>
            <div className="modal-actions">
              <button type="button" onClick={() => setNationalOffer(null)}>
                Décliner — je reste où je suis
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => {
                  careerRef.current = {
                    kind: 'SELECTIONNEUR',
                    since: nationalOffer.season + 1,
                    failures: 0,
                  };
                  nationalPicksRef.current = { added: [], removed: [] };
                  windowReportsRef.current = [];
                  setNationalOffer(null);
                  setPendingOffers([]);
                  notify('Vous prenez le XV de France.', 'success');
                }}
              >
                Accepter
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingOffers.length > 0 && !nationalOffer && (() => {
        const career = careerRef.current;
        const currentName = career.kind === 'EN_POSTE'
          ? allClubs.find(c => c.id === career.clubId)?.name
          : undefined;
        return (
          <JobOfferModal
            offers={pendingOffers}
            reputation={reputationRef.current}
            unemployed={career.kind === 'LIBRE'}
            {...(currentName ? { currentClubName: currentName } : {})}
            clubShortName={id => allClubs.find(c => c.id === id)?.shortName ?? id}
            onAccept={(offer) => setNegotiating(offer)}
            onDecline={() => {
              // Décliner ne gèle pas le championnat : les autres signent.
              refillVacantBenches(seasonState?.currentSeason ?? 2025);
              setPendingOffers([]);
            }}
          />
        );
      })()}

      {negotiating && (() => {
        const club = allClubs.find(c => c.id === negotiating.clubId);
        if (!club) return null;
        return (
          <NegotiationModal
            offer={negotiating}
            club={club}
            reputation={reputationRef.current}
            clubShortName={club.shortName}
            onSign={(demands) => acceptJobOffer(negotiating, demands)}
            onCancel={() => setNegotiating(null)}
          />
        );
      })()}

      {firedNotice && (
        <div
          className="rollover-banner fired-notice"
          style={{ borderLeftColor: 'var(--red, #c44)' }}
          role="status"
        >
          <span>⚠ {firedNotice}</span>
          <button type="button" className="modal-skip" onClick={() => setFiredNotice(null)}>
            Compris
          </button>
        </div>
      )}

      {!inGame && screen.kind !== 'title' && (
        <header className="app-header">
          <h1>
            <span className="logo-mark">15</span>
            Le Quinze
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="alpha-tag">Alpha V0.10</span>
          </div>
        </header>
      )}

      {screen.kind === 'title' && (
        <TitleScreen
          onNewCareer={() => setScreen({ kind: 'season-setup' })}
          onContinue={(saveId) => loadSeason(saveId)}
          onFreeMatch={() => setScreen({ kind: 'match-setup' })}
        />
      )}

      {screen.kind === 'season-setup' && (
        <>
          <SeasonSetupScreen
            clubs={allClubs}
            onStartSeason={startSeason}
            onLoadSeason={loadSeason}
            onPlaySingleMatch={() => setScreen({ kind: 'match-setup' })}
          />
        </>
      )}

      {screen.kind === 'match-setup' && (
        <SetupScreen
          clubs={clubs}
          onStart={startMatch}
          onLoad={loadMatch}
        />
      )}

      {/* V0.43 — sans club, le championnat se joue sans nous. L'écran de club
          n'aurait aucun sens : il n'y a plus de club. */}
      {screen.kind === 'dashboard' && seasonState && careerRef.current.kind === 'LIBRE' && renderInGame(
        <SabbaticalScreen
          season={seasonState.currentSeason}
          round={seasonState.currentRound}
          totalRounds={26}
          standings={[...seasonState.standings.values()]}
          reputation={reputationRef.current}
          since={careerRef.current.since}
          vacancies={vacanciesRef.current.map(id => id as string)}
          clubName={id => allClubs.find(c => c.id === id)?.name ?? id}
          clubShortName={id => allClubs.find(c => c.id === id)?.shortName ?? id}
          onAdvance={advanceSabbatical}
          onOpenOffers={() => setPendingOffers(jobOffersFor({
            clubs,
            vacancies: vacanciesRef.current,
            reputation: reputationRef.current,
            status: careerRef.current,
          }))}
          hasOffers={vacanciesRef.current.length > 0}
        />
      )}

      {/* V0.59 — sélectionneur : ni club, ni disponible. Sept matchs par an. */}
      {screen.kind === 'dashboard' && seasonState && careerRef.current.kind === 'SELECTIONNEUR' && renderInGame(
        <NationalScreen
          season={seasonState.currentSeason}
          round={seasonState.currentRound}
          totalRounds={seasonState.calendar.totalRounds}
          standings={[...seasonState.standings.values()]}
          reputation={reputationRef.current}
          since={careerRef.current.since}
          clubName={id => allClubs.find(c => c.id === id)?.name ?? id}
          squad={nationalEpoch >= 0 ? seasonState.nationalSquad : undefined}
          shortlist={seasonState.nationalShortlist}
          capsOf={id => seasonState.caps.get(id)?.caps ?? 0}
          reports={windowReportsRef.current}
          onAdvance={advanceSabbatical}
          onToggle={(playerId) => {
            const picks = nationalPicksRef.current;
            const squad = seasonRef.current?.getState().nationalSquad;
            const dedans = squad?.players.includes(playerId) ?? false;
            if (dedans) {
              picks.removed = [...picks.removed.filter(id => id !== playerId), playerId];
              picks.added = picks.added.filter(id => id !== playerId);
            } else {
              picks.added = [...picks.added.filter(id => id !== playerId), playerId];
              picks.removed = picks.removed.filter(id => id !== playerId);
            }
            setNationalEpoch(e => e + 1);
            refreshSeason();
          }}
        />
      )}

      {screen.kind === 'dashboard' && seasonState && careerRef.current.kind === 'EN_POSTE' && renderInGame(
        <DashboardScreen
          state={seasonState}
          clubs={clubs}
          division={playerDivisionRef.current}
          agenda={weekAgenda}
          onNavigate={(destination) => setScreen({ kind: destination })}
          playerClubRoster={listRoster(seasonState.playerClubId)}
          recentResultsForPlayer={recentResultsForPlayer()}
          playRatioByPlayer={playRatioByPlayerForPlayerClub()}
          onPlayMatch={playPlayerMatch}
          onPlayEuropeanMatch={playEuropeanMatch}
          developmentReports={developmentReportsRef.current}
          onSimRoundOnly={onSimRoundOnly}
          onSkipRound={onSkipRound}
          onStartNextSeason={onStartNextSeason}
          rolloverSummary={rolloverSummary}
          careerHistory={careerHistoryRef.current}
          careerBook={careerBookRef.current}
          reputation={reputationRef.current}
          objective={objectiveRef.current}
          boardConfidence={confidenceRef.current}
          onThreadClick={(thread) => {
            // Si fil = event en attente → laisser le modal s'afficher (déjà visible)
            if (thread.kind === 'PENDING_EVENT') return;
            // Si fil concerne un joueur → naviguer vers sa fiche
            const firstPid = thread.playerIds[0];
            if (firstPid) {
              const player = listRoster(seasonState.playerClubId).find(p => p.id === firstPid);
              if (player) setScreen({ kind: 'player', player });
            }
          }}
        />
      )}

      {screen.kind === 'standings' && seasonState && renderInGame(
        <StandingsScreen state={seasonState} clubs={clubs} division={playerDivisionRef.current} />
      )}

      {screen.kind === 'squad' && seasonState && renderInGame(
        <SquadScreen
          clubName={allClubs.find(c => c.id === seasonState.playerClubId)?.name ?? seasonState.playerClubId}
          players={listRoster(seasonState.playerClubId)}
          currentSeason={seasonState.currentSeason}
          recentResults={recentResultsForPlayer()}
          playRatioByPlayer={playRatioByPlayerForPlayerClub()}
          relations={seasonState.relations}
          seasonStats={seasonState.seasonPlayerStats}
          scouting={seasonState.scouting}
          currentRound={seasonState.currentRound}
          {...(captainRef.current !== undefined ? { captainId: captainRef.current } : {})}
          squadStatuses={statusEpoch >= 0 ? squadStatusRef.current : new Map()}
          onSetStatus={setSquadStatus}
          onSelectPlayer={(player) => setScreen({ kind: 'player', player })}
          onBack={() => setScreen({ kind: 'dashboard' })}
        />
      )}

      {screen.kind === 'training' && seasonState && renderInGame(
        <TrainingScreen
          roster={seasonState.playerClubRoster}
          trainingByPlayer={seasonState.trainingByPlayer}
          seasonStats={seasonState.seasonPlayerStats}
          coaching={seasonState.coaching}
          staff={seasonRef.current?.getStaff() ?? []}
          scouting={seasonState.scouting}
          currentSeason={seasonState.currentSeason}
          rested={restedPlayers}
          onToggleRest={(playerId) => setRestedPlayers(prev => {
            const next = new Set(prev);
            if (next.has(playerId)) next.delete(playerId); else next.add(playerId);
            return next;
          })}
          onSetFocus={(playerId, focus) => {
            seasonRef.current?.setTrainingFocus(playerId, focus);
            refreshSeason();
            const p = seasonState.playerClubRoster.find(x => x.id === playerId);
            notify(`${p ? p.lastName : 'Joueur'} — entraînement : ${TRAINING_FOCUS_LABEL[focus]}`, 'success');
          }}
          onSetFocusForAll={(focus) => {
            seasonRef.current?.setTrainingFocusForAll(focus);
            refreshSeason();
            notify(`Tout l'effectif passe en entraînement « ${TRAINING_FOCUS_LABEL[focus]} »`, 'success');
          }}
          onBack={() => setScreen({ kind: 'dashboard' })}
          academy={academyRef.current}
          academyCostPerSeason={(() => {
            const c = clubs.find(x => x.id === seasonState.playerClubId);
            return c ? academyCost(academyRef.current.investment, c) : 0;
          })()}
          academyTarget={(() => {
            const c = clubs.find(x => x.id === seasonState.playerClubId);
            return c ? targetLevel(academyRef.current.investment, c) : 3;
          })()}
          prospects={prospectsRef.current}
          staffMarket={staffMarket}
          treasury={seasonState.financesByClub.get(seasonState.playerClubId)?.balance ?? 0}
          hireVerdict={(candidate) => {
            const club = allClubs.find(c => c.id === seasonState.playerClubId);
            return club
              ? evaluateHire(candidate, club, reputationRef.current, candidate.askingSalary)
              : { accepted: false, message: 'Club introuvable.' };
          }}
          onHireStaff={hireStaffMember}
          onSetAcademy={(plan) => {
            academyRef.current = { ...academyRef.current, ...plan };
            seasonRef.current?.setAcademyPlan(plan);
            refreshSeason();
          }}
        />
      )}

      {screen.kind === 'player' && seasonState && renderInGame(
        <PlayerScreen
          player={screen.player}
          familiarity={seasonState.scouting.knowledge.get(screen.player.id)?.familiarity ?? 0}
          {...(seasonState.seasonPlayerStats.get(screen.player.id)
            ? { seasonStat: seasonState.seasonPlayerStats.get(screen.player.id)! } : {})}
          currentSeason={seasonState.currentSeason}
          recentResults={recentResultsForPlayer()}
          playRatio={playRatioByPlayerForPlayerClub().get(screen.player.id as string) ?? 0.5}
          relations={seasonState.relations}
          playersById={new Map(listRoster(seasonState.playerClubId).map(p => [p.id, p] as const))}
          isCaptain={screen.player.id === captainRef.current}
          honours={honoursOf(honoursRef.current, screen.player.id)}
          currentRound={seasonState.currentRound}
          caps={seasonState.caps.get(screen.player.id)?.caps ?? 0}
          {...(() => {
            const career = careerBookRef.current.get(screen.player.id);
            return career ? { career } : {};
          })()}
          clubNameOf={(cid) => allClubs.find(c => c.id === cid)?.name ?? (cid as string)}
          {...(() => {
            const hint = adaptationHint({
              player: screen.player, currentRound: seasonState.currentRound,
            });
            return hint ? { adaptation: hint } : {};
          })()}
          squadStatus={statusOf(
            statusEpoch >= 0 ? squadStatusRef.current : new Map(),
            screen.player,
            playRatioByPlayerForPlayerClub().get(screen.player.id as string) ?? 0.5,
            seasonState.currentSeason,
          )}
          onSelectPlayer={(player) => setScreen({ kind: 'player', player })}
          talk={{
            context: {
              playRatio: playRatioByPlayerForPlayerClub().get(screen.player.id as string) ?? 0.5,
              forme: screen.player.dynamic.forme,
              mood: screen.player.dynamic.mood,
              currentRound: seasonState.currentRound,
            },
            ...(promisesRef.current.find(p => p.playerId === screen.player.id)
              ? { pendingPromise: promisesRef.current.find(p => p.playerId === screen.player.id)! }
              : {}),
            ...(lastTalkOutcome && lastTalkOutcome.playerId === screen.player.id
              ? { lastOutcome: lastTalkOutcome.outcome } : {}),
            // `requestEpoch` force le recalcul quand la ref change.
            ...(requestEpoch >= 0
              && transferRequestsRef.current.find(r => r.playerId === screen.player.id)
              ? {
                request: {
                  status: transferRequestsRef.current
                    .find(r => r.playerId === screen.player.id)!.status,
                },
              }
              : {}),
            onTalk: (topic) => talkToPlayer(screen.player, topic),
          }}
          onBack={() => setScreen({ kind: 'squad' })}
        />
      )}

      {screen.kind === 'finances' && seasonState && (() => {
        const club = allClubs.find(c => c.id === seasonState.playerClubId);
        const finances = seasonState.financesByClub.get(seasonState.playerClubId);
        if (!club || !finances) return null;
        return renderInGame(
          <FinancesScreen
            club={club}
            finances={finances}
            playerClubRoster={listRoster(seasonState.playerClubId)}
            currentSeason={seasonState.currentSeason}
            currentRound={seasonState.currentRound}
            totalRounds={seasonState.calendar.totalRounds}
            onBack={() => setScreen({ kind: 'dashboard' })}
          />
        );
      })()}

      {screen.kind === 'news' && seasonState && renderInGame(
        <NewsScreen
          feed={newsRef.current}
          currentSeason={seasonState.currentSeason}
          currentRound={seasonState.currentRound}
          playerClubId={seasonState.playerClubId as string}
          clubName={id => allClubs.find(c => c.id === id)?.name ?? id}
          clubShortName={id => allClubs.find(c => c.id === id)?.shortName ?? id}
        />
      )}

      {screen.kind === 'direction' && seasonState && renderInGame((() => {
        // `directionEpoch` est lu ici : `facilitiesRef` et `clubPlanRef` sont des
        // refs, donc invisibles à React. Sans cette lecture, changer un tarif ne
        // redessinerait pas l'écran.
        void directionEpoch;
        const club = allClubs.find(c => c.id === seasonState.playerClubId);
        if (!club) return null;
        const played = [...seasonState.standings.values()]
          .find(r => r.clubId === seasonState.playerClubId);
        const winsRatio = played && played.played > 0 ? played.wins / played.played : 0.5;
        return (
          <ClubDirectionScreen
            club={club}
            facilities={facilitiesRef.current}
            ongoing={ongoingProjectRef.current}
            plan={clubPlanRef.current}
            balance={seasonState.financesByClub.get(seasonState.playerClubId)?.balance ?? 0}
            winsRatio={winsRatio}
            currentSeason={seasonState.currentSeason}
            onSetPlan={(next) => {
              clubPlanRef.current = next;
              setDirectionEpoch(e => e + 1);
            }}
            onLaunch={launchProject}
            onBack={() => setScreen({ kind: 'dashboard' })}
          />
        );
      })())}

      {screen.kind === 'career' && seasonState && renderInGame(
        <CareerScreen
          career={managerCareerRef.current}
          mailbox={mailboxRef.current}
          reputation={reputationRef.current}
          status={careerRef.current}
          confidence={confidenceRef.current}
          objective={objectiveRef.current}
          currentSeason={seasonState.currentSeason}
          clubName={id => allClubs.find(c => c.id === id)?.name ?? id}
          clubShortName={id => allClubs.find(c => c.id === id)?.shortName ?? id}
          {...(careerRef.current.kind === 'EN_POSTE' ? { contract: contractRef.current } : {})}
          expectations={expectationsRef.current}
          peers={rivalEpoch >= 0 ? reputationTable(
            rivalsRef.current,
            {
              name: 'Vous',
              reputation: reputationRef.current.score,
              ...(careerRef.current.kind === 'EN_POSTE'
                ? { clubName: allClubs.find(c => c.id === seasonState.playerClubId)?.name }
                : {}),
            },
            id => allClubs.find(c => (c.id as string) === id)?.name,
          ) : []}
          onReadMail={(id) => {
            mailboxRef.current = markRead(mailboxRef.current, id);
            setUnreadMails(unreadCount(mailboxRef.current));
          }}
          onAnswerMail={resolveMailAnswer}
          onMarkAllRead={() => {
            mailboxRef.current = markAllRead(mailboxRef.current);
            setUnreadMails(0);
          }}
        />
      )}

      {screen.kind === 'transfers' && seasonState && (() => {
        const club = allClubs.find(c => c.id === seasonState.playerClubId);
        if (!club) return null;
        const allPlayers = listAllPlayersWithOverrides();
        const freeAgents = allPlayers.filter(p => p.freeAgent && !p.retired);
        return renderInGame(
          <TransferMarketScreen
            leaguePlayers={listAllPlayersWithOverrides().filter(
              p => !p.retired && !p.freeAgent && p.clubId !== seasonState.playerClubId,
            )}
            clubNameById={(id) => allClubs.find(c => c.id === id)?.name ?? id}
            scouting={seasonState.scouting}
            scoutingSlots={seasonState.scoutingSlots}
            onAssignScout={(id) => {
              const before = seasonRef.current?.getState().scouting.assignments.length ?? 0;
              seasonRef.current?.assignScout(id);
              const after = seasonRef.current?.getState().scouting.assignments.length ?? 0;
              refreshSeason();
              notify(
                after > before ? 'Joueur placé sous observation' : 'Tous les créneaux de scouting sont occupés',
                after > before ? 'success' : 'warn',
              );
            }}
            onUnassignScout={(id) => {
              seasonRef.current?.unassignScout(id);
              refreshSeason();
              notify('Observation levée', 'info');
            }}
            playerClubId={seasonState.playerClubId}
            playerClub={club}
            regulation={{
              cap: capReport(listRoster(seasonState.playerClubId), playerDivisionRef.current),
              jiff: jiffReport(listRoster(seasonState.playerClubId)),
              transferBan: transferBanRef.current,
            }}
            currentSeason={seasonState.currentSeason}
            seed={seasonSeedRef.current}
            freeAgents={freeAgents}
            incomingOffers={seasonState.pendingIncomingOffers}
            onSignFreeAgent={onSignFreeAgent}
            onResolveIncomingOffer={onResolveIncomingOffer}
            loans={{
              // Un joueur déjà parti ne se prête pas une seconde fois.
              candidates: loanEpoch >= 0
                ? listRoster(seasonState.playerClubId)
                  .filter(p => !loansRef.current.some(l => l.playerId === p.id))
                  .filter(p => isLoanable({
                    player: p,
                    playRatio: playRatioByPlayerForPlayerClub().get(p.id as string) ?? 0,
                    currentSeason: seasonState.currentSeason,
                  }))
                : [],
              active: loansRef.current.map(l => {
                const p = listRoster(seasonState.playerClubId).find(x => x.id === l.playerId);
                const reste = p ? loanCost(l, p.contract.annualSalary) : 0;
                return {
                  playerName: l.playerName,
                  clubName: l.clubName,
                  playingTime: l.playingTime,
                  costLine: `il vous reste ${Math.round(reste / 1000)} k€/an à payer`,
                };
              }),
              offersFor: (player) => loanOffersFor({
                player,
                clubs: allClubs,
                ownClubId: seasonState.playerClubId as ClubId,
                rng: createRng(`pret_${seasonSeedRef.current}_${seasonState.currentSeason}_${player.id as string}`),
              }),
              tradeoff: loanTradeoff,
              onSend: sendOnLoan,
            }}
            previewBid={onPreviewBid}
            onSubmitBid={onSubmitBid}
            aiMarket={aiMarketRef.current}
            transferWindow={seasonState.transferWindow}
            jokerOptions={seasonRef.current?.getJokerOptions() ?? []}
            onSignJoker={(injuredId, candidate, salary) => {
              const session = seasonRef.current;
              if (!session) return 'Aucune saison en cours.';
              const outcome = session.signMedicalJoker(injuredId, candidate, salary);
              if (!outcome.ok) {
                notify(outcome.reason, 'warn');
                return outcome.reason;
              }
              commitRoster(
                listAllPlayersWithOverrides().map(p => (p.id === outcome.player.id ? outcome.player : p)),
              );
              notify(`${outcome.player.lastName} signe comme joker médical`, 'success');
              refreshSeason();
              return undefined;
            }}
            onBack={() => setScreen({ kind: 'dashboard' })}
          />
        );
      })()}

      {screen.kind === 'highlights' && (
        <HighlightsScreen
          result={screen.result}
          input={screen.input}
          homeClubId={screen.homeClubId}
          awayClubId={screen.awayClubId}
          homeName={allClubs.find(c => (c.id as string) === screen.homeClubId)?.name ?? screen.homeClubId}
          awayName={allClubs.find(c => (c.id as string) === screen.awayClubId)?.name ?? screen.awayClubId}
          homeShort={allClubs.find(c => (c.id as string) === screen.homeClubId)?.shortName ?? '—'}
          awayShort={allClubs.find(c => (c.id as string) === screen.awayClubId)?.shortName ?? '—'}
          onBack={() => setScreen({ kind: 'dashboard' })}
        />
      )}

      {screen.kind === 'pre-match' && (
        <PreMatchScreen
          homeClubName={allClubs.find(c => c.id === screen.ctx.homeClubId)?.name ?? screen.ctx.homeClubId}
          awayClubName={allClubs.find(c => c.id === screen.ctx.awayClubId)?.name ?? screen.ctx.awayClubId}
          homeClubId={screen.ctx.homeClubId}
          awayClubId={screen.ctx.awayClubId}
          isHome={screen.ctx.playerIsHome}
          roster={listRoster(screen.ctx.playerClubId)}
          medicalQuality={Math.min(100,
            (seasonState?.coaching.physique ?? 50) + medicalBonus(facilitiesRef.current))}
          {...(() => {
            const opponentId = (screen.ctx.playerIsHome
              ? screen.ctx.awayClubId : screen.ctx.homeClubId) as ClubId;
            const r = rivalryBetween(screen.ctx.playerClubId as ClubId, opponentId);
            if (!r) return {};
            const h2h = headToHeadRef.current.get(opponentId as string) ?? EMPTY_HEAD_TO_HEAD;
            return { rivalry: rivalryContext(r, h2h) };
          })()}
          initialLineup={screen.ctx.initialLineup}
          {...(captainRef.current !== undefined
            ? { currentCaptainId: captainRef.current as string } : {})}
          {...(seasonRef.current
            ? { relations: seasonRef.current.getState().relations } : {})}
          conditions={screen.ctx.conditions}
          referee={screen.ctx.referee}
          {...(seasonRef.current
            ? { unavailable: unavailableThisRound(seasonRef.current.getState()) } : {})}
          {...(seasonState ? { currentRound: seasonState.currentRound } : {})}
          {...(() => {
            // V0.58 — ce que la politique du club et la saison ont produit
            // comme affluence, montré là où l'on prépare la rencontre.
            if (!screen.ctx.playerIsHome || !seasonState) return {};
            const club = allClubs.find(c => (c.id as string) === screen.ctx.homeClubId);
            if (!club) return {};
            const st = seasonState.standings.get(club.id);
            const revenue = matchdayRevenue({
              club,
              facilities: facilitiesRef.current,
              plan: clubPlanRef.current,
              winsRatio: st && st.played > 0 ? st.wins / st.played : 0.5,
            });
            return {
              crowd: {
                level: crowdFromFillRate(revenue.fillRate),
                attendance: revenue.attendance,
                capacity: Math.round(revenue.attendance / Math.max(0.01, revenue.fillRate)),
              },
            };
          })()}
          onPlay={launchPreparedMatch}
          {...(() => {
            const opponentId = screen.ctx.playerIsHome ? screen.ctx.awayClubId : screen.ctx.homeClubId;
            const report = buildDossier(opponentId);
            if (!report) return {};
            const sc = seasonState?.scouting;
            const opponentClubId = opponentId as ClubId;
            const assigned = sc?.clubAssignments?.includes(opponentClubId) ?? false;
            return {
              opponentReport: report,
              opponentScouting: {
                assigned,
                canAssign: sc
                  ? usedSlots(sc) + CLUB_MISSION_COST <= (seasonState?.scoutingSlots ?? 0)
                  : false,
                slotCost: CLUB_MISSION_COST,
                onToggle: () => {
                  const session = seasonRef.current;
                  if (!session) return;
                  if (assigned) session.unassignClubScout(opponentClubId);
                  else session.assignClubScout(opponentClubId);
                  refreshSeason();
                },
              },
            };
          })()}
          onBack={() => setScreen({ kind: 'dashboard' })}
        />
      )}

      {screen.kind === 'match' && (
        <MatchScreen
          setup={screen.setup}
          onBack={backToHome}
          {...(screen.setup.returnToSeason ? { onMatchFinished } : {})}
        />
      )}

      {/* Modal d'event humain : affiché si on est sur le dashboard et qu'il y a des events en attente.
          V0.43 — jamais pendant une année sabbatique : ces décisions concernent
          un vestiaire qu'on ne dirige plus. */}
      {screen.kind === 'dashboard' && careerRef.current.kind === 'EN_POSTE'
        && seasonState && seasonState.pendingEvents.length > 0 && (
        <HumanEventModal
          key={seasonState.pendingEvents[0]!.id}
          event={seasonState.pendingEvents[0]!}
          remaining={seasonState.pendingEvents.length}
          onChoose={(optionId) => onResolveEvent(seasonState.pendingEvents[0]!.id, optionId)}
          onSkip={onSkipCurrentEvent}
        />
      )}

      {/* Modal de décision de contrat : après un event humain résolu */}
      {screen.kind === 'dashboard' && careerRef.current.kind === 'EN_POSTE'
        && seasonState && seasonState.pendingEvents.length === 0 && (
        (() => {
          const next = seasonState.pendingContractDecisions.find(d => !snoozedContractIds.has(d.id));
          if (!next && !lastContractResolution) return null;
          const remainingPending = seasonState.pendingContractDecisions.filter(d => !snoozedContractIds.has(d.id)).length;
          // Si on est en mode "résolution affichée", on garde la décision portée par la résolution
          const decisionForUi = next ?? seasonState.pendingContractDecisions[0]!;
          return (
            <ContractDecisionModal
              key={decisionForUi.id}
              decision={decisionForUi}
              remaining={remainingPending}
              lastResolution={lastContractResolution}
              onChoose={(optionId) => onResolveContractDecision(decisionForUi.id, optionId)}
              onSkip={() => onSkipContractDecision(decisionForUi.id)}
              onAcknowledge={onAcknowledgeContractResolution}
            />
          );
        })()
      )}
    </div>
  );
}
