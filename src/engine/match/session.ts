/**
 * MatchSession — moteur de match stateful interactif.
 *
 * Permet d'avancer le match phase par phase, en s'arrêtant à chaque "live moment"
 * pour qu'un client externe (UI ou IA) prenne une décision.
 *
 * - Mode batch (tests, calibration) : `simulateMatch` (dans simulate.ts) consomme
 *   automatiquement chaque décision avec son option par défaut.
 * - Mode interactif (UI) : la session expose `advance()`, `getState()`,
 *   `applyDecision(optionId)`.
 *
 * Architecture : chaque méthode est synchrone et déterministe (pour rejouabilité).
 *
 * Référence :
 *   - 06-moteur-match.md (live decision moments 5-15 par match)
 *   - 09-architecture-logicielle.md (moteur pur, pas de side-effects)
 */

import { createRng } from '../rng.js';
import { crowdFactor } from './crowd.js';
import { resolveTalk, situationFor, type DressingRoom, type TalkTone } from './team-talk.js';
import type { Player, PlayerId, Position } from '../types.js';
import { simulateScrum, computeScrumDominanceShift, type ScrumInput } from './scrum.js';
import { simulateLineout, type LineoutInput } from './lineout.js';
import {
  callForSituation,
  readLevel,
  recordCall,
  type CallUsage,
  type Playbook,
} from './playbook.js';
import { simulateRuck, type RuckInput } from './ruck.js';
import { simulateOpenPlay, type OpenPlayInput } from './openplay.js';
import { simulateGoalLine, type GoalLineInput } from './goal-line.js';
import { NEUTRAL_PLAN, resolveTactics, type TacticalModifiers } from './tactics.js';
import { weatherEffects } from './weather.js';
import { policyEffects, refereeEffects } from './referee.js';
import {
  moraleEffects,
  teamMorale,
  type TeamMorale,
} from './morale.js';
import {
  advanceMomentum,
  momentumEffects,
  momentumFor,
  momentumShift,
} from './momentum.js';
import {
  armbandLoss,
  averageAuthority,
  captainDisciplineFactor,
  captainFrom,
  relayedLeadership,
} from './captain.js';
import {
  placeKickSuccessProb,
  simulateTacticalKick,
  type TacticalKickInput,
} from './kicking.js';
import type {
  IndividualMatchStats,
  MatchInput,
  MatchResult,
  MatchSquad,
  MatchStateSnapshot,
  PhaseOutcome,
  PhaseRecord,
  PhaseType,
  PreMatchTacticalPlan,
} from './types.js';
import type { Club } from '../types.js';
import {
  makeBenchCallMoment,
  makeCrunchTimeMoment,
  makeGoalLineStandMoment,
  makeDefensivePressureMoment,
  makeFatiguedStarMoment,
  makeTeamTalkMoment,
  makePenaltyDecisionMoment,
  type LiveMoment,
  type LiveMomentOption,
  type LiveMomentType,
  type MomentEffect,
} from './live-moments.js';
import {
  accrueFatigue,
  accrueMinutes,
  applyFatigueDeltaOnField,
  applySubstitution,
  returnFromSinBin,
  scrumsUncontested,
  sendOff,
  sendToSinBin,
  sinBinned,
  backsFatigue,
  bestCoverFor,
  canCover,
  MAX_SUBSTITUTIONS,
  createSquadRuntime,
  mostFatiguedOnField,
  onFieldBacks,
  onFieldPack,
  packFatigue,
  planAutoSubstitution,
  playerFatigue,
  recoverBench,
  squadFatigue,
  type SquadRuntime,
  type SubstitutionOutcome,
  type SubstitutionRecord,
} from './bench.js';

// =============================================================================
// Constantes (identiques à V0.1)
// =============================================================================

const FORWARD_POSITIONS: ReadonlySet<Position> = new Set<Position>([
  'PILIER_GAUCHE', 'TALONNEUR', 'PILIER_DROIT',
  'DEUXIEME_LIGNE_GAUCHE', 'DEUXIEME_LIGNE_DROITE',
  'TROISIEME_LIGNE_AILE_GAUCHE', 'TROISIEME_LIGNE_AILE_DROITE', 'NUMERO_8',
]);

const PHASE_DURATION_SECONDS: Record<PhaseType, number> = {
  KICKOFF: 60,
  SCRUM: 90,
  LINEOUT: 60,
  RUCK: 55,
  OPEN_PLAY: 80,
  GOAL_LINE: 45,
  KICK: 40,
  PENALTY: 62,
  CONVERSION: 60,
  DROP_GOAL: 30,
  TRY: 30,
};

const MATCH_DURATION_SECONDS = 80 * 60;

/**
 * Coût de fatigue par phase.
 *
 * V0.13 — rééchelonnage ×2.1. Les valeurs V0.1 plafonnaient la fatigue de fin de
 * match autour de 37/100 : l'échelle 0-100 n'était exploitée qu'au tiers, le terme
 * `1 - fatigue/100 × 0.30` des sous-systèmes ne descendait jamais sous 0.89, et le
 * live moment FATIGUED_STAR (seuil 75) ne se déclenchait donc jamais.
 * Après rééchelonnage on termine autour de 75-80, ce qui rend enfin significatifs
 * l'endurance, la gestion du banc et la fin de match.
 */
const PHASE_FATIGUE_COST: Record<PhaseType, { att: number; def: number }> = {
  KICKOFF: { att: 0.65, def: 0.65 },
  SCRUM: { att: 2.5, def: 2.5 },
  LINEOUT: { att: 0.85, def: 0.85 },
  RUCK: { att: 1.05, def: 1.05 },
  OPEN_PLAY: { att: 1.5, def: 1.3 },
  GOAL_LINE: { att: 2.0, def: 2.3 },   // le pilonnage épuise, la défense encore plus
  KICK: { att: 0.45, def: 0.65 },
  PENALTY: { att: 0.4, def: 0.4 },
  CONVERSION: { att: 0.2, def: 0.2 },
  DROP_GOAL: { att: 0.4, def: 0.2 },
  TRY: { att: 1.05, def: 1.05 },
};

/**
 * Garde-fou : un match ne peut pas dépasser ce nombre de phases.
 *
 * Il n'existe que pour empêcher une boucle infinie si un enchaînement de phases
 * cessait un jour de faire avancer le chronomètre. Mesuré en v0.60 sur 500
 * matchs entre équipes de niveau 70 : 75 phases en médiane, 80 au maximum, et
 * jamais une seule rencontre arrêtée par ce plafond. La marge est d'un facteur
 * trois : il reste un garde-fou, pas une contrainte de jeu.
 */
export const MAX_PHASES = 250;

/**
 * V0.13 — au-delà de ce point du terrain (soit à 15 mètres de l'en-but), le jeu
 * courant bascule en séquence de pilonnage `GOAL_LINE`. Voir goal-line.ts.
 */
const GOAL_LINE_THRESHOLD = 35;

// =============================================================================
// Helpers d'extraction (identiques à V0.1)
// =============================================================================

interface SidePlayers {
  readonly pack: readonly Player[];
  readonly backs: readonly Player[];
  readonly kicker: Player;
}

function lookupPlayer(id: PlayerId, map: ReadonlyMap<PlayerId, Player>): Player {
  const p = map.get(id);
  if (!p) throw new Error(`MatchSession: joueur introuvable (id=${id})`);
  return p;
}

function extractSidePlayers(squad: MatchSquad, map: ReadonlyMap<PlayerId, Player>): SidePlayers {
  const pack: Player[] = [];
  const backs: Player[] = [];
  let kickerFromOuvreur: Player | undefined;

  for (const entry of squad.starters) {
    const player = lookupPlayer(entry.playerId, map);
    if (FORWARD_POSITIONS.has(entry.position)) pack.push(player);
    else backs.push(player);
    if (entry.position === 'OUVREUR') kickerFromOuvreur = player;
  }

  // 1. Buteur désigné explicitement par le manager
  let kicker: Player | undefined;
  if (squad.placeKickerId) {
    kicker = map.get(squad.placeKickerId);
  }
  // 2. Sinon, l'ouvreur titulaire
  if (!kicker) kicker = kickerFromOuvreur;
  // 3. Sinon, fallback : meilleur jeuAuPiedPlace parmi les titulaires
  if (!kicker) {
    let best: Player | undefined;
    let bestSkill = -1;
    for (const player of [...backs, ...pack]) {
      if (player.technical.jeuAuPiedPlace > bestSkill) {
        bestSkill = player.technical.jeuAuPiedPlace;
        best = player;
      }
    }
    kicker = best;
  }
  if (!kicker) throw new Error('MatchSession: aucun joueur dans la feuille de match');
  return { pack, backs, kicker };
}

// =============================================================================
// Runtime state
// =============================================================================

interface SideRuntime {
  /** V0.13 — effectif vivant : 15 sur le terrain + banc + fatigue individuelle. */
  readonly squad: SquadRuntime;
  tacticalBonus: number;
  /** Nombre de phases restantes avant que le tacticalBonus retombe à sa valeur de base. */
  tacticalBonusRemaining: number;
  /** Valeur de base du tacticalBonus (à laquelle on revient après un boost temporaire). */
  baseTacticalBonus: number;
  /** V0.8 — philosophie de touche pour ce side (undef si pas définie). */
  readonly lineoutPhilosophy?: import('./types.js').LineoutPhilosophy;
  /**
   * V0.65 — le carnet de touche de ce camp, ce qu'il a déjà joué cette saison,
   * et ce qu'il a appelé dans ce match.
   *
   * Le compteur de saison arrive de l'extérieur et n'est jamais modifié ici :
   * le moteur reste sans mémoire d'un match à l'autre. Ce qu'il produit,
   * `matchCalls`, remonte dans le résultat pour que la saison l'y ajoute.
   */
  readonly playbook?: Playbook;
  readonly seasonCalls: CallUsage;
  matchCalls: CallUsage;
  /** Qualité d'analyse : sa capacité à lire les habitudes d'en face. */
  readonly analysis: number;
  /** V0.32 — effets du plan de match, injectés dans chaque sous-système. */
  tactics: TacticalModifiers;
  /**
   * V0.50 — le capitaine désigné sur la feuille de match.
   *
   * `undefined` quand personne ne porte le brassard : le champ existait depuis
   * la V0.2 sans jamais être lu, et une feuille sans capitaine reste valide.
   */
  readonly captain?: Player;
  /** Vrai tant qu'il est sur le terrain. Faux dès qu'il sort. */
  captainOnField: boolean;
}

interface SimRuntime {
  minute: number;
  homeScore: number;
  awayScore: number;
  fieldPosition: number;
  phaseInPossession: number;
  attacker: 'HOME' | 'AWAY';
  lastScorer: 'HOME' | 'AWAY' | undefined;
  homeScrumDominance: number;
  scrumCount: number;
  /** V0.50 — élan signé pour les locaux, -100 à +100. */
  homeMomentum: number;
  /** V0.13 — temps consécutifs joués dans la séquence GOAL_LINE en cours. */
  phasesAtLine: number;
}

// =============================================================================
// API publique
// =============================================================================

export interface MatchSessionState {
  readonly status: 'in-progress' | 'awaiting-decision' | 'finished';
  readonly phases: readonly PhaseRecord[];
  readonly pendingMoment: LiveMoment | undefined;
  /** V0.45 — ce qu'a produit la causerie de mi-temps, une fois tenue. */
  readonly lastTalk: import('./team-talk.js').TalkOutcome | undefined;
  readonly homeScore: number;
  readonly awayScore: number;
  readonly minute: number;
  readonly homeFatigue: number;
  readonly awayFatigue: number;
}

export interface DecisionRecord {
  readonly momentId: string;
  readonly momentType: LiveMomentType;
  readonly optionId: string;
  readonly atPhaseIndex: number;
  readonly minute: number;
}

/** Vue du banc et du terrain, côté manager, pendant le match (V0.33). */
export interface LiveSquadView {
  readonly onField: readonly {
    readonly player: Player;
    readonly position: Position;
    readonly fatigue: number;
    readonly minutesPlayed: number;
  }[];
  readonly bench: readonly {
    readonly player: Player;
    readonly fatigue: number;
    /** Postes que ce remplaçant peut couvrir parmi ceux actuellement occupés. */
    readonly covers: readonly Position[];
  }[];
  /** V0.52 — joueurs au cachot, que le bord de touche doit voir. */
  readonly sinBinned: readonly { readonly id: PlayerId; readonly lastName: string }[];
  readonly substitutionsUsed: number;
  readonly substitutionsAllowed: number;
  /** Vrai si le pack n'a plus de première ligne de rechange (mêlées simulées). */
  readonly uncontestedScrums: boolean;
}

export interface MatchSession {
  readonly input: MatchInput;
  getState(): MatchSessionState;
  /**
   * V0.33 — état du banc du côté dirigé par le manager.
   *
   * Sans cette vue, les huit remplacements, la fatigue individuelle et les
   * règles de première ligne construits en V0.13 tournaient sans que le joueur
   * puisse ni les voir ni s'en servir.
   */
  getLiveSquad(): LiveSquadView;
  /** V0.33 — remplacement décidé par le manager. Renvoie un motif en cas de refus. */
  substitute(offPlayerId: PlayerId, onPlayerId: PlayerId): SubstitutionOutcome;
  /** V0.33 — change le plan de match en cours de rencontre (mi-temps, urgence). */
  setTacticalPlan(plan: PreMatchTacticalPlan): void;
  /** V0.33 — plan actuellement appliqué au côté du manager. */
  getTacticalPlan(): PreMatchTacticalPlan;
  /** Avance jusqu'à la prochaine décision ou la fin du match. No-op si awaiting-decision ou finished. */
  advance(): void;
  /** Applique l'option choisie pour la décision en cours et continue. */
  applyDecision(optionId: string): void;
  /**
   * V0.57 — remplacements déjà effectués, des deux côtés.
   *
   * `getResult()` les portait déjà, mais il ne répond qu'une fois le match
   * terminé. La vue à trente joueurs a besoin de savoir, **pendant** la
   * rencontre, qui est encore sur le pré : afficher un joueur sorti à la
   * cinquantième serait une contre-vérité, et le moteur connaît la réponse.
   */
  getSubstitutions(): {
    readonly home: readonly SubstitutionRecord[];
    readonly away: readonly SubstitutionRecord[];
  };
  /** Renvoie le résultat final. Throws si le match n'est pas terminé. */
  getResult(): MatchResult;
  /** Log des décisions prises pendant le match (pour sauvegarde / replay). */
  getDecisionLog(): readonly DecisionRecord[];
}

/** Décision pré-enregistrée pour replay automatique. */
export interface PreloadedDecision {
  readonly momentId: string;
  readonly optionId: string;
}

export interface MatchSessionOptions {
  /**
   * Si défini, les décisions matching (par momentId) sont auto-appliquées sans pause.
   * Permet de rejouer un match sauvegardé.
   */
  readonly preloadedDecisions?: readonly PreloadedDecision[];
}

// =============================================================================
// Helpers
// =============================================================================

/** Le cumul saison et ce que ce match a déjà montré, additionnés. */
function mergeUsage(season: CallUsage, match: CallUsage): CallUsage {
  const out: Record<string, number> = { ...season };
  for (const [id, n] of Object.entries(match)) out[id] = (out[id] ?? 0) + n;
  return out;
}

function clampField(x: number): number {
  if (x < -50) return -50;
  if (x > 50) return 50;
  return x;
}

function clampDominance(x: number): number {
  if (x < -60) return -60;
  if (x > 60) return 60;
  return x;
}

// =============================================================================
// Agrégation stats individuelles + narratif (utilisés dans getResult)
// =============================================================================

function emptyIndividualStats(): IndividualMatchStats {
  return {
    minutesPlayed: 0,
    tries: 0,
    tackles: 0,
    tacklesMissed: 0,
    metersWithBall: 0,
    carries: 0,
    turnoversWon: 0,
    handlingErrors: 0,
    penaltiesConceded: 0,
    cards: { yellow: 0, red: 0 },
    kicksFromHand: 0,
    placeKicks: { attempted: 0, made: 0 },
    defendersBeaten: 0,
    lineBreaks: 0,
  };
}

function withMutableStats(s: IndividualMatchStats): IndividualMatchStats & { tries: number; placeKicks: { attempted: number; made: number } } {
  return {
    ...s,
    placeKicks: { ...s.placeKicks },
    cards: { ...s.cards },
  } as IndividualMatchStats & { tries: number; placeKicks: { attempted: number; made: number } };
}

function computeIndividualStats(
  phases: readonly PhaseRecord[],
  playersById: ReadonlyMap<PlayerId, Player>,
  squads: readonly SquadRuntime[],
): Map<PlayerId, IndividualMatchStats> {
  const out = new Map<PlayerId, IndividualMatchStats>();

  function ensure(pid: PlayerId): IndividualMatchStats {
    let s = out.get(pid);
    if (!s) {
      s = withMutableStats(emptyIndividualStats());
      out.set(pid, s);
    }
    return s;
  }

  // V0.13 : minutes réellement jouées (le banc est actif — plus de 80' en dur).
  for (const sq of squads) {
    for (const [pid, minutes] of sq.minutesByPlayer) {
      if (minutes <= 0) continue;
      const s = ensure(pid);
      out.set(pid, { ...s, minutesPlayed: Math.min(80, Math.round(minutes)) });
    }
  }

  // V0.13 : apports individuels du jeu courant (courses, mètres, plaquages,
  // défenseurs battus, grattages). Voir carry.ts.
  for (const phase of phases) {
    for (const c of phase.outcome.contributions ?? []) {
      if (!playersById.has(c.playerId)) continue;
      const s = ensure(c.playerId);
      out.set(c.playerId, {
        ...s,
        carries: s.carries + (c.carries ?? 0),
        metersWithBall: s.metersWithBall + (c.metersWithBall ?? 0),
        tackles: s.tackles + (c.tackles ?? 0),
        tacklesMissed: s.tacklesMissed + (c.tacklesMissed ?? 0),
        turnoversWon: s.turnoversWon + (c.turnoversWon ?? 0),
        handlingErrors: s.handlingErrors + (c.handlingErrors ?? 0),
        defendersBeaten: s.defendersBeaten + (c.defendersBeaten ?? 0),
        lineBreaks: s.lineBreaks + (c.lineBreaks ?? 0),
      });
    }
  }

  for (const phase of phases) {
    const keyId = phase.outcome.keyPlayerId;
    if (!keyId) continue;
    if (!playersById.has(keyId)) continue;
    const stats = ensure(keyId);

    if (phase.outcome.tryScored) {
      out.set(keyId, { ...stats, tries: stats.tries + 1 });
    }
    if (phase.type === 'PENALTY' && (phase.outcome.summary.startsWith('pénalité réussie') || phase.outcome.summary.startsWith('pénalité manquée'))) {
      const made = phase.outcome.pointsScored?.type === 'PENALTY';
      out.set(keyId, {
        ...stats,
        placeKicks: { attempted: stats.placeKicks.attempted + 1, made: stats.placeKicks.made + (made ? 1 : 0) },
      });
    }
    if (phase.type === 'CONVERSION') {
      const made = phase.outcome.pointsScored?.type === 'CONVERSION';
      out.set(keyId, {
        ...stats,
        placeKicks: { attempted: stats.placeKicks.attempted + 1, made: stats.placeKicks.made + (made ? 1 : 0) },
      });
    }
  }

  // Arrondi final des mètres (accumulés en flottant phase par phase).
  for (const [pid, st] of out) {
    out.set(pid, { ...st, metersWithBall: Math.round(st.metersWithBall) });
  }

  return out;
}

function topScorers(stats: ReadonlyMap<PlayerId, IndividualMatchStats>, players: ReadonlyMap<PlayerId, Player>, limit = 3): Player[] {
  const entries = [...stats.entries()]
    .filter(([, s]) => s.tries > 0)
    .sort(([, a], [, b]) => b.tries - a.tries);
  const top: Player[] = [];
  for (const [id] of entries) {
    const p = players.get(id);
    if (p) top.push(p);
    if (top.length >= limit) break;
  }
  return top;
}

function bestKicker(stats: ReadonlyMap<PlayerId, IndividualMatchStats>, players: ReadonlyMap<PlayerId, Player>): { player: Player; made: number; attempts: number } | undefined {
  let bestPid: PlayerId | undefined;
  let bestAttempts = 0;
  for (const [pid, s] of stats) {
    if (s.placeKicks.attempted > bestAttempts) {
      bestAttempts = s.placeKicks.attempted;
      bestPid = pid;
    }
  }
  if (!bestPid) return undefined;
  const player = players.get(bestPid);
  if (!player) return undefined;
  const stat = stats.get(bestPid)!;
  return { player, made: stat.placeKicks.made, attempts: stat.placeKicks.attempted };
}

function buildNarrativeSummary(
  phases: readonly PhaseRecord[],
  homeScore: number,
  awayScore: number,
  homeClub: Club | undefined,
  awayClub: Club | undefined,
  individualStats: ReadonlyMap<PlayerId, IndividualMatchStats>,
  playersById: ReadonlyMap<PlayerId, Player>,
): string {
  const homeName = homeClub?.name ?? 'Domicile';
  const awayName = awayClub?.name ?? 'Extérieur';
  const homeTries = phases.filter(p => p.outcome.tryScored === 'HOME').length;
  const awayTries = phases.filter(p => p.outcome.tryScored === 'AWAY').length;
  const diff = homeScore - awayScore;

  // Ouverture
  let opening: string;
  if (diff === 0) {
    opening = `Match nul ${homeScore}-${awayScore} entre ${homeName} et ${awayName}.`;
  } else if (Math.abs(diff) >= 17) {
    const winner = diff > 0 ? homeName : awayName;
    opening = `Démonstration de ${winner} : ${homeScore}-${awayScore}.`;
  } else if (Math.abs(diff) >= 8) {
    const winner = diff > 0 ? homeName : awayName;
    opening = `${winner} s'impose ${homeScore}-${awayScore}.`;
  } else {
    const winner = diff > 0 ? homeName : awayName;
    opening = `Victoire serrée de ${winner} ${homeScore}-${awayScore} dans un match disputé.`;
  }

  // Marqueurs principaux
  const top = topScorers(individualStats, playersById, 3);
  const scorerLines: string[] = [];
  for (const p of top) {
    const t = individualStats.get(p.id)?.tries ?? 0;
    if (t >= 2) {
      scorerLines.push(`${p.firstName} ${p.lastName} a inscrit ${t} essais`);
    } else if (t === 1 && top.length === 1) {
      scorerLines.push(`${p.firstName} ${p.lastName} a marqué l'unique essai`);
    }
  }

  // Buteur
  const kicker = bestKicker(individualStats, playersById);
  let kickerLine = '';
  if (kicker && kicker.attempts >= 3) {
    const pct = Math.round((kicker.made / kicker.attempts) * 100);
    kickerLine = ` ${kicker.player.lastName} ${kicker.made}/${kicker.attempts} au pied (${pct}%).`;
  }

  // Volumétrie essais
  const triesLine = `${homeTries} essai${homeTries > 1 ? 's' : ''} pour ${homeName}, ${awayTries} pour ${awayName}.`;

  const parts = [opening, triesLine];
  if (scorerLines.length > 0) {
    parts.push(scorerLines.join(', ') + '.');
  }
  if (kickerLine) parts.push(kickerLine.trim());

  return parts.join(' ');
}

// =============================================================================
// Implémentation
// =============================================================================

export function createMatchSession(
  input: MatchInput,
  seed: string,
  options: MatchSessionOptions = {},
): MatchSession {
  const rng = createRng(seed);
  const preloadedDecisions = options.preloadedDecisions ?? [];

  // V0.58 — le public entre enfin dans le calcul. `homeFans` était déclaré
  // depuis la V0.1 et lu nulle part ; l'effet du remplissage était bricolé
  // côté interface, repliée dans un bonus tactique. Un stade plein porte son
  // équipe, un stade vide retire à « recevoir » l'essentiel de son sens.
  const homeAdvantage = input.homeAdvantageBonus * 5 * crowdFactor(input.homeFans);
  const homeWeekly = input.homeWeeklyModifiers;
  const awayWeekly = input.awayWeeklyModifiers;
  const homeBonus = homeAdvantage + (homeWeekly?.tacticalBonus ?? 0);
  const awayBonus = awayWeekly?.tacticalBonus ?? 0;
  const homeInitialFatigue = Math.max(0, Math.min(40, homeWeekly?.initialFatigueDelta ?? 0));
  const awayInitialFatigue = Math.max(0, Math.min(40, awayWeekly?.initialFatigueDelta ?? 0));
  function buildSide(
    decisions: typeof input.home,
    bonus: number,
    initialFatigue: number,
    philosophy: import('./types.js').LineoutPhilosophy | undefined,
    weekly: import('./types.js').HomeWeeklyModifiers | undefined,
    seasonCalls: CallUsage | undefined,
  ): SideRuntime {
    const extracted = extractSidePlayers(decisions.squad, input.playersById);
    const tactics = resolveTactics(decisions.tacticalPlan);
    const captain = captainFrom(decisions.squad.starters, input.playersById);
    // La philosophie de touche du plan de semaine prime : c'est un choix plus
    // fin que le simple focus « maul » du plan de match.
    const effectivePhilosophy = philosophy ?? tactics.lineoutPhilosophy;
    return {
      squad: createSquadRuntime(
        decisions.squad.starters,
        decisions.squad.substitutes,
        input.playersById,
        extracted.kicker,
        initialFatigue,
      ),
      tacticalBonus: bonus,
      baseTacticalBonus: bonus,
      tacticalBonusRemaining: 0,
      tactics,
      ...(effectivePhilosophy ? { lineoutPhilosophy: effectivePhilosophy } : {}),
      ...(weekly?.playbook ? { playbook: weekly.playbook } : {}),
      seasonCalls: seasonCalls ?? {},
      matchCalls: {},
      analysis: Math.max(0, Math.min(1, weekly?.analysis ?? 0)),
      ...(captain ? { captain } : {}),
      captainOnField: captain !== undefined,
    };
  }

  const home: SideRuntime = buildSide(
    input.home, homeBonus, homeInitialFatigue, homeWeekly?.lineoutPhilosophy,
    homeWeekly, input.homeCallUsage,
  );
  const away: SideRuntime = buildSide(
    input.away, awayBonus, awayInitialFatigue, awayWeekly?.lineoutPhilosophy,
    awayWeekly, input.awayCallUsage,
  );
  // V0.9 — côté contrôlé par le joueur (pour live moments + décisions)
  const playerSide: 'HOME' | 'AWAY' = input.playerSide ?? 'HOME';
  const playerRuntime = playerSide === 'HOME' ? home : away;
  /** V0.33 — plan courant du côté manager, modifiable en cours de match. */
  let currentPlayerPlan: PreMatchTacticalPlan =
    (playerSide === 'HOME' ? input.home : input.away).tacticalPlan ?? NEUTRAL_PLAN;
  const opponentSide: 'HOME' | 'AWAY' = playerSide === 'HOME' ? 'AWAY' : 'HOME';

  const sim: SimRuntime = {
    minute: 0,
    homeScore: 0,
    awayScore: 0,
    fieldPosition: -10,
    phaseInPossession: 0,
    attacker: 'AWAY',
    lastScorer: undefined,
    homeScrumDominance: 0,
    scrumCount: 0,
    phasesAtLine: 0,
    homeMomentum: 0,
  };

  const phases: PhaseRecord[] = [];
  let nextPhaseType: PhaseType = 'KICKOFF';
  /** V0.13 — routage vers GOAL_LINE décidé dans applyOutcome (voir plus bas). */
  let nextPhaseOverride: PhaseType | undefined = undefined;

  // Live moment state
  const triggeredMoments = new Set<LiveMomentType>();
  let pendingMoment: LiveMoment | undefined = undefined;
  /** V0.45 — dernière causerie tenue, pour le récit d'après-match. */
  let lastTalk: import('./team-talk.js').TalkOutcome | undefined = undefined;
  /** Décision verrouillée pour la prochaine phase PENALTY (côté HOME uniquement). */
  let forcedHomePenaltyChoice: 'POSTS' | 'TOUCH' | 'TAP' | undefined = undefined;

  // Log des décisions prises (pour sauvegarde / replay)
  const decisionLog: DecisionRecord[] = [];

  let finished = false;

  // ---------------------------------------------------------------------------
  // Effets temporaires (durée en phases)
  // ---------------------------------------------------------------------------

  function tickTacticalBonus(side: SideRuntime): void {
    if (side.tacticalBonusRemaining > 0) {
      side.tacticalBonusRemaining -= 1;
      if (side.tacticalBonusRemaining <= 0) {
        side.tacticalBonus = side.baseTacticalBonus;
      }
    }
  }

  /**
   * V0.50 — décalage de dominance en mêlée de la phase courante.
   *
   * Consommé par le calcul d'élan juste après : une mêlée qui recule est le
   * seul endroit où une domination lente devient un élan visible.
   */
  let lastScrumShift: number | undefined = undefined;

  /**
   * V0.51 — état du vestiaire d'un camp, recalculé à chaque phase.
   *
   * À chaque phase et non une fois pour toutes : les remplacements changent qui
   * est sur le terrain, et la causerie de mi-temps déplace réellement le moral
   * des quinze présents.
   */
  function moraleOf(side: SideRuntime): TeamMorale {
    const onField = side.squad.slots.map(sl => sl.player);
    const relations = side === home ? input.homeRelations : input.awayRelations;
    return teamMorale(onField, relations);
  }

  /**
   * V0.51 — ce que le ciel impose, identique pour les deux camps.
   *
   * Calculé une fois : il ne se met pas à pleuvoir à la 40ᵉ. Ce qui distingue
   * les deux équipes n'est pas le temps qu'il fait, mais la façon dont chacune
   * s'y est préparée.
   */
  const meteo = weatherEffects(input.weather);

  /**
   * V0.52 — ce que l'arbitre impose, par camp.
   *
   * Calculé une fois : un arbitre ne change pas d'avis à la mi-temps. Le biais
   * domicile est porté par le camp, d'où les deux valeurs.
   */
  const siffletHome = refereeEffects(input.referee, 'HOME');
  const siffletAway = refereeEffects(input.referee, 'AWAY');
  const sifflet = (side: SideRuntime) => (side === home ? siffletHome : siffletAway);

  /** Consigne de discipline du camp, quand il y en a une. */
  const consigne = (side: SideRuntime) =>
    policyEffects(side === home ? input.homeDisciplinePolicy : input.awayDisciplinePolicy);

  /** Ce que l'état du groupe vaut sur le terrain, pour un camp. */
  function esprit(side: SideRuntime): ReturnType<typeof moraleEffects> {
    return moraleEffects(moraleOf(side));
  }

  /** Effets de l'élan pour un camp, à l'instant où la phase se résout. */
  function elan(side: 'HOME' | 'AWAY'): ReturnType<typeof momentumEffects> {
    return momentumEffects(momentumFor(sim.homeMomentum, side));
  }

  /**
   * Tenue d'un groupe, hors attributs individuels.
   *
   * Deux apports qui se multiplient : le capitaine, relatif au XV qu'il a sous
   * les yeux (V0.50), et l'état du vestiaire (V0.51). Un groupe qui va mal se
   * sanctionne, et un capitaine respecté le retient — les deux peuvent se
   * compenser, ce qui est exactement ce qu'on observe.
   */
  function captainFactor(side: SideRuntime): number {
    return captainDisciplineFactor(
      side.captain,
      side.captainOnField,
      averageAuthority(side.squad.slots.map(sl => sl.player)),
    ) * esprit(side).indisciplineFactor;
  }

  /**
   * V0.50 — constate la sortie du capitaine, quelle qu'en soit la cause.
   *
   * Appelé après **tout** remplacement, y compris ceux que le staff décide
   * seul : remplacement tactique, coup dur, banc vidé. Le brassard change de
   * bras, et le groupe le paie un moment.
   *
   * Idempotent : une fois le capitaine sorti, il ne revient pas — la règle du
   * rugby l'interdit, et le malus ne doit pas se cumuler.
   */
  function noteCaptainDeparture(side: SideRuntime): void {
    if (side.captain === undefined || !side.captainOnField) return;
    if (side.squad.slots.some(sl => sl.player.id === side.captain?.id)) return;

    side.captainOnField = false;
    const loss = armbandLoss(side.captain);
    if (loss.tacticalMalus === 0) return;
    side.tacticalBonus = side.baseTacticalBonus + loss.tacticalMalus;
    side.tacticalBonusRemaining = loss.phases;
  }

  /**
   * Applique l'effet d'un live moment au côté contrôlé par le joueur.
   * V0.13 : les effets ciblent `playerRuntime` (et non plus HOME en dur), et
   * `substitutePlayerId` provoque un vrai remplacement.
   */
  function applyEffect(effect: MomentEffect): void {
    const side = playerRuntime;
    if (effect.tacticalBonus !== undefined) {
      side.tacticalBonus = side.baseTacticalBonus + effect.tacticalBonus;
      side.tacticalBonusRemaining = effect.phasesRemaining ?? Number.POSITIVE_INFINITY;
    }
    if (effect.fatigueDelta !== undefined) {
      applyFatigueDeltaOnField(side.squad, effect.fatigueDelta);
    }
    if (effect.forcePenaltyChoice !== undefined) {
      forcedHomePenaltyChoice = effect.forcePenaltyChoice;
    }
    // V0.13 : le banc est actif — on sort réellement le joueur désigné.
    if (effect.substitutePlayerId !== undefined) {
      substituteNamedPlayer(side, effect.substitutePlayerId as PlayerId, 'MANAGER');
    }
    // V0.13 : "vider le banc" — on enchaîne jusqu'à N remplacements automatiques.
    if (effect.emptyBenchCount !== undefined) {
      const minute = Math.floor(sim.minute / 60);
      for (let i = 0; i < effect.emptyBenchCount; i++) {
        const plan = planAutoSubstitution(side.squad, Math.max(minute, 50));
        if (!plan) break;
        applySubstitution(side.squad, { ...plan, reason: 'TACTIQUE' });
        noteCaptainDeparture(side);
      }
    }
  }

  /** Sort un joueur nommément désigné et fait entrer la meilleure doublure du banc. */
  function substituteNamedPlayer(
    side: SideRuntime,
    offPlayerId: PlayerId,
    reason: SubstitutionRecord['reason'],
  ): void {
    const slot = side.squad.slots.find(s => s.player.id === offPlayerId);
    if (!slot) return;
    const incoming = bestCoverFor(side.squad, slot.position);
    if (!incoming) return;
    applySubstitution(side.squad, {
      offPlayerId,
      onPlayerId: incoming.id,
      minute: Math.floor(sim.minute / 60),
      reason,
    });
    noteCaptainDeparture(side);
  }

  // ---------------------------------------------------------------------------
  // Détection de live moments
  // ---------------------------------------------------------------------------

  /**
   * État du vestiaire au moment de parler.
   *
   * Moyenne du XV sur le terrain, pas de l'effectif : ce sont ces quinze-là
   * qu'on a devant soi à la pause.
   */
  function dressingRoom(): DressingRoom {
    const onField = playerRuntime.squad.slots.map(sl => sl.player);
    if (onField.length === 0) return { mood: 55, leadership: 55, composure: 55 };
    const avg = (pick: (p: typeof onField[number]) => number): number =>
      Math.round(onField.reduce((sum, p) => sum + pick(p), 0) / onField.length);
    return {
      mood: avg(p => p.dynamic.mood),
      // V0.50 — une causerie ne se diffuse pas dans une moyenne : elle passe
      // d'abord par le capitaine, quand il est encore là pour la relayer.
      leadership: relayedLeadership(
        avg(p => p.mental.leadership),
        playerRuntime.captain,
        playerRuntime.captainOnField,
      ),
      composure: avg(p => p.mental.sangFroid),
    };
  }

  function detectLiveMoment(): LiveMoment | undefined {
    const minute = Math.floor(sim.minute / 60);

    // 1) MI-TEMPS : à 40' une seule fois
    if (minute >= 40 && !triggeredMoments.has('HALF_TIME')) {
      // V0.45 — la causerie remplace la bascule tactique. On s'adresse au
      // groupe, et la réponse dépend de la situation et du vestiaire.
      const mine = playerSide === 'HOME' ? sim.homeScore : sim.awayScore;
      const theirs = playerSide === 'HOME' ? sim.awayScore : sim.homeScore;
      return makeTeamTalkMoment(phases.length, mine, theirs, dressingRoom());
    }

    // 2) DEFENSIVE_PRESSURE : 2+ essais ENCAISSÉS par le joueur dans les 20 dernières phases
    if (minute >= 20 && !triggeredMoments.has('DEFENSIVE_PRESSURE')) {
      const lookback = phases.slice(-20);
      const triesAgainst = lookback.filter(p => p.outcome.tryScored === opponentSide).length;
      if (triesAgainst >= 2) {
        return makeDefensivePressureMoment(phases.length, minute, triesAgainst);
      }
    }

    // 3) FATIGUED_STAR : V0.13 — le joueur le plus émoussé *individuellement*, pas
    //    une moyenne d'équipe. Il faut une doublure sur le banc pour que le choix ait du sens.
    if (minute >= 55 && !triggeredMoments.has('FATIGUED_STAR')) {
      const worst = mostFatiguedOnField(playerRuntime.squad);
      if (worst && worst.fatigue > 78) {
        const slot = playerRuntime.squad.slots.find(s => s.player.id === worst.player.id);
        const cover = slot ? bestCoverFor(playerRuntime.squad, slot.position) : undefined;
        if (cover) {
          return makeFatiguedStarMoment(phases.length, minute, worst.player, worst.fatigue, cover);
        }
      }
    }

    // 3bis) BENCH_CALL : V0.13 — l'heure de jeu, le banc est encore plein, on demande
    //       au manager comment il veut l'utiliser (les "finishers").
    if (
      minute >= 55 &&
      !triggeredMoments.has('BENCH_CALL') &&
      playerRuntime.squad.bench.length >= 4 &&
      playerRuntime.squad.substitutions.length === 0
    ) {
      return makeBenchCallMoment(
        phases.length,
        minute,
        packFatigue(playerRuntime.squad),
        backsFatigue(playerRuntime.squad),
        playerRuntime.squad.bench.length,
      );
    }

    // 3ter) GOAL_LINE_STAND : V0.13 — le pilonnage s'installe à cinq mètres, d'un
    //       côté ou de l'autre. C'est le pic de tension d'un match de rugby.
    if (sim.phasesAtLine >= 2 && !triggeredMoments.has('GOAL_LINE_STAND')) {
      const playerScore = playerSide === 'HOME' ? sim.homeScore : sim.awayScore;
      const oppScore = playerSide === 'HOME' ? sim.awayScore : sim.homeScore;
      return makeGoalLineStandMoment(
        phases.length,
        minute,
        sim.attacker !== playerSide,      // le joueur défend si l'adversaire attaque
        sim.phasesAtLine,
        playerScore - oppScore,
      );
    }

    // 4) CRUNCH_TIME : minute ≥ 70 et écart ≤ 7 — l'écart est exprimé du POV joueur
    if (minute >= 70 && !triggeredMoments.has('CRUNCH_TIME')) {
      const playerScore = playerSide === 'HOME' ? sim.homeScore : sim.awayScore;
      const oppScore = playerSide === 'HOME' ? sim.awayScore : sim.homeScore;
      if (Math.abs(playerScore - oppScore) <= 7) {
        return makeCrunchTimeMoment(phases.length, minute, playerScore - oppScore);
      }
    }

    return undefined;
  }

  // ---------------------------------------------------------------------------
  // Détection PRÉ-phase : pénalité ambigüe pour HOME
  // ---------------------------------------------------------------------------

  function detectPreDecisionMoment(): LiveMoment | undefined {
    if (nextPhaseType !== 'PENALTY') return undefined;
    // V0.9 : la décision est proposée quand le côté joueur attaque (pas seulement HOME)
    if (sim.attacker !== playerSide) return undefined;
    if (forcedHomePenaltyChoice !== undefined) return undefined;
    if (sim.fieldPosition < -5 || sim.fieldPosition > 38) return undefined;
    if (triggeredMoments.has('PENALTY_DECISION')) return undefined;
    const playerScore = playerSide === 'HOME' ? sim.homeScore : sim.awayScore;
    const oppScore = playerSide === 'HOME' ? sim.awayScore : sim.homeScore;
    return makePenaltyDecisionMoment(
      phases.length,
      Math.floor(sim.minute / 60),
      sim.fieldPosition,
      playerScore - oppScore,
    );
  }

  // ---------------------------------------------------------------------------
  // Dispatch de phase (identique V0.1 sauf forcedHomePenaltyChoice)
  // ---------------------------------------------------------------------------

  function dispatchPhase(phaseType: PhaseType): PhaseOutcome {
    const att = sim.attacker === 'HOME' ? home : away;
    const def = sim.attacker === 'HOME' ? away : home;

    switch (phaseType) {
      case 'KICKOFF': {
        const receiver: 'HOME' | 'AWAY' = sim.attacker;
        return {
          possessionAfter: receiver,
          metersGained: 0,
          nextPhase: rng.next() < 0.85 ? 'OPEN_PLAY' : 'SCRUM',
          summary: 'engagement réceptionné',
        };
      }
      case 'SCRUM': {
        // V0.13 : plus de première ligne spécialiste d'un côté → mêlées simulées.
        // Personne ne pousse, l'introduction est rendue proprement.
        if (scrumsUncontested(att.squad) || scrumsUncontested(def.squad)) {
          return {
            possessionAfter: sim.attacker,
            metersGained: 0,
            nextPhase: 'OPEN_PLAY',
            summary: 'mêlée simulée — introduction conservée',
          };
        }
        const cumulativeDominance = sim.attacker === 'HOME'
          ? sim.homeScrumDominance
          : -sim.homeScrumDominance;
        const inp: ScrumInput = {
          attackForwards: onFieldPack(att.squad),
          defenseForwards: onFieldPack(def.squad),
          attackPossession: sim.attacker,
          attackTacticalBonus: att.tacticalBonus + att.tactics.scrumBonus,
          defenseTacticalBonus: def.tacticalBonus + def.tactics.scrumBonus,
          fatigueAttack: packFatigue(att.squad),
          fatigueDefense: packFatigue(def.squad),
          fieldCondition: input.fieldCondition,
          cumulativeDominance,
          scrumIndex: sim.scrumCount,
        };
        const outcome = simulateScrum(inp, rng);
        const shift = computeScrumDominanceShift(inp);
        const homeShift = sim.attacker === 'HOME' ? shift : -shift;
        lastScrumShift = homeShift;
        sim.homeScrumDominance = clampDominance(sim.homeScrumDominance + homeShift);
        sim.scrumCount += 1;
        return outcome;
      }
      case 'LINEOUT': {
        /*
         * V0.65 — la combinaison se choisit ici, sur la position du ballon.
         *
         * Le manager dessine le carnet, il n'appelle pas chaque touche : ce
         * serait quatorze fenêtres par match. Et la lecture se calcule sur le
         * cumul saison **plus** ce que ce match a déjà montré : une équipe qui
         * répète la même chose pendant quatre-vingts minutes finit lue avant le
         * coup de sifflet final, pas la semaine suivante.
         */
        const call = att.playbook
          ? callForSituation({ playbook: att.playbook, fieldPosition: sim.fieldPosition + 50 })
          : undefined;
        const read = call
          ? readLevel({
            usage: mergeUsage(att.seasonCalls, att.matchCalls),
            callId: call.id,
            opponentPreparation: def.analysis,
          })
          : 0;
        if (call) att.matchCalls = recordCall(att.matchCalls, call.id);

        const inp: LineoutInput = {
          attackPack: onFieldPack(att.squad),
          defensePack: onFieldPack(def.squad),
          attackPossession: sim.attacker,
          fatigueAttack: packFatigue(att.squad),
          fatigueDefense: packFatigue(def.squad),
          // Le vent gêne le lanceur, pas les sauteurs adverses.
          attackBonus: att.tactics.lineoutBonus - meteo.lineoutMalus,
          defenseBonus: def.tactics.lineoutBonus,
          ...(att.lineoutPhilosophy ? { philosophy: att.lineoutPhilosophy } : {}),
          ...(call ? { call, read } : {}),
        };
        return simulateLineout(inp, rng);
      }
      case 'RUCK': {
        const inp: RuckInput = {
          attackForwardsClose: onFieldPack(att.squad).slice(0, 3),
          defenseForwardsClose: onFieldPack(def.squad).slice(0, 3),
          attackPossession: sim.attacker,
          fatigueAttack: packFatigue(att.squad),
          fatigueDefense: packFatigue(def.squad),
          attackTacticalBonus: att.tacticalBonus - att.tactics.openPlayMalus
            + esprit(att).confidence,
          defenseTacticalBonus: def.tacticalBonus - def.tactics.openPlayMalus
            + esprit(def).confidence,
          attackDisciplineFactor: captainFactor(att)
            * sifflet(att).ruckPenalty * consigne(att).penaltyConceded,
          defenseDisciplineFactor: captainFactor(def)
            * sifflet(def).ruckPenalty * consigne(def).penaltyConceded,
          attackCardRate: sifflet(att).cardRate,
          defenseCardRate: sifflet(def).cardRate,
          attackTurnoverFactor: consigne(att).turnoverWon,
          defenseTurnoverFactor: consigne(def).turnoverWon,
        };
        return simulateRuck(inp, rng);
      }
      case 'OPEN_PLAY': {
        const inp: OpenPlayInput = {
          attackBacks: onFieldBacks(att.squad),
          defenseBacks: onFieldBacks(def.squad),
          attackPack: onFieldPack(att.squad),
          defensePack: onFieldPack(def.squad),
          attackPossession: sim.attacker,
          fieldPosition: sim.fieldPosition,
          fatigueAttack: squadFatigue(att.squad),
          fatigueDefense: squadFatigue(def.squad),
          phaseInPossession: sim.phaseInPossession,
          attackTacticalBonus: att.tacticalBonus - att.tactics.openPlayMalus
            + elan(sim.attacker).tacticalBonus + esprit(att).confidence,
          defenseTacticalBonus: def.tacticalBonus - def.tactics.openPlayMalus
            + elan(sim.attacker === 'HOME' ? 'AWAY' : 'HOME').tacticalBonus
            + esprit(def).confidence,
          kickTendency: att.tactics.kickTendency * meteo.kickTendency,
          attackErrorRisk: att.tactics.ownErrorRisk
            * elan(sim.attacker).errorFactor * esprit(att).errorFactor
            * meteo.handlingFactor,
          defensePressure: def.tactics.pressureOnAttack * esprit(def).tackleFactor,
          defensePenaltyRisk: def.tactics.penaltyRisk,
          defenseTryRisk: def.tactics.tryConceded * meteo.tryFactor,
          attackDisciplineFactor: captainFactor(att) * sifflet(att).offsidePenalty,
          defenseDisciplineFactor: captainFactor(def) * sifflet(def).offsidePenalty,
          attackCardRate: sifflet(att).cardRate,
          defenseCardRate: sifflet(def).cardRate,
        };
        return simulateOpenPlay(inp, rng);
      }
      case 'GOAL_LINE': {
        const inp: GoalLineInput = {
          attackPack: onFieldPack(att.squad),
          attackBacks: onFieldBacks(att.squad),
          defensePack: onFieldPack(def.squad),
          defenseBacks: onFieldBacks(def.squad),
          attackPossession: sim.attacker,
          fieldPosition: sim.fieldPosition,
          fatigueAttack: squadFatigue(att.squad),
          fatigueDefense: squadFatigue(def.squad),
          phasesAtLine: sim.phasesAtLine,
          // C'est à la ligne que l'état d'esprit se voit le plus : le pilonnage
          // se gagne à l'engagement, pas aux attributs.
          attackTacticalBonus: att.tacticalBonus - att.tactics.openPlayMalus
            + esprit(att).confidence,
          defenseTacticalBonus: def.tacticalBonus - def.tactics.openPlayMalus
            + esprit(def).confidence,
        };
        return simulateGoalLine(inp, rng);
      }
      case 'KICK': {
        const inp: TacticalKickInput = {
          kicker: att.squad.kicker,
          attackPossession: sim.attacker,
          fieldPosition: sim.fieldPosition,
          fatigue: playerFatigue(att.squad, att.squad.kicker.id),
        };
        return simulateTacticalKick(inp, rng);
      }
      case 'PENALTY': {
        const inOpp22 = sim.fieldPosition >= 35;
        const inOppHalf = sim.fieldPosition >= 0;
        let decision: 'POSTS' | 'TOUCH' | 'TAP';

        // V0.9 : si le côté joueur attaque ET qu'un choix a été forcé (live moment) → on l'utilise
        if (sim.attacker === playerSide && forcedHomePenaltyChoice !== undefined) {
          decision = forcedHomePenaltyChoice;
          forcedHomePenaltyChoice = undefined;
        } else {
          // V0.13 : recalibré après la hausse du nombre de pénalités sifflées.
          // Les équipes prennent un peu plus souvent les points, comme en Top 14.
          const r = rng.next();
          if (inOpp22) decision = r < 0.52 ? 'TOUCH' : r < 0.97 ? 'POSTS' : 'TAP';
          else if (inOppHalf) decision = r < 0.78 ? 'POSTS' : r < 0.97 ? 'TOUCH' : 'TAP';
          else decision = r < 0.85 ? 'TOUCH' : r < 0.95 ? 'POSTS' : 'TAP';
        }

        if (decision === 'POSTS') {
          const distance = Math.max(15, 55 - sim.fieldPosition);
          const kicker = att.squad.kicker;
          const made = rng.next() < placeKickSuccessProb({
            kicker,
            distance,
            angleFactor: 0.95,
            fatigue: playerFatigue(att.squad, kicker.id),
            weather: input.weather,
          }) + elan(sim.attacker).kickAccuracyDelta / 100;
          const otherSide: 'HOME' | 'AWAY' = sim.attacker === 'HOME' ? 'AWAY' : 'HOME';
          const kickerName = `${kicker.firstName} ${kicker.lastName}`;
          if (made) {
            return {
              possessionAfter: otherSide,
              metersGained: 0,
              nextPhase: 'KICKOFF',
              pointsScored: { team: sim.attacker, value: 3, type: 'PENALTY' },
              keyPlayerId: kicker.id,
              summary: `pénalité réussie par ${kickerName} (${Math.round(distance)}m)`,
            };
          }
          return {
            possessionAfter: otherSide,
            metersGained: 0,
            nextPhase: 'OPEN_PLAY',
            keyPlayerId: kicker.id,
            summary: `pénalité manquée par ${kickerName} (${Math.round(distance)}m)`,
          };
        }
        if (decision === 'TOUCH') {
          return {
            possessionAfter: sim.attacker,
            metersGained: 30,
            nextPhase: 'LINEOUT',
            summary: 'pénaltouche jouée',
          };
        }
        return {
          possessionAfter: sim.attacker,
          metersGained: 5,
          nextPhase: 'OPEN_PLAY',
          summary: 'pénalité jouée vite',
        };
      }
      case 'TRY': {
        return {
          possessionAfter: sim.attacker,
          metersGained: 0,
          nextPhase: 'CONVERSION',
          summary: 'essai posé',
        };
      }
      case 'CONVERSION': {
        const kicker = att.squad.kicker;
        const made = rng.next() < placeKickSuccessProb({
          kicker,
          distance: 25,
          angleFactor: 0.85,
          fatigue: playerFatigue(att.squad, kicker.id),
          weather: input.weather,
        }) + elan(sim.attacker).kickAccuracyDelta / 100;
        const otherSide: 'HOME' | 'AWAY' = sim.attacker === 'HOME' ? 'AWAY' : 'HOME';
        return {
          possessionAfter: otherSide,
          metersGained: 0,
          nextPhase: 'KICKOFF',
          keyPlayerId: kicker.id,
          summary: made
            ? `transformation réussie par ${kicker.lastName}`
            : `transformation manquée par ${kicker.lastName}`,
          ...(made ? { pointsScored: { team: sim.attacker, value: 2, type: 'CONVERSION' as const } } : {}),
        };
      }
      case 'DROP_GOAL': {
        const otherSide: 'HOME' | 'AWAY' = sim.attacker === 'HOME' ? 'AWAY' : 'HOME';
        return {
          possessionAfter: otherSide,
          metersGained: 0,
          nextPhase: 'KICKOFF',
          summary: 'drop',
        };
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Remplacements automatiques
  // ---------------------------------------------------------------------------

  /**
   * Politique de banc appliquée aux deux camps après chaque phase.
   *
   * Le côté joueur est concerné lui aussi : ses live moments lui permettent d'agir
   * *plus tôt* et de choisir *qui* sort, mais s'il ne fait rien son staff finit par
   * vider le banc — sinon il finirait le match à 15 joueurs cuits pendant que l'IA
   * fait entrer ses finishers.
   */
  function runAutoSubstitutions(): void {
    const minute = Math.floor(sim.minute / 60);
    for (const side of [home, away]) {
      // Un seul changement par phase et par camp : on étale les entrées.
      const plan = planAutoSubstitution(side.squad, minute);
      if (plan) {
        applySubstitution(side.squad, plan);
        noteCaptainDeparture(side);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Cartons
  // ---------------------------------------------------------------------------

  /** Cartons distribués pendant la rencontre, pour les suites disciplinaires. */
  const matchCards: { playerId: PlayerId; color: 'YELLOW' | 'RED'; minute: number }[] = [];

  /**
   * V0.52 — sort le sanctionné du terrain.
   *
   * Le camp fautif se déduit du bénéficiaire de la pénalité : c'est l'autre. À
   * défaut de pénalité — cas qui n'existe pas aujourd'hui mais que le type
   * autorise — on cherche le joueur dans les deux effectifs.
   */
  function applyCard(outcome: PhaseOutcome): void {
    const card = outcome.cardIssued;
    if (card === undefined) return;

    const side = outcome.penaltyAwarded !== undefined
      ? (outcome.penaltyAwarded === 'HOME' ? away : home)
      : (home.squad.slots.some(sl => sl.player.id === card.playerId) ? home : away);

    const minute = Math.floor(sim.minute / 60);
    const done = card.color === 'RED'
      ? sendOff(side.squad, card.playerId, minute)
      : sendToSinBin(side.squad, card.playerId, minute);
    if (!done) return;

    matchCards.push({ playerId: card.playerId, color: card.color, minute });
    // Le capitaine sanctionné, c'est le brassard qui s'en va aussi.
    noteCaptainDeparture(side);
  }

  /** Réintègre ceux dont les dix minutes sont écoulées. */
  function releaseSinBins(): void {
    const minute = Math.floor(sim.minute / 60);
    for (const side of [home, away]) returnFromSinBin(side.squad, minute);
  }

  // ---------------------------------------------------------------------------
  // Application d'un outcome
  // ---------------------------------------------------------------------------

  function applyOutcome(phaseType: PhaseType, outcome: PhaseOutcome): void {
    // V0.50 — l'élan se met à jour avant tout le reste : il doit refléter la
    // phase qui vient de se jouer, et le camp en possession n'a pas encore
    // changé à ce stade.
    sim.homeMomentum = advanceMomentum(
      sim.homeMomentum,
      momentumShift({
        phaseType,
        outcome,
        attackerBefore: sim.attacker,
        ...(lastScrumShift !== undefined ? { scrumDominanceShift: lastScrumShift } : {}),
      }),
      outcome.nextPhase,
    );
    lastScrumShift = undefined;

    // V0.52 — le carton, avant tout le reste : jouer à quatorze doit valoir dès
    // la phase suivante, et le sanctionné cesse immédiatement d'accumuler de la
    // fatigue et des minutes.
    applyCard(outcome);

    if (outcome.tryScored === 'HOME') sim.homeScore += 5;
    if (outcome.tryScored === 'AWAY') sim.awayScore += 5;
    if (outcome.tryScored) sim.lastScorer = outcome.tryScored;
    if (outcome.pointsScored) {
      if (outcome.pointsScored.team === 'HOME') sim.homeScore += outcome.pointsScored.value;
      else sim.awayScore += outcome.pointsScored.value;
      if (outcome.pointsScored.type === 'PENALTY' || outcome.pointsScored.type === 'DROP_GOAL') {
        sim.lastScorer = outcome.pointsScored.team;
      }
    }

    const cost = PHASE_FATIGUE_COST[phaseType];
    const attackerSide = sim.attacker === 'HOME' ? home : away;
    const defenderSide = sim.attacker === 'HOME' ? away : home;
    // V0.13 : la fatigue est portée par chaque joueur sur le terrain (modulée par
    // l'endurance et le rôle dans la phase), pas par un scalaire d'équipe.
    accrueFatigue(attackerSide.squad, phaseType, cost.att);
    accrueFatigue(defenderSide.squad, phaseType, cost.def);
    recoverBench(attackerSide.squad, cost.att);
    recoverBench(defenderSide.squad, cost.def);

    const deltaMinutes = PHASE_DURATION_SECONDS[phaseType] / 60;
    accrueMinutes(home.squad, deltaMinutes);
    accrueMinutes(away.squad, deltaMinutes);
    sim.minute += PHASE_DURATION_SECONDS[phaseType];

    // Les dix minutes se purgent sur la minute mise à jour : un carton pris à
    // la 30ᵉ rend son homme à la 40ᵉ, pas à la 39ᵉ.
    releaseSinBins();

    // V0.13 : remplacements automatiques. Le côté adverse (et le côté joueur en
    // mode batch) vide son banc selon une politique déterministe.
    runAutoSubstitutions();

    // Effets temporaires (live moment) — on décrémente après chaque phase
    tickTacticalBonus(home);
    tickTacticalBonus(away);

    let newAttacker: 'HOME' | 'AWAY';
    if (outcome.possessionAfter === 'CONTESTED') {
      newAttacker = rng.next() < 0.5 ? 'HOME' : 'AWAY';
    } else {
      newAttacker = outcome.possessionAfter;
    }

    if (newAttacker === sim.attacker) {
      sim.fieldPosition = clampField(sim.fieldPosition + outcome.metersGained);
      sim.phaseInPossession += 1;
    } else {
      sim.fieldPosition = clampField(-sim.fieldPosition + outcome.metersGained);
      sim.phaseInPossession = 0;
      sim.attacker = newAttacker;
    }

    if (outcome.nextPhase === 'KICKOFF') {
      sim.fieldPosition = -10;
      sim.phaseInPossession = 0;
      if (sim.lastScorer) {
        sim.attacker = sim.lastScorer;
      }
    }

    // -------------------------------------------------------------------------
    // V0.13 — entrée / sortie de la séquence de défense de ligne
    // -------------------------------------------------------------------------
    if (phaseType === 'GOAL_LINE' && outcome.nextPhase === 'GOAL_LINE') {
      // Le pilonnage continue : on incrémente l'attrition.
      sim.phasesAtLine += 1;
    } else {
      sim.phasesAtLine = 0;
    }

    // Un jeu courant qui aboutit à moins de 15 mètres bascule en pilonnage.
    // C'est le seul point d'entrée de GOAL_LINE : le reste du moteur ignore la zone.
    if (
      (outcome.nextPhase === 'OPEN_PLAY' || outcome.nextPhase === 'RUCK') &&
      sim.fieldPosition >= GOAL_LINE_THRESHOLD
    ) {
      nextPhaseOverride = 'GOAL_LINE';
    }
  }

  // ---------------------------------------------------------------------------
  // Boucle principale
  // ---------------------------------------------------------------------------

  function step(): void {
    const phaseType = nextPhaseType;
    const snapshot: MatchStateSnapshot = {
      minute: Math.floor(sim.minute / 60),
      homeScore: sim.homeScore,
      awayScore: sim.awayScore,
      possession: sim.attacker,
      fieldPosition: sim.fieldPosition,
      phaseInPossession: sim.phaseInPossession,
      homeFatigue: squadFatigue(home.squad),
      awayFatigue: squadFatigue(away.squad),
      homeMomentum: sim.homeMomentum,
    };
    const outcome = dispatchPhase(phaseType);
    phases.push({ index: phases.length, state: snapshot, type: phaseType, outcome });
    nextPhaseOverride = undefined;
    applyOutcome(phaseType, outcome);
    nextPhaseType = nextPhaseOverride ?? outcome.nextPhase;
  }

  function checkFinished(): void {
    if (sim.minute >= MATCH_DURATION_SECONDS || phases.length >= MAX_PHASES) {
      finished = true;
    }
  }

  /** Renvoie la décision pré-enregistrée pour ce moment, si elle existe. */
  function findPreloadedDecision(moment: LiveMoment): string | undefined {
    const match = preloadedDecisions.find(d => d.momentId === moment.id);
    return match?.optionId;
  }

  function advanceUntilDecisionOrEnd(): void {
    while (!finished && pendingMoment === undefined) {
      // Décision PRÉ-phase (pénalité HOME ambigüe)
      const pre = detectPreDecisionMoment();
      if (pre) {
        triggeredMoments.add(pre.type);
        const preloaded = findPreloadedDecision(pre);
        if (preloaded !== undefined) {
          // Auto-replay : on applique sans attendre l'utilisateur
          const opt = pre.options.find(o => o.id === preloaded);
          if (opt) {
            applyEffect(opt.effect);
            decisionLog.push({
              momentId: pre.id,
              momentType: pre.type,
              optionId: preloaded,
              atPhaseIndex: pre.atPhaseIndex,
              minute: pre.minute,
            });
            continue;
          }
        }
        pendingMoment = pre;
        return;
      }

      step();
      checkFinished();
      if (finished) return;

      // Décision POST-phase (mi-temps, fatigue, pression défensive, crunch time)
      const post = detectLiveMoment();
      if (post) {
        triggeredMoments.add(post.type);
        const preloaded = findPreloadedDecision(post);
        if (preloaded !== undefined) {
          const opt = post.options.find(o => o.id === preloaded);
          if (opt) {
            applyEffect(opt.effect);
            decisionLog.push({
              momentId: post.id,
              momentType: post.type,
              optionId: preloaded,
              atPhaseIndex: post.atPhaseIndex,
              minute: post.minute,
            });
            continue;
          }
        }
        pendingMoment = post;
        return;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // API publique
  // ---------------------------------------------------------------------------

  return {
    input,

    getState() {
      const status: MatchSessionState['status'] =
        finished ? 'finished' : pendingMoment ? 'awaiting-decision' : 'in-progress';
      return {
        status,
        phases,
        pendingMoment,
        lastTalk,
        homeScore: sim.homeScore,
        awayScore: sim.awayScore,
        minute: Math.floor(sim.minute / 60),
        homeFatigue: squadFatigue(home.squad),
        awayFatigue: squadFatigue(away.squad),
      };
    },

    advance() {
      if (finished) return;
      if (pendingMoment !== undefined) return;       // bloqué — il faut applyDecision
      advanceUntilDecisionOrEnd();
    },

    getLiveSquad(): LiveSquadView {
      const sq = playerRuntime.squad;
      const occupiedPositions = sq.slots.map(slot => slot.position);
      return {
        onField: sq.slots.map(slot => ({
          player: slot.player,
          position: slot.position,
          fatigue: playerFatigue(sq, slot.player.id),
          minutesPlayed: Math.max(0, Math.floor(sim.minute / 60) - slot.enteredAtMinute),
        })),
        bench: sq.bench.map(b => ({
          player: b.player,
          fatigue: playerFatigue(sq, b.player.id),
          // On n'affiche que les postes réellement occupés : proposer un poste
          // vacant n'aurait aucun sens, un XV est toujours complet.
          covers: occupiedPositions.filter(pos => canCover(b.player, pos)),
        })),
        sinBinned: sinBinned(sq).map(p => ({ id: p.id, lastName: p.lastName })),
        substitutionsUsed: sq.substitutions.length,
        substitutionsAllowed: MAX_SUBSTITUTIONS,
        uncontestedScrums: scrumsUncontested(sq),
      };
    },

    substitute(offPlayerId: PlayerId, onPlayerId: PlayerId): SubstitutionOutcome {
      if (finished) return { ok: false, reason: 'le match est terminé' };
      const outcome = applySubstitution(playerRuntime.squad, {
        offPlayerId,
        onPlayerId,
        minute: Math.floor(sim.minute / 60),
        reason: 'TACTIQUE',
      });
      // Sortir son capitaine se paie, même quand c'est un choix délibéré.
      noteCaptainDeparture(playerRuntime);
      return outcome;
    },

    setTacticalPlan(plan: PreMatchTacticalPlan) {
      // Le plan de semaine garde la main sur la touche : c'est un choix plus fin
      // que le focus « maul », et le manager l'a arrêté avant le coup d'envoi.
      currentPlayerPlan = plan;
      playerRuntime.tactics = resolveTactics(plan);
    },

    getTacticalPlan(): PreMatchTacticalPlan {
      return currentPlayerPlan;
    },

    applyDecision(optionId: string) {
      if (!pendingMoment) throw new Error('applyDecision: aucune décision en cours.');
      const opt: LiveMomentOption | undefined =
        pendingMoment.options.find(o => o.id === optionId);
      if (!opt) throw new Error(`applyDecision: option inconnue (${optionId})`);

      // V0.45 — la causerie ne se résout pas comme les autres moments : son
      // effet dépend du vestiaire et d'un tirage, il ne peut donc pas être
      // déclaré dans l'option. Le connaître d'avance en ferait un menu de bonus.
      if (pendingMoment.type === 'HALF_TIME') {
        const mine = playerSide === 'HOME' ? sim.homeScore : sim.awayScore;
        const theirs = playerSide === 'HOME' ? sim.awayScore : sim.homeScore;
        lastTalk = resolveTalk({
          tone: optionId as TalkTone,
          situation: situationFor(mine - theirs),
          room: dressingRoom(),
          rng: createRng(`talk_${input.matchId}_${phases.length}`),
        });
        applyEffect({
          ...opt.effect,
          tacticalBonus: lastTalk.tacticalBonus,
        });
        // Le moral bouge réellement : la causerie s'adresse à des hommes, et
        // ce moral est ce que lira la prochaine causerie.
        for (const slot of playerRuntime.squad.slots) {
          slot.player = {
            ...slot.player,
            dynamic: {
              ...slot.player.dynamic,
              mood: Math.max(0, Math.min(100, slot.player.dynamic.mood + lastTalk.moodDelta)),
            },
          };
        }
      } else {
        applyEffect(opt.effect);
      }
      decisionLog.push({
        momentId: pendingMoment.id,
        momentType: pendingMoment.type,
        optionId,
        atPhaseIndex: pendingMoment.atPhaseIndex,
        minute: pendingMoment.minute,
      });
      pendingMoment = undefined;
      advanceUntilDecisionOrEnd();
    },

    getDecisionLog() {
      return decisionLog;
    },

    getSubstitutions() {
      return { home: home.squad.substitutions, away: away.squad.substitutions };
    },

    getResult() {
      if (!finished) throw new Error('getResult: le match n\'est pas terminé.');
      const individualStats: ReadonlyMap<PlayerId, IndividualMatchStats> = computeIndividualStats(
        phases,
        input.playersById,
        [home.squad, away.squad],
      );
      const narrativeSummary = buildNarrativeSummary(
        phases,
        sim.homeScore,
        sim.awayScore,
        input.homeClub,
        input.awayClub,
        individualStats,
        input.playersById,
      );
      return {
        matchId: input.matchId,
        homeScore: sim.homeScore,
        awayScore: sim.awayScore,
        phases,
        individualStats,
        narrativeSummary,
        homeSubstitutions: home.squad.substitutions,
        awaySubstitutions: away.squad.substitutions,
        uncontestedScrums: scrumsUncontested(home.squad) || scrumsUncontested(away.squad),
        cardsIssued: matchCards,
        // V0.65 — ce que chaque camp a appelé en touche. La saison les cumule :
        // c'est ce cumul qui finit par se faire lire.
        homeLineoutCalls: home.matchCalls,
        awayLineoutCalls: away.matchCalls,
      };
    },
  };
}
