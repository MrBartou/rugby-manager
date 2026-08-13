/**
 * SeasonSaveRepository — sauvegarde d'une partie en cours (saison Top 14).
 *
 * V0.3 : snapshot de l'état (history + currentRound + playerClubId + seed).
 * V0.4 (V0.6 phase 1) : multi-saisons — currentSeason + playerOverrides.
 *   playerOverrides permet de persister les modifications du roster (retraites
 *   après rollover). Les saves 0.3.0 sans cette donnée sont migrés à la volée.
 */

import type { ClubId, Player } from '../engine/types.js';
import type { PlayedMatch, SeasonPlayerStat, SeasonState } from '../engine/game/season-session.js';
import type { CapRecord } from '../engine/season/national-team.js';
import type { PlayerCareer } from '../engine/season/player-career.js';
import type { ClubStanding } from '../engine/season/standings.js';
import type { ClubFinances } from '../engine/club/finances.js';
import type { CareerHistory } from '../engine/season/records.js';
import type { ManagerReputation } from '../engine/season/manager-reputation.js';
import type { BoardConfidence, SeasonObjective } from '../engine/season/board-objective.js';
import type { TrainingFocus } from '../engine/club/development.js';
import type { PlayerKnowledge } from '../engine/club/scouting.js';
import type { AiTransfer } from '../engine/club/ai-market.js';
import type { NewsItem } from '../engine/season/news.js';
import type { AcademyState, ProspectRecord } from '../engine/club/academy.js';
import type { ManagerStatus } from '../engine/season/manager-career.js';
import type { ManagerSeasonRecord } from '../engine/season/manager-record.js';
import type { Mail } from '../engine/season/mailbox.js';
import type { ManagerContract } from '../engine/season/contract-negotiation.js';
import type { DivisionState } from '../engine/season/divisions.js';
import type { StaffMember } from '../engine/club/staff.js';
import type { ClubFacilities, ClubPlan, OngoingProject } from '../engine/club/club-management.js';
import type { PlayerPromise, TransferRequest } from '../engine/human/player-talk.js';
import type { SquadStatus } from '../engine/club/squad-status.js';
import type { RivalManager } from '../engine/season/rival-managers.js';
import type { SeasonHonours } from '../engine/season/honours.js';
import type { ActiveLoan } from '../engine/club/loans.js';
import type { BoardExpectation } from '../engine/season/board-expectations.js';
import type { HeadToHead } from '../engine/season/rivalries.js';
import type { PlayerId } from '../engine/types.js';
import type { HumanEvent } from '../engine/human/events.js';
import type { EuropeanWorld } from '../engine/season/european-world.js';

/**
 * 0.5.0 — V0.31 : ajout des réglages d'entraînement, du scouting, des délais
 * d'offre et du fil de mercato. Une partie sauvegardée avant cette version
 * perdait tout cela au chargement : focus revenus à « équilibré », rapports de
 * scouting effacés, et délais après refus remis à zéro — il suffisait de
 * recharger pour reproposer une offre qu'un joueur venait de décliner.
 */
/**
 * 0.6.0 — V0.60 : le format avait cessé d'être versionné.
 *
 * Tout ce qui a été ajouté depuis la V0.32 (staff, direction du club, promesses,
 * capitaine, hiérarchie de l'effectif, rivaux, palmarès, prêts, attentes du
 * board, confrontations, retouches du groupe France, registre de carrière) est
 * entré dans la sauvegarde sous le tampon `0.5.0`. La migration ne pouvait donc
 * plus rien distinguer, et une sauvegarde écrite par une version postérieure du
 * jeu était chargée puis re-tamponnée sans le moindre contrôle.
 *
 * Ces champs sont tous facultatifs : une partie 0.5.0 se charge telle quelle,
 * la session repartant de ses valeurs par défaut pour ce qu'elle ne trouve pas.
 * Le numéro sert à savoir ce qu'on lit, pas à refuser de le lire.
 */
export const SEASON_SCHEMA_VERSION = '0.6.0';

/** Les versions de format que ce build sait ouvrir. */
const READABLE_SCHEMA_VERSIONS: readonly string[] = ['0.3.0', '0.4.0', '0.5.0', '0.6.0'];

/**
 * Vrai si la sauvegarde vient d'une version du jeu postérieure à celle-ci.
 *
 * La charger reviendrait à en perdre silencieusement tout ce qu'on ne sait pas
 * lire, puis à la réécrire amputée sous notre propre tampon.
 */
export function isFutureSchema(version: string | undefined): boolean {
  if (version === undefined) return false;
  return !READABLE_SCHEMA_VERSIONS.includes(version);
}

export interface SeasonSaveMeta {
  readonly saveId: string;
  readonly displayName: string;            // ex : "Toulouse — Saison 2025-26 (J12)"
  readonly savedAt: string;
  readonly schemaVersion: string;
  readonly playerClubId: ClubId;
  readonly seed: string;
  readonly currentRound: number;
  readonly currentSeason: number;          // V0.4 — saison en cours (ex: 2025 = 2025-26)
  readonly playerRank: number;
  readonly playerLeaguePoints: number;
  readonly champion?: ClubId;
}

export interface SeasonSave extends SeasonSaveMeta {
  readonly history: readonly PlayedMatch[];
  readonly standings: readonly ClubStanding[];   // serializé sous forme de tableau (Map non-JSON)
  readonly clubIds: readonly ClubId[];            // pour reconstruire la session
  /** V0.4 — joueurs modifiés (retraites, contrats à venir). Vide = utiliser le CSV. */
  readonly playerOverrides: readonly Player[];
  /**
   * V0.60 — retraités de longue date des données de base, réduits à leur
   * identifiant. Reconstruits au chargement : voir `pruneRetiredOverrides`.
   */
  readonly retiredSeedPlayerIds?: readonly PlayerId[];
  /** V0.6 — finances par club (sérialisé comme tableau de paires). */
  readonly financesByClub: readonly { readonly clubId: ClubId; readonly finances: ClubFinances }[];
  /** V0.9 — historique de carrière (records + palmarès). */
  readonly careerHistory: CareerHistory;
  /** V0.9 — réputation manager. */
  readonly managerReputation: ManagerReputation;
  /** V0.9 — objectif fixé par le board pour la saison en cours. */
  readonly objective: SeasonObjective;
  /** V0.9 — confiance du board envers le manager. */
  readonly boardConfidence: BoardConfidence;
  /**
   * V0.31 — état de club qui vivait uniquement en mémoire. Optionnel : les
   * sauvegardes antérieures restent lisibles, elles repartent simplement des
   * valeurs par défaut.
   */
  readonly trainingByPlayer?: readonly { readonly playerId: PlayerId; readonly focus: TrainingFocus }[];
  readonly scouting?: {
    readonly knowledge: readonly { readonly playerId: PlayerId; readonly knowledge: PlayerKnowledge }[];
    readonly assignments: readonly PlayerId[];
    /** V0.43 — clubs sous observation. */
    readonly clubAssignments?: readonly ClubId[];
  };
  readonly bidCooldowns?: readonly { readonly playerId: PlayerId; readonly untilRound: number }[];
  /** V0.37 — blessés dont le droit au joker médical est déjà consommé. */
  readonly jokersUsedFor?: readonly PlayerId[];
  /** Mouvements de la dernière fenêtre de mercato, pour l'onglet Mercato. */
  readonly aiMarket?: readonly AiTransfer[];
  /** Saison pour laquelle le mercato d'hiver a déjà été joué. */
  readonly winterMarketSeason?: number;
  /** V0.38 — journal du championnat. Une carrière sans mémoire n'est pas une carrière. */
  readonly news?: readonly NewsItem[];
  /** V0.39 — centre de formation : niveau acquis, investissement, orientation. */
  readonly academy?: AcademyState;
  /** V0.41 — statut du manager : en poste quelque part, ou libre. */
  readonly career?: ManagerStatus;
  /**
   * V0.42 — parcours du manager, saison par saison.
   *
   * Distinct de `careerHistory`, qui archive le championnat vu du club : depuis
   * que le manager change de banc, seul cet enregistrement dit **qui** a fait
   * quoi et où.
   */
  readonly managerSeasons?: readonly ManagerSeasonRecord[];
  /** V0.42 — correspondance reçue par le manager, non-lus compris. */
  readonly mailbox?: readonly Mail[];
  /** V0.43 — contrat négocié avec le président : durée, salaire, patience. */
  readonly managerContract?: ManagerContract;
  /** V0.43 — espoirs issus du centre, suivis nommément. */
  readonly prospects?: readonly ProspectRecord[];
  /**
   * V0.44 — répartition des clubs entre les deux étages.
   *
   * Sans elle, un rechargement remettrait tout le monde en Top 14 : le club
   * relégué la saison précédente réapparaîtrait dans l'élite, et le promu
   * disparaîtrait du championnat qu'on est en train de jouer.
   */
  readonly divisions?: DivisionState;
  /**
   * V0.44 — encadrement recruté.
   *
   * Sans lui, toute embauche disparaissait au rechargement : le staff était
   * regénéré depuis la réputation du club, comme si rien n'avait été signé.
   */
  readonly staff?: readonly StaffMember[];
  /**
   * V0.45 — suites de la commission, qui courent sur la saison en cours.
   *
   * Sans elles, un rechargement effacerait l'interdiction de recruter et la
   * récidive : il suffirait de recharger pour purger sa sanction.
   */
  readonly regulation?: {
    readonly sanctionedLastSeason: boolean;
    readonly transferBan: boolean;
    /** V0.47 — clubs déjà sanctionnés la saison passée, récidive comprise. */
    readonly repeatOffenders?: readonly ClubId[];
    /**
     * V0.60 — retraits de points en vigueur cette saison, par club.
     *
     * Ils étaient calculés à l'intersaison puis oubliés au rechargement. Le
     * classement, lui, portait bien la sanction : le club apparaissait à moins
     * six points sans que rien ne dise pourquoi.
     */
    readonly pointsPenaltyByClub?: readonly { readonly clubId: ClubId; readonly points: number }[];
  };
  /**
   * V0.62 — domaines confiés au staff.
   *
   * Choix de carrière et non préférence d'affichage : il suit la partie, et se
   * perd quand on change de club.
   */
  readonly delegation?: readonly string[];
  /**
   * V0.61 — joueurs gardés à l'œil, et le club qu'ils occupaient alors.
   *
   * Le club d'origine sert à signaler un départ : sans lui, un joueur suivi qui
   * change de club le fait dans le dos du manager.
   */
  readonly shortlist?: readonly { readonly playerId: PlayerId; readonly clubId: ClubId }[];
  /**
   * V0.60 — décisions humaines en attente au moment de la sauvegarde.
   *
   * Un conflit de vestiaire ouvert disparaissait au rechargement, avec la
   * décision qu'il appelait : la question se refermait sans réponse.
   */
  readonly pendingEvents?: readonly HumanEvent[];
  /**
   * V0.60 — bancs libres au moment de la sauvegarde.
   *
   * Sans eux, recharger effaçait la liste des clubs sans entraîneur : les
   * offres en attente disparaissaient, et les postes se pourvoyaient tout seuls
   * à la journée suivante.
   */
  readonly vacancies?: readonly ClubId[];
  /**
   * V0.48 — promesses en cours, avec le nombre de matchs déjà disputés au
   * moment où elles ont été faites. Sans cette référence, un rechargement
   * remettrait les compteurs à zéro et toute promesse deviendrait tenue.
   */
  readonly promises?: readonly {
    readonly promise: PlayerPromise;
    readonly baseline: number;
  }[];
  /**
   * V0.49 — demandes de départ ouvertes, et joueurs déjà placés sur la liste
   * des transferts. Sans elles, un rechargement effacerait l'affaire : il
   * suffirait de recharger pour que le joueur oublie qu'il voulait partir.
   */
  readonly transferRequests?: readonly TransferRequest[];
  /**
   * V0.50 — capitaine en titre. Sans lui, le brassard repartait à l'ouvreur à
   * chaque chargement, et le choix du manager s'effaçait.
   */
  readonly captainPlayerId?: PlayerId;
  /**
   * V0.50 — hiérarchie annoncée. Absente d'une sauvegarde antérieure : le
   * statut y reste déduit du temps de jeu, comme il l'a toujours été.
   */
  readonly squadStatuses?: readonly { readonly playerId: PlayerId; readonly status: SquadStatus }[];
  /**
   * V0.53 — le corps des entraîneurs rivaux, et qui tient quel banc.
   *
   * Sans lui, recharger une sauvegarde repeuplerait le championnat d'inconnus :
   * les carrières bâties sur dix saisons — limogeages, rebonds, réputations —
   * repartiraient de zéro.
   */
  readonly rivals?: {
    readonly managers: readonly RivalManager[];
    readonly byClub: readonly { readonly clubId: string; readonly managerId: string }[];
  };
  /** V0.53 — palmarès individuel de chaque saison écoulée. */
  readonly honours?: readonly SeasonHonours[];
  /** V0.55 — joueurs partis jouer ailleurs pour la saison en cours. */
  readonly loans?: readonly ActiveLoan[];
  /** V0.48 — mémoire des confrontations avec les rivaux. */
  readonly headToHead?: readonly { readonly clubId: ClubId; readonly record: HeadToHead }[];
  /** V0.48 — feuille de route du président pour la saison en cours. */
  readonly expectations?: readonly BoardExpectation[];
  /**
   * V0.58 — statistiques individuelles de la saison en cours.
   *
   * Elles n'étaient pas sauvegardées, et le défaut se propageait plus loin
   * qu'il n'y paraît : recharger une partie à la vingtième journée remettait
   * tout le monde à zéro match. Le classement des marqueurs se vidait, le
   * développement des jeunes perdait les minutes qui le pilotent depuis la
   * V0.14, les honneurs de fin de saison jugeaient sur une demi-saison, et le
   * temps de jeu qui alimente les rivalités (V0.56) repartait de zéro.
   *
   * Absentes d'une sauvegarde antérieure : on repart de la feuille blanche
   * qu'on avait de toute façon.
   */
  readonly playerStats?: readonly {
    readonly playerId: PlayerId;
    readonly stat: SeasonPlayerStat;
  }[];
  /** V0.58 — matchs du club dirigé déjà comptabilisés, dénominateur du temps de jeu. */
  readonly statsMatchCount?: number;
  /**
   * V0.58 — capes internationales, toutes saisons confondues.
   *
   * C'est la mémoire de la sélection : sans elle, une carrière internationale
   * bâtie sur huit saisons repartirait de zéro au premier rechargement, et
   * chaque Tournoi produirait une nouvelle fournée de « premières sélections ».
   */
  readonly caps?: readonly { readonly playerId: PlayerId; readonly record: CapRecord }[];
  /**
   * V0.59 — le registre de carrière, saison par saison.
   *
   * Remplace `careerHistory.playerCareerStats`, qui ne gardait qu'un cumul
   * d'essais et de matchs. Une sauvegarde antérieure porte encore l'ancien
   * champ : il est repris en une ligne unique au chargement, marquée pour ce
   * qu'elle est — un passé dont on ne connaît que la somme.
   */
  readonly careerBook?: readonly {
    readonly playerId: PlayerId;
    readonly career: PlayerCareer;
  }[];
  /**
   * V0.60 : retouches du sélectionneur sur le groupe France.
   *
   * Elles vivaient en mémoire vive seulement. Un manager qui composait son
   * groupe puis rechargeait retrouvait la liste du sélectionneur automatique,
   * sans trace de ses choix.
   */
  readonly nationalPicks?: {
    readonly added: readonly PlayerId[];
    readonly removed: readonly PlayerId[];
  };
  /**
   * V0.63 : le monde européen, ses trente-deux clubs, leur niveau et leur palmarès.
   *
   * Sans lui, l'Europe redeviendrait ce qu'elle était avant la V0.63 : quatre
   * inconnus régénérés chaque saison. Absent d'une sauvegarde antérieure : le
   * monde est alors créé au chargement, avec un palmarès vierge. On ne peut pas
   * inventer les vainqueurs des saisons déjà jouées.
   */
  readonly europeanWorld?: EuropeanWorld;
  /**
   * V0.63 : saison du premier jour de la carrière.
   *
   * Elle donne son âge aux joueurs des sélections étrangères : sans elle, les
   * All Blacks auraient vingt-deux ans à chaque saison.
   */
  readonly careerStartSeason?: number;
  /** V0.45 — installations, chantier en cours et politique commerciale. */
  readonly direction?: {
    readonly facilities: ClubFacilities;
    readonly plan: ClubPlan;
    readonly ongoing?: OngoingProject;
  };
}

export interface SeasonSaveRepository {
  list(): Promise<readonly SeasonSaveMeta[]>;
  load(saveId: string): Promise<SeasonSave | undefined>;
  save(save: SeasonSave): Promise<void>;
  delete(saveId: string): Promise<void>;
}

// =============================================================================
// localStorage impl
// =============================================================================

const STORAGE_KEY = 'rm_seasons_v0';

interface StorageShape {
  readonly version: string;
  readonly saves: Record<string, SeasonSave>;
}

/** Clé de la copie de secours, écrite avant tout écrasement. */
const BACKUP_KEY = `${STORAGE_KEY}_backup`;

/**
 * Parties illisibles rencontrées à la dernière lecture.
 *
 * Exposé pour que l'interface puisse le dire au joueur au lieu de faire comme
 * si ces parties n'avaient jamais existé.
 */
export interface StorageHealth {
  readonly corrupted: readonly string[];
  /** Vrai si le bloc entier est illisible, pas seulement une entrée. */
  readonly totalLoss: boolean;
  /**
   * Parties écrites par une version plus récente du jeu.
   *
   * Elles ne sont ni chargées ni touchées : les ouvrir amputerait tout ce que
   * ce build ne sait pas lire, et la sauvegarde suivante figerait la perte.
   */
  readonly fromFutureVersion: readonly string[];
}

const HEALTHY: StorageHealth = { corrupted: [], totalLoss: false, fromFutureVersion: [] };

let lastHealth: StorageHealth = HEALTHY;

/**
 * Entrées lues mais non chargées, gardées telles quelles.
 *
 * Une partie illisible ou écrite par une version postérieure du jeu ne doit pas
 * disparaître à la prochaine écriture : `save()` reconstruit le bloc à partir
 * de ce qu'il a su lire, et tout ce qui n'y figure pas serait effacé.
 */
let preservedEntries: Record<string, unknown> = {};

export function storageHealth(): StorageHealth {
  return lastHealth;
}

/**
 * Lecture défensive du stockage : v0.60.
 *
 * L'ancienne version avalait **toute** erreur dans un `catch` qui renvoyait un
 * objet vide. Une seule entrée mal formée faisait donc disparaître la totalité
 * des parties, et la sauvegarde automatique suivante réécrivait le bloc entier
 * par-dessus : la perte devenait définitive en une journée de jeu.
 *
 * On lit désormais **entrée par entrée**. Une partie illisible est mise de côté
 * et signalée, les autres sont chargées normalement. Rien n'est effacé.
 */
function readStorage(): StorageShape {
  const corrupted: string[] = [];
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    lastHealth = { ...HEALTHY, totalLoss: true };
    return { version: SEASON_SCHEMA_VERSION, saves: {} };
  }
  if (!raw) {
    lastHealth = HEALTHY;
    return { version: SEASON_SCHEMA_VERSION, saves: {} };
  }

  let parsed: Partial<StorageShape> | undefined;
  try {
    parsed = JSON.parse(raw) as Partial<StorageShape>;
  } catch {
    // Le bloc entier est illisible. On le signale, et surtout on ne le
    // remplace pas : la copie de secours reste la seule chance de le récupérer.
    lastHealth = { ...HEALTHY, totalLoss: true };
    return { version: SEASON_SCHEMA_VERSION, saves: {} };
  }

  const saves: Record<string, SeasonSave> = {};
  const fromFutureVersion: string[] = [];
  const preserved: Record<string, unknown> = {};
  for (const [id, s] of Object.entries(parsed?.saves ?? {})) {
    if (isFutureSchema((s as Partial<SeasonSave> | undefined)?.schemaVersion)) {
      fromFutureVersion.push(id);
      preserved[id] = s;
      continue;
    }
    try {
      const migrated = migrateSave(s);
      // Une entrée sans identifiant ni club n'est pas une partie : la charger
      // ferait planter l'écran de reprise plus loin, sans indice sur la cause.
      if (!migrated.saveId || !migrated.playerClubId) throw new Error('entrée incomplète');
      saves[id] = migrated;
    } catch {
      corrupted.push(id);
      preserved[id] = s;
    }
  }
  preservedEntries = preserved;
  lastHealth = { corrupted, totalLoss: false, fromFutureVersion };
  return { version: SEASON_SCHEMA_VERSION, saves };
}

/**
 * Migration des saves vers la version courante.
 *  - 0.3.0 → 0.4.0 : ajout de currentSeason, playerOverrides, financesByClub, careerHistory.
 *  - 0.4.0 → 0.4.0 (sans-history) : ajout de careerHistory si manquant.
 */
export function migrateSave(raw: unknown): SeasonSave {
  const r = raw as Partial<SeasonSave> & { schemaVersion?: string };
  const defaultReputation: ManagerReputation = { score: 30, titlesWon: 0, seasonsManaged: 0 };
  const defaultObjective: SeasonObjective = { kind: 'TOP_10', targetRank: 10, label: 'Top 10' };
  const defaultConfidence: BoardConfidence = { score: 60, consecutiveFailures: 0, fired: false };
  if (r.schemaVersion === '0.3.0' || r.schemaVersion === undefined) {
    return {
      ...(r as SeasonSave),
      schemaVersion: SEASON_SCHEMA_VERSION,
      currentSeason: r.currentSeason ?? 2025,
      playerOverrides: r.playerOverrides ?? [],
      financesByClub: r.financesByClub ?? [],
      careerHistory: r.careerHistory ?? { seasons: [] },
      managerReputation: r.managerReputation ?? defaultReputation,
      objective: r.objective ?? defaultObjective,
      boardConfidence: r.boardConfidence ?? defaultConfidence,
    };
  }
  // Compatibilité : un save 0.4.0 antérieur à V0.9 peut ne pas avoir tous les champs
  let merged = r as SeasonSave;
  if (!merged.careerHistory) merged = { ...merged, careerHistory: { seasons: [] } };
  if (!merged.managerReputation) merged = { ...merged, managerReputation: defaultReputation };
  if (!merged.objective) merged = { ...merged, objective: defaultObjective };
  if (!merged.boardConfidence) merged = { ...merged, boardConfidence: defaultConfidence };

  // 0.4.0 → 0.5.0 : entraînement, scouting, délais d'offre et fil de mercato
  // restent absents. Ils sont optionnels et la session repart de ses valeurs
  // par défaut — il n'y a rien à reconstituer, seulement à ne pas planter.
  return { ...merged, schemaVersion: SEASON_SCHEMA_VERSION };
}

/**
 * L'élagage des retraités : v0.60.
 *
 * `playerOverrides` porte la base joueurs entière, et les retraités y restaient
 * à vie. Un joueur pèse environ 880 octets une fois sérialisé ; vingt saisons de
 * retraites et de générations de jeunes suffisaient à faire dériver la
 * sauvegarde vers le quota de `localStorage`, cinq mégaoctets pour toutes les
 * parties confondues. La partie mourait alors d'un stockage plein, sans que le
 * joueur ait rien fait de particulier.
 *
 * Deux sorts, selon d'où vient le joueur.
 *
 * - **Il figure dans les données de base** : on ne garde que son identifiant,
 *   huit octets au lieu de huit cents. Au chargement, il est reconstruit depuis
 *   ces données et remarqué comme retraité.
 * - **Il a été généré en cours de partie** (jeune du centre de formation) : rien
 *   ne permettrait de le reconstruire, mais rien n'y renvoie non plus. Il sort
 *   de la sauvegarde. Ce qu'il a fait sur le terrain reste au registre de
 *   carrière, qui garde ses propres lignes et son nom.
 *
 * Le délai de grâce évite de toucher aux retraites récentes, qui s'affichent
 * encore dans le bilan d'intersaison.
 */
export const RETIREMENT_GRACE_SEASONS = 3;

export interface PrunedOverrides {
  readonly overrides: readonly Player[];
  /** Retraités des données de base, réduits à leur identifiant. */
  readonly retiredSeedPlayerIds: readonly PlayerId[];
}

export function pruneRetiredOverrides(
  overrides: readonly Player[],
  currentSeason: number,
  isSeedPlayer: (playerId: PlayerId) => boolean,
): PrunedOverrides {
  const kept: Player[] = [];
  const retiredSeedPlayerIds: PlayerId[] = [];
  for (const p of overrides) {
    const retiredLongAgo = p.retired === true
      && p.retirementSeason !== undefined
      && currentSeason - p.retirementSeason >= RETIREMENT_GRACE_SEASONS;
    if (!retiredLongAgo) {
      kept.push(p);
      continue;
    }
    if (isSeedPlayer(p.id)) retiredSeedPlayerIds.push(p.id);
  }
  return { overrides: kept, retiredSeedPlayerIds };
}

/**
 * Erreur d'écriture, avec une cause exploitable par l'interface : v0.60.
 *
 * `QuotaExceededError` était avalé et rendu au joueur sous la forme d'un
 * « Échec de la sauvegarde » sans cause ni remède, alors que le dépôt des
 * matchs, lui, le gérait déjà.
 */
export class SaveWriteError extends Error {
  constructor(
    readonly cause_: 'QUOTA' | 'INDISPONIBLE',
    message: string,
  ) {
    super(message);
    this.name = 'SaveWriteError';
  }
}

function isQuotaError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  return e.name === 'QuotaExceededError'
    || e.name === 'NS_ERROR_DOM_QUOTA_REACHED';
}

/**
 * Écriture protégée par une copie de secours.
 *
 * On conserve l'état précédent avant d'écraser. Si l'écriture échoue à
 * mi-chemin ou si le contenu se révèle illisible ensuite, il reste quelque
 * chose à récupérer.
 */
function writeStorage(s: StorageShape): void {
  const payload = JSON.stringify({
    ...s,
    // Ce qu'on n'a pas su lire repart tel quel : on ne réécrit jamais le bloc
    // en n'y remettant que ce qu'on a compris.
    saves: { ...preservedEntries, ...s.saves },
  });
  try {
    const previous = localStorage.getItem(STORAGE_KEY);
    if (previous) localStorage.setItem(BACKUP_KEY, previous);
  } catch {
    // Pas de copie de secours possible : on tente quand même l'écriture, mais
    // on ne masque pas l'échec s'il vient ensuite.
  }

  try {
    localStorage.setItem(STORAGE_KEY, payload);
  } catch (e) {
    if (isQuotaError(e)) {
      throw new SaveWriteError(
        'QUOTA',
        'Stockage plein. Supprimez une partie ancienne pour libérer de la place.',
      );
    }
    throw new SaveWriteError('INDISPONIBLE', 'Le stockage du navigateur est inaccessible.');
  }
}

/**
 * Restaure la copie de secours prise avant la dernière écriture.
 *
 * Dernier recours quand le bloc principal est illisible. Renvoie le nombre de
 * parties récupérées, zéro s'il n'y a rien à récupérer.
 */
export function restoreBackup(): number {
  try {
    const backup = localStorage.getItem(BACKUP_KEY);
    if (!backup) return 0;
    const parsed = JSON.parse(backup) as Partial<StorageShape>;
    const count = Object.keys(parsed?.saves ?? {}).length;
    if (count === 0) return 0;
    localStorage.setItem(STORAGE_KEY, backup);
    return count;
  } catch {
    return 0;
  }
}

class LocalStorageSeasonRepository implements SeasonSaveRepository {
  async list(): Promise<readonly SeasonSaveMeta[]> {
    const data = readStorage();
    return Object.values(data.saves)
      .map(s => ({
        saveId: s.saveId,
        displayName: s.displayName,
        savedAt: s.savedAt,
        schemaVersion: s.schemaVersion,
        playerClubId: s.playerClubId,
        seed: s.seed,
        currentRound: s.currentRound,
        currentSeason: s.currentSeason,
        playerRank: s.playerRank,
        playerLeaguePoints: s.playerLeaguePoints,
        ...(s.champion !== undefined ? { champion: s.champion } : {}),
      }))
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }

  async load(saveId: string): Promise<SeasonSave | undefined> {
    return readStorage().saves[saveId];
  }

  async save(save: SeasonSave): Promise<void> {
    const data = readStorage();
    writeStorage({ version: SEASON_SCHEMA_VERSION, saves: { ...data.saves, [save.saveId]: save } });
  }

  async delete(saveId: string): Promise<void> {
    const data = readStorage();
    if (!(saveId in data.saves)) return;
    const next = { ...data.saves };
    delete next[saveId];
    writeStorage({ version: SEASON_SCHEMA_VERSION, saves: next });
  }
}

export const seasonSaveRepository: SeasonSaveRepository = new LocalStorageSeasonRepository();

// =============================================================================
// Helpers
// =============================================================================

export function generateSeasonSaveId(): string {
  return `season_${Date.now()}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** Construit un SeasonSave à partir de l'état courant. */
export function buildSeasonSaveFromState(
  saveId: string,
  state: SeasonState,
  seed: string,
  clubIds: readonly ClubId[],
  displayName: string,
  playerOverrides: readonly Player[] = [],
  careerHistory: CareerHistory = { seasons: [] },
  managerReputation: ManagerReputation = { score: 30, titlesWon: 0, seasonsManaged: 0 },
  objective: SeasonObjective = { kind: 'TOP_10', targetRank: 10, label: 'Top 10' },
  boardConfidence: BoardConfidence = { score: 60, consecutiveFailures: 0, fired: false },
  extras: {
    readonly aiMarket?: readonly AiTransfer[];
    readonly winterMarketSeason?: number;
    readonly news?: readonly NewsItem[];
    readonly academy?: AcademyState;
    readonly career?: ManagerStatus;
    readonly managerSeasons?: readonly ManagerSeasonRecord[];
    readonly mailbox?: readonly Mail[];
    readonly managerContract?: ManagerContract;
    readonly prospects?: readonly ProspectRecord[];
    readonly divisions?: DivisionState;
    readonly regulation?: {
      readonly sanctionedLastSeason: boolean;
      readonly transferBan: boolean;
      readonly repeatOffenders?: readonly ClubId[];
      readonly pointsPenaltyByClub?: readonly { readonly clubId: ClubId; readonly points: number }[];
    };
    /** V0.60 — bancs libres. */
    readonly vacancies?: readonly ClubId[];
    /** V0.60 — décisions humaines en attente. */
    readonly pendingEvents?: readonly HumanEvent[];
    /** V0.61 — liste de suivi. */
    readonly shortlist?: readonly { readonly playerId: PlayerId; readonly clubId: ClubId }[];
    /** V0.62 — domaines confiés au staff. */
    readonly delegation?: readonly string[];
    readonly direction?: {
      readonly facilities: ClubFacilities;
      readonly plan: ClubPlan;
      readonly ongoing?: OngoingProject;
    };
    readonly promises?: readonly {
      readonly promise: PlayerPromise;
      readonly baseline: number;
    }[];
    readonly transferRequests?: readonly TransferRequest[];
    readonly captainPlayerId?: PlayerId;
    readonly squadStatuses?: readonly { readonly playerId: PlayerId; readonly status: SquadStatus }[];
    readonly rivals?: {
      readonly managers: readonly RivalManager[];
      readonly byClub: readonly { readonly clubId: string; readonly managerId: string }[];
    };
    readonly honours?: readonly SeasonHonours[];
    readonly loans?: readonly ActiveLoan[];
    readonly expectations?: readonly BoardExpectation[];
    readonly headToHead?: readonly { readonly clubId: ClubId; readonly record: HeadToHead }[];
    /** V0.59 — registre de carrière des joueurs, saison par saison. */
    readonly careerBook?: readonly {
      readonly playerId: PlayerId;
      readonly career: PlayerCareer;
    }[];
    /** V0.60 — retraités de longue date, réduits à leur identifiant. */
    readonly retiredSeedPlayerIds?: readonly PlayerId[];
    /** V0.60 — retouches du sélectionneur sur le groupe France. */
    readonly nationalPicks?: {
      readonly added: readonly PlayerId[];
      readonly removed: readonly PlayerId[];
    };
    /** V0.63 : le monde européen persistant et son palmarès. */
    readonly europeanWorld?: EuropeanWorld;
    /** V0.63 : saison du début de carrière. */
    readonly careerStartSeason?: number;
  } = {},
): SeasonSave {
  const ranked = [...state.standings.values()].sort((a, b) => {
    if (b.leaguePoints !== a.leaguePoints) return b.leaguePoints - a.leaguePoints;
    return (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst);
  });
  const playerRank = ranked.findIndex(r => r.clubId === state.playerClubId) + 1;
  const playerStanding = state.standings.get(state.playerClubId);

  return {
    saveId,
    displayName,
    savedAt: new Date().toISOString(),
    schemaVersion: SEASON_SCHEMA_VERSION,
    playerClubId: state.playerClubId,
    seed,
    currentRound: state.currentRound,
    currentSeason: state.currentSeason,
    playerRank: playerRank > 0 ? playerRank : 0,
    playerLeaguePoints: playerStanding?.leaguePoints ?? 0,
    ...(state.champion !== undefined ? { champion: state.champion } : {}),
    history: state.history,
    standings: [...state.standings.values()],
    clubIds,
    playerOverrides,
    ...(extras.retiredSeedPlayerIds ? { retiredSeedPlayerIds: extras.retiredSeedPlayerIds } : {}),
    ...(extras.vacancies !== undefined ? { vacancies: extras.vacancies } : {}),
    ...(extras.pendingEvents !== undefined ? { pendingEvents: extras.pendingEvents } : {}),
    ...(extras.shortlist !== undefined ? { shortlist: extras.shortlist } : {}),
    ...(extras.delegation !== undefined ? { delegation: extras.delegation } : {}),
    financesByClub: [...state.financesByClub.entries()].map(([clubId, finances]) => ({ clubId, finances })),
    careerHistory,
    managerReputation,
    objective,
    boardConfidence,
    trainingByPlayer: [...state.trainingByPlayer].map(([playerId, focus]) => ({ playerId, focus })),
    scouting: {
      knowledge: [...state.scouting.knowledge].map(([playerId, knowledge]) => ({ playerId, knowledge })),
      assignments: [...state.scouting.assignments],
      clubAssignments: [...(state.scouting.clubAssignments ?? [])],
    },
    bidCooldowns: [...state.bidCooldowns].map(([playerId, untilRound]) => ({ playerId, untilRound })),
    jokersUsedFor: [...state.jokersUsedFor],
    // V0.58 — la saison en cours garde ses statistiques, et le compteur de
    // matchs qui leur sert de dénominateur.
    playerStats: [...state.seasonPlayerStats].map(([playerId, stat]) => ({ playerId, stat })),
    statsMatchCount: state.statsMatchCount,
    caps: [...state.caps].map(([playerId, record]) => ({ playerId, record })),
    ...(extras.aiMarket !== undefined ? { aiMarket: extras.aiMarket } : {}),
    ...(extras.winterMarketSeason !== undefined ? { winterMarketSeason: extras.winterMarketSeason } : {}),
    ...(extras.news !== undefined ? { news: extras.news } : {}),
    ...(extras.academy !== undefined ? { academy: extras.academy } : {}),
    ...(extras.career !== undefined ? { career: extras.career } : {}),
    ...(extras.managerSeasons !== undefined ? { managerSeasons: extras.managerSeasons } : {}),
    ...(extras.mailbox !== undefined ? { mailbox: extras.mailbox } : {}),
    ...(extras.managerContract !== undefined ? { managerContract: extras.managerContract } : {}),
    ...(extras.prospects !== undefined ? { prospects: extras.prospects } : {}),
    ...(extras.divisions !== undefined ? { divisions: extras.divisions } : {}),
    staff: state.staff,
    ...(extras.regulation !== undefined ? { regulation: extras.regulation } : {}),
    ...(extras.direction !== undefined ? { direction: extras.direction } : {}),
    ...(extras.promises !== undefined ? { promises: extras.promises } : {}),
    ...(extras.transferRequests !== undefined ? { transferRequests: extras.transferRequests } : {}),
    ...(extras.captainPlayerId !== undefined ? { captainPlayerId: extras.captainPlayerId } : {}),
    ...(extras.squadStatuses !== undefined ? { squadStatuses: extras.squadStatuses } : {}),
    ...(extras.rivals !== undefined ? { rivals: extras.rivals } : {}),
    ...(extras.careerBook !== undefined ? { careerBook: extras.careerBook } : {}),
    ...(extras.nationalPicks !== undefined ? { nationalPicks: extras.nationalPicks } : {}),
    ...(extras.honours !== undefined ? { honours: extras.honours } : {}),
    ...(extras.loans !== undefined ? { loans: extras.loans } : {}),
    ...(extras.expectations !== undefined ? { expectations: extras.expectations } : {}),
    ...(extras.headToHead !== undefined ? { headToHead: extras.headToHead } : {}),
    ...(extras.europeanWorld !== undefined ? { europeanWorld: extras.europeanWorld } : {}),
    ...(extras.careerStartSeason !== undefined ? { careerStartSeason: extras.careerStartSeason } : {}),
  };
}
